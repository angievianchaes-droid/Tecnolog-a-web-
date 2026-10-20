const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { z, validarBody, validarQuery, validarIds } = require('../middleware/validar');
const { ApiError, noEncontrado, asyncH } = require('../middleware/errores');
const { requiereAuth, requiereRol } = require('../middleware/auth');
const { publico, correoInstitucional, contrasena } = require('./auth');

const base = {
  nombre: z.string({ required_error: 'El nombre es obligatorio' }).trim().min(3, 'Mínimo 3 caracteres').max(120),
  correo: correoInstitucional,
  rol: z.enum(['estudiante', 'bienestar', 'admin'], { errorMap: () => ({ message: 'Rol inválido (estudiante, bienestar o admin)' }) }),
  programa_academico: z.string().trim().max(120).optional().nullable(),
  codigo_estudiantil: z.string().trim().regex(/^[0-9]{6,15}$/, 'Solo dígitos (6 a 15)').optional().nullable(),
};
const crearSchema = z.object({ ...base, contrasena });
const editarSchema = z.object({ ...base, contrasena: contrasena.optional() }); // contraseña opcional al editar

const consultaSchema = z.object({
  q: z.string().trim().max(100).optional(),
  rol: z.enum(['estudiante', 'bienestar', 'admin']).optional(),
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(100).default(20),
});

// ---- Rutas "me" (cualquier usuario con sesión). Van ANTES de /:id ----
router.get('/me/inscripciones', requiereAuth, asyncH(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT i.id, i.estado, i.asistio, i.creado_en, e.id AS evento_id, e.titulo, e.fecha_inicio, e.fecha_fin, l.nombre AS lugar_nombre
     FROM inscripcion i JOIN evento e ON e.id = i.evento_id JOIN lugar l ON l.id = e.lugar_id
     WHERE i.usuario_id = $1 AND i.estado <> 'cancelada' ORDER BY e.fecha_inicio`, [req.usuario.id]);
  res.json(rows);
}));

// ---- CRUD de usuarios: solo administradores ----
const admin = [requiereAuth, requiereRol('admin')];

router.get('/', ...admin, validarQuery(consultaSchema), asyncH(async (req, res) => {
  const f = req.consulta;
  const w = []; const p = [];
  if (f.rol) { p.push(f.rol); w.push(`rol = $${p.length}`); }
  if (f.q) { p.push(`%${f.q}%`); w.push(`(nombre ILIKE $${p.length} OR correo ILIKE $${p.length})`); }
  const where = w.length ? `WHERE ${w.join(' AND ')}` : '';
  const total = await pool.query(`SELECT count(*)::int AS n FROM usuario ${where}`, p);
  const { rows } = await pool.query(`SELECT * FROM usuario ${where} ORDER BY nombre LIMIT ${f.limite} OFFSET ${(f.pagina - 1) * f.limite}`, p);
  res.json({ datos: rows.map(publico), pagina: f.pagina, limite: f.limite, total: total.rows[0].n });
}));

router.get('/:id', ...admin, validarIds('id'), asyncH(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM usuario WHERE id=$1', [req.params.id]);
  if (!rows[0]) throw noEncontrado('Usuario');
  res.json(publico(rows[0]));
}));

router.post('/', ...admin, validarBody(crearSchema), asyncH(async (req, res) => {
  const b = req.body;
  const hash = await bcrypt.hash(b.contrasena, 10);
  const { rows } = await pool.query(
    `INSERT INTO usuario (nombre, correo, contrasena_hash, rol, programa_academico, codigo_estudiantil)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [b.nombre, b.correo, hash, b.rol, b.programa_academico ?? null, b.codigo_estudiantil ?? null]);
  res.status(201).json(publico(rows[0]));
}));

router.put('/:id', ...admin, validarIds('id'), validarBody(editarSchema), asyncH(async (req, res) => {
  const b = req.body;
  if (req.params.id === req.usuario.id && b.rol !== 'admin') {
    throw new ApiError(422, 'VALIDACION', 'No puedes quitarte a ti mismo el rol de administrador', [{ campo: 'rol', mensaje: 'Operación no permitida sobre tu propia cuenta' }]);
  }
  const hash = b.contrasena ? await bcrypt.hash(b.contrasena, 10) : null;
  const { rows } = await pool.query(
    `UPDATE usuario SET nombre=$1, correo=$2, rol=$3, programa_academico=$4, codigo_estudiantil=$5,
       contrasena_hash = COALESCE($6, contrasena_hash) WHERE id=$7 RETURNING *`,
    [b.nombre, b.correo, b.rol, b.programa_academico ?? null, b.codigo_estudiantil ?? null, hash, req.params.id]);
  if (!rows[0]) throw noEncontrado('Usuario');
  res.json(publico(rows[0]));
}));

router.delete('/:id', ...admin, validarIds('id'), asyncH(async (req, res) => {
  if (req.params.id === req.usuario.id) {
    throw new ApiError(409, 'OPERACION_NO_PERMITIDA', 'No puedes eliminar tu propia cuenta');
  }
  const r = await pool.query('DELETE FROM usuario WHERE id=$1', [req.params.id]);
  if (!r.rowCount) throw noEncontrado('Usuario');
  res.status(204).end();
}));

module.exports = router;
