# Eventos de Bienestar Universitario · Unitrópico

Plataforma web para publicar, consultar e inscribirse a los eventos de Bienestar Universitario de Unitrópico (Yopal, Casanare).

**Versión publicada:** https://bienestar-eventos.onrender.com
**Documentación de la API (Swagger):** https://bienestar-eventos.onrender.com/docs

> El servidor gratuito se duerme tras 15 minutos sin visitas. La primera carga puede tardar cerca de un minuto.

## El problema
La información de los eventos de Bienestar Universitario está dispersa entre redes sociales, grupos de WhatsApp y correo institucional. Los estudiantes no conocen a tiempo las actividades disponibles y Bienestar no tiene un lugar único para publicar eventos, recibir inscripciones y registrar asistencia.

## Equipo
Tecnologías Web 2026-B · Grupo 1

| Integrante | Rol | GitHub |
|---|---|---|
| Natalia Caicedo | Backend y datos | @Natalia-Caicedo |
| Angie Zarith Viancha | Frontend y experiencia | @angievianchaes-droid |

Rutas de profundización elegidas: **C** (PWA y funcionamiento sin conexión) y **E** (modelos de lenguaje en la web).

## Qué incluye
API REST con **Node.js + Express + PostgreSQL**, autenticación JWT, validación, documentación Swagger e interfaz web (HTML, CSS y JavaScript sin frameworks).

| Requisito | Cómo se cumple |
|---|---|
| CRUD de 4 entidades | `eventos`, `categorias`, `lugares` y `usuarios` (crear, leer, actualizar, eliminar). Además: inscripciones y asistencia |
| Autenticación | Registro y login con contraseña cifrada (bcrypt) y token **JWT**. Rutas protegidas por sesión y por **rol** (estudiante, bienestar, admin). Límite de intentos de login |
| Validación | Esquemas **zod** en cada petición: tipos, formatos, longitudes, correo institucional. Respuesta `422` con el detalle por campo. Reglas de negocio: fechas coherentes, cupo ≤ capacidad del lugar, sin fechas pasadas, sin doble inscripción, lista de espera, no borrar datos con relaciones (`409`) |
| Documentación | Swagger UI en `/docs`, generado desde `api/openapi.yaml` (ejemplos y códigos de error) |
| Demostración | Guion al final de este documento |

## Estado del proyecto
| Componente | Estado |
|---|---|
| Interfaz web (listado, detalle, login, panel de administración) | Hecho |
| API con CRUD de 4 entidades | Hecho |
| Autenticación JWT y roles | Hecho |
| Validación y reglas de negocio | Hecho |
| Documentación Swagger / OpenAPI | Hecho |
| Base de datos PostgreSQL | Hecho |
| Pruebas automáticas (13) | Hecho |
| Publicado en internet (Render + Neon) | Hecho |
| PWA y funcionamiento sin conexión (ruta C) | Pendiente |
| Asistente con modelos de lenguaje (ruta E) | Pendiente |

## Ejecutarlo en local
Requisitos: **Node.js 18 o superior** (probado con 22) y **PostgreSQL 14 o superior**.

1. Crea la base de datos vacía. En pgAdmin: clic derecho en *Databases → Create → Database* y nómbrala `bienestar_eventos`. O con SQL:
```sql
   CREATE DATABASE bienestar_eventos;
```
2. Copia `.env.example` a `.env` y ajústalo:
```
   PORT=3000
   DATABASE_URL=postgresql://postgres:TU_CONTRASEÑA@localhost:5432/bienestar_eventos
   JWT_SECRET=una_frase_larga_y_aleatoria
   JWT_EXPIRA_EN=8h
```
   `JWT_EXPIRA_EN` debe quedar sin espacios ni comillas.
3. En la terminal, dentro de la carpeta del proyecto:
```bash
   npm install
   npm run db:init     # crea las tablas y carga datos de ejemplo
   npm start           # o: npm run dev (se reinicia al guardar)
```
   En Windows PowerShell, si `npm` da un error de scripts deshabilitados: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.
4. Abre `http://localhost:3000` (sitio) y `http://localhost:3000/docs` (Swagger).

**Usuarios de prueba (solo en local, tras `npm run db:init`)**

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | admin@unitropico.edu.co | Admin1234 |
| Bienestar | bienestar@unitropico.edu.co | Bienestar1234 |
| Estudiante | laura.rincon@unitropico.edu.co | Estudiante1234 |

En la versión publicada las contraseñas son distintas y se entregan por separado.

Pruebas automáticas (CRUD, autenticación, validación y reglas de negocio): `npm test`

## Publicación en internet
El servidor corre en **Render** (plan gratuito) y la base de datos en **Neon** (PostgreSQL gratuito). Render publica automáticamente lo que se integre a la rama `main`.

