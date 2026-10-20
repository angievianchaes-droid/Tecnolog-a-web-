// Se monta en /api/eventos  →  /:id/inscripciones...
const router = require('express').Router({ mergeParams: true });
const pool = require('../config/db');
const { z, validarBody, validarIds } = require('../middleware/validar');
const { ApiError, noEncontrado, asyncH } = require('../middleware/errores');
const { requiereAuth, requiereRol } = require('../middleware/auth');

const staff = [requiereAuth, requiereRol('bienestar', 'admin')];

// Inscribirse: transacción con bloqueo de la fila del evento para que dos personas
// no tomen el último cupo al mismo tiempo.
router.post('/:id/inscripciones', requiereAuth, validarIds('id'), asyncH(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ev = await client.query('SELECT id, estado, fecha_fin, cupo_maximo FROM evento WHERE id=$1 FOR UPDATE', [req.params.id]);
    const e = ev.rows[0];
    if (!e || e.estado === 'borrador') throw noEncontrado('Evento');
    if (e.estado !== 'publicado') throw new ApiError(422, 'EVENTO_NO_DISPONIBLE', `El evento está ${e.estado}; no admite inscripciones`);
    if (new Date(e.fecha_fin) < new Date()) throw new ApiError(422, 'EVENTO_TERMINADO', 'El evento ya terminó');

    const ex = await client.query('SELECT id, estado FROM inscripcion WHERE evento_id=$1 AND usuario_id=$2', [e.id, req.usuario.id]);
    if (ex.rows[0] && ex.rows[0].estado !== 'cancelada') {
      throw new ApiError(409, 'YA_INSCRITO', 'Ya estás inscrito (o en lista de espera) en este evento');
    }
    const n = await client.query("SELECT count(*)::int AS n FROM inscripcion WHERE evento_id=$1 AND estado='confirmada'", [e.id]);
    const lleno = e.cupo_maximo != null && n.rows[0].n >= e.cupo_maximo;
    const estado = lleno ? 'en_espera' : 'confirmada';

    let r;
    if (ex.rows[0]) { // reactivar una inscripción cancelada antes
      r = await client.query("UPDATE inscripcion SET estado=$1, asistio=false, asistencia_registrada_en=NULL WHERE id=$2 RETURNING *", [estado, ex.rows[0].id]);
    } else {
      r = await client.query('INSERT INTO inscripcion (evento_id, usuario_id, estado) VALUES ($1,$2,$3) RETURNING *', [e.id, req.usuario.id, estado]);
    }
    await client.query('COMMIT');
    res.status(201).json(r.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}));

// Cancelar mi inscripción; si había lista de espera, entra el primero
router.delete('/:id/inscripciones/mia', requiereAuth, validarIds('id'), asyncH(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM evento WHERE id=$1 FOR UPDATE', [req.params.id]);
    const r = await client.query(
      "UPDATE inscripcion SET estado='cancelada' WHERE evento_id=$1 AND usuario_id=$2 AND estado <> 'cancelada' RETURNING estado",
      [req.params.id, req.usuario.id]);
    if (!r.rowCount) throw noEncontrado('Inscripción');
    await client.query(
      `UPDATE inscripcion SET estado='confirmada' WHERE id = (
         SELECT i.id FROM inscripcion i JOIN evento e ON e.id = i.evento_id
         WHERE i.evento_id=$1 AND i.estado='en_espera'
           AND (e.cupo_maximo IS NULL OR (SELECT count(*) FROM inscripcion WHERE evento_id=$1 AND estado='confirmada') < e.cupo_maximo)
         ORDER BY i.creado_en LIMIT 1)`, [req.params.id]);
    await client.query('COMMIT');
    res.status(204).end();
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}));

// Lista de inscritos de un evento (Bienestar)
router.get('/:id/inscripciones', ...staff, validarIds('id'), asyncH(async (req, res) => {
  const ev = await pool.query('SELECT 1 FROM evento WHERE id=$1', [req.params.id]);
  if (!ev.rowCount) throw noEncontrado('Evento');
  const { rows } = await pool.query(
    `SELECT i.id, i.estado, i.asistio, i.asistencia_registrada_en, i.creado_en,
            u.id AS usuario_id, u.nombre, u.correo, u.programa_academico
     FROM inscripcion i JOIN usuario u ON u.id = i.usuario_id
     WHERE i.evento_id=$1 AND i.estado <> 'cancelada' ORDER BY i.creado_en`, [req.params.id]);
  res.json(rows);
}));

// Registrar asistencia
router.patch('/:id/inscripciones/:inscripcionId/asistencia', ...staff, validarIds('id', 'inscripcionId'),
  validarBody(z.object({ asistio: z.boolean({ required_error: 'Indica si asistió (true/false)', invalid_type_error: 'Debe ser true o false' }) })),
  asyncH(async (req, res) => {
    const { rows } = await pool.query(
      `UPDATE inscripcion SET asistio=$1, asistencia_registrada_en = CASE WHEN $1 THEN now() ELSE NULL END
       WHERE id=$2 AND evento_id=$3 AND estado='confirmada' RETURNING *`,
      [req.body.asistio, req.params.inscripcionId, req.params.id]);
    if (!rows[0]) throw noEncontrado('Inscripción confirmada');
    res.json(rows[0]);
  }));

module.exports = router;
