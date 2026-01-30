const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

dotenv.config();

/* DB*/

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/* APP*/

const app = express();
app.use(cors());
app.use(express.json());

/* RUTAS */ 
const cajasRoutes = require("./routes/cajas.routes");
const apuestasRoutes = require("./routes/apuestas.routes");

app.use("/api", cajasRoutes);
app.use("/api", apuestasRoutes);


/* CREAR CARPETA UPLOADS SI NO EXISTE*/

if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
}

app.use("/uploads", express.static("uploads"));

/* MIDDLEWARES*/

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token requerido" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Token inválido" });
  }
}

function adminMiddleware(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Acceso solo para admin" });
  }
  next();
}

/*  MULTER CONFIG (IMÁGENES) */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() +
      "-" +
      Math.round(Math.random() * 1e9) +
      path.extname(file.originalname);
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Solo imágenes"));
    }
    cb(null, true);
  },
});

/* TEST*/

app.get("/", (req, res) => {
  res.send("Backend funcionando ✅");
});

/* REGISTER*/

app.post("/api/register", async (req, res) => {
  try {
    let { username, email, password, referral_code_used } = req.body;

    // normalizar
    username = username.trim();
    email = email.trim();
    referral_code_used = referral_code_used.trim();

    // código obligatorio
    if (!referral_code_used) {
      return res.status(400).json({
        success: false,
        message: "El código de referido es obligatorio"
      });
    }

    // validar formato
    const referralRegex = /^[A-Za-z0-9]+$/;
    if (!referralRegex.test(referral_code_used)) {
      return res.status(400).json({
        success: false,
        message: "Código de referido inválido"
      });
    }

    // verificar que exista
    const refResult = await pool.query(
      "SELECT id FROM users WHERE referral_code = $1",
      [referral_code_used]
    );

    if (refResult.rowCount === 0) {
      return res.status(400).json({
        success: false,
        message: "El código de referido no existe"
      });
    }

    const referred_by = refResult.rows[0].id;

    // validar email o usuario repetido
    const exists = await pool.query(
      "SELECT 1 FROM users WHERE email = $1 OR username = $2",
      [email, username]
    );
    if (exists.rowCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Usuario o email ya registrado"
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // insertar usuario
    const result = await pool.query(
      `
        INSERT INTO users (username, email, password_hash, referred_by)
        VALUES ($1, $2, $3, $4)
        RETURNING id, username, email;
      `,
      [username, email, hashedPassword, referred_by]
    );

    res.json({ success: true, user: result.rows[0] });

  } catch (err) {
    console.error("ERROR REGISTRO:", err);
    res.status(500).json({ success: false });
  }
});



/* LOGIN */

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (userResult.rows.length === 0)
      return res.json({ success: false });

    const user = userResult.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword)
      return res.json({ success: false });

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ success: true, token });
  } catch (err) {
    console.error("ERROR LOGIN:", err);
    res.status(500).json({ success: false });
  }
});

/* PROFILE (USUARIO LOGUEADO) */

