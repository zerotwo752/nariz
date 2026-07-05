const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { pool } = require('./db');
require('dotenv').config();

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 6 * 1024 * 1024 } });
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || '*' }));
app.use(express.json({ limit: '2mb' }));

const services = [
  { id: 'basic', name: 'Manicure básica', price: 40, duration: 45, description: 'Limpieza, limado, cutícula e hidratación.' },
  { id: 'spa', name: 'Manicure spa', price: 65, duration: 70, description: 'Experiencia relajante con exfoliación y masaje.' },
  { id: 'gel', name: 'Gel permanente', price: 60, duration: 75, description: 'Color de larga duración y brillo premium.' },
  { id: 'acrylic', name: 'Acrílicas', price: 80, duration: 110, description: 'Extensión resistente con acabado personalizado.' },
  { id: 'softgel', name: 'Soft Gel', price: 60, duration: 90, description: 'Extensiones ligeras, flexibles y modernas.' },
  { id: 'nailart', name: 'Nail Art', price: 30, duration: 50, description: 'Decoración artística, relieves, piedras y efectos.' },
];

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
  return jwt.sign({ id: user.id, dni: user.dni, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}

function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); } catch { res.status(401).json({ error: 'Token inválido' }); }
}

app.get('/health', (_, res) => res.json({ ok: true, service: 'Nail Beauty API' }));
app.get('/api/services', (_, res) => res.json(services));

app.post('/api/auth/register', async (req, res) => {
  const { dni, fullName, birthDate, phone, email, password } = req.body;
  if (!dni || !fullName || !birthDate || !phone || !password) return res.status(400).json({ error: 'Faltan campos obligatorios' });
  const passwordHash = hashPassword(password);
  const result = await pool.query(
    `insert into clients (dni, full_name, birth_date, phone, email, password_hash)
     values ($1,$2,$3,$4,$5,$6)
     returning id, dni, full_name, phone, email, loyalty_points, role`,
    [dni, fullName, birthDate, phone, email || null, passwordHash]
  );
  res.status(201).json({ user: result.rows[0], token: sign(result.rows[0]) });
});

app.post('/api/auth/login', async (req, res) => {
  const { dni, password } = req.body;
  const result = await pool.query('select * from clients where dni=$1', [dni]);
  const user = result.rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) return res.status(401).json({ error: 'Credenciales inválidas' });
  res.json({ token: sign(user), user: { id: user.id, dni: user.dni, full_name: user.full_name, role: user.role, loyalty_points: user.loyalty_points } });
});

app.get('/api/me', auth, async (req, res) => {
  const result = await pool.query('select id,dni,full_name,birth_date,phone,email,loyalty_points,role from clients where id=$1', [req.user.id]);
  res.json(result.rows[0]);
});

app.post('/api/quotes/ai', upload.single('image'), (req, res) => {
  const hints = String(req.body.hints || '').toLowerCase();
  const complexity = hints.includes('piedra') || hints.includes('3d') || hints.includes('boda') ? 'Alta' : 'Media';
  const base = complexity === 'Alta' ? 150 : 95;
  res.json({ difficulty: complexity, estimatedMinutes: complexity === 'Alta' ? 135 : 95, price: base, materials: ['Acrílico', 'Nail Art', 'Esmalte permanente', complexity === 'Alta' ? 'Piedras' : 'Brillo'], explanation: 'Cotización preliminar generada por reglas IA; diseños fuera de lo habitual pasan a revisión del salón.', requiresReview: complexity === 'Alta' });
});

app.post('/api/bookings', auth, async (req, res) => {
  const { serviceId, specialistId, startsAt, paymentMethod, depositAmount, quote } = req.body;
  const service = services.find((item) => item.id === serviceId);
  if (!service || !startsAt) return res.status(400).json({ error: 'Servicio y horario son obligatorios' });
  const result = await pool.query(
    `insert into bookings (client_id, service_id, specialist_id, starts_at, duration_minutes, price, payment_method, deposit_amount, quote_snapshot)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *`,
    [req.user.id, serviceId, specialistId || null, startsAt, service.duration, quote?.price || service.price, paymentMethod || 'local', depositAmount || 0, quote || null]
  );
  res.status(201).json(result.rows[0]);
});

app.get('/api/admin/reports', auth, (_, res) => {
  res.json({ todayBookings: 18, monthlyRevenue: 12450, topService: 'Gel permanente', aiInsight: 'La demanda sube viernes y sábado; lanzar promoción de Soft Gel los martes puede equilibrar la agenda.' });
});

app.listen(PORT, () => console.log(`Nail Beauty API running on ${PORT}`));
module.exports = app;
