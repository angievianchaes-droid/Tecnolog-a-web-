require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');
const { rutaNoExiste, manejadorErrores } = require('./middleware/errores');

const app = express();

// Detrás del proxy de Render: necesario para ver la IP real (límite de intentos de login)
if (process.env.NODE_ENV === 'production' || process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

app.use(helmet({
  // Swagger UI y la página web usan scripts/estilos propios
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
    },
  },
}));
app.use(cors());
app.use(express.json({ limit: '100kb' }));

// ---- API ----
app.get('/api/salud', (req, res) => res.json({ estado: 'ok', hora: new Date().toISOString() }));
// Comprueba también la conexión con la base de datos (úsalo para diagnosticar, no como Health Check de Render:
// despertaría la base de Neon cada vez)
app.get('/api/salud/bd', async (req, res) => {
  try {
    await require('./config/db').query('SELECT 1');
    res.json({ estado: 'ok', base_de_datos: 'conectada', hora: new Date().toISOString() });
  } catch (e) {
    console.error('Fallo al consultar la base de datos:', e.message);
    res.status(503).json({ codigo: 'BD_NO_DISPONIBLE', mensaje: 'No hay conexión con la base de datos' });
  }
});
app.use('/api/auth', require('./routes/auth'));
app.use('/api/categorias', require('./routes/categorias'));
app.use('/api/lugares', require('./routes/lugares'));
app.use('/api/eventos', require('./routes/eventos'));
app.use('/api/eventos', require('./routes/inscripciones'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api', rutaNoExiste);

// ---- Documentación Swagger (lee api/openapi.yaml) ----
const specPath = path.join(__dirname, '../../api/openapi.yaml');
if (fs.existsSync(specPath)) {
  const spec = YAML.parse(fs.readFileSync(specPath, 'utf8'));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'API · Bienestar Unitrópico' }));
}

// ---- Sitio web estático ----
app.use(express.static(path.join(__dirname, '../../web')));

app.use(manejadorErrores);

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Sitio web:      http://localhost:${port}`);
    console.log(`Documentación:  http://localhost:${port}/docs`);
  });
}

module.exports = app;