app.get("/api/profile", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT 
        id,
        username,
        email,
        referral_code,
        balance,
        avatar_url,
        trc20_address,
        bep20_address,
        yape_address,
        plin_address
      FROM users
      WHERE id = $1
      `,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false });
    }

    res.json({
      success: true,
      user: result.rows[0],
    });
  } catch (err) {
    console.error("ERROR PROFILE:", err);
    res.status(500).json({ success: false });
  }
});

/* GUARDAR DIRECCIONES DE RETIRO */

app.post("/api/wallets", authMiddleware, async (req, res) => {
  try {
    // Desestructuración de los datos
    const { trc20, bep20, yape, plin } = req.body;

    // Validación de valores vacíos
    const trc20Address = trc20?.trim() === "" ? null : trc20;
    const bep20Address = bep20?.trim() === "" ? null : bep20;
    const yapeAddress = yape?.trim() === "" ? null : yape;
    const plinAddress = plin?.trim() === "" ? null : plin;

    // Verificación de los datos recibidos
    console.log("Datos recibidos para guardar:", { trc20, bep20, yape, plin });

    // Actualización de las direcciones en la base de datos
    await pool.query(
      `
      UPDATE users
      SET 
        trc20_address = COALESCE($1, trc20_address),
        bep20_address = COALESCE($2, bep20_address),
        yape_address = COALESCE($3, yape_address),
        plin_address = COALESCE($4, plin_address)
      WHERE id = $5
      `,
      [trc20Address, bep20Address, yapeAddress, plinAddress, req.user.id]
    );

    // Respuesta exitosa
    res.json({ success: true });
  } catch (err) {
    // Manejo de errores
    console.error("ERROR GUARDAR WALLET:", err);
    res.status(500).json({ success: false });
  }
});



/* INVERSIONES - CREAR */

app.post("/api/investments", authMiddleware, async (req, res) => {
  const client = await pool.connect();

  try {
    const { amount } = req.body;
    const numericAmount = Number(amount);

    if (isNaN(numericAmount) || numericAmount < 2) {
      return res.status(400).json({ error: "Monto mínimo 2 USDT" });
    }

    await client.query("BEGIN");

    // 1️⃣ Obtener balance del usuario
    const userResult = await client.query(
      "SELECT balance FROM users WHERE id = $1 FOR UPDATE",
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Usuario no encontrado" });
    }     

    const userBalance = Number(userResult.rows[0].balance);

    // 2️⃣ Validar balance suficiente
    if (userBalance < numericAmount) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Saldo insuficiente" });
    }

    // 3️⃣ Obtener configuración activa
    const settings = await client.query(
      "SELECT * FROM investment_settings WHERE active = true ORDER BY id DESC LIMIT 1"
    );

    if (settings.rows.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ error: "Configuración de inversión no definida" });
    }

    const { daily_percent, duration_days } = settings.rows[0];

    const startAt = new Date();
    const endAt = new Date();
    endAt.setDate(endAt.getDate() + duration_days);

    // 4️⃣ Descontar balance
    await client.query(
      `
      UPDATE users
      SET balance = balance - $1
      WHERE id = $2
      `,
      [numericAmount, req.user.id]
    );

    // 5️⃣ Crear inversión (FORMA CORRECTA)
    await client.query(
      `
      INSERT INTO investments
      (
        user_id,
        amount,
        daily_percent,
        duration_days,
        start_at,
        end_at,
        last_claim_at
      )
      VALUES
      (
        $1,
        $2,
        $3::double precision,
        $4::integer,
        NOW(),
        NOW() + ($4::integer * INTERVAL '1 day'),
        NOW()
      )


  `,
  [
    req.user.id,
    numericAmount,
    daily_percent,
    duration_days
  ]
);


    await client.query("COMMIT");

    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("ERROR INVERSION:", err);
    res.status(500).json({ error: "Error creando inversión" });
  } finally {
    client.release();
  }
});


/* INVERSIONES - USUARIO */
app.get("/api/investments", authMiddleware, async (req, res) => {
  const result = await pool.query(
    `
    SELECT *
    FROM investments
    WHERE user_id = $1
    ORDER BY created_at DESC
    `,
    [req.user.id]
  );

  res.json(result.rows);
});

/* CREAR RETIRO */

app.post("/api/withdrawals", authMiddleware, async (req, res) => {
  const client = await pool.connect();

  try {
    const { amount, network } = req.body;
    const numericAmount = Number(amount);

    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ error: "Monto inválido" });
    }

    // verificar que no exista retiro pendiente
    const pending = await client.query(
      `
      SELECT id FROM withdrawals
      WHERE user_id = $1 AND status = 'pendiente'
      `,
      [req.user.id]
    );

    if (pending.rowCount > 0) {
      return res.status(400).json({ error: "Ya tienes un retiro en proceso" });
    }

    // obtener usuario
    const userRes = await client.query(
      `SELECT balance, trc20_address, bep20_address, yape_address, plin_address FROM users WHERE id = $1 FOR UPDATE`,
      [req.user.id]
    );

    const user = userRes.rows[0];

    // validar red y dirección
    let address = null;

    if (network === "trc20") address = user.trc20_address;
    if (network === "bep20") address = user.bep20_address;
    if (network === "yape") address = user.yape_address;
    if (network === "plin") address = user.plin_address; 

    if (!address) {
      return res.status(400).json({ error: "No tienes esta dirección registrada" });
    }

    if (user.balance < numericAmount) {
      return res.status(400).json({ error: "Saldo insuficiente" });
    }

    await client.query("BEGIN");

    // descontar saldo inmediatamente
    await client.query(
      `UPDATE users SET balance = balance - $1 WHERE id = $2`,
      [numericAmount, req.user.id]
    );

    await client.query(
      `
      INSERT INTO withdrawals (user_id, network, address, amount, status)
      VALUES ($1, $2, $3, $4, 'pendiente')
      `,
      [req.user.id, network, address, numericAmount]
    );

    await client.query("COMMIT");

    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("ERROR RETIRO:", err);
    res.status(500).json({ error: "Error creando retiro" });
  } finally {
    client.release();
  }
});

/* LISTAR RETIROS DEL USUARIO */
app.get("/api/withdrawals/user", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id, amount, network, address, status, created_at
      FROM withdrawals
      WHERE user_id = $1
      ORDER BY created_at DESC
      `,
      [req.user.id]
    );

    res.json({
      success: true,
      withdrawals: result.rows,
    });
  } catch (err) {
    console.error("ERROR AL OBTENER RETIROS:", err);
    res.status(500).json({ error: "Error obteniendo retiros" });
  }
});


