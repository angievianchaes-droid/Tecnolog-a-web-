(function () {
  const { api, esc, fechaLarga, mensajeError, sesion, esStaff, avisar } = App;
  const cont = document.getElementById('evento');
  const id = new URLSearchParams(location.search).get('id');
  let evento = null;

  const estado = (html, rol = 'status') => { cont.setAttribute('aria-busy', 'false'); cont.innerHTML = `<div class="estado" role="${rol}">${html}</div>`; };

  async function cargar() {
    cont.setAttribute('aria-busy', 'true');
    cont.innerHTML = '<div class="estado" role="status"><div class="giro" aria-hidden="true"></div><p>Cargando evento…</p></div>';
    if (!id) return estado('<h2>Falta el evento</h2><p>Elige un evento desde el listado.</p><a class="btn" href="index.html">Ver eventos</a>');
    try {
      evento = await api('GET', `/eventos/${encodeURIComponent(id)}`);
      pintar();
      if (esStaff()) cargarInscritos();
    } catch (err) {
      if (err.status === 404 || err.status === 400) estado('<h2>Evento no encontrado</h2><p>Puede que haya sido eliminado o que el enlace sea incorrecto.</p><a class="btn" href="index.html">Ver eventos</a>');
      else {
        estado(`<h2>No pudimos cargar el evento</h2><p>${esc(mensajeError(err))}</p><button class="btn" type="button" id="reintentar">Reintentar</button>`, 'alert');
        document.getElementById('reintentar').addEventListener('click', cargar);
      }
    }
  }

  function bloqueInscripcion() {
    const e = evento;
    const mi = e.mi_inscripcion;
    if (!sesion()) return `<p>Para inscribirte necesitas una cuenta institucional.</p><a class="btn" href="login.html?volver=${encodeURIComponent(location.pathname.split('/').pop() + location.search)}">Ingresar o crear cuenta</a>`;
    if (e.estado !== 'publicado') return `<p class="aviso aviso-info">Este evento está <strong>${esc(e.estado)}</strong>; no admite inscripciones.</p>`;
    if (new Date(e.fecha_fin) < new Date()) return '<p class="aviso aviso-info">Este evento ya terminó.</p>';
    if (mi && mi.estado !== 'cancelada') {
      const txt = mi.estado === 'en_espera' ? 'Estás en <strong>lista de espera</strong>. Si se libera un cupo, pasarás a confirmado automáticamente.' : 'Tu inscripción está <strong>confirmada</strong>. ¡Te esperamos!';
      return `<p class="aviso aviso-ok">${txt}</p><button class="btn btn-peligro" type="button" id="cancelar">Cancelar mi inscripción</button>`;
    }
    const lleno = e.cupos_disponibles === 0;
    return `${lleno ? '<p class="aviso aviso-info">El cupo está lleno. Puedes anotarte en la lista de espera.</p>' : ''}<button class="btn" type="button" id="inscribir">${lleno ? 'Anotarme en lista de espera' : 'Inscribirme'}</button>`;
  }

  function pintar() {
    const e = evento;
    cont.setAttribute('aria-busy', 'false');
    const cupo = e.cupo_maximo == null ? 'Sin límite de cupo' : `${e.inscritos} de ${e.cupo_maximo} cupos ocupados (${e.cupos_disponibles} disponibles)`;
    document.title = `${e.titulo} · Bienestar Unitrópico`;
    cont.innerHTML = `
      <div class="detalle" style="--cat:${esc(e.categoria_color)}">
        <article class="panel">
          <span class="etiqueta">${esc(e.categoria_nombre)}</span>
          ${e.estado !== 'publicado' ? `<span class="insignia insignia-gris">${esc(e.estado)}</span>` : ''}
          <h1 style="margin-top:.6rem">${esc(e.titulo)}</h1>
          <p style="white-space:pre-line">${esc(e.descripcion)}</p>
          <h2>Información</h2>
          <dl class="datos">
            <dt>Inicio</dt><dd>${esc(fechaLarga(e.fecha_inicio))}</dd>
            <dt>Fin</dt><dd>${esc(fechaLarga(e.fecha_fin))}</dd>
            <dt>Lugar</dt><dd>${esc(e.lugar_nombre)}</dd>
            <dt>Cupo</dt><dd>${esc(cupo)}</dd>
          </dl>
        </article>
        <aside class="panel" aria-labelledby="t-insc">
          <h2 id="t-insc">Inscripción</h2>
          <div id="msg" role="status" hidden></div>
          ${bloqueInscripcion()}
        </aside>
      </div>`;
    document.getElementById('inscribir')?.addEventListener('click', () => accion('POST', 'Inscripción registrada.'));
    document.getElementById('cancelar')?.addEventListener('click', () => { if (confirm('¿Cancelar tu inscripción a este evento?')) accion('DELETE', 'Inscripción cancelada.', '/mia'); });
  }

  async function accion(metodo, okMsg, sufijo = '') {
    const btn = document.querySelector('#inscribir, #cancelar');
    btn.disabled = true;
    try {
      await api(metodo, `/eventos/${encodeURIComponent(id)}/inscripciones${sufijo}`);
      await cargar();
      const m = document.getElementById('msg');
      if (m) avisar(m, 'ok', okMsg);
    } catch (err) {
      btn.disabled = false;
      if (err.status === 401) { location.href = 'login.html'; return; }
      avisar(document.getElementById('msg'), 'error', mensajeError(err));
    }
  }

  async function cargarInscritos() {
    const sec = document.getElementById('inscritos');
    sec.hidden = false;
    sec.innerHTML = '<h2 id="titulo-inscritos">Inscritos</h2><div class="estado" role="status"><div class="giro" aria-hidden="true"></div><p>Cargando inscritos…</p></div>';
    try {
      const lista = await api('GET', `/eventos/${encodeURIComponent(id)}/inscripciones`);
      if (!lista.length) { sec.innerHTML = '<h2 id="titulo-inscritos">Inscritos</h2><div class="estado"><p>Aún no hay personas inscritas.</p></div>'; return; }
      sec.innerHTML = `<h2 id="titulo-inscritos">Inscritos (${lista.length})</h2>
        <div class="tabla-caja"><table><thead><tr><th scope="col">Nombre</th><th scope="col">Correo</th><th scope="col">Programa</th><th scope="col">Estado</th><th scope="col">Asistencia</th></tr></thead><tbody>
        ${lista.map((i) => `<tr><td>${esc(i.nombre)}</td><td>${esc(i.correo)}</td><td>${esc(i.programa_academico || '—')}</td><td>${esc(i.estado.replace('_', ' '))}</td>
          <td>${i.estado === 'confirmada' ? `<label><input type="checkbox" data-id="${esc(i.id)}" ${i.asistio ? 'checked' : ''}> Asistió<span class="solo-lectores">: ${esc(i.nombre)}</span></label>` : '—'}</td></tr>`).join('')}
        </tbody></table></div><div id="msg-asist" role="status" hidden style="margin-top:1rem"></div>`;
      sec.querySelectorAll('input[type=checkbox]').forEach((c) => c.addEventListener('change', async () => {
        try {
          await api('PATCH', `/eventos/${encodeURIComponent(id)}/inscripciones/${c.dataset.id}/asistencia`, { asistio: c.checked });
          avisar(document.getElementById('msg-asist'), 'ok', 'Asistencia actualizada.');
        } catch (err) { c.checked = !c.checked; avisar(document.getElementById('msg-asist'), 'error', mensajeError(err)); }
      }));
    } catch (err) {
      sec.innerHTML = `<h2 id="titulo-inscritos">Inscritos</h2><div class="aviso aviso-error" role="alert">${esc(mensajeError(err))}</div>`;
    }
  }

  cargar();
})();
