const router = require('express').Router();
const pool = require('../config/db');
const { z, uuid, validarBody, validarQuery, validarIds } = require('../middleware/validar');
const { ApiError, noEncontrado, asyncH } = require('../middleware/errores');
const { requiereAuth, requiereRol, authOpcional, esStaff } = require('../middleware/auth');

const fecha = (campo) => z.string({ required_error: `${campo} es obligatoria` }).datetime({ offset: true, message: 'Debe ser fecha y hora ISO 8601, ej. 2026-11-20T14:00:00-05:00' });

const eventoSchema = z.object({
  titulo: z.string({ required_error: 'El título es obligatorio' }).trim().min(5, 'Mínimo 5 caracteres').max(150),
  descripcion: z.string({ required_error: 'La descripción es obligatoria' }).trim().min(20, 'Mínimo 20 caracteres').max(5000),
  fecha_inicio: fecha('La fecha de inicio'),
  fecha_fin: fecha('La fecha de fin'),
  cupo_maximo: z.number({ invalid_type_error: 'Debe ser un número' }).int('Debe ser un entero').positive('Debe ser mayor que 0').max(100000).nullable().optional(),
  estado: z.enum(['borrador', 'publicado', 'cancelado', 'finalizado'], { errorMap: () => ({ message: 'Estado inválido (borrador, publicado, cancelado o finalizado)' }) }).default('borrador'),
  imagen_url: z.string().url('Debe ser una URL válida').max(300).refine((u) => u.startsWith('https://'), 'Debe usar https://').nullable().optional(),
  categoria_id: uuid,
  lugar_id: uuid,
}).refine((d) => new Date(d.fecha_fin) > new Date(d.fecha_inicio), {
  message: 'La fecha de fin debe ser posterior a la de inicio', path: ['fecha_fin'],
});

const consultaSchema = z.object({
  q: z.string().trim().max(100).optional(),
  categoria_id: uuid.optional(),
  lugar_id: uuid.optional(),
  estado: z.enum(['borrador', 'publicado', 'cancelado', 'finalizado']).optional(),
  desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato AAAA-MM-DD').optional(),
  hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato AAAA-MM-DD').optional(),
  incluir_pasados: z.enum(['true', 'false']).default('false'),
  pagina: z.coerce.number().int().min(1).default(1),
  limite: z.coerce.number().int().min(1).max(50).default(12),
});

const BASE = `
  SELECT e.*, c.nombre AS categoria_nombre, c.color AS categoria_color, l.nombre AS lugar_nombre,
    (SELECT count(*)::int FROM inscripcion i WHERE i.evento_id = e.id AND i.estado = 'confirmada') AS inscritos
  FROM evento e
  JOIN categoria c ON c.id = e.categoria_id
  JOIN lugar l ON l.id = e.lugar_id`;

const conCupos = (e) => ({ ...e, cupos_disponibles: e.cupo_maximo == null ? null : Math.max(e.cupo_maximo - e.inscritos, 0) });

// Reglas de negocio compartidas por crear y actualizar
async function verificarReglas(b, { nuevo, idEvento }) {
  const detalles = [];
  const c = await pool.query('SELECT 1 FROM categoria WHERE id=$1', [b.categoria_id]);
  if (!c.rowCount) detalles.push({ campo: 'categoria_id', mensaje: 'La categoría no existe' });
  const l = await pool.query('SELECT capacidad FROM lugar WHERE id=$1', [b.lugar_id]);
  if (!l.rowCount) detalles.push({ campo: 'lugar_id', mensaje: 'El lugar no existe' });
  else if (l.rows[0].capacidad && b.cupo_maximo && b.cupo_maximo > l.rows[0].capacidad) {
    detalles.push({ campo: 'cupo_maximo', mensaje: `El cupo supera la capacidad del lugar (${l.rows[0].capacidad})` });
  }
  if (nuevo && new Date(b.fecha_inicio) < new Date()) {
    detalles.push({ campo: 'fecha_inicio', mensaje: 'No se puede crear un evento con fecha de inicio en el pasado' });
  }
  if (idEvento && b.cupo_maximo) {
    const n = await pool.query("SELECT count(*)::int AS n FROM inscripcion WHERE evento_id=$1 AND estado='confirmada'", [idEvento]);
    if (b.cupo_maximo < n.rows[0].n) {
      detalles.push({ campo: 'cupo_maximo', mensaje: `Ya hay ${n.rows[0].n} inscritos confirmados; el cupo no puede ser menor` });
    }
  }
  if (detalles.length) throw new ApiError(422, 'VALIDACION', 'El evento no cumple las reglas de negocio', detalles);
}

