require('./env');
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { pool } = require('./db');
const { ensureDatabase } = require('./initDb');

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

app.post('/api/auth/register', async (req, res) => {
  const { dni, fullName, birthDate, phone, email, password } = req.body;
  if (!dni || !fullName || !birthDate || !phone || !password) return res.status(400).json({ error: 'Faltan campos obligatorios' });
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

app.post('/api/quotes/ai', auth, upload.single('image'), async (req, res) => {
  const hints = String(req.body.hints || '').toLowerCase();
  const complexity = hints.includes('piedra') || hints.includes('3d') || hints.includes('boda') ? 'Alta' : 'Media';
  const base = complexity === 'Alta' ? 150 : 95;
  const payload = {
    difficulty: complexity,
    estimatedMinutes: complexity === 'Alta' ? 135 : 95,
    price: base,
    materials: ['Acrílico', 'Nail Art', 'Esmalte permanente', complexity === 'Alta' ? 'Piedras' : 'Brillo'],
    explanation: 'Cotización preliminar generada por reglas IA; diseños fuera de lo habitual pasan a revisión del salón.',
    requiresReview: complexity === 'Alta',
  };
  const result = await pool.query(
    'insert into ai_quotes (user_id, hints, difficulty, estimated_minutes, price, materials, requires_review) values ($1,$2,$3,$4,$5,$6,$7) returning id',
    [req.user.id, req.body.hints || null, payload.difficulty, payload.estimatedMinutes, payload.price, JSON.stringify(payload.materials), payload.requiresReview]
  );
  res.json({ id: result.rows[0].id, ...payload });
});

app.post('/api/bookings', auth, async (req, res) => {
  const { serviceId, specialistId, startsAt, quoteId, notes } = req.body;
  if (!serviceId || !startsAt) return res.status(400).json({ error: 'Servicio y horario son obligatorios' });
  const serviceResult = await pool.query('select * from services where id=$1 and is_active=true', [serviceId]);
  const service = serviceResult.rows[0];
  if (!service) return res.status(404).json({ error: 'Servicio no encontrado' });
  const result = await pool.query(
    `insert into bookings (user_id, service_id, specialist_id, quote_id, starts_at, duration_minutes, price, notes)
     values ($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [req.user.id, serviceId, specialistId || null, quoteId || null, startsAt, service.duration_minutes, service.base_price, notes || null]
  );
  res.status(201).json(result.rows[0]);
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
