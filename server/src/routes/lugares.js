const router = require('express').Router();
const pool = require('../config/db');
const { z, validarBody, validarIds } = require('../middleware/validar');
const { noEncontrado, asyncH } = require('../middleware/errores');
const { requiereAuth, requiereRol } = require('../middleware/auth');

const schema = z.object({
  nombre: z.string({ required_error: 'El nombre es obligatorio' }).trim().min(3, 'Mínimo 3 caracteres').max(100),
  direccion: z.string().trim().max(200).optional().nullable(),
  capacidad: z.number({ invalid_type_error: 'Debe ser un número' }).int('Debe ser un entero').positive('Debe ser mayor que 0').max(100000).optional().nullable(),
  latitud: z.number().min(-90).max(90).optional().nullable(),
  longitud: z.number().min(-180).max(180).optional().nullable(),
});

const staff = [requiereAuth, requiereRol('bienestar', 'admin')];
const vals = (b) => [b.nombre, b.direccion ?? null, b.capacidad ?? null, b.latitud ?? null, b.longitud ?? null];

router.get('/', asyncH(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM lugar ORDER BY nombre');
  res.json(rows);
}));

router.get('/:id', validarIds('id'), asyncH(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM lugar WHERE id = $1', [req.params.id]);
  if (!rows[0]) throw noEncontrado('Lugar');
  res.json(rows[0]);
}));

router.post('/', ...staff, validarBody(schema), asyncH(async (req, res) => {
  const { rows } = await pool.query(
    'INSERT INTO lugar (nombre, direccion, capacidad, latitud, longitud) VALUES ($1,$2,$3,$4,$5) RETURNING *', vals(req.body));
  res.status(201).json(rows[0]);
}));

router.put('/:id', ...staff, validarIds('id'), validarBody(schema), asyncH(async (req, res) => {
  const { rows } = await pool.query(
    'UPDATE lugar SET nombre=$1, direccion=$2, capacidad=$3, latitud=$4, longitud=$5 WHERE id=$6 RETURNING *',
    [...vals(req.body), req.params.id]);
  if (!rows[0]) throw noEncontrado('Lugar');
  res.json(rows[0]);
}));

router.delete('/:id', ...staff, validarIds('id'), asyncH(async (req, res) => {
  const r = await pool.query('DELETE FROM lugar WHERE id = $1', [req.params.id]);
  if (!r.rowCount) throw noEncontrado('Lugar');
  res.status(204).end();
}));

module.exports = router;