const staff = [requiereAuth, requiereRol('bienestar', 'admin')];
const cols = (b) => [b.titulo, b.descripcion, b.fecha_inicio, b.fecha_fin, b.cupo_maximo ?? null, b.estado, b.imagen_url ?? null, b.categoria_id, b.lugar_id];

// ---- LISTAR (público: solo eventos publicados) ----
router.get('/', authOpcional, validarQuery(consultaSchema), asyncH(async (req, res) => {
  const f = req.consulta;
  const w = [];
  const p = [];
  const add = (sql, v) => { p.push(v); w.push(sql.replace('?', `$${p.length}`)); };

  if (esStaff(req.usuario)) { if (f.estado) add('e.estado = ?', f.estado); }
  else w.push("e.estado = 'publicado'");
  if (f.q) { p.push(`%${f.q}%`); w.push(`(e.titulo ILIKE $${p.length} OR e.descripcion ILIKE $${p.length})`); }
  if (f.categoria_id) add('e.categoria_id = ?', f.categoria_id);
  if (f.lugar_id) add('e.lugar_id = ?', f.lugar_id);
  if (f.desde) add('e.fecha_inicio >= ?', f.desde);
  if (f.hasta) add("e.fecha_inicio < (?::date + 1)", f.hasta);
  if (f.incluir_pasados === 'false' && !f.desde) w.push('e.fecha_fin >= now()');

  const where = w.length ? `WHERE ${w.join(' AND ')}` : '';
  const total = await pool.query(`SELECT count(*)::int AS n FROM evento e ${where}`, p);
  const off = (f.pagina - 1) * f.limite;
  const { rows } = await pool.query(`${BASE} ${where} ORDER BY e.fecha_inicio ASC LIMIT ${f.limite} OFFSET ${off}`, p);
  res.json({ datos: rows.map(conCupos), pagina: f.pagina, limite: f.limite, total: total.rows[0].n });
}));

// ---- LEER UNO ----
router.get('/:id', authOpcional, validarIds('id'), asyncH(async (req, res) => {
  const { rows } = await pool.query(`${BASE} WHERE e.id = $1`, [req.params.id]);
  const e = rows[0];
  if (!e || (e.estado === 'borrador' && !esStaff(req.usuario))) throw noEncontrado('Evento');
  const out = conCupos(e);
  if (req.usuario) {
    const m = await pool.query('SELECT id, estado FROM inscripcion WHERE evento_id=$1 AND usuario_id=$2', [e.id, req.usuario.id]);
    out.mi_inscripcion = m.rows[0] || null;
  }
  res.json(out);
}));

// ---- CREAR ----
router.post('/', ...staff, validarBody(eventoSchema), asyncH(async (req, res) => {
  await verificarReglas(req.body, { nuevo: true });
  const { rows } = await pool.query(
    `INSERT INTO evento (titulo, descripcion, fecha_inicio, fecha_fin, cupo_maximo, estado, imagen_url, categoria_id, lugar_id, creado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`, [...cols(req.body), req.usuario.id]);
  const r = await pool.query(`${BASE} WHERE e.id = $1`, [rows[0].id]);
  res.status(201).json(conCupos(r.rows[0]));
}));

// ---- ACTUALIZAR ----
router.put('/:id', ...staff, validarIds('id'), validarBody(eventoSchema), asyncH(async (req, res) => {
  const ya = await pool.query('SELECT 1 FROM evento WHERE id=$1', [req.params.id]);
  if (!ya.rowCount) throw noEncontrado('Evento');
  await verificarReglas(req.body, { nuevo: false, idEvento: req.params.id });
  await pool.query(
    `UPDATE evento SET titulo=$1, descripcion=$2, fecha_inicio=$3, fecha_fin=$4, cupo_maximo=$5, estado=$6,
       imagen_url=$7, categoria_id=$8, lugar_id=$9 WHERE id=$10`, [...cols(req.body), req.params.id]);
  const r = await pool.query(`${BASE} WHERE e.id = $1`, [req.params.id]);
  res.json(conCupos(r.rows[0]));
}));

// ---- ELIMINAR ----
router.delete('/:id', ...staff, validarIds('id'), asyncH(async (req, res) => {
  const ya = await pool.query('SELECT 1 FROM evento WHERE id=$1', [req.params.id]);
  if (!ya.rowCount) throw noEncontrado('Evento');
  const n = await pool.query("SELECT count(*)::int AS n FROM inscripcion WHERE evento_id=$1 AND estado IN ('confirmada','en_espera')", [req.params.id]);
  if (n.rows[0].n > 0) {
    throw new ApiError(409, 'EVENTO_CON_INSCRITOS', `El evento tiene ${n.rows[0].n} inscripciones activas. Cámbialo a estado "cancelado" en lugar de eliminarlo`);
  }
  await pool.query('DELETE FROM evento WHERE id=$1', [req.params.id]);
  res.status(204).end();
}));

module.exports = router;
