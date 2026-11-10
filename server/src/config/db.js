require('dotenv').config();
const { Pool } = require('pg');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Falta DATABASE_URL en el archivo .env');
  process.exit(1);
}

// Las bases de datos en internet (Neon, Render…) exigen conexión cifrada (SSL).
// No hace falta en local ni dentro de Docker (host "db"). Si la URL ya trae ?sslmode=…, se respeta.
// DB_SSL=true|false fuerza el comportamiento si alguna vez se necesita.
const esLocal = /@(localhost|127\.0\.0\.1|db)(:|\/)/.test(url);
const traeSsl = /sslmode=/.test(url);
let ssl;
if (process.env.DB_SSL === 'true') ssl = true;
else if (process.env.DB_SSL === 'false') ssl = false;
else ssl = esLocal || traeSsl ? undefined : true;

const pool = new Pool({
  connectionString: url,
  ssl,
  max: 10,
  idleTimeoutMillis: 30000,
  // Neon se suspende tras unos minutos sin uso: damos tiempo a que despierte
  connectionTimeoutMillis: 20000,
});

// Sin este manejador, una conexión inactiva que la base cierra (p. ej. Neon al suspenderse)
// hace caer todo el proceso de Node. Así solo se registra y el pool abre otra conexión.
pool.on('error', (e) => console.error('Conexión inactiva con la base de datos cerrada:', e.message));

module.exports = pool;