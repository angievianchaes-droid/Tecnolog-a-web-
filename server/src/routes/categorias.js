const router = require('express').Router();
const pool = require('../config/db');
const { z, validarBody, validarIds } = require('../middleware/validar');
const { noEncontrado, asyncH } = require('../middleware/errores');
const { requiereAuth, requiereRol } = require('../middleware/auth');

const schema = z.object({
  nombre: z.string({ required_error: 'El nombre es obligatorio' }).trim().min(3, 'Mínimo 3 caracteres').max(60),
  descripcion: z.string().trim().max(300).optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Debe ser un color hexadecimal, ej. #1b7f3b').optional(),
});

const staff = [requiereAuth, requiereRol('bienestar', 'admin')];

router.get('/', asyncH(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM categoria ORDER BY nombre');
  res.json(rows);
}));

router.get('/:id', validarIds('id'), asyncH(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM categoria WHERE id = $1', [req.params.id]);
  if (!rows[0]) throw noEncontrado('Categoría');
  res.json(rows[0]);
}));

router.post('/', ...staff, validarBody(schema), asyncH(async (req, res) => {
  const { nombre, descripcion = null, color = '#2e7d32' } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO categoria (nombre, descripcion, color) VALUES ($1,$2,$3) RETURNING *', [nombre, descripcion, color]);
  res.status(201).json(rows[0]);
}));

router.put('/:id', ...staff, validarIds('id'), validarBody(schema), asyncH(async (req, res) => {
  const { nombre, descripcion = null, color = '#2e7d32' } = req.body;
  const { rows } = await pool.query(
    'UPDATE categoria SET nombre=$1, descripcion=$2, color=$3 WHERE id=$4 RETURNING *',
    [nombre, descripcion, color, req.params.id]);
  if (!rows[0]) throw noEncontrado('Categoría');
  res.json(rows[0]);
}));

router.delete('/:id', ...staff, validarIds('id'), asyncH(async (req, res) => {
  // Si hay eventos que usan la categoría, PostgreSQL lo impide (FK RESTRICT) → 409
  const r = await pool.query('DELETE FROM categoria WHERE id = $1', [req.params.id]);
  if (!r.rowCount) throw noEncontrado('Categoría');
  res.status(204).end();
}));

module.exports = router;
