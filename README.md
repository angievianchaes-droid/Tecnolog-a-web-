# Eventos de Bienestar Universitario · Unitrópico

Plataforma web para publicar, consultar e inscribirse a los eventos de Bienestar Universitario de Unitrópico (Yopal, Casanare).

**Problema:** la información de los eventos está dispersa entre redes sociales, WhatsApp y correo, y los estudiantes no se enteran a tiempo.
**Qué incluye:** API REST (Node.js + Express + PostgreSQL) con CRUD de 4 entidades, autenticación JWT, validación, documentación Swagger y una interfaz web.

## Ejecutarlo en local (VS Code)

Requisitos: **Node.js 18+** y **PostgreSQL 14+** instalados.

1. Crea la base de datos y el usuario (en `psql` o pgAdmin):
   ```sql
   CREATE USER bienestar WITH PASSWORD 'bienestar123';
   CREATE DATABASE bienestar_eventos OWNER bienestar;
   ```
2. Copia `.env.example` a `.env` y ajusta `DATABASE_URL` y `JWT_SECRET` (una cadena larga y aleatoria).
3. En la terminal de VS Code (`` Ctrl+Ñ `` o *Terminal → Nueva terminal*):
   ```bash
   npm install
   npm run db:init     # crea las tablas y carga datos de ejemplo
   npm start           # o: npm run dev (se reinicia al guardar)
   ```
4. Abre:
   - Sitio web: <http://localhost:3000>
   - Documentación Swagger: <http://localhost:3000/docs>

**Usuarios de prueba**

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | admin@unitropico.edu.co | Admin1234 |
| Bienestar | bienestar@unitropico.edu.co | Bienestar1234 |
| Estudiante | laura.rincon@unitropico.edu.co | Estudiante1234 |

Pruebas automáticas (CRUD, autenticación, validación y reglas de negocio): `npm test`

## Estructura

```
├── api/openapi.yaml        Contrato de la API (OpenAPI 3.1) → se muestra en /docs
├── db/schema.sql           Tablas, restricciones, índices y triggers
├── docs/modelo-datos.md    Modelo de datos con diagrama
├── server/src/
│   ├── app.js              Arranque de Express, seguridad y rutas
│   ├── config/             Conexión a la BD y script db:init (esquema + datos)
│   ├── middleware/         auth (JWT y roles), validar (zod), errores
│   └── routes/             auth, categorias, lugares, eventos, inscripciones, usuarios
├── server/test/api.test.js Pruebas de extremo a extremo
└── web/                    Interfaz (HTML + CSS + JS sin frameworks)
```

## Qué cumple el backend

| Requisito | Cómo |
|---|---|
| CRUD de 4 entidades | `eventos`, `categorias`, `lugares`, `usuarios` (Crear, Leer, Actualizar, Eliminar). Además: inscripciones y asistencia |
| Autenticación | Registro y login con contraseña cifrada (bcrypt) y token **JWT**; rutas protegidas por sesión y por **rol** (estudiante / bienestar / admin); límite de intentos de login |
| Validación | Esquemas **zod** en cada petición: tipos, formatos, longitudes, correo institucional, contraseñas. Respuesta `422` con el detalle por campo. Reglas de negocio: fechas coherentes, cupo ≤ capacidad del lugar, sin fechas pasadas, sin doble inscripción, lista de espera, no borrar con datos asociados (`409`) |
| Documentación | Swagger UI en `/docs`, generado desde `api/openapi.yaml` (con ejemplos y todos los códigos de error) |
| Demostración | Guion abajo |

Códigos usados: `200`, `201`, `204`, `400` (id o parámetros inválidos), `401` (sin sesión), `403` (sin permiso), `404`, `409` (conflicto), `422` (validación), `429`. Todos los errores tienen la forma `{ codigo, mensaje, detalles? }`.

## Guion para la demostración en vivo

1. **Swagger** (`/docs`): `POST /auth/login` con el admin → copiar el `token` → botón **Authorize** → pegarlo.
2. **Crear:** `POST /categorias` con `{"nombre":"Voluntariado"}` → `201`.
3. **Validación:** repetir con `{"nombre":"ab","color":"rojo"}` → `422` con el detalle de cada campo.
4. **Leer:** `GET /categorias` y `GET /categorias/{id}`.
5. **Actualizar:** `PUT /categorias/{id}` cambiando el color.
6. **Eliminar:** `DELETE /categorias/{id}` → `204`; repetir → `404`.
7. **Seguridad:** sin token `GET /usuarios` → `401`; con el token de un estudiante → `403`.
8. **Regla de negocio:** intentar eliminar una categoría con eventos → `409`.
9. **Interfaz:** entrar como estudiante, inscribirse a un evento y cancelar; entrar como Bienestar y crear/editar/eliminar un evento en *Administración*.
10. Mostrar `npm test` en verde.

## Uso de inteligencia artificial
Se usó Claude (Anthropic) como apoyo para generar el código base, el contrato OpenAPI y las pruebas. El equipo revisó, ejecutó y es responsable de entender cada parte.
