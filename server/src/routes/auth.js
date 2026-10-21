const router = require('express').Router();
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const pool = require('../config/db');
const { z, validarBody } = require('../middleware/validar');
const { ApiError, asyncH } = require('../middleware/errores');
const { firmarToken, requiereAuth } = require('../middleware/auth');

const correoInstitucional = z
  .string({ required_error: 'El correo es obligatorio' })
  .trim().toLowerCase()
  .email('Formato de correo inválido')
  .max(160)
  .refine((c) => c.endsWith('@unitropico.edu.co'), 'Debe ser un correo institucional @unitropico.edu.co');

const contrasena = z
  .string({ required_error: 'La contraseña es obligatoria' })
  .min(8, 'Mínimo 8 caracteres')
  .max(72, 'Máximo 72 caracteres')
  .regex(/[A-Za-z]/, 'Debe incluir al menos una letra')
  .regex(/[0-9]/, 'Debe incluir al menos un número');

const registroSchema = z.object({
  nombre: z.string({ required_error: 'El nombre es obligatorio' }).trim().min(3, 'Mínimo 3 caracteres').max(120),
  correo: correoInstitucional,
  contrasena,
  programa_academico: z.string().trim().max(120).optional().nullable(),
  codigo_estudiantil: z.string().trim().regex(/^[0-9]{6,15}$/, 'Solo dígitos (6 a 15)').optional().nullable(),
});

const loginSchema = z.object({
  correo: z.string({ required_error: 'El correo es obligatorio' }).trim().toLowerCase().email('Formato de correo inválido'),
  contrasena: z.string({ required_error: 'La contraseña es obligatoria' }).min(1, 'La contraseña es obligatoria'),
});

// Limita intentos de login para frenar ataques de fuerza bruta
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.LOGIN_LIMITE) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ codigo: 'DEMASIADOS_INTENTOS', mensaje: 'Demasiados intentos. Intenta de nuevo en unos minutos' }),
});

const publico = (u) => ({
  id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol,
  programa_academico: u.programa_academico, codigo_estudiantil: u.codigo_estudiantil,
  creado_en: u.creado_en, actualizado_en: u.actualizado_en,
});

router.post('/registro', limiteLogin, validarBody(registroSchema), asyncH(async (req, res) => {
  const { nombre, correo, contrasena: pass, programa_academico = null, codigo_estudiantil = null } = req.body;
  const existe = await pool.query('SELECT 1 FROM usuario WHERE correo = $1', [correo]);
  if (existe.rowCount) throw new ApiError(409, 'DUPLICADO', 'Ya existe una cuenta con ese correo');
  const hash = await bcrypt.hash(pass, 10);
  // El rol SIEMPRE es "estudiante" al registrarse; solo un admin puede crear otros roles.
  const { rows } = await pool.query(
    `INSERT INTO usuario (nombre, correo, contrasena_hash, rol, programa_academico, codigo_estudiantil)
     VALUES ($1,$2,$3,'estudiante',$4,$5) RETURNING *`,
    [nombre, correo, hash, programa_academico, codigo_estudiantil]);
  res.status(201).json({ token: firmarToken(rows[0]), usuario: publico(rows[0]) });
}));

const HASH_FALSO = bcrypt.hashSync('no-existe', 10);

router.post('/login', limiteLogin, validarBody(loginSchema), asyncH(async (req, res) => {
  const { correo, contrasena: pass } = req.body;
  const { rows } = await pool.query('SELECT * FROM usuario WHERE correo = $1', [correo]);
  const u = rows[0];
  // Se compara siempre, exista o no el usuario, para no revelar cuáles correos existen
  const ok = await bcrypt.compare(pass, u ? u.contrasena_hash : HASH_FALSO);
  if (!u || !ok) throw new ApiError(401, 'CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos');
  res.json({ token: firmarToken(u), usuario: publico(u) });
}));

router.get('/yo', requiereAuth, asyncH(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM usuario WHERE id = $1', [req.usuario.id]);
  if (!rows[0]) throw new ApiError(401, 'TOKEN_INVALIDO', 'La cuenta de este token ya no existe');
  res.json(publico(rows[0]));
}));

module.exports = router;
module.exports.publico = publico;
module.exports.correoInstitucional = correoInstitucional;
module.exports.contrasena = contrasena;
