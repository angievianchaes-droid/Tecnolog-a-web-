// Panel CRUD para las cuatro entidades. Cada entidad se describe en un objeto
// (ruta, columnas y campos del formulario) y un motor genérico hace el resto.
(function () {
  const { api, esc, esStaff, esAdmin, fechaCorta, aInputFecha, deInputFecha, mensajeError, mostrarErroresCampos, avisar } = App;
  const $ = (id) => document.getElementById(id);

  const ESTADOS = ['borrador', 'publicado', 'cancelado', 'finalizado'].map((v) => ({ valor: v, texto: v[0].toUpperCase() + v.slice(1) }));
  const ROLES = [{ valor: 'estudiante', texto: 'Estudiante' }, { valor: 'bienestar', texto: 'Bienestar' }, { valor: 'admin', texto: 'Administrador' }];
  const opcionesDe = (ruta) => async () => (await api('GET', ruta)).map((x) => ({ valor: x.id, texto: x.nombre }));

  const ENTIDADES = {
    eventos: {
      titulo: 'Eventos', singular: 'evento', ruta: '/eventos', paginado: true,
      consulta: '?incluir_pasados=true',
      columnas: [
        ['Título', (e) => esc(e.titulo)], ['Inicio', (e) => esc(fechaCorta(e.fecha_inicio))],
        ['Categoría', (e) => esc(e.categoria_nombre)], ['Lugar', (e) => esc(e.lugar_nombre)],
        ['Estado', (e) => esc(e.estado)], ['Inscritos', (e) => `${e.inscritos}${e.cupo_maximo ? ' / ' + e.cupo_maximo : ''}`],
      ],
      extra: (e) => `<a class="btn btn-sec btn-peq" href="detalle.html?id=${esc(e.id)}">Inscritos<span class="solo-lectores"> de ${esc(e.titulo)}</span></a>`,
      campos: [
        { n: 'titulo', et: 'Título', tipo: 'text', req: true },
        { n: 'descripcion', et: 'Descripción', tipo: 'textarea', req: true, ayuda: 'Mínimo 20 caracteres.' },
        { n: 'fecha_inicio', et: 'Fecha y hora de inicio', tipo: 'datetime', req: true },
        { n: 'fecha_fin', et: 'Fecha y hora de fin', tipo: 'datetime', req: true },
        { n: 'categoria_id', et: 'Categoría', tipo: 'select', req: true, opciones: opcionesDe('/categorias') },
        { n: 'lugar_id', et: 'Lugar', tipo: 'select', req: true, opciones: opcionesDe('/lugares') },
        { n: 'cupo_maximo', et: 'Cupo máximo', tipo: 'number', ayuda: 'Déjalo vacío si no hay límite.' },
        { n: 'estado', et: 'Estado', tipo: 'select', req: true, opciones: async () => ESTADOS, defecto: 'borrador', ayuda: 'Solo los eventos "Publicado" los ve el público.' },
        { n: 'imagen_url', et: 'URL de la imagen', tipo: 'url', ayuda: 'Opcional. Debe empezar con https://' },
      ],
    },
    categorias: {
      titulo: 'Categorías', singular: 'categoría', ruta: '/categorias',
      columnas: [['Nombre', (c) => esc(c.nombre)], ['Descripción', (c) => esc(c.descripcion || '—')], ['Color', (c) => `<span class="etiqueta" style="--cat:${esc(c.color)}">${esc(c.color)}</span>`]],
      campos: [
        { n: 'nombre', et: 'Nombre', tipo: 'text', req: true },
        { n: 'descripcion', et: 'Descripción', tipo: 'textarea' },
        { n: 'color', et: 'Color', tipo: 'color', defecto: '#2e7d32' },
      ],
    },
    lugares: {
      titulo: 'Lugares', singular: 'lugar', ruta: '/lugares',
      columnas: [['Nombre', (l) => esc(l.nombre)], ['Dirección', (l) => esc(l.direccion || '—')], ['Capacidad', (l) => esc(l.capacidad ?? '—')]],
      campos: [
        { n: 'nombre', et: 'Nombre', tipo: 'text', req: true },
        { n: 'direccion', et: 'Dirección', tipo: 'text' },
        { n: 'capacidad', et: 'Capacidad (personas)', tipo: 'number' },
        { n: 'latitud', et: 'Latitud', tipo: 'number', paso: 'any', ayuda: 'Opcional. Ej. 5.3377' },
        { n: 'longitud', et: 'Longitud', tipo: 'number', paso: 'any', ayuda: 'Opcional. Ej. -72.3959' },
      ],
    },
    usuarios: {
      titulo: 'Usuarios', singular: 'usuario', ruta: '/usuarios', paginado: true, soloAdmin: true,
      columnas: [['Nombre', (u) => esc(u.nombre)], ['Correo', (u) => esc(u.correo)], ['Rol', (u) => esc(u.rol)], ['Programa', (u) => esc(u.programa_academico || '—')]],
      campos: [
        { n: 'nombre', et: 'Nombre completo', tipo: 'text', req: true },
        { n: 'correo', et: 'Correo institucional', tipo: 'email', req: true, ayuda: 'Debe terminar en @unitropico.edu.co' },
        { n: 'rol', et: 'Rol', tipo: 'select', req: true, opciones: async () => ROLES, defecto: 'estudiante' },
        { n: 'contrasena', et: 'Contraseña', tipo: 'password', reqAlCrear: true, ayuda: 'Mínimo 8 caracteres, con letras y números. Al editar, déjala vacía para no cambiarla.' },
        { n: 'programa_academico', et: 'Programa académico', tipo: 'text' },
        { n: 'codigo_estudiantil', et: 'Código estudiantil', tipo: 'text', ayuda: 'Solo dígitos.' },
      ],
    },
  };

  let clave = 'eventos';
  let pagina = 1;
  let filas = [];
  let editando = null;
  const aviso = $('aviso');

  // ---------- Acceso ----------
  if (!esStaff()) {
    $('acceso').hidden = false;
    $('acceso').innerHTML = '<div class="estado"><h2>Acceso restringido</h2><p>Esta sección es solo para el personal de Bienestar. Inicia sesión con una cuenta autorizada.</p><a class="btn" href="login.html?volver=admin.html">Ingresar</a></div>';
    return;
  }
  $('panel').hidden = false;

  function pintarPestanas() {
    $('pestanas').innerHTML = Object.entries(ENTIDADES)
      .filter(([, e]) => !e.soloAdmin || esAdmin())
      .map(([k, e]) => `<button type="button" data-k="${k}" aria-pressed="${k === clave}">${esc(e.titulo)}</button>`).join('');
    $('pestanas').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { clave = b.dataset.k; pagina = 1; aviso.hidden = true; pintarPestanas(); cargar(); }));
  }

  // ---------- Listado ----------
  async function cargar() {
    const ent = ENTIDADES[clave];
    $('titulo-seccion').textContent = ent.titulo;
    $('nuevo').textContent = `+ Nuevo ${ent.singular}`;
    $('lista').setAttribute('aria-busy', 'true');
    $('lista').innerHTML = '<div class="estado" role="status"><div class="giro" aria-hidden="true"></div><p>Cargando…</p></div>';
    $('paginacion').hidden = true;
    try {
      let r;
      if (ent.paginado) {
        r = await api('GET', `${ent.ruta}${ent.consulta ? ent.consulta + '&' : '?'}pagina=${pagina}&limite=10`);
        filas = r.datos;
      } else { filas = await api('GET', ent.ruta); }
      $('lista').setAttribute('aria-busy', 'false');
      if (!filas.length) {
        $('lista').innerHTML = `<div class="estado"><h2>Todavía no hay ${esc(ent.titulo.toLowerCase())}</h2><p>Crea el primero con el botón "Nuevo ${esc(ent.singular)}".</p></div>`;
        return;
      }
      $('lista').innerHTML = `<div class="tabla-caja"><table><caption class="solo-lectores">Lista de ${esc(ent.titulo.toLowerCase())}</caption><thead><tr>
        ${ent.columnas.map((c) => `<th scope="col">${esc(c[0])}</th>`).join('')}<th scope="col">Acciones</th></tr></thead><tbody>
        ${filas.map((f, i) => `<tr>${ent.columnas.map((c) => `<td>${c[1](f)}</td>`).join('')}<td class="acciones">
          ${ent.extra ? ent.extra(f) : ''}
          <button class="btn btn-sec btn-peq" type="button" data-editar="${i}">Editar<span class="solo-lectores"> ${esc(f.titulo || f.nombre)}</span></button>
          <button class="btn btn-peligro btn-peq" type="button" data-borrar="${i}">Eliminar<span class="solo-lectores"> ${esc(f.titulo || f.nombre)}</span></button></td></tr>`).join('')}
        </tbody></table></div>`;
      $('lista').querySelectorAll('[data-editar]').forEach((b) => b.addEventListener('click', () => abrir(filas[b.dataset.editar])));
      $('lista').querySelectorAll('[data-borrar]').forEach((b) => b.addEventListener('click', () => eliminar(filas[b.dataset.borrar])));
      if (r) {
        const total = Math.max(Math.ceil(r.total / r.limite), 1);
        $('paginacion').hidden = total <= 1;
        $('pagina-info').textContent = `Página ${r.pagina} de ${total}`;
        $('anterior').disabled = r.pagina <= 1;
        $('siguiente').disabled = r.pagina >= total;
      }
    } catch (err) {
      $('lista').setAttribute('aria-busy', 'false');
      $('lista').innerHTML = `<div class="estado" role="alert"><h2>No pudimos cargar los datos</h2><p>${esc(mensajeError(err))}</p><button class="btn" type="button" id="reintentar">Reintentar</button></div>`;
      $('reintentar').addEventListener('click', cargar);
    }
  }

  // ---------- Formulario ----------
  async function abrir(fila) {
    const ent = ENTIDADES[clave];
    editando = fila || null;
    $('dlg-titulo').textContent = `${fila ? 'Editar' : 'Nuevo'} ${ent.singular}`;
    $('dlg-aviso').hidden = true;
    $('campos').innerHTML = '<p role="status">Cargando formulario…</p>';
    $('dlg').showModal();
    try {
      const html = [];
      for (const c of ent.campos) {
        const id = `f-${c.n}`;
        const req = c.req || (c.reqAlCrear && !fila);
        let v = fila ? fila[c.n] : c.defecto;
        if (c.tipo === 'datetime') v = aInputFecha(v);
        if (c.tipo === 'password') v = '';
        v = v ?? '';
        const ayuda = c.ayuda ? `<p class="ayuda" id="${id}-ayuda">${esc(c.ayuda)}</p>` : '';
        const desc = c.ayuda ? ` aria-describedby="${id}-ayuda"` : '';
        const rq = req ? ' required' : '';
        let ctl;
        if (c.tipo === 'textarea') ctl = `<textarea id="${id}" name="${c.n}"${rq}${desc}>${esc(v)}</textarea>`;
        else if (c.tipo === 'select') {
          const ops = await c.opciones();
          ctl = `<select id="${id}" name="${c.n}"${rq}${desc}>${req ? '<option value="">Selecciona…</option>' : '<option value="">—</option>'}${ops.map((o) => `<option value="${esc(o.valor)}"${o.valor === v ? ' selected' : ''}>${esc(o.texto)}</option>`).join('')}</select>`;
        } else {
          const tipo = c.tipo === 'datetime' ? 'datetime-local' : c.tipo;
          const extra = c.tipo === 'number' ? ` step="${c.paso || 1}"` : '';
          const auto = c.tipo === 'password' ? ' autocomplete="new-password"' : '';
          ctl = `<input id="${id}" name="${c.n}" type="${tipo}" value="${esc(v)}"${rq}${extra}${auto}${desc}>`;
        }
        html.push(`<div class="campo"><label for="${id}">${esc(c.et)}${req ? ' <span class="req" aria-hidden="true">*</span>' : ''}</label>${ctl}${ayuda}</div>`);
      }
      $('campos').innerHTML = html.join('');
      $('campos').querySelector('input, select, textarea')?.focus();
    } catch (err) {
      $('campos').innerHTML = '';
      avisar($('dlg-aviso'), 'error', mensajeError(err));
    }
  }

  function leerCuerpo() {
    const ent = ENTIDADES[clave];
    const cuerpo = {};
    for (const c of ent.campos) {
      const el = $(`f-${c.n}`);
      let v = el.value;
      if (c.tipo === 'number') v = v === '' ? null : Number(v);
      else if (c.tipo === 'datetime') v = deInputFecha(v);
      else if (c.tipo === 'password') { if (v === '') continue; }
      else { v = v.trim(); if (v === '' && !c.req) v = null; }
      cuerpo[c.n] = v;
    }
    return cuerpo;
  }

  $('form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ent = ENTIDADES[clave];
    const btn = $('guardar');
    $('dlg-aviso').hidden = true;
    mostrarErroresCampos($('form'), null);
    btn.disabled = true;
    try {
      const cuerpo = leerCuerpo();
      if (editando) await api('PUT', `${ent.ruta}/${editando.id}`, cuerpo);
      else await api('POST', ent.ruta, cuerpo);
      $('dlg').close();
      avisar(aviso, 'ok', `${ent.singular[0].toUpperCase() + ent.singular.slice(1)} ${editando ? 'actualizado' : 'creado'} correctamente.`);
      await cargar();
    } catch (err) {
      const sueltos = mostrarErroresCampos($('form'), err, 'f-');
      $('form').querySelector('[aria-invalid="true"]')?.focus();
      const hayCampos = err.data?.detalles?.length && !sueltos.length;
      avisar($('dlg-aviso'), 'error', hayCampos ? 'Revisa los campos marcados.' : (sueltos.length ? sueltos.join('; ') : mensajeError(err)));
    } finally { btn.disabled = false; }
  });

  async function eliminar(fila) {
    const ent = ENTIDADES[clave];
    if (!confirm(`¿Eliminar ${ent.singular} "${fila.titulo || fila.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await api('DELETE', `${ent.ruta}/${fila.id}`);
      avisar(aviso, 'ok', `${ent.singular[0].toUpperCase() + ent.singular.slice(1)} eliminado.`);
      if (filas.length === 1 && pagina > 1) pagina--;
      await cargar();
    } catch (err) { avisar(aviso, 'error', mensajeError(err)); aviso.scrollIntoView({ block: 'nearest' }); }
  }

  $('nuevo').addEventListener('click', () => abrir(null));
  $('cerrar').addEventListener('click', () => $('dlg').close());
  $('cancelar').addEventListener('click', () => $('dlg').close());
  $('anterior').addEventListener('click', () => { pagina--; cargar(); });
  $('siguiente').addEventListener('click', () => { pagina++; cargar(); });

  pintarPestanas();
  cargar();
})();
