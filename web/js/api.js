// Utilidades compartidas: llamadas a la API, sesión, formato y navegación.
(function () {
  const API = '/api';
  const K = 'bienestar_sesion';

  const guardar = (s) => { try { localStorage.setItem(K, JSON.stringify(s)); } catch { window.__sesion = s; } };
  const leer = () => { try { return JSON.parse(localStorage.getItem(K)) || window.__sesion || null; } catch { return window.__sesion || null; } };
  const borrar = () => { try { localStorage.removeItem(K); } catch { /* sin almacenamiento */ } window.__sesion = null; };

  const sesion = () => leer();
  const esStaff = () => ['bienestar', 'admin'].includes(sesion()?.usuario?.rol);
  const esAdmin = () => sesion()?.usuario?.rol === 'admin';

  // Escapa texto para insertarlo de forma segura en HTML
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function api(metodo, ruta, cuerpo) {
    const s = sesion();
    let res;
    try {
      res = await fetch(API + ruta, {
        method: metodo,
        headers: { 'Content-Type': 'application/json', ...(s ? { Authorization: `Bearer ${s.token}` } : {}) },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
      });
    } catch {
      throw { status: 0, data: { codigo: 'SIN_RED', mensaje: 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.' } };
    }
    const texto = await res.text();
    const data = texto ? JSON.parse(texto) : null;
    if (res.status === 401 && s && data?.codigo !== 'CREDENCIALES_INVALIDAS') { borrar(); }
    if (!res.ok) throw { status: res.status, data };
    return data;
  }

  const zona = 'America/Bogota';
  const fechaLarga = (iso) => new Intl.DateTimeFormat('es-CO', { dateStyle: 'full', timeStyle: 'short', timeZone: zona }).format(new Date(iso));
  const fechaCorta = (iso) => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: zona }).format(new Date(iso));

  // Convierte ISO a valor para <input type="datetime-local"> (hora de Colombia)
  function aInputFecha(iso) {
    if (!iso) return '';
    const p = new Intl.DateTimeFormat('sv-SE', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
    return p.replace(' ', 'T');
  }
  // De "2026-11-20T14:00" (hora de Colombia, UTC-5) a ISO con zona
  const deInputFecha = (v) => (v ? `${v}:00-05:00` : null);

  function mensajeError(err) {
    const d = err?.data;
    if (!d) return 'Ocurrió un error inesperado.';
    if (d.detalles?.length) return `${d.mensaje}: ${d.detalles.map((x) => x.mensaje).join('; ')}`;
    return d.mensaje || 'Ocurrió un error inesperado.';
  }

  // Muestra errores de validación (422) junto a cada campo del formulario
  function mostrarErroresCampos(form, err, prefijo = '') {
    form.querySelectorAll('.mensaje-error').forEach((e) => e.remove());
    form.querySelectorAll('[aria-invalid]').forEach((e) => { e.removeAttribute('aria-invalid'); });
    const sin = [];
    for (const d of err?.data?.detalles || []) {
      const input = form.querySelector(`#${prefijo}${d.campo}`);
      if (!input) { sin.push(d.mensaje); continue; }
      input.setAttribute('aria-invalid', 'true');
      const p = document.createElement('p');
      p.className = 'mensaje-error';
      p.id = `${prefijo}${d.campo}-error`;
      p.textContent = d.mensaje;
      input.setAttribute('aria-describedby', p.id);
      input.insertAdjacentElement('afterend', p);
    }
    return sin;
  }

  function avisar(el, tipo, texto) {
    el.className = `aviso aviso-${tipo}`;
    el.textContent = texto;
    el.hidden = false;
  }

  function pintarNav() {
    const nav = document.getElementById('nav');
    if (!nav) return;
    const actual = location.pathname.split('/').pop() || 'index.html';
    const s = sesion();
    const enlace = (href, txt) => `<a href="${href}"${actual === href ? ' aria-current="page"' : ''}>${txt}</a>`;
    let html = enlace('index.html', 'Eventos');
    if (esStaff()) html += enlace('admin.html', 'Administración');
    if (s) html += `<span class="usuario">${esc(s.usuario.nombre)} · ${esc(s.usuario.rol)}</span><button type="button" id="btn-salir">Cerrar sesión</button>`;
    else html += enlace('login.html', 'Ingresar');
    nav.innerHTML = html;
    document.getElementById('btn-salir')?.addEventListener('click', () => { borrar(); location.href = 'index.html'; });
  }

  document.addEventListener('DOMContentLoaded', pintarNav);
  window.App = { api, sesion, guardar, esStaff, esAdmin, esc, fechaLarga, fechaCorta, aInputFecha, deInputFecha, mensajeError, mostrarErroresCampos, avisar, pintarNav };
})();
