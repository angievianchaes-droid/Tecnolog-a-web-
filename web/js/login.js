(function () {
  const { api, guardar, mensajeError, mostrarErroresCampos, avisar } = App;

  // Redirección segura: solo a páginas del propio sitio
  function destino() {
    const v = new URLSearchParams(location.search).get('volver');
    return v && /^[a-z]+\.html(\?[\w=&%-]*)?$/i.test(v) ? v : 'index.html';
  }

  function conectar(form, aviso, ruta, prefijo, armar) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      aviso.hidden = true;
      const btn = form.querySelector('button[type=submit]');
      mostrarErroresCampos(form, null);
      btn.disabled = true;
      try {
        const s = await api('POST', ruta, armar(new FormData(form)));
        guardar(s);
        location.href = s.usuario.rol === 'estudiante' ? destino() : (destino() === 'index.html' ? 'admin.html' : destino());
      } catch (err) {
        btn.disabled = false;
        const sueltos = mostrarErroresCampos(form, err, prefijo);
        const primero = form.querySelector('[aria-invalid="true"]');
        if (primero) primero.focus();
        if (!err.data?.detalles?.length || sueltos.length) avisar(aviso, 'error', sueltos.length ? sueltos.join('; ') : mensajeError(err));
        else avisar(aviso, 'error', 'Revisa los campos marcados.');
      }
    });
  }

  const limpio = (v) => { const t = String(v ?? '').trim(); return t === '' ? null : t; };

  conectar(document.getElementById('form-login'), document.getElementById('aviso-login'), '/auth/login', 'login-',
    (f) => ({ correo: f.get('correo'), contrasena: f.get('contrasena') }));

  conectar(document.getElementById('form-registro'), document.getElementById('aviso-registro'), '/auth/registro', 'reg-',
    (f) => ({ nombre: f.get('nombre'), correo: f.get('correo'), contrasena: f.get('contrasena'),
      programa_academico: limpio(f.get('programa_academico')), codigo_estudiantil: limpio(f.get('codigo_estudiantil')) }));
})();