/* LISTAR RETIROS PARA ADMIN */
app.get("/api/admin/withdrawals", authMiddleware, async (req, res) => {
  try {
    // verificar que sea admin
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "No autorizado" });
    }

    const result = await pool.query(`
      SELECT 
        w.id,
        w.user_id,
        w.amount,
        w.network,
        w.address,
        w.status,
        w.created_at,

        u.username,
        u.email,
        u.balance

      FROM withdrawals w
      LEFT JOIN users u ON u.id = w.user_id
      ORDER BY w.id DESC
    `);

    const withdrawals = result.rows.map(r => ({
      id: r.id,
      amount: r.amount,
      network: r.network,
      address: r.address,
      status: r.status,
      created_at: r.created_at,

      user: {
        id: r.user_id,
        username: r.username,
        email: r.email,
        balance: r.balance
      }
    }));

    res.json(withdrawals);
  } catch (err) {
    console.error("ERROR ADMIN WITHDRAWALS:", err);
    res.status(500).json({ error: "Error obteniendo retiros" });
  }
});



/* RECARGAS (CON IMAGEN REAL) */

// 🔥 FUNCION PAGAR COMISIONES POR NIVELES 🔥
async function pagarComisionesPorRecarga(userId, recargaId, recargaAmount, client) {
  // obtener configuración de porcentajes
  const settingsResult = await client.query(`
    SELECT level1_percent, level2_percent, level3_percent, referral_enabled
    FROM settings
    LIMIT 1
  `);

  if (settingsResult.rows.length === 0 || !settingsResult.rows[0].referral_enabled) {
    console.log("➡ Sistema de referidos desactivado");
    return;
  }

  const { level1_percent, level2_percent, level3_percent } = settingsResult.rows[0];

  // buscamos LINEA DE PADRES
  let currentUser = userId;
  let level = 1;

  while (level <= 3) {
    const refResult = await client.query(`
      SELECT referred_by
      FROM users
      WHERE id = $1
    `, [currentUser]);

    if (refResult.rows.length === 0 || !refResult.rows[0].referred_by) break;

    const parentId = refResult.rows[0].referred_by;

    // calcular comisión según nivel
    let percent = 0;
    if (level === 1) percent = level1_percent;
    if (level === 2) percent = level2_percent;
    if (level === 3) percent = level3_percent;

    const rewardAmount = (recargaAmount * percent) / 100;

    // evitar pagar 2 veces por la misma recarga
    await client.query(`
      INSERT INTO referral_rewards (user_id, referred_user_id, amount, level, recarga_id)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT DO NOTHING
    `, [parentId, userId, rewardAmount, level, recargaId]);

    // sumar balance
    await client.query(`
      UPDATE users
      SET balance = balance + $1
      WHERE id = $2
    `, [rewardAmount, parentId]);

    console.log(`💰 Pagado nivel ${level}: ${rewardAmount} a usuario ${parentId}`);

    currentUser = parentId;
    level++;
  }
}

app.post(
  "/api/recargas",
  authMiddleware,
  upload.single("image"),
  async (req, res) => {
    try {
      const { network, address, amount, operationDigits } = req.body;
      const numericAmount = Number(amount);

      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: "Imagen requerida" });
      }

      if (isNaN(numericAmount) || numericAmount <= 0) {
        return res
          .status(400)
          .json({ success: false, message: "Monto inválido" });
      }

      if (!operationDigits || operationDigits.length !== 6) {
        return res
          .status(400)
          .json({ success: false, message: "6 dígitos inválidos" });
      }

      const userId = req.user.id;
      const imageUrl = req.file.filename;

      await pool.query(
        `
        INSERT INTO recargas
        (user_id, network, address, amount, operation_digits, image_url, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'pendiente')
        `,
        [userId, network, address, numericAmount, operationDigits, imageUrl]
      );

      res.json({ success: true });
    } catch (err) {
      console.error("ERROR RECARGA:", err);
      res.status(500).json({ success: false });
    }
  }
);



/* ADMIN */

/* ADMIN - BUSCAR USUARIO */

app.get(
  "/api/admin/users/search",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({ error: "Parámetro requerido" });
    }

    try {
      const result = await pool.query(
        `
        SELECT id, username, email, balance
        FROM users
        WHERE id::text = $1 OR username ILIKE $2
        LIMIT 1
        `,
        [q, `%${q}%`]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      res.json(result.rows[0]);
    } catch (err) {
      console.error("ERROR BUSCAR USUARIO:", err);
      res.status(500).json({ error: "Error buscando usuario" });
    }
  }
);

/* ADMIN - CONFIGURACIÓN DE INVERSIÓN */

app.post(
  "/api/admin/investment/settings",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    const { daily_percent, duration_days } = req.body;

    if (
      isNaN(Number(daily_percent)) ||
      isNaN(Number(duration_days))
    ) {
      return res.status(400).json({ error: "Datos inválidos" });
    }

    try {
      await pool.query(
        "UPDATE investment_settings SET active = false WHERE active = true"
      );

      await pool.query(
        `
        INSERT INTO investment_settings (daily_percent, duration_days, active)
        VALUES ($1, $2, true)
        `,
        [daily_percent, duration_days]
      );

      res.json({ success: true });
    } catch (err) {
      console.error("ERROR SETTINGS:", err);
      res.status(500).json({ error: "Error guardando configuración" });
    }
  }
);



app.get("/api/recargas", authMiddleware, adminMiddleware, async (req, res) => {
  const result = await pool.query(`
    SELECT 
      r.*,
      u.username,
      u.email
    FROM recargas r
    JOIN users u ON u.id = r.user_id
    ORDER BY r.created_at DESC
  `);

  res.json(result.rows);
});


app.put("/api/recargas/:id", authMiddleware, adminMiddleware, async (req, res) => {
  const client = await pool.connect();

  try {
    const { status } = req.body;
    const recargaId = req.params.id;

    await client.query("BEGIN");

    const recargaResult = await client.query(
      `
      SELECT * FROM recargas
      WHERE id = $1
      FOR UPDATE
      `,
      [recargaId]
    );

    if (recargaResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Recarga no encontrada" });
    }

    const recarga = recargaResult.rows[0];

    // ❗ Evitar doble aprobación
    if (recarga.status === "aprobado") {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "Recarga ya aprobada" });
    }

    // Actualizar estado
    await client.query(
      "UPDATE recargas SET status = $1 WHERE id = $2",
      [status, recargaId]
    );

    // ✔️ Si aprueba → sumar balance
    if (status === "aprobado") {
      await client.query(
        `
        UPDATE users
        SET balance = GREATEST(balance + $1, 0)
        WHERE id = $2
        `,
        [recarga.amount, recarga.user_id]
      );
      await pagarComisionesPorRecarga(
        recarga.user_id,
        recarga.id,
        recarga.amount,
        client
      );
    }

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("ERROR APROBAR RECARGA:", err);
    res.status(500).json({ error: "Error actualizando recarga" });
  } finally {
    client.release();
  }
});


/* ADMIN - INVERSIONES */



app.get(
  "/api/admin/investments",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    const result = await pool.query(`
      SELECT 
        i.*,
        u.username,
        u.email
      FROM investments i
      JOIN users u ON u.id = i.user_id
      ORDER BY i.created_at DESC
    `);

    res.json(result.rows);
  }
);

app.post(
  "/api/admin/users/:id/balance",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const { amount, reason } = req.body;
      const userId = req.params.id;

      const numericAmount = Number(amount);

      if (isNaN(numericAmount) || numericAmount === 0) {
        return res.status(400).json({ error: "Monto inválido" });
}

      const result = await pool.query(
        `
        UPDATE users
        SET balance = GREATEST(balance + $1, 0)
        WHERE id = $2
        RETURNING balance
        `,
        [numericAmount, userId]
      );
      await pool.query(
       `
        INSERT INTO balance_logs (user_id, admin_id, amount, reason)
        VALUES ($1, $2, $3, $4)
        `,
        [userId, req.user.id, numericAmount, reason || null]
      );  

      if (result.rowCount === 0) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }

      res.json({
        success: true,
        newBalance: result.rows[0].balance,
        message: `Balance actualizado (${numericAmount > 0 ? "+" : ""}${numericAmount})`,
      });
    } catch (err) {
      console.error("ERROR BALANCE MANUAL:", err);
      res.status(500).json({ error: "Error actualizando balance" });
    }
  }
);

/* ADMIN - LISTAR RETIROS */

app.get(
  "/api/admin/withdrawals",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    const result = await pool.query(`
      SELECT 
        w.*,
        u.username,
        u.email,
        u.balance
      FROM withdrawals w
      JOIN users u ON u.id = w.user_id
      ORDER BY w.created_at DESC
    `);

    res.json(result.rows);
  }
);

/* ADMIN - ACTUALIZAR RETIRO */

app.put(
  "/api/admin/withdrawals/:id",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    const client = await pool.connect();

    try {
      const withdrawalId = req.params.id;
      const { status } = req.body;

      await client.query("BEGIN");

      const result = await client.query(
        `SELECT * FROM withdrawals WHERE id = $1 FOR UPDATE`,
        [withdrawalId]
      );

      if (result.rowCount === 0)
        return res.status(404).json({ error: "Retiro no encontrado" });

      const withdrawal = result.rows[0];

      // evitar doble aprobación
      if (withdrawal.status === "aprobado") {
        return res.status(400).json({ error: "Ya fue aprobado" });
      }

      await client.query(
        `UPDATE withdrawals SET status = $1 WHERE id = $2`,
        [status, withdrawalId]
      );

      // si rechaza -> devolver saldo
      if (status === "rechazado") {
        await client.query(
          `UPDATE users SET balance = balance + $1 WHERE id = $2`,
          [withdrawal.amount, withdrawal.user_id]
        );
      }

      await client.query("COMMIT");

      res.json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("ERROR APROBAR RETIRO:", err);
      res.status(500).json({ error: "Error actualizando retiro" });
    } finally {
      client.release();
    }
  }
);




/* cancelar inversion devolucion opcional */

app.post(
  "/api/admin/investments/:id/cancel",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    const client = await pool.connect();
    try {
      const investmentId = req.params.id;
      const { refundAmount, reason } = req.body;

      await client.query("BEGIN");

      const invRes = await client.query(
        `SELECT * FROM investments WHERE id = $1 FOR UPDATE`,
        [investmentId]
      );

      if (invRes.rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Inversión no encontrada" });
      }

      const inv = invRes.rows[0];

      // Cancelar inversión
      await client.query(
        `UPDATE investments SET status = 'cancelled' WHERE id = $1`,
        [investmentId]
      );

      // Devolver dinero si se indica
      if (refundAmount && Number(refundAmount) > 0) {
        await client.query(
          `UPDATE users SET balance = balance + $1 WHERE id = $2`,
          [refundAmount, inv.user_id]
        );
      }

      // Log sanción
      await client.query(
        `
        INSERT INTO sanctions
        (user_id, investment_id, admin_id, type, refund_amount, reason)
        VALUES ($1, $2, $3, 'cancel_refund', $4, $5)
        `,
        [inv.user_id, investmentId, req.user.id, refundAmount || 0, reason || null]
      );

      await client.query("COMMIT");
      res.json({ success: true });

    } catch (err) {
      await client.query("ROLLBACK");
      console.error("ERROR SANCIÓN:", err);
      res.status(500).json({ error: "Error sancionando inversión" });
    } finally {
      client.release();
    }
  }
);

