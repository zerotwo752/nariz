const path = require('path');
const dotenv = require('dotenv');

const envFiles = [
  path.resolve(__dirname, '..', '.env'),
  path.resolve(__dirname, '..', '..', '.env'),
];

for (const envFile of envFiles) {
  dotenv.config({ path: envFile, override: false, quiet: true });
}

function cleanDatabaseUrl(value) {
  if (!value) return value;

  return value
    .trim()
    .replace(/^psql\s+/, '')
    .replace(/^['"]|['"]$/g, '');
}

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = cleanDatabaseUrl(process.env.DATABASE_URL);
}

module.exports = { cleanDatabaseUrl };
