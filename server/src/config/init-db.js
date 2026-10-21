// Crea las tablas y carga datos de ejemplo.  Uso:  npm run db:init
// Es seguro repetirlo: no duplica datos si ya existen.
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('./db');

const dias = (n, hora = 9) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(hora, 0, 0, 0);
  return d.toISOString();
};

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, '../../../db/schema.sql'), 'utf8');
  await pool.query(sql);

  const { rows } = await pool.query('SELECT count(*)::int AS n FROM usuario');
  if (rows[0].n > 0) {
    console.log('La base ya tiene datos. Esquema verificado, no se cargaron ejemplos.');
    return pool.end();
  }

  const hash = (p) => bcrypt.hashSync(p, 10);
  const usuarios = [
    ['Administrador Bienestar', 'admin@unitropico.edu.co', hash('Admin1234'), 'admin', null, null],
    ['Coordinación de Bienestar', 'bienestar@unitropico.edu.co', hash('Bienestar1234'), 'bienestar', null, null],
    ['Laura Sofía Rincón', 'laura.rincon@unitropico.edu.co', hash('Estudiante1234'), 'estudiante', 'Ingeniería de Sistemas', '1116660001'],
    ['Juan David Pérez', 'juan.perez@unitropico.edu.co', hash('Estudiante1234'), 'estudiante', 'Medicina Veterinaria y Zootecnia', '1116660002'],
  ];
  const ids = {};
  for (const u of usuarios) {
    const r = await pool.query(
      `INSERT INTO usuario (nombre, correo, contrasena_hash, rol, programa_academico, codigo_estudiantil)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`, u);
    ids[u[1]] = r.rows[0].id;
  }

  const categorias = [
    ['Deporte', 'Torneos, entrenamientos y actividad física', '#1b7f3b'],
    ['Cultura', 'Danza, música, teatro y tradiciones llaneras', '#c2410c'],
    ['Salud y bienestar', 'Salud física, mental y prevención', '#0e7490'],
    ['Académico', 'Charlas, talleres y apoyo académico', '#4338ca'],
    ['Ambiental', 'Cuidado del entorno y la biodiversidad de la Orinoquía', '#4d7c0f'],
    ['Recreación', 'Cine, juegos y espacios de integración', '#be185d'],
  ];
  const cat = {};
  for (const c of categorias) {
    const r = await pool.query('INSERT INTO categoria (nombre, descripcion, color) VALUES ($1,$2,$3) RETURNING id', c);
    cat[c[0]] = r.rows[0].id;
  }

  const lugares = [
    ['Coliseo cubierto', 'Campus Unitrópico, Yopal', 800],
    ['Auditorio principal', 'Campus Unitrópico, Yopal', 300],
    ['Cancha de fútbol', 'Campus Unitrópico, Yopal', 500],
    ['Sala de conferencias de la biblioteca', 'Campus Unitrópico, Yopal', 80],
    ['Zona verde central', 'Campus Unitrópico, Yopal', 400],
    ['Oficina de Bienestar Universitario', 'Campus Unitrópico, Yopal', 30],
  ];
  const lug = {};
  for (const l of lugares) {
    const r = await pool.query('INSERT INTO lugar (nombre, direccion, capacidad) VALUES ($1,$2,$3) RETURNING id', l);
    lug[l[0]] = r.rows[0].id;
  }

  const por = ids['bienestar@unitropico.edu.co'];
  const eventos = [
    ['Torneo interfacultades de microfútbol', 'Competencia entre programas académicos. Inscripción por equipos de 7 jugadores en la oficina de Bienestar. Se premia a los tres primeros puestos.', dias(3, 14), dias(3, 18), 200, 'publicado', 'Deporte', 'Cancha de fútbol'],
    ['Festival del Joropo y la cultura llanera', 'Muestra de danza, música llanera y gastronomía regional con grupos de la comunidad universitaria y artistas invitados de Casanare.', dias(7, 18), dias(7, 22), 300, 'publicado', 'Cultura', 'Auditorio principal'],
    ['Jornada de donación de sangre', 'En alianza con el hospital regional. Requisitos: ser mayor de 18 años, pesar más de 50 kg, desayunar antes de donar y llevar documento de identidad.', dias(5, 8), dias(5, 13), 60, 'publicado', 'Salud y bienestar', 'Coliseo cubierto'],
    ['Taller: manejo del estrés en época de parciales', 'Técnicas de respiración, organización del tiempo y hábitos de estudio, con el equipo de psicología de Bienestar.', dias(2, 15), dias(2, 17), 40, 'publicado', 'Salud y bienestar', 'Sala de conferencias de la biblioteca'],
    ['Feria de emprendimiento estudiantil', 'Los estudiantes presentan sus ideas de negocio y productos. Entrada libre para toda la comunidad universitaria.', dias(10, 9), dias(10, 16), null, 'publicado', 'Académico', 'Zona verde central'],
    ['Cine foro: la Orinoquía en el cine colombiano', 'Proyección de cortometrajes regionales seguida de conversatorio con realizadores.', dias(4, 18), dias(4, 21), 80, 'publicado', 'Recreación', 'Auditorio principal'],
    ['Caminata ecológica y siembra de árboles nativos', 'Jornada de siembra con especies nativas del piedemonte llanero. Llevar gorra, hidratación y calzado cómodo.', dias(12, 6), dias(12, 11), 120, 'publicado', 'Ambiental', 'Zona verde central'],
    ['Charla de salud mental: pedir ayuda sí es de valientes', 'Conversatorio abierto sobre salud mental universitaria y rutas de atención disponibles en la institución.', dias(8, 10), dias(8, 12), 150, 'publicado', 'Salud y bienestar', 'Auditorio principal'],
    ['Torneo relámpago de ajedrez', 'Formato suizo a 5 rondas. Traer reloj si lo tienen; Bienestar presta tableros.', dias(6, 14), dias(6, 18), 32, 'publicado', 'Deporte', 'Sala de conferencias de la biblioteca'],
    ['Clases abiertas de danza folclórica', 'Primera sesión del semillero de danza. No se requiere experiencia previa.', dias(9, 16), dias(9, 18), 50, 'publicado', 'Cultura', 'Coliseo cubierto'],
    ['Intercambio de libros y juegos de mesa', 'Borrador del próximo evento de integración. Aún sin fecha confirmada.', dias(20, 15), dias(20, 18), 60, 'borrador', 'Recreación', 'Zona verde central'],
  ];
  const evId = [];
  for (const e of eventos) {
    const r = await pool.query(
      `INSERT INTO evento (titulo, descripcion, fecha_inicio, fecha_fin, cupo_maximo, estado, categoria_id, lugar_id, creado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [e[0], e[1], e[2], e[3], e[4], e[5], cat[e[6]], lug[e[7]], por]);
    evId.push(r.rows[0].id);
  }
  // Algunas inscripciones de ejemplo
  await pool.query(`INSERT INTO inscripcion (evento_id, usuario_id) VALUES ($1,$2),($3,$2),($1,$4)`,
    [evId[0], ids['laura.rincon@unitropico.edu.co'], evId[3], ids['juan.perez@unitropico.edu.co']]);

  console.log('Base de datos lista con datos de ejemplo.');
  console.log('Usuarios de prueba:');
  console.log('  admin@unitropico.edu.co        / Admin1234');
  console.log('  bienestar@unitropico.edu.co    / Bienestar1234');
  console.log('  laura.rincon@unitropico.edu.co / Estudiante1234');
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