/* congelar inverison x dias */

app.post(
  "/api/admin/investments/:id/freeze",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const investmentId = req.params.id;
      const { days, reason } = req.body;

      const frozenUntil = new Date();
      frozenUntil.setDate(frozenUntil.getDate() + Number(days));

      const invRes = await pool.query(
        `
        UPDATE investments
        SET status = 'frozen',
            frozen_until = $1
        WHERE id = $2
        RETURNING user_id
        `,
        [frozenUntil, investmentId]
      );

      if (invRes.rowCount === 0)
        return res.status(404).json({ error: "Inversión no encontrada" });

      await pool.query(
        `
        INSERT INTO sanctions
        (user_id, investment_id, admin_id, type, days, reason)
        VALUES ($1, $2, $3, 'freeze', $4, $5)
        `,
        [invRes.rows[0].user_id, investmentId, req.user.id, days, reason || null]
      );

      res.json({ success: true });
    } catch (err) {
      console.error("ERROR FREEZE:", err);
      res.status(500).json({ error: "Error congelando inversión" });
    }
  }
);

/*banear perma */

app.post(
  "/api/admin/investments/:id/ban",
  authMiddleware,
  adminMiddleware,
  async (req, res) => {
    try {
      const investmentId = req.params.id;
      const { reason } = req.body;

      const invRes = await pool.query(
        `
        UPDATE investments
        SET status = 'banned'
        WHERE id = $1
        RETURNING user_id
        `,
        [investmentId]
      );

      if (invRes.rowCount === 0)
        return res.status(404).json({ error: "Inversión no encontrada" });

      await pool.query(
        `
        INSERT INTO sanctions
        (user_id, investment_id, admin_id, type, reason)
        VALUES ($1, $2, $3, 'ban', $4)
        `,
        [invRes.rows[0].user_id, investmentId, req.user.id, reason || null]
      );

      res.json({ success: true });
    } catch (err) {
      console.error("ERROR BAN:", err);
      res.status(500).json({ error: "Error aplicando ban" });
    }
  }
);



/* CLAIM / RECOLECTAR INVERSIÓN */

app.post("/api/investments/:id/claim", authMiddleware, async (req, res) => {
  const client = await pool.connect();

  try {
    const investmentId = req.params.id;
    const userId = req.user.id;

    await client.query("BEGIN");

    // 1️⃣ Obtener inversión
    const invRes = await client.query(
      `
      SELECT *
      FROM investments
      WHERE id = $1 AND user_id = $2 AND status = 'active'
      FOR UPDATE
      `,
      [investmentId, userId]
    );

    if (invRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Inversión no encontrada" });
    }

    const investment = invRes.rows[0];

    // 2️⃣ Validar 24h (POSTGRES MANDA)
    const timeCheck = await client.query(
      `
      SELECT
        timezone('UTC', NOW()) >= ($1::timestamp + INTERVAL '24 hours') AS can_claim,
        EXTRACT(
          EPOCH FROM (
            ($1::timestamp + INTERVAL '24 hours') - timezone('UTC', NOW())
          )
        ) / 3600 AS hours_left
      `,
      [investment.last_claim_at]
    );



    if (!timeCheck.rows[0].can_claim) {
      await client.query("ROLLBACK");
      return res.json({
        canClaim: false,
        hoursLeft: Math.ceil(timeCheck.rows[0].hours_left),
        message: `Faltan ${Math.ceil(timeCheck.rows[0].hours_left)} horas`
      });
    }

    // 3️⃣ Calcular ganancia
    const profit =
      Number(investment.amount) * (Number(investment.daily_percent) / 100);

    // 4️⃣ Sumar balance
    await client.query(
      `
      UPDATE users
      SET balance = balance + $1
      WHERE id = $2
      `,
      [profit, userId]
    );

    // 5️⃣ Actualizar inversión
    await client.query(
      `
      UPDATE investments
      SET
        last_claim_at = NOW(),
        claimed_days = claimed_days + 1
      WHERE id = $1
      `,
      [investmentId]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      profit,
      message: "Ganancia recolectada correctamente"
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("ERROR CLAIM:", err);
    res.status(500).json({ error: "Error al recolectar" });
  } finally {
    client.release();
  }
});



 
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Backend corriendo en puerto ${PORT}`);
});

