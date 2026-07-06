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
  const result = await pool.query('select id, name, description, base_price as price, duration_minutes as duration, category, image_url from services where is_active=true order by name');
  res.json(result.rows);
});

app.get('/api/payment-methods', async (_, res) => {
  const result = await pool.query('select id, code, name, provider, requires_reference from payment_methods where is_active=true order by id');
  res.json(result.rows);
});

app.get('/api/specialists', async (_, res) => {
  const result = await pool.query('select id, full_name, phone, email, bio from specialists where is_active=true order by full_name');
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
     returning id, dni, full_name, phone, email, loyalty_points, role_code`,
    [dni, fullName, birthDate, phone, email || null, passwordHash]
  );
  res.status(201).json({ user: result.rows[0], token: sign(result.rows[0]) });
});

app.post('/api/auth/login', async (req, res) => {
  const { dni, password } = req.body;
  const result = await pool.query('select * from users where dni=$1 and is_active=true', [dni]);
  const user = result.rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) return res.status(401).json({ error: 'Credenciales inválidas' });
  res.json({ token: sign(user), user: { id: user.id, dni: user.dni, full_name: user.full_name, role: user.role_code, loyalty_points: user.loyalty_points } });
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
  const payload = await quoteDesign({ hints: req.body.hints || '', image: req.file });
  const result = await pool.query(
    'insert into ai_quotes (user_id, hints, difficulty, estimated_minutes, price, materials, requires_review) values ($1,$2,$3,$4,$5,$6,$7) returning id',
    [req.user.id, req.body.hints || null, payload.difficulty, payload.estimatedMinutes, payload.price, JSON.stringify(payload.materials), payload.requiresReview]
  );
  res.json({ id: result.rows[0].id, ...payload });
});

app.post('/api/assistant', auth, async (req, res) => {
  const message = String(req.body.message || '').trim();
  if (!message) return res.status(400).json({ error: 'Escribe una pregunta para la asistente IA' });
  const services = await pool.query('select name, base_price, duration_minutes from services where is_active=true order by name');
  res.json(await assistantReply({ message, services: services.rows }));
});

app.get('/api/bookings', auth, async (req, res) => {
  const isAdmin = ['SA', 'OWNER'].includes(req.user.role);
  const result = await pool.query(
    `select b.*, s.name as service_name, sp.full_name as specialist_name, u.full_name as customer_name
     from bookings b
     join services s on s.id=b.service_id
     left join specialists sp on sp.id=b.specialist_id
     join users u on u.id=b.user_id
     where ($1::boolean or b.user_id=$2)
     order by b.starts_at desc`,
    [isAdmin, req.user.id]
  );
  res.json(result.rows);
});

app.get('/api/availability', auth, async (req, res) => {
  const { date, specialistId } = req.query;
  const slots = ['09:00', '10:00', '11:30', '15:00', '16:30', '18:00'];
  if (!date) return res.json(slots);
  const result = await pool.query(
    `select to_char(starts_at at time zone 'America/Lima', 'HH24:MI') as time
     from bookings
     where starts_at::date=$1::date and status in ('pending','confirmed') and ($2::bigint is null or specialist_id=$2)`,
    [date, specialistId || null]
  );
  const busy = new Set(result.rows.map((row) => row.time));
  res.json(slots.map((time) => ({ time, available: !busy.has(time) })));
});

app.post('/api/bookings', auth, async (req, res) => {
  const { serviceId, specialistId, startsAt, quoteId, notes } = req.body;
  if (!serviceId || !startsAt) return res.status(400).json({ error: 'Servicio y horario son obligatorios' });
  const serviceResult = await pool.query('select * from services where id=$1 and is_active=true', [serviceId]);
  const service = serviceResult.rows[0];
  if (!service) return res.status(404).json({ error: 'Servicio no encontrado' });
  const overlap = await pool.query(
    `select id from bookings where starts_at=$1 and status in ('pending','confirmed') and ($2::bigint is null or specialist_id=$2)`,
    [startsAt, specialistId || null]
  );
  if (overlap.rowCount) return res.status(409).json({ error: 'Ese horario ya fue reservado' });
  const result = await pool.query(
    `insert into bookings (user_id, service_id, specialist_id, quote_id, starts_at, duration_minutes, price, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [req.user.id, serviceId, specialistId || null, quoteId || null, startsAt, service.duration_minutes, service.base_price, notes || null]
  );
  res.status(201).json(result.rows[0]);
});

app.patch('/api/bookings/:id/status', auth, async (req, res) => {
  const allowed = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: 'Estado inválido' });
  const isAdmin = ['SA', 'OWNER'].includes(req.user.role);
  const result = await pool.query(
    `update bookings set status=$1 where id=$2 and ($3::boolean or user_id=$4) returning *`,
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
