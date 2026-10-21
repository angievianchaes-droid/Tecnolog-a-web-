require('dotenv').config();
const jwt = require('jsonwebtoken');
const { ApiError } = require('./errores');

if (!process.env.JWT_SECRET) {
  console.error('Falta JWT_SECRET en el archivo .env');
  process.exit(1);
}
const SECRET = process.env.JWT_SECRET;
const EXPIRA = process.env.JWT_EXPIRA_EN || '8h';

const firmarToken = (u) => jwt.sign({ sub: u.id, rol: u.rol, nombre: u.nombre }, SECRET, { expiresIn: EXPIRA });

function leerToken(req) {
  const h = req.headers.authorization || '';
  const [tipo, token] = h.split(' ');
  if (tipo !== 'Bearer' || !token) return null;
  try { return jwt.verify(token, SECRET); } catch { return 'invalido'; }
}

// Exige sesión válida
const requiereAuth = (req, res, next) => {
  const p = leerToken(req);
  if (!p) return next(new ApiError(401, 'NO_AUTENTICADO', 'Debes iniciar sesión (cabecera Authorization: Bearer <token>)'));
  if (p === 'invalido') return next(new ApiError(401, 'TOKEN_INVALIDO', 'El token es inválido o expiró. Inicia sesión de nuevo'));
  req.usuario = { id: p.sub, rol: p.rol, nombre: p.nombre };
  next();
};

// Sesión opcional: si hay token válido llena req.usuario, si no sigue como anónimo
const authOpcional = (req, res, next) => {
  const p = leerToken(req);
  if (p && p !== 'invalido') req.usuario = { id: p.sub, rol: p.rol, nombre: p.nombre };
  next();
};

// Exige uno de los roles indicados (usar después de requiereAuth)
const requiereRol = (...roles) => (req, res, next) => {
  if (!roles.includes(req.usuario.rol)) {
    return next(new ApiError(403, 'SIN_PERMISO', 'Tu rol no tiene permiso para esta operación'));
  }
  next();
};

const esStaff = (u) => !!u && ['bienestar', 'admin'].includes(u.rol);

module.exports = { firmarToken, requiereAuth, authOpcional, requiereRol, esStaff };
