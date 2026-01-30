const express = require("express");
const router = express.Router();
const pool = require("../db");
const multer = require("multer");
const path = require("path");

/* ===============================
   CONFIG SUBIDA DE IMAGENES
================================= */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(
      null,
      Date.now() +
        "-" +
        Math.round(Math.random() * 1e9) +
        path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage });

/* ===============================
   CREAR CAJA
================================= */
router.post("/cases", upload.single("image"), async (req, res) => {
  const { name, price } = req.body;
  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const result = await pool.query(
      `INSERT INTO cases (name, price, image, active)
       VALUES ($1,$2,$3,true)
       RETURNING *`,
      [name, price, imagePath]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error creando caja" });
  }
});

/* ===============================
   LISTAR CAJAS ACTIVAS
================================= */
router.get("/cases", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM cases WHERE active=true ORDER BY id DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Error listando cajas" });
  }
});

/* ===============================
   ELIMINAR CAJA
================================= */
router.delete("/cases/:id", async (req, res) => {
  const { id } = req.params;

  await pool.query("DELETE FROM cases WHERE id=$1", [id]);
  res.json({ success: true });
});

/* ===============================
   CREAR ITEM NORMAL
================================= */
router.post(
  "/cases/:case_id/items",
  upload.single("image"),
  async (req, res) => {
    const { case_id } = req.params;
    const { name, price, drop_chance } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    if (drop_chance < 0 || drop_chance > 100)
      return res
        .status(400)
        .json({ error: "La probabilidad debe estar entre 0 y 100" });

    const result = await pool.query(
      `INSERT INTO case_items (case_id,name,image,price,drop_chance)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [case_id, name, imagePath, price, drop_chance]
    );

    res.json(result.rows[0]);
  }
);

/* ===============================
   LISTAR ITEMS DE UNA CAJA
================================= */
router.get("/cases/:case_id/items", async (req, res) => {
  const { case_id } = req.params;

  try {

    const normal = await pool.query(
      `SELECT id, name, image, price AS value, drop_chance AS probability,
      false AS is_special
      FROM case_items
      WHERE case_id=$1`,
      [case_id]
    );

    const special = await pool.query(
      `SELECT id, name, image, total_value AS value,
      special_chance AS probability,
      true AS is_special
      FROM case_special_items
      WHERE case_id=$1 AND active=true`,
      [case_id]
    );

    res.json([...normal.rows, ...special.rows]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error obteniendo items" });
  }
});




/* ===============================
   CREAR OBJETO ESPECIAL
================================= */
router.post(
  "/cases/:case_id/special",
  upload.single("image"),
  async (req, res) => {
    const { case_id } = req.params;
    const { name, max_drops, special_chance } = req.body;
    const imagePath = req.file ? `/uploads/${req.file.filename}` : null;

    if (special_chance < 0 || special_chance > 100)
      return res
        .status(400)
        .json({ error: "Probabilidad debe estar entre 0 y 100" });

    const result = await pool.query(
      `INSERT INTO case_special_items
      (case_id,name,image,max_drops,special_chance,total_value,duration_days,dropped_count,active)
       VALUES ($1,$2,$3,$4,$5,NULL,NULL,0,false)
       RETURNING *`,
      [case_id, name, imagePath, max_drops, special_chance]
    );

    res.json(result.rows[0]);
  }
);

/* ===============================
   ABRIR CAJA NORMAL
================================= */
router.post("/cases/:case_id/open", async (req, res) => {
  try {
    const { case_id } = req.params;
    const { user_id } = req.body;

    // 1. obtener usuario
    const userResult = await pool.query(
      "SELECT id, balance FROM users WHERE id=$1",
      [user_id]
    );

    if (userResult.rows.length === 0)
      return res.status(400).json({ error: "Usuario no existe" });

    const user = userResult.rows[0];

    // 2. obtener precio de la caja
    const boxResult = await pool.query(
      "SELECT price FROM cases WHERE id=$1",
      [case_id]
    );

    if (boxResult.rows.length === 0)
      return res.status(400).json({ error: "Caja no existe" });

    const boxPrice = Number(boxResult.rows[0].price);
    const userBalance = Number(user.balance);

    // 3. validar saldo
    if (userBalance < boxPrice) {
      return res.status(400).json({ error: "Saldo insuficiente" });
    }

    // 4. descontar saldo
    await pool.query(
      "UPDATE users SET balance = balance - $1 WHERE id=$2",
      [boxPrice, user_id]
    );

    // 5. obtener items normales
    const normalItems = await pool.query(
      "SELECT id, name, image, price AS value, drop_chance FROM case_items WHERE case_id=$1",
      [case_id]
    );

    // 6. obtener especiales válidos
    const specialItems = await pool.query(
      `SELECT id, name, image, total_value, max_drops, dropped_count, special_chance
       FROM case_special_items
       WHERE case_id=$1 AND active=true AND dropped_count < max_drops`,
      [case_id]
    );

    let drop = null;

    // 7. sortear especial
    if (specialItems.rows.length > 0) {
      const sp = specialItems.rows[0];
      const chance = Number(sp.special_chance) || 0;
      const roll = Math.random() * 100;

      if (roll <= chance) {
        drop = sp;

        await pool.query(
          "UPDATE case_special_items SET dropped_count = dropped_count + 1 WHERE id=$1",
          [sp.id]
        );
      }
    }

// 8. sino sale especial → normal (RESPETANDO PROBABILIDADES)
   if (!drop) {
     const normals = normalItems.rows;
   
     // filtrar items con probabilidad > 0
     const validItems = normals.filter(i => Number(i.drop_chance) > 0);
   
     const totalChance = validItems.reduce(
       (sum, item) => sum + Number(item.drop_chance),
       0
     );
   
     let roll = Math.random() * totalChance;
     let accumulated = 0;
   
     for (const item of validItems) {
       accumulated += Number(item.drop_chance);
       if (roll <= accumulated) {
         drop = item;
         break;
       }
     }
   
     const reward = Number(drop.value) || 0;
   
     await pool.query(
       "UPDATE users SET balance = balance + $1 WHERE id=$2",
       [reward, user_id]
     );
   }


    // 9. saldo final
    const newBalanceResult = await pool.query(
      "SELECT balance FROM users WHERE id=$1",
      [user_id]
    );

    res.json({
      success: true,
      drop,
      balance: newBalanceResult.rows[0].balance
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al abrir la caja" });
  }
});




/* ===============================
   ASIGNAR VALOR Y DURACIÓN A ESPECIAL
================================= */
router.post("/special/:id/set-value", async (req, res) => {
  const { id } = req.params;
  const { total_value, duration_days } = req.body;

  await pool.query(
    `UPDATE case_special_items
     SET total_value=$1, duration_days=$2, active=true
     WHERE id=$3`,
    [total_value, duration_days, id]
  );

  res.json({ success: true });
});

/* ===============================
   ENTREGAR ESPECIAL MANUALMENTE
================================= */
router.post("/special/give", async (req, res) => {
  const { user_id, special_id } = req.body;

  try {
    await pool.query("BEGIN");

    const result = await pool.query(
      "SELECT * FROM case_special_items WHERE id=$1 FOR UPDATE",
      [special_id]
    );

    const sp = result.rows[0];

    if (!sp) throw new Error("Especial no existe");

    if (sp.dropped_count >= sp.max_drops)
      throw new Error("Ya se entregaron todos los drops disponibles");

    await pool.query(
      `INSERT INTO user_special_items
      (user_id,special_id,total_value,remaining_value,remaining_days,status)
      VALUES ($1,$2,$3,$3,$4,'inactive')`,
      [user_id, sp.id, sp.total_value, sp.duration_days]
    );

    await pool.query(
      `UPDATE case_special_items
       SET dropped_count = dropped_count + 1
       WHERE id=$1`,
      [special_id]
    );

    await pool.query("COMMIT");

    res.json({ success: true, message: "Objeto especial entregado" });
  } catch (err) {
    await pool.query("ROLLBACK");
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
