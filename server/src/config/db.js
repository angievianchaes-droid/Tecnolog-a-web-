require('dotenv').config();
const { Pool } = require('pg');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DATABASE_URL en el archivo .env');
  process.exit(1);
}

// Las bases de datos en internet (Neon, Render…) exigen conexión cifrada (SSL).
// En local (localhost) no hace falta. Si la URL ya trae ?sslmode=…, se respeta.
const esLocal = /@(localhost|127\.0\.0\.1)(:|\/)/.test(url);
const traeSsl = /sslmode=/.test(url);

const pool = new Pool({
  connectionString: url,
  ssl: esLocal || traeSsl ? undefined : true,
});
module.exports = pool;