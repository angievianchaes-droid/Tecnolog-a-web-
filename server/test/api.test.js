// Pruebas de extremo a extremo contra la base de datos real.
// Requiere haber corrido antes:  npm run db:init
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const pool = require('../src/config/db');

let server, base;
const sufijo = Date.now();

test.before(async () => {
  await new Promise((r) => { server = app.listen(0, r); });
  base = `http://localhost:${server.address().port}/api`;
});
test.after(async () => { server.close(); await pool.end(); });

async function api(method, ruta, { token, body } = {}) {
  const res = await fetch(base + ruta, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const texto = await res.text();
  return { status: res.status, data: texto ? JSON.parse(texto) : null };
}
const login = async (correo, contrasena) => (await api('POST', '/auth/login', { body: { correo, contrasena } })).data.token;

let admin, staff, est, estId;
const futuro = (d, h = 10) => { const x = new Date(Date.now() + d * 864e5); x.setHours(h, 0, 0, 0); return x.toISOString(); };

test('Autenticación', async (t) => {
  await t.test('login correcto devuelve token JWT', async () => {
    const r = await api('POST', '/auth/login', { body: { correo: 'admin@unitropico.edu.co', contrasena: 'Admin1234' } });
    assert.equal(r.status, 200);
    assert.ok(r.data.token.split('.').length === 3);
    assert.equal(r.data.usuario.rol, 'admin');
    assert.equal(r.data.usuario.contrasena_hash, undefined, 'nunca se expone el hash');
  });
  await t.test('contraseña errónea → 401', async () => {
    const r = await api('POST', '/auth/login', { body: { correo: 'admin@unitropico.edu.co', contrasena: 'incorrecta1' } });
    assert.equal(r.status, 401);
    assert.equal(r.data.codigo, 'CREDENCIALES_INVALIDAS');
  });
  await t.test('login sin datos → 422', async () => {
    const r = await api('POST', '/auth/login', { body: {} });
    assert.equal(r.status, 422);
    assert.ok(r.data.detalles.length >= 2);
  });
  await t.test('ruta protegida sin token → 401; con token falso → 401', async () => {
    assert.equal((await api('GET', '/usuarios')).status, 401);
    assert.equal((await api('GET', '/usuarios', { token: 'abc.def.ghi' })).status, 401);
  });
  admin = await login('admin@unitropico.edu.co', 'Admin1234');
  staff = await login('bienestar@unitropico.edu.co', 'Bienestar1234');
  est = await login('laura.rincon@unitropico.edu.co', 'Estudiante1234');
  await t.test('estudiante no puede crear categorías → 403', async () => {
    const r = await api('POST', '/categorias', { token: est, body: { nombre: 'Prueba' } });
    assert.equal(r.status, 403);
  });
  await t.test('registro: correo no institucional → 422; válido → 201 con rol estudiante', async () => {
    const mal = await api('POST', '/auth/registro', { body: { nombre: 'Ana Gómez', correo: 'ana@gmail.com', contrasena: 'Clave12345' } });
    assert.equal(mal.status, 422);
    const ok = await api('POST', '/auth/registro', { body: { nombre: 'Ana Gómez', correo: `ana${sufijo}@unitropico.edu.co`, contrasena: 'Clave12345', rol: 'admin' } });
    assert.equal(ok.status, 201);
    assert.equal(ok.data.usuario.rol, 'estudiante', 'no se puede auto-asignar rol admin');
    estId = ok.data.usuario.id;
    const dup = await api('POST', '/auth/registro', { body: { nombre: 'Ana Gómez', correo: `ana${sufijo}@unitropico.edu.co`, contrasena: 'Clave12345' } });
    assert.equal(dup.status, 409);
  });
});

test('CRUD categorías', async () => {
  const c = await api('POST', '/categorias', { token: staff, body: { nombre: `Test ${sufijo}`, color: '#112233' } });
  assert.equal(c.status, 201);
  const id = c.data.id;
  assert.equal((await api('GET', `/categorias/${id}`)).data.nombre, `Test ${sufijo}`);
  const u = await api('PUT', `/categorias/${id}`, { token: staff, body: { nombre: `Test ${sufijo} B`, color: '#445566' } });
  assert.equal(u.status, 200);
  assert.equal(u.data.color, '#445566');
  assert.equal((await api('POST', '/categorias', { token: staff, body: { nombre: `Test ${sufijo} B` } })).status, 409, 'nombre duplicado');
  assert.equal((await api('POST', '/categorias', { token: staff, body: { nombre: 'ab', color: 'rojo' } })).status, 422);
  assert.equal((await api('GET', '/categorias/no-es-uuid')).status, 400);
  assert.equal((await api('DELETE', `/categorias/${id}`, { token: staff })).status, 204);
  assert.equal((await api('GET', `/categorias/${id}`)).status, 404);
});

test('CRUD lugares', async () => {
  const c = await api('POST', '/lugares', { token: staff, body: { nombre: `Salón ${sufijo}`, capacidad: 30 } });
  assert.equal(c.status, 201);
  const id = c.data.id;
  assert.equal((await api('POST', '/lugares', { token: staff, body: { nombre: 'Salón X', capacidad: -5 } })).status, 422);
  const u = await api('PUT', `/lugares/${id}`, { token: staff, body: { nombre: `Salón ${sufijo}`, capacidad: 50, latitud: 5.337, longitud: -72.395 } });
  assert.equal(u.data.capacidad, 50);
  assert.equal((await api('DELETE', `/lugares/${id}`, { token: staff })).status, 204);
  assert.equal((await api('DELETE', `/lugares/${id}`, { token: staff })).status, 404);
});

test('CRUD eventos + validación + reglas de negocio', async () => {
  const cats = (await api('GET', '/categorias')).data;
  const lugs = (await api('GET', '/lugares')).data;
  const lugarPeq = (await api('POST', '/lugares', { token: staff, body: { nombre: `Aula ${sufijo}`, capacidad: 2 } })).data;
  const ok = { titulo: 'Taller de prueba automatizada', descripcion: 'Descripción suficientemente larga para pasar la validación.',
    fecha_inicio: futuro(30), fecha_fin: futuro(30, 12), cupo_maximo: 2, estado: 'publicado', categoria_id: cats[0].id, lugar_id: lugarPeq.id };

  // validaciones
  const v1 = await api('POST', '/eventos', { token: staff, body: { ...ok, fecha_fin: ok.fecha_inicio } });
  assert.equal(v1.status, 422); // fin <= inicio
  const v2 = await api('POST', '/eventos', { token: staff, body: { ...ok, titulo: 'x', categoria_id: 'abc' } });
  assert.equal(v2.status, 422);
  assert.ok(v2.data.detalles.some((d) => d.campo === 'titulo'));
  const v3 = await api('POST', '/eventos', { token: staff, body: { ...ok, cupo_maximo: 50 } });
  assert.equal(v3.status, 422, 'cupo mayor que la capacidad del lugar');
  const v4 = await api('POST', '/eventos', { token: staff, body: { ...ok, fecha_inicio: '2020-01-01T10:00:00-05:00', fecha_fin: '2020-01-01T12:00:00-05:00' } });
  assert.equal(v4.status, 422, 'fecha en el pasado');
  const v5 = await api('POST', '/eventos', { token: staff, body: { ...ok, lugar_id: '00000000-0000-4000-8000-000000000000' } });
  assert.equal(v5.status, 422, 'lugar inexistente');

  // crear / leer / actualizar
  const c = await api('POST', '/eventos', { token: staff, body: ok });
  assert.equal(c.status, 201);
  const id = c.data.id;
  assert.equal(c.data.cupos_disponibles, 2);
  const lista = await api('GET', '/eventos?q=prueba%20automatizada');
  assert.ok(lista.data.datos.some((e) => e.id === id));
  const u = await api('PUT', `/eventos/${id}`, { token: staff, body: { ...ok, titulo: 'Taller de prueba (editado)' } });
  assert.equal(u.status, 200);
  assert.equal(u.data.titulo, 'Taller de prueba (editado)');

  // inscripciones: cupo 2, el tercero queda en espera
  const e2 = await login('juan.perez@unitropico.edu.co', 'Estudiante1234');
  const e3 = (await api('POST', '/auth/login', { body: { correo: `ana${sufijo}@unitropico.edu.co`, contrasena: 'Clave12345' } })).data.token;
  const i1 = await api('POST', `/eventos/${id}/inscripciones`, { token: est });
  const i2 = await api('POST', `/eventos/${id}/inscripciones`, { token: e2 });
  const i3 = await api('POST', `/eventos/${id}/inscripciones`, { token: e3 });
  assert.deepEqual([i1.status, i1.data.estado, i2.data.estado, i3.status, i3.data.estado], [201, 'confirmada', 'confirmada', 201, 'en_espera']);
  assert.equal((await api('POST', `/eventos/${id}/inscripciones`, { token: est })).status, 409, 'doble inscripción');
  assert.equal((await api('POST', `/eventos/${id}/inscripciones`)).status, 401);
  assert.equal((await api('PUT', `/eventos/${id}`, { token: staff, body: { ...ok, cupo_maximo: 1 } })).status, 422, 'cupo menor a inscritos');

  // cancelar uno → el de la lista de espera pasa a confirmado
  assert.equal((await api('DELETE', `/eventos/${id}/inscripciones/mia`, { token: est })).status, 204);
  const insc = (await api('GET', `/eventos/${id}/inscripciones`, { token: staff })).data;
  assert.equal(insc.filter((i) => i.estado === 'confirmada').length, 2);
  assert.equal((await api('GET', `/eventos/${id}/inscripciones`, { token: est })).status, 403);
  const pa = await api('PATCH', `/eventos/${id}/inscripciones/${insc[0].id}/asistencia`, { token: staff, body: { asistio: true } });
  assert.equal(pa.data.asistio, true);
  assert.equal((await api('PATCH', `/eventos/${id}/inscripciones/${insc[0].id}/asistencia`, { token: staff, body: { asistio: 'si' } })).status, 422);
  assert.equal((await api('GET', '/usuarios/me/inscripciones', { token: e2 })).data.length >= 1, true);

  // no se puede eliminar con inscritos
  assert.equal((await api('DELETE', `/eventos/${id}`, { token: staff })).status, 409);
  // categoría/lugar en uso no se pueden borrar
  assert.equal((await api('DELETE', `/lugares/${lugarPeq.id}`, { token: staff })).status, 409);

  // limpiar: pasar a cancelado, cancelar inscripciones y eliminar
  await pool.query('DELETE FROM inscripcion WHERE evento_id=$1', [id]);
  assert.equal((await api('DELETE', `/eventos/${id}`, { token: staff })).status, 204);
  assert.equal((await api('GET', `/eventos/${id}`)).status, 404);
  assert.equal((await api('DELETE', `/lugares/${lugarPeq.id}`, { token: staff })).status, 204);
  assert.ok(lugs.length > 0);
});

test('Borradores no son visibles al público', async () => {
  const pub = (await api('GET', '/eventos?incluir_pasados=true&limite=50')).data.datos;
  assert.ok(pub.every((e) => e.estado === 'publicado'));
  const interno = (await api('GET', '/eventos?estado=borrador', { token: staff })).data.datos;
  assert.ok(interno.length >= 1);
  assert.equal((await api('GET', `/eventos/${interno[0].id}`)).status, 404);
  assert.equal((await api('GET', `/eventos/${interno[0].id}`, { token: staff })).status, 200);
});

test('CRUD usuarios (solo admin)', async () => {
  assert.equal((await api('GET', '/usuarios', { token: staff })).status, 403);
  const c = await api('POST', '/usuarios', { token: admin, body: { nombre: 'Pedro Alvarado', correo: `pedro${sufijo}@unitropico.edu.co`, contrasena: 'Segura1234', rol: 'bienestar' } });
  assert.equal(c.status, 201);
  assert.equal(c.data.contrasena_hash, undefined);
  const id = c.data.id;
  assert.equal((await api('POST', '/usuarios', { token: admin, body: { nombre: 'X', correo: 'x@y.com', contrasena: '123', rol: 'dios' } })).status, 422);
  const u = await api('PUT', `/usuarios/${id}`, { token: admin, body: { nombre: 'Pedro A. Alvarado', correo: `pedro${sufijo}@unitropico.edu.co`, rol: 'estudiante' } });
  assert.equal(u.data.rol, 'estudiante');
  assert.equal((await api('GET', `/usuarios/${id}`, { token: admin })).data.nombre, 'Pedro A. Alvarado');
  assert.ok((await api('GET', '/usuarios?q=pedro', { token: admin })).data.total >= 1);
  const yo = (await api('GET', '/auth/yo', { token: admin })).data;
  assert.equal((await api('DELETE', `/usuarios/${yo.id}`, { token: admin })).status, 409, 'no puede borrarse a sí mismo');
  assert.equal((await api('DELETE', `/usuarios/${id}`, { token: admin })).status, 204);
  assert.equal((await api('GET', `/usuarios/${id}`, { token: admin })).status, 404);
  await api('DELETE', `/usuarios/${estId}`, { token: admin });
});

test('Errores generales', async () => {
  assert.equal((await api('GET', '/no-existe')).status, 404);
  const res = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{malo' });
  assert.equal(res.status, 400);
});
