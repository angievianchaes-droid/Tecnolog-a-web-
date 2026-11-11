// Cambia la contraseña de los 4 usuarios de ejemplo SIN borrar ningún dato.
// Sirve para reemplazar las contraseñas públicas antiguas en una base que ya existe (por ejemplo Neon).
//
// Uso (PowerShell), con la base a modificar en DATABASE_URL:
//   $env:DATABASE_URL = "postgresql://...neon.tech/neondb?sslmode=require"
//   $env:ADMIN_PASSWORD = "..."; $env:BIENESTAR_PASSWORD = "..."; $env:ESTUDIANTE_PASSWORD = "..."
//   node server/src/config/cambiar-passwords.js
const bcrypt = require('bcryptjs');
const pool = require('./db');

const cuentas = [
  ['admin@unitropico.edu.co', 'ADMIN_PASSWORD'],
  ['bienestar@unitropico.edu.co', 'BIENESTAR_PASSWORD'],
  ['laura.rincon@unitropico.edu.co', 'ESTUDIANTE_PASSWORD'],
  ['juan.perez@unitropico.edu.co', 'ESTUDIANTE_PASSWORD'],
];

async function main() {
  for (const [, variable] of cuentas) {
    const v = process.env[variable];
    if (!v) throw new Error(`Falta la variable ${variable}`);
    if (v.length < 10) throw new Error(`${variable} debe tener al menos 10 caracteres`);
    if (/1234$/.test(v)) throw new Error(`${variable} no puede terminar en 1234 (es fácil de adivinar)`);
  }
  for (const [correo, variable] of cuentas) {
    const { rowCount } = await pool.query(
      'UPDATE usuario SET contrasena_hash = $1 WHERE correo = $2',
      [bcrypt.hashSync(process.env[variable], 10), correo],
    );
    console.log(`${correo}: ${rowCount ? 'contraseña actualizada' : 'no existe en esta base (sin cambios)'}`);
  }
  await pool.end();
}

main().catch(async (e) => {
  console.error('Error:', e.message);
  await pool.end().catch(() => {});
  process.exit(1);
});
 