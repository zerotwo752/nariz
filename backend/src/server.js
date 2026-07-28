require('./env');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { pool } = require('./db');
const { ensureDatabase } = require('./initDb');
const { quoteDesign, assistantReply } = require('./gemini');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024 } });
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || '*' }));
app.set('trust proxy', true);
app.use(express.json({ limit: '2mb' }));


function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), candidate);
}

function sign(user) {
  return jwt.sign({ id: user.id, dni: user.dni, role: user.role_code }, JWT_SECRET, { expiresIn: '7d' });
}

function addMinutes(date, minutes) { return new Date(date.getTime() + minutes * 60000); }
function toMinutes(time) { const [h, m] = String(time).slice(0,5).split(':').map(Number); return h * 60 + m; }
function timeFromMinutes(minutes) { return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; }
function normalizeText(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function nameParts(fullName) { return normalizeText(fullName).trim().split(/\s+/).filter(Boolean); }
function generateWorkerPassword(fullName, birthDate) {
  const parts = nameParts(fullName);
  const lastName = parts.length > 1 ? parts[parts.length - 1] : parts[0];
  const cleanLastName = String(lastName || 'Salon').replace(/[^a-z0-9]/gi, '') || 'Salon';
  const prettyLastName = `${cleanLastName.charAt(0).toUpperCase()}${cleanLastName.slice(1).toLowerCase()}`;
  const dateNumbers = String(birthDate || '').replace(/\D/g, '');
  return `${prettyLastName}${dateNumbers.slice(-6)}`;
}
function workerUsernameBase(fullName) {
  const parts = nameParts(fullName).map(part => part.replace(/[^a-z0-9]/gi, '').toLowerCase()).filter(Boolean);
  const firstName = parts[0] || 'trabajadora';
  const secondName = parts[1] || '';
  return `${firstName}${secondName}`.slice(0, 12) || crypto.randomBytes(4).toString('hex');
}
async function generateWorkerUsername(fullName) {
  const base = workerUsernameBase(fullName);
  for (let i = 0; i < 100; i++) {
    const suffix = i === 0 ? '' : String(i + 1);
    const candidate = `${base.slice(0, 12 - suffix.length)}${suffix}`;
    const exists = await pool.query('select 1 from users where lower(dni)=lower($1)', [candidate]);
    if (!exists.rowCount) return candidate;
  }
  return `${base.slice(0, 8)}${crypto.randomBytes(2).toString('hex')}`;
}
function slugify(value) { return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || crypto.randomBytes(4).toString('hex'); }
function publicUser(user) { return { id: user.id, dni: user.dni, full_name: user.full_name, role: user.role_code, loyalty_points: user.loyalty_points, is_active: user.is_active }; }

function orderStatusForPayment(method) {
  const code = String(method?.code || '').toLowerCase();
  return code.includes('cash') || code.includes('local') || code.includes('tienda') ? 'pending' : 'paid';
}
function generateOrderCode() { return `NB-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`; }
function normalizeOrder(row) { return { ...row, items: Array.isArray(row.items) ? row.items : [] }; }
function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return (forwarded || req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
}
function lateText(seconds) {
  const total = Math.max(0, Number(seconds || 0));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${String(minutes).padStart(2, '0')} min ${String(rest).padStart(2, '0')} seg`;
}
async function attendanceSettings(req) {
  const currentIp = clientIp(req);
  const row = (await pool.query('select value from app_settings where key=$1', ['attendance_allowed_ip'])).rows[0];
  return { currentIp, allowedIp: row?.value || null };
}


function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'No tienes permisos para esta acción' });
    next();
  };
}

function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); } catch { res.status(401).json({ error: 'Token inválido' }); }
}

app.get('/health', (_, res) => res.json({ ok: true, service: 'Nail Beauty API' }));
app.get('/api/services', async (_, res) => {
  const result = await pool.query(`select s.id, s.name, s.description, s.base_price as price, s.duration_minutes as duration, s.category, s.category_id, c.name as category_name, s.image_url
    from services s left join categories c on c.id=s.category_id where s.is_active=true order by c.name, s.name`);
  res.json(result.rows);
});

app.get('/api/categories', async (_, res) => {
  const result = await pool.query('select * from categories where is_active=true order by name');
  res.json(result.rows);
});

app.get('/api/payment-methods', async (_, res) => {
  const result = await pool.query('select id, code, name, provider, requires_reference from payment_methods where is_active=true order by id');
  res.json(result.rows);
});


app.get('/api/products', async (_, res) => {
  const result = await pool.query('select id, sku, name, description, category, price, stock, image_url from products where is_active=true order by category, name');
  res.json(result.rows);
});

app.get('/api/admin/products', auth, requireRole('SA', 'OWNER'), async (_, res) => {
  const result = await pool.query('select * from products where is_active=true order by created_at desc');
  res.json(result.rows);
});

app.post('/api/admin/products', auth, requireRole('SA', 'OWNER'), upload.single('image'), async (req, res) => {
  const { name, description, category = 'Tienda', price, stock = 0 } = req.body;
  if (!name || price === undefined || price === '') return res.status(400).json({ error: 'Nombre y precio son obligatorios' });
  if (Number(price) < 0 || Number(stock) < 0) return res.status(400).json({ error: 'Precio y stock no pueden ser negativos' });
  const sku = `${slugify(name).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const imageUrl = req.file ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` : null;
  const result = await pool.query('insert into products (sku,name,description,category,price,stock,image_url) values ($1,$2,$3,$4,$5,$6,$7) returning *', [sku, name, description || null, category || 'Tienda', price, stock, imageUrl]);
  res.status(201).json(result.rows[0]);
});

app.patch('/api/admin/products/:id', auth, requireRole('SA', 'OWNER'), upload.single('image'), async (req, res) => {
  const { name, description, category, price, stock, isActive } = req.body;
  const current = await pool.query('select * from products where id=$1', [req.params.id]);
  if (!current.rowCount) return res.status(404).json({ error: 'Producto no encontrado' });
  if ((price !== undefined && price !== '' && Number(price) < 0) || (stock !== undefined && stock !== '' && Number(stock) < 0)) return res.status(400).json({ error: 'Precio y stock no pueden ser negativos' });
  const imageUrl = req.file ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` : null;
  const activeValue = typeof isActive === 'boolean' ? isActive : (isActive === 'false' ? false : null);
  const result = await pool.query(`update products set name=coalesce($1,name), description=coalesce($2,description), category=coalesce($3,category), price=coalesce($4,price), stock=coalesce($5,stock), image_url=coalesce($6,image_url), is_active=coalesce($7,is_active), updated_at=now() where id=$8 returning *`, [name || null, description || null, category || null, price === undefined || price === '' ? null : price, stock === undefined || stock === '' ? null : stock, imageUrl, activeValue, req.params.id]);
  res.json(result.rows[0]);
});

app.delete('/api/admin/products/:id', auth, requireRole('SA', 'OWNER'), async (req, res) => {
  const result = await pool.query('update products set is_active=false, updated_at=now() where id=$1 returning *', [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json({ ok: true });
});

app.get('/api/store/orders', auth, async (req, res) => {
  const isAdmin = req.user.role === 'SA' || req.user.role === 'OWNER';
  const isWorker = req.user.role === 'WORKER';
  const result = await pool.query(`select o.*, u.full_name as customer_name, pm.name as payment_method, dw.full_name as delivered_by_name,
      coalesce(json_agg(json_build_object('id', i.id, 'product_id', i.product_id, 'product_name', i.product_name, 'unit_price', i.unit_price, 'quantity', i.quantity, 'subtotal', i.subtotal) order by i.id) filter (where i.id is not null), '[]') as items
    from product_orders o join users u on u.id=o.user_id left join payment_methods pm on pm.id=o.payment_method_id left join users dw on dw.id=o.delivered_by left join product_order_items i on i.order_id=o.id
    where ($1::boolean or $2::boolean or o.user_id=$3)
    group by o.id, u.full_name, pm.name, dw.full_name order by o.created_at desc`, [isAdmin, isWorker, req.user.id]);
  res.json(result.rows.map(normalizeOrder));
});

app.post('/api/store/orders', auth, async (req, res) => {
  const { items = [], paymentMethodId, paymentReference } = req.body;
  if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Agrega al menos un producto' });
  if (!paymentMethodId) return res.status(400).json({ error: 'Selecciona un método de pago' });
  const client = await pool.connect();
  try {
    await client.query('begin');
    const method = (await client.query('select * from payment_methods where id=$1 and is_active=true', [paymentMethodId])).rows[0];
    if (!method) throw Object.assign(new Error('Método de pago no encontrado'), { status: 404 });
    let total = 0; const orderItems = [];
    for (const item of items) {
      const qty = Math.max(1, Number(item.quantity || 1));
      const product = (await client.query('select * from products where id=$1 and is_active=true for update', [item.productId])).rows[0];
      if (!product) throw Object.assign(new Error('Producto no encontrado'), { status: 404 });
      if (Number(product.stock) < qty) throw Object.assign(new Error(`Stock insuficiente para ${product.name}`), { status: 409 });
      const subtotal = Number(product.price) * qty; total += subtotal;
      orderItems.push({ product, qty, subtotal });
      await client.query('update products set stock=stock-$1, updated_at=now() where id=$2', [qty, product.id]);
    }
    let code; for (let i=0;i<5;i++){ const candidate=generateOrderCode(); const exists=await client.query('select 1 from product_orders where code=$1',[candidate]); if(!exists.rowCount){ code=candidate; break; } }
    if (!code) throw new Error('No se pudo generar el código de compra');
    const status = orderStatusForPayment(method);
    const order = (await client.query('insert into product_orders (code,user_id,payment_method_id,total,status,payment_reference,paid_at) values ($1,$2,$3,$4,$5,$6,case when $5=$$paid$$ then now() else null end) returning *', [code, req.user.id, paymentMethodId, total, status, paymentReference || null])).rows[0];
    for (const oi of orderItems) await client.query('insert into product_order_items (order_id,product_id,product_name,unit_price,quantity,subtotal) values ($1,$2,$3,$4,$5,$6)', [order.id, oi.product.id, oi.product.name, oi.product.price, oi.qty, oi.subtotal]);
    await client.query('commit');
    res.status(201).json(order);
  } catch (e) { await client.query('rollback'); res.status(e.status || 500).json({ error: e.message || 'No se pudo crear la compra' }); }
  finally { client.release(); }
});

app.post('/api/store/orders/:code/deliver', auth, requireRole('SA', 'OWNER', 'WORKER'), async (req, res) => {
  const result = await pool.query(`update product_orders set status='delivered', delivered_by=$1, delivered_at=now() where upper(code)=upper($2) and status <> 'cancelled' returning *`, [req.user.id, req.params.code]);
  if (!result.rowCount) return res.status(404).json({ error: 'Compra no encontrada o cancelada' });
  res.json(result.rows[0]);
});

app.get('/api/specialists', async (req, res) => {
  const { serviceId, categoryId } = req.query;
  const result = await pool.query(`select sp.id, sp.full_name, sp.phone, sp.email, sp.bio, sp.work_start, sp.work_end,
      coalesce(json_agg(distinct jsonb_build_object('id', c.id, 'name', c.name)) filter (where c.id is not null), '[]') as categories
    from specialists sp
    left join specialist_categories sc on sc.specialist_id=sp.id
    left join categories c on c.id=sc.category_id
    where sp.is_active=true and ($1::varchar is null or exists (select 1 from services svc where svc.id=$1 and svc.category_id=c.id)) and ($2::bigint is null or c.id=$2)
    group by sp.id order by sp.full_name`, [serviceId || null, categoryId || null]);
  res.json(result.rows);
});


app.get('/api/admin/workers', auth, requireRole('SA', 'OWNER'), async (_, res) => {
  const result = await pool.query(`select sp.*, u.dni, u.birth_date, u.plain_password, u.is_active as user_active,
      coalesce(json_agg(distinct jsonb_build_object('id', c.id, 'name', c.name)) filter (where c.id is not null), '[]') as categories
    from specialists sp join users u on u.id=sp.user_id
    left join specialist_categories sc on sc.specialist_id=sp.id left join categories c on c.id=sc.category_id
    group by sp.id, u.dni, u.birth_date, u.plain_password, u.is_active order by sp.full_name`);
  res.json(result.rows);
});

app.post('/api/admin/workers', auth, requireRole('SA', 'OWNER'), async (req, res) => {
  const { fullName, birthDate, phone, email, workStart = '09:00', workEnd = '18:00', categoryIds = [] } = req.body;
  if (!fullName || !birthDate || !phone) return res.status(400).json({ error: 'Nombre, fecha de nacimiento y celular son obligatorios' });
  const password = generateWorkerPassword(fullName, birthDate);
  const dni = await generateWorkerUsername(fullName);
  const userResult = await pool.query(`insert into users (dni, full_name, birth_date, phone, email, password_hash, plain_password, role_code) values ($1,$2,$3,$4,$5,$6,$7,'WORKER') returning *`, [dni, fullName, birthDate, phone, email || null, hashPassword(password), password]);
  const spResult = await pool.query(`insert into specialists (user_id, full_name, phone, email, work_start, work_end) values ($1,$2,$3,$4,$5,$6) returning *`, [userResult.rows[0].id, fullName, phone, email || null, workStart, workEnd]);
  for (const id of categoryIds) await pool.query('insert into specialist_categories (specialist_id, category_id) values ($1,$2) on conflict do nothing', [spResult.rows[0].id, id]);
  res.status(201).json({ ...spResult.rows[0], dni, plain_password: password });
});

app.patch('/api/admin/workers/:id', auth, requireRole('SA', 'OWNER'), async (req, res) => {
  const { fullName, birthDate, phone, email, workStart, workEnd, isActive, categoryIds } = req.body;
  const current = await pool.query('select * from specialists where id=$1', [req.params.id]);
  if (!current.rowCount) return res.status(404).json({ error: 'Trabajadora no encontrada' });
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await client.query(`update specialists set full_name=coalesce($1,full_name), phone=coalesce($2,phone), email=coalesce($3,email), work_start=coalesce($4,work_start), work_end=coalesce($5,work_end), is_active=coalesce($6,is_active) where id=$7 returning *`, [fullName || null, phone || null, email || null, workStart || null, workEnd || null, typeof isActive === 'boolean' ? isActive : null, req.params.id]);
    await client.query('update users set full_name=$1, birth_date=coalesce($2,birth_date), phone=$3, email=$4, is_active=$5 where id=$6', [result.rows[0].full_name, birthDate || null, result.rows[0].phone, result.rows[0].email, result.rows[0].is_active, result.rows[0].user_id]);
    if (Array.isArray(categoryIds)) {
      const cleanCategoryIds = [...new Set(categoryIds.map(Number).filter(Number.isInteger))];
      await client.query('delete from specialist_categories where specialist_id=$1', [req.params.id]);
      for (const id of cleanCategoryIds) await client.query('insert into specialist_categories (specialist_id, category_id) values ($1,$2) on conflict do nothing', [req.params.id, id]);
    }
    await client.query('commit');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
});

app.post('/api/admin/categories', auth, requireRole('SA', 'OWNER'), async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre de categoría obligatorio' });
  const result = await pool.query('insert into categories (name, description) values ($1,$2) on conflict (name) do update set description=excluded.description, is_active=true returning *', [name, description || null]);
  res.status(201).json(result.rows[0]);
});

app.patch('/api/admin/categories/:id', auth, requireRole('SA', 'OWNER'), async (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Nombre de categoría obligatorio' });
  const result = await pool.query('update categories set name=$1, description=$2, is_active=true where id=$3 returning *', [name, description || null, req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Categoría no encontrada' });
  await pool.query('update services set category=$1 where category_id=$2', [result.rows[0].name, req.params.id]);
  res.json(result.rows[0]);
});

app.delete('/api/admin/categories/:id', auth, requireRole('SA', 'OWNER'), async (req, res) => {
  const linked = await pool.query('select count(*)::int as count from services where category_id=$1 and is_active=true', [req.params.id]);
  if (linked.rows[0].count > 0) return res.status(409).json({ error: 'Primero elimina o mueve los servicios de esta categoría' });
  const result = await pool.query('update categories set is_active=false where id=$1 returning *', [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Categoría no encontrada' });
  res.json({ ok: true });
});

app.post('/api/admin/services', auth, requireRole('SA', 'OWNER'), upload.single('image'), async (req, res) => {
  const { name, description, price, duration, categoryId } = req.body;
  if (!name || !description || !price || !duration || !categoryId) return res.status(400).json({ error: 'Completa título, descripción, precio, duración y categoría' });
  const cat = await pool.query('select * from categories where id=$1', [categoryId]);
  if (!cat.rowCount) return res.status(404).json({ error: 'Categoría no encontrada' });
  const existing = await pool.query('select id from services where is_active=true and category_id=$1 and lower(trim(name))=lower(trim($2)) limit 1', [categoryId, name]);
  if (existing.rowCount) return res.status(409).json({ error: 'Ya existe un servicio activo con ese nombre en esta categoría' });
  const imageUrl = req.file ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` : null;
  const id = `${slugify(name)}-${crypto.randomBytes(2).toString('hex')}`;
  const result = await pool.query('insert into services (id,name,description,base_price,duration_minutes,category,category_id,image_url) values ($1,$2,$3,$4,$5,$6,$7,$8) returning *', [id, name, description, price, duration, cat.rows[0].name, categoryId, imageUrl]);
  res.status(201).json(result.rows[0]);
});

app.patch('/api/admin/services/:id', auth, requireRole('SA', 'OWNER'), upload.single('image'), async (req, res) => {
  const { name, description, price, duration, categoryId } = req.body;
  const current = await pool.query('select * from services where id=$1', [req.params.id]);
  if (!current.rowCount) return res.status(404).json({ error: 'Servicio no encontrado' });
  const cat = categoryId ? await pool.query('select * from categories where id=$1 and is_active=true', [categoryId]) : { rows: [] };
  if (categoryId && !cat.rows.length) return res.status(404).json({ error: 'Categoría no encontrada' });
  const imageUrl = req.file ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` : null;
  const result = await pool.query(`update services set name=coalesce($1,name), description=coalesce($2,description), base_price=coalesce($3,base_price), duration_minutes=coalesce($4,duration_minutes), category=coalesce($5,category), category_id=coalesce($6,category_id), image_url=coalesce($7,image_url), is_active=true where id=$8 returning *`, [name || null, description || null, price || null, duration || null, cat.rows[0]?.name || null, categoryId || null, imageUrl, req.params.id]);
  res.json(result.rows[0]);
});

app.delete('/api/admin/services/:id', auth, requireRole('SA', 'OWNER'), async (req, res) => {
  const result = await pool.query('update services set is_active=false where id=$1 returning *', [req.params.id]);
  if (!result.rowCount) return res.status(404).json({ error: 'Servicio no encontrado' });
  res.json({ ok: true });
});


app.get('/api/admin/attendance/settings', auth, requireRole('SA', 'OWNER'), async (req, res) => {
  res.json(await attendanceSettings(req));
});

app.post('/api/admin/attendance/settings/use-current-ip', auth, requireRole('SA', 'OWNER'), async (req, res) => {
  const ip = clientIp(req);
  if (!ip) return res.status(400).json({ error: 'No se pudo detectar la IP actual' });
  await pool.query(`insert into app_settings (key, value, updated_by, updated_at) values ('attendance_allowed_ip',$1,$2,now())
    on conflict (key) do update set value=excluded.value, updated_by=excluded.updated_by, updated_at=now()`, [ip, req.user.id]);
  res.json(await attendanceSettings(req));
});

app.get('/api/attendance/today', auth, requireRole('WORKER'), async (req, res) => {
  const settings = await attendanceSettings(req);
  const sp = (await pool.query('select * from specialists where user_id=$1 and is_active=true', [req.user.id])).rows[0];
  if (!sp) return res.status(404).json({ error: 'No tienes perfil de trabajadora activo' });
  const att = (await pool.query('select * from worker_attendance where specialist_id=$1 and work_date=current_date', [sp.id])).rows[0];
  res.json({ workStart: String(sp.work_start).slice(0,5), workEnd: String(sp.work_end).slice(0,5), checkInAt: att?.check_in_at || null, lateSeconds: att?.late_seconds || 0, lateText: lateText(att?.late_seconds || 0), currentIp: settings.currentIp, allowedIpConfigured: Boolean(settings.allowedIp) });
});

app.post('/api/attendance/check-in', auth, requireRole('WORKER'), async (req, res) => {
  const settings = await attendanceSettings(req);
  if (!settings.allowedIp) return res.status(409).json({ error: 'La dueña aún no configuró la IP válida del local para asistencia' });
  if (settings.currentIp !== settings.allowedIp) return res.status(403).json({ error: 'Tienes que estar en el local y conectada a la red WiFi autorizada para marcar asistencia' });
  const sp = (await pool.query('select * from specialists where user_id=$1 and is_active=true', [req.user.id])).rows[0];
  if (!sp) return res.status(404).json({ error: 'No tienes perfil de trabajadora activo' });
  const now = new Date();
  const [h, m] = String(sp.work_start).slice(0,5).split(':').map(Number);
  const scheduled = new Date(now);
  scheduled.setHours(h, m, 0, 0);
  const lateSecondsValue = Math.max(0, Math.floor((now.getTime() - scheduled.getTime()) / 1000));
  const result = await pool.query(`insert into worker_attendance (specialist_id,user_id,work_date,scheduled_start,check_in_at,ip_address,late_seconds)
    values ($1,$2,current_date,$3,now(),$4,$5)
    on conflict (specialist_id, work_date) do update set check_in_at=worker_attendance.check_in_at returning *`, [sp.id, req.user.id, sp.work_start, settings.currentIp, lateSecondsValue]);
  const att = result.rows[0];
  res.json({ workStart: String(sp.work_start).slice(0,5), workEnd: String(sp.work_end).slice(0,5), checkInAt: att.check_in_at, lateSeconds: att.late_seconds, lateText: lateText(att.late_seconds), currentIp: settings.currentIp, allowedIpConfigured: true });
});

app.get('/api/admin/revenue', auth, requireRole('SA', 'OWNER'), async (_, res) => {
  const result = await pool.query(`with worker_groups as (
      select min(sp.id) as id, sp.full_name, array_agg(sp.id) as specialist_ids
      from specialists sp
      where sp.is_active=true
      group by coalesce(sp.user_id, sp.id), sp.full_name
    )
    select wg.id, wg.full_name, coalesce(sum(case when b.status='paid' then b.price else 0 end),0) as total,
      coalesce(sum(case when b.status='paid' and b.paid_at::date=current_date then b.price else 0 end),0) as today,
      count(b.id) filter (where b.starts_at::date=current_date and b.status <> 'cancelled') as today_jobs,
      coalesce(json_agg(json_build_object('id', b.id, 'service', sv.name, 'starts_at', b.starts_at, 'price', b.price, 'payment', pm.name, 'status', b.status) order by b.starts_at desc) filter (where b.id is not null), '[]') as jobs
    from worker_groups wg
    left join bookings b on b.specialist_id=any(wg.specialist_ids)
    left join services sv on sv.id=b.service_id
    left join payment_methods pm on pm.id=b.payment_method_id
    group by wg.id, wg.full_name
    order by wg.full_name`);
  res.json(result.rows);
});

app.post('/api/auth/register', async (req, res) => {
  const { dni, fullName, birthDate, phone, email, password } = req.body;
  if (!dni || !fullName || !birthDate || !phone || !password) return res.status(400).json({ error: 'Faltan campos obligatorios' });
  const exists = await pool.query('select id from users where dni=$1', [dni]);
  if (exists.rowCount) return res.status(409).json({ error: 'Ya existe un usuario registrado con ese DNI' });
  const passwordHash = hashPassword(password);
  const result = await pool.query(
    `insert into users (dni, full_name, birth_date, phone, email, password_hash, role_code)
     values ($1,$2,$3,$4,$5,$6,'USER')
     returning id, dni, full_name, phone, email, loyalty_points, role_code, is_active`,
    [dni, fullName, birthDate, phone, email || null, passwordHash]
  );
  res.status(201).json({ user: publicUser(result.rows[0]), token: sign(result.rows[0]) });
});

app.post('/api/auth/login', async (req, res) => {
  const { dni, password } = req.body;
  const result = await pool.query('select * from users where dni=$1 and is_active=true', [dni]);
  const user = result.rows[0];
  if (!user || !user.is_active || !verifyPassword(password, user.password_hash)) return res.status(401).json({ error: 'Credenciales inválidas o usuario inactivo' });
  res.json({ token: sign(user), user: publicUser(user) });
});

app.get('/api/me', auth, async (req, res) => {
  const result = await pool.query('select id,dni,full_name,birth_date,phone,email,loyalty_points,role_code from users where id=$1', [req.user.id]);
  res.json(result.rows[0]);
});

app.patch('/api/me', auth, async (req, res) => {
  const { fullName, phone, email, birthDate } = req.body;
  const result = await pool.query(
    `update users set full_name=coalesce($1, full_name), phone=coalesce($2, phone), email=coalesce($3, email), birth_date=coalesce($4, birth_date), updated_at=now()
     where id=$5 returning id,dni,full_name,birth_date,phone,email,loyalty_points,role_code`,
    [fullName || null, phone || null, email || null, birthDate || null, req.user.id]
  );
  res.json(result.rows[0]);
});

app.post('/api/quotes/ai', auth, upload.single('image'), async (req, res) => {
  const [servicesResult, specialistsResult] = await Promise.all([
    pool.query('select s.name, s.description, s.base_price, s.duration_minutes, c.name as category from services s left join categories c on c.id=s.category_id where s.is_active=true order by s.name'),
    pool.query(`select sp.full_name, coalesce(array_agg(c.name) filter (where c.id is not null), '{}') as categories
      from specialists sp left join specialist_categories sc on sc.specialist_id=sp.id left join categories c on c.id=sc.category_id
      where sp.is_active=true group by sp.id order by sp.full_name`),
  ]);
  const payload = await quoteDesign({ hints: req.body.hints || '', image: req.file, services: servicesResult.rows, specialists: specialistsResult.rows });
  const result = await pool.query(
    'insert into ai_quotes (user_id, hints, difficulty, estimated_minutes, price, materials, requires_review) values ($1,$2,$3,$4,$5,$6,$7) returning id',
    [req.user.id, req.body.hints || null, payload.difficulty, payload.estimatedMinutes, payload.price, JSON.stringify(payload.materials), payload.requiresReview]
  );
  res.json({ id: result.rows[0].id, ...payload });
});

app.post('/api/assistant', async (req, res) => {
  const message = String(req.body.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Escribe una pregunta para la asistente IA' });

  let services = [];
  let products = [];
  let specialists = [];
  let availability = [];
  try {
    const result = await pool.query('select name, description, base_price, duration_minutes, category from services where is_active=true order by name');
    services = result.rows;
  } catch {
    services = [];
  }
  try {
    const result = await pool.query('select sku, name, description, category, price, stock from products where is_active=true order by name');
    products = result.rows;
  } catch {
    products = [];
  }
  try {
    const result = await pool.query(`select sp.full_name, sp.work_start, sp.work_end, coalesce(string_agg(c.name, ', '), '') as specialties
      from specialists sp left join specialist_categories sc on sc.specialist_id=sp.id left join categories c on c.id=sc.category_id
      where sp.is_active=true group by sp.id order by sp.full_name`);
    specialists = result.rows;
  } catch { specialists = []; }
  try {
    const result = await pool.query(`select b.starts_at, b.duration_minutes, b.buffer_minutes, b.status, sv.name as service_name, sp.full_name as specialist_name
      from bookings b join services sv on sv.id=b.service_id left join specialists sp on sp.id=b.specialist_id
      where b.starts_at >= now() and b.starts_at < now() + interval '14 days' and b.status in ('pending','in_progress') order by b.starts_at limit 40`);
    availability = result.rows;
  } catch { availability = []; }

  res.json(await assistantReply({ message, services, products, specialists, availability }));
});

app.get('/api/bookings', auth, async (req, res) => {
  const isAdmin = req.user.role === 'SA';
  const isWorker = req.user.role === 'WORKER';
  const result = await pool.query(
    `select b.*, s.name as service_name, sp.full_name as specialist_name, u.full_name as customer_name, pm.name as payment_method
     from bookings b
     join services s on s.id=b.service_id
     left join specialists sp on sp.id=b.specialist_id
     join users u on u.id=b.user_id
     left join payment_methods pm on pm.id=b.payment_method_id
     where ($1::boolean or b.user_id=$2 or ($3::boolean and sp.user_id=$2))
     order by b.starts_at desc`,
    [isAdmin, req.user.id, isWorker]
  );
  res.json(result.rows);
});

app.get('/api/availability', auth, async (req, res) => {
  const { date, specialistId, serviceId } = req.query;
  if (!date || !specialistId) return res.status(400).json({ error: 'Fecha y trabajadora son obligatorias' });
  const sp = (await pool.query('select * from specialists where id=$1 and is_active=true', [specialistId])).rows[0];
  if (!sp) return res.status(404).json({ error: 'Trabajadora no disponible' });
  const service = serviceId ? (await pool.query('select duration_minutes from services where id=$1', [serviceId])).rows[0] : { duration_minutes: 60 };
  const duration = Number(service?.duration_minutes || 60);
  const buffer = 15;
  const start = toMinutes(sp.work_start); const end = toMinutes(sp.work_end);
  const bookings = await pool.query(`select starts_at, duration_minutes, buffer_minutes from bookings where starts_at::date=$1::date and specialist_id=$2 and status in ('pending','in_progress','paid')`, [date, specialistId]);
  const slots = [];
  for (let mins = start; mins + duration + buffer <= end; mins += 30) {
    const slotStart = new Date(`${date}T${timeFromMinutes(mins)}:00-05:00`);
    const slotEnd = addMinutes(slotStart, duration + buffer);
    const busy = bookings.rows.some((b) => slotStart < addMinutes(new Date(b.starts_at), Number(b.duration_minutes) + Number(b.buffer_minutes || 15)) && slotEnd > new Date(b.starts_at));
    slots.push({ time: timeFromMinutes(mins), available: !busy });
  }
  res.json(slots);
});

app.post('/api/bookings', auth, async (req, res) => {
  const { serviceId, specialistId, startsAt, quoteId, notes, paymentMethodId, paymentReference } = req.body;
  if (!serviceId || !specialistId || !startsAt) return res.status(400).json({ error: 'Servicio, trabajadora y horario son obligatorios' });
  const serviceResult = await pool.query('select * from services where id=$1 and is_active=true', [serviceId]);
  const service = serviceResult.rows[0];
  if (!service) return res.status(404).json({ error: 'Servicio no encontrado' });
  const specialist = (await pool.query('select * from specialists where id=$1 and is_active=true', [specialistId])).rows[0];
  if (!specialist) return res.status(404).json({ error: 'Trabajadora no disponible' });
  const skill = await pool.query('select 1 from specialist_categories where specialist_id=$1 and category_id=$2', [specialistId, service.category_id]);
  if (!skill.rowCount) return res.status(409).json({ error: 'La trabajadora no atiende esta categoría' });
  const startDate = new Date(startsAt); const endDate = addMinutes(startDate, Number(service.duration_minutes) + 15);
  const workStart = toMinutes(specialist.work_start); const workEnd = toMinutes(specialist.work_end); const startMins = startDate.getUTCHours()*60 + startDate.getUTCMinutes() - 300;
  if (startMins < workStart || startMins + Number(service.duration_minutes) + 15 > workEnd) return res.status(409).json({ error: 'Fuera del horario laboral de la trabajadora' });
  const overlap = await pool.query(
    `select id from bookings where specialist_id=$1 and status in ('pending','in_progress','paid') and starts_at < $3 and (starts_at + ((duration_minutes + buffer_minutes) || ' minutes')::interval) > $2`,
    [specialistId, startDate, endDate]
  );
  if (overlap.rowCount) return res.status(409).json({ error: 'Ese bloque horario ya fue reservado' });
  const result = await pool.query(
    `insert into bookings (user_id, service_id, specialist_id, quote_id, starts_at, ends_at, duration_minutes, buffer_minutes, price, payment_method_id, payment_reference, notes)
     values ($1,$2,$3,$4,$5,$6,$7,15,$8,$9,$10,$11) returning *`,
    [req.user.id, serviceId, specialistId, quoteId || null, startDate, addMinutes(startDate, Number(service.duration_minutes)), service.duration_minutes, service.base_price, paymentMethodId || null, paymentReference || null, notes || null]
  );
  res.status(201).json(result.rows[0]);
});

app.patch('/api/bookings/:id/status', auth, async (req, res) => {
  const allowed = ['pending', 'in_progress', 'paid', 'cancelled', 'no_show'];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: 'Estado inválido' });
  const isAdmin = req.user.role === 'SA';
  const result = await pool.query(
    `update bookings set status=$1, paid_at=case when $1='paid' then now() else paid_at end where id=$2 and ($3::boolean or user_id=$4 or specialist_id in (select id from specialists where user_id=$4)) returning *`,
    [req.body.status, req.params.id, isAdmin, req.user.id]
  );
  if (!result.rowCount) return res.status(404).json({ error: 'Reserva no encontrada' });
  res.json(result.rows[0]);
});

app.get('/api/admin/reports', auth, requireRole('SA', 'OWNER'), (_, res) => {
  res.json({ todayBookings: 18, monthlyRevenue: 12450, topService: 'Gel permanente', aiInsight: 'La demanda sube viernes y sábado; lanzar promoción de Soft Gel los martes puede equilibrar la agenda.' });
});

async function start() {
  if (process.env.SKIP_DB_INIT !== 'true') {
    await ensureDatabase();
  }

  app.listen(PORT, () => console.log(`Nail Beauty API running on ${PORT}`));
}

if (require.main === module) {
  start().catch((error) => {
    console.error('No se pudo iniciar Nail Beauty API:', error.message);
    process.exit(1);
  });
}

module.exports = app;
