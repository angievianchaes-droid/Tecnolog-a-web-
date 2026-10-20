// Esquema de error común para toda la API: { codigo, mensaje, detalles? }
class ApiError extends Error {
  constructor(status, codigo, mensaje, detalles) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
    this.detalles = detalles;
  }
}

const noEncontrado = (what = 'Recurso') => new ApiError(404, 'NO_ENCONTRADO', `${what} no encontrado`);

// Envuelve handlers async para que los errores lleguen al manejador central
const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function rutaNoExiste(req, res) {
  res.status(404).json({ codigo: 'RUTA_NO_EXISTE', mensaje: `No existe ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function manejadorErrores(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ codigo: err.codigo, mensaje: err.message, detalles: err.detalles });
  }
  // JSON mal formado
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ codigo: 'JSON_INVALIDO', mensaje: 'El cuerpo de la petición no es un JSON válido' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ codigo: 'CUERPO_MUY_GRANDE', mensaje: 'El cuerpo de la petición es demasiado grande' });
  }
  // Errores de PostgreSQL
  if (err.code === '23505') {
    return res.status(409).json({ codigo: 'DUPLICADO', mensaje: 'Ya existe un registro con ese valor único', detalles: [{ campo: err.constraint }] });
  }
  if (err.code === '23503' || err.code === '23001') {
    return res.status(409).json({ codigo: 'REFERENCIA', mensaje: 'La operación viola una relación con otro registro (existen datos asociados o la referencia no existe)' });
  }
  if (err.code === '23514') {
    return res.status(422).json({ codigo: 'VALIDACION', mensaje: 'Los datos no cumplen una restricción de la base de datos', detalles: [{ campo: err.constraint }] });
  }
  console.error(err);
  res.status(500).json({ codigo: 'ERROR_INTERNO', mensaje: 'Ocurrió un error inesperado en el servidor' });
}

module.exports = { ApiError, noEncontrado, asyncH, rutaNoExiste, manejadorErrores };
