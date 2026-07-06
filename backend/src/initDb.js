require('./env');
const fs = require('fs/promises');
const path = require('path');
const { pool } = require('./db');

async function runSqlFile(relativePath) {
  const filePath = path.resolve(__dirname, '..', relativePath);
  const sql = await fs.readFile(filePath, 'utf8');
  await pool.query(sql);
}

async function ensureDatabase() {
  await runSqlFile('database/schema.sql');
  await runSqlFile('database/seed.sql');
}

if (require.main === module) {
  ensureDatabase()
    .then(async () => {
      console.log('Base de datos inicializada correctamente.');
      await pool.end();
    })
    .catch(async (error) => {
      console.error('No se pudo inicializar la base de datos:', error.message);
      await pool.end().catch(() => {});
      process.exit(1);
    });
}

module.exports = { ensureDatabase };
