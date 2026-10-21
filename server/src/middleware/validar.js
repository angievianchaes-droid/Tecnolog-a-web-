const { z } = require('zod');
const { ApiError } = require('./errores');

// Mensajes de validación en español para los casos que no traen mensaje propio
z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case 'invalid_type':
      if (issue.received === 'undefined' || issue.received === 'null') return { message: 'Este campo es obligatorio' };
      if (issue.expected === 'number' || issue.expected === 'integer') return { message: 'Debe ser un número' };
      if (issue.expected === 'boolean') return { message: 'Debe ser verdadero o falso' };
      if (issue.expected === 'string') return { message: 'Debe ser texto' };
      return { message: 'El tipo de dato no es válido' };
    case 'invalid_enum_value': return { message: 'Valor no permitido' };
    case 'too_small': return { message: issue.type === 'string' ? `Mínimo ${issue.minimum} caracteres` : `Debe ser mayor o igual a ${issue.minimum}` };
    case 'too_big': return { message: issue.type === 'string' ? `Máximo ${issue.maximum} caracteres` : `Debe ser menor o igual a ${issue.maximum}` };
    case 'invalid_string': return { message: 'Formato inválido' };
    default: return { message: ctx.defaultError };
  }
});

const uuid = z.string().uuid('Selecciona una opción válida');

// Valida req.body contra un esquema zod. Si falla → 422 con el detalle por campo.
const validarBody = (schema) => (req, res, next) => {
  const r = schema.safeParse(req.body ?? {});
  if (!r.success) {
    const detalles = r.error.issues.map((i) => ({ campo: i.path.join('.') || 'cuerpo', mensaje: i.message }));
    return next(new ApiError(422, 'VALIDACION', 'Hay datos inválidos en la petición', detalles));
  }
  req.body = r.data;
  next();
};

// Valida query string (filtros, paginación)
const validarQuery = (schema) => (req, res, next) => {
  const r = schema.safeParse(req.query);
  if (!r.success) {
    const detalles = r.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message }));
    return next(new ApiError(400, 'PARAMETROS_INVALIDOS', 'Los parámetros de consulta no son válidos', detalles));
  }
  req.consulta = r.data;
  next();
};

// Valida que los parámetros de ruta indicados sean UUID → si no, 400
const validarIds = (...nombres) => (req, res, next) => {
  for (const n of nombres) {
    if (!uuid.safeParse(req.params[n]).success) {
      return next(new ApiError(400, 'ID_INVALIDO', `El parámetro "${n}" debe ser un UUID válido`));
    }
  }
  next();
};

module.exports = { z, uuid, validarBody, validarQuery, validarIds };