| Ajuste en Render | Valor |
|---|---|
| Build Command | `npm install` |
| Start Command | `npm run db:init && npm start` |
| Health Check Path | `/api/salud` |
| Variables de entorno | `DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRA_EN`, `NODE_ENV=production`, `NODE_VERSION=22`, `ADMIN_PASSWORD`, `BIENESTAR_PASSWORD`, `ESTUDIANTE_PASSWORD` |

Los valores de las variables nunca se suben al repositorio.

Limitaciones del plan gratuito: el servidor se duerme tras 15 minutos sin visitas (la siguiente visita tarda cerca de un minuto en despertarlo) y la base de Neon se suspende tras 5 minutos de inactividad.

## Estructura
```
├── api/openapi.yaml          Contrato de la API (OpenAPI 3.1), se muestra en /docs
├── db/schema.sql             Tablas, restricciones, índices y triggers
├── docs/modelo-datos.md      Modelo de datos con diagrama
├── server/
│   ├── src/app.js            Arranque de Express, seguridad y rutas
│   ├── src/config/           Conexión a la BD y script db:init (esquema + datos)
│   ├── src/middleware/       auth (JWT y roles), validar (zod), errores
│   ├── src/routes/           auth, categorias, lugares, eventos, inscripciones, usuarios
│   └── test/api.test.js      Pruebas de extremo a extremo
├── web/                      Interfaz (HTML + CSS + JS)
├── .env.example              Variables necesarias, sin valores reales
└── package.json
```

## Rutas principales
Todas bajo `/api`. Detalle completo, con ejemplos y errores, en `/docs`.

| Método y ruta | Quién | Qué hace |
|---|---|---|
| `POST /auth/registro` | Público | Crea una cuenta de estudiante |
| `POST /auth/login` | Público | Inicia sesión y devuelve el token JWT |
| `GET /auth/yo` | Con sesión | Datos de la sesión actual |
| `GET /eventos`, `GET /eventos/:id` | Público | Lista y detalle de eventos publicados |
| `POST /eventos`, `PUT /eventos/:id`, `DELETE /eventos/:id` | Bienestar, admin | Crear, actualizar y eliminar eventos |
| `GET /categorias`, `GET /lugares` (y `/:id`) | Público | Consultar categorías y lugares |
| `POST`, `PUT`, `DELETE` en `/categorias` y `/lugares` | Bienestar, admin | Crear, actualizar y eliminar |
| `POST /eventos/:id/inscripciones` | Con sesión | Inscribirse (o lista de espera si el cupo está lleno) |
| `DELETE /eventos/:id/inscripciones/mia` | Con sesión | Cancelar mi inscripción |
| `GET /eventos/:id/inscripciones` | Bienestar, admin | Lista de inscritos |
| `PATCH /eventos/:id/inscripciones/:inscripcionId/asistencia` | Bienestar, admin | Registrar asistencia |
| `GET /usuarios/me/inscripciones` | Con sesión | Mis inscripciones |
| `GET`, `POST`, `PUT`, `DELETE` en `/usuarios` | Solo admin | CRUD de usuarios |
| `GET /salud` | Público | Comprobación de que el servidor responde |

Códigos usados: `200`, `201`, `204`, `400` (id o parámetros inválidos), `401` (sin sesión), `403` (sin permiso), `404`, `409` (conflicto), `422` (validación), `429` (demasiados intentos). Todos los errores tienen la forma `{ codigo, mensaje, detalles? }`.

## Seguridad
- Contraseñas cifradas con bcrypt; nunca se guardan en texto plano.
- Token JWT con duración de 8 horas y control de acceso por rol.
- Límite de intentos en el login y el registro.
- Consultas SQL parametrizadas (sin inyección SQL) y cabeceras de seguridad (helmet).
- El archivo `.env` está en `.gitignore`: ninguna credencial se versiona.

## Guion para la demostración en vivo
1. **Swagger** (`/docs`): `POST /auth/login` con el admin → copiar el `token` → botón **Authorize** → pegarlo.
2. **Crear:** `POST /categorias` con `{"nombre":"Voluntariado"}` → `201`.
3. **Validación:** repetir con `{"nombre":"ab","color":"rojo"}` → `422` con el detalle de cada campo.
4. **Leer:** `GET /categorias` y `GET /categorias/{id}`.
5. **Actualizar:** `PUT /categorias/{id}` cambiando el color.
6. **Eliminar:** `DELETE /categorias/{id}` → `204`; repetir → `404`.
7. **Seguridad:** sin token `GET /usuarios` → `401`; con el token de un estudiante → `403`.
8. **Regla de negocio:** intentar eliminar una categoría con eventos → `409`.
9. **Interfaz:** como estudiante, inscribirse a un evento y cancelar; como Bienestar, crear, editar y eliminar un evento en *Administración*.
10. Mostrar `npm test` en verde.

## Uso de inteligencia artificial
Se usó Claude (Anthropic) como apoyo para generar el código base, el contrato OpenAPI, las pruebas y la guía de despliegue. El equipo revisó y ejecutó el código y es responsable de entender cada parte.