(function () {
  const { api, esc, fechaCorta, mensajeError } = App;
  const cont = document.getElementById('resultado');
  const form = document.getElementById('filtros');
  const pag = document.getElementById('paginacion');
  let pagina = 1;

  const cargando = () => {
    cont.setAttribute('aria-busy', 'true');
    cont.innerHTML = '<div class="estado" role="status"><div class="giro" aria-hidden="true"></div><p>Cargando eventos…</p></div>';
    pag.hidden = true;
  };

  function tarjeta(e) {
    const lleno = e.cupos_disponibles === 0;
    const cupos = e.cupo_maximo == null
      ? '<span class="insignia">Cupo libre</span>'
      : lleno ? '<span class="insignia insignia-alerta">Cupo lleno · lista de espera</span>'
              : `<span class="insignia">${e.cupos_disponibles} cupos disponibles</span>`;
    return `<li><article class="tarjeta" style="--cat:${esc(e.categoria_color)}">
      <span class="etiqueta">${esc(e.categoria_nombre)}</span>
      <h2><a href="detalle.html?id=${esc(e.id)}">${esc(e.titulo)}</a></h2>
      <p class="meta"><span class="solo-lectores">Fecha: </span>📅 ${esc(fechaCorta(e.fecha_inicio))}</p>
      <p class="meta"><span class="solo-lectores">Lugar: </span>📍 ${esc(e.lugar_nombre)}</p>
      <div class="pie-tarjeta">${cupos}<a class="btn btn-sec btn-peq" href="detalle.html?id=${esc(e.id)}">Ver detalle<span class="solo-lectores"> de ${esc(e.titulo)}</span></a></div>
    </article></li>`;
  }

  async function cargar() {
    cargando();
    const p = new URLSearchParams({ pagina, limite: 9 });
    for (const [k, v] of new FormData(form)) if (v) p.set(k, v);
    try {
      const r = await api('GET', `/eventos?${p}`);
      cont.setAttribute('aria-busy', 'false');
      if (!r.datos.length) {
        cont.innerHTML = '<div class="estado"><h2>No encontramos eventos</h2><p>No hay eventos próximos con esos filtros. Prueba con otra búsqueda o limpia los filtros.</p></div>';
        return;
      }
      cont.innerHTML = `<ul class="rejilla">${r.datos.map(tarjeta).join('')}</ul>`;
      const total = Math.max(Math.ceil(r.total / r.limite), 1);
      pag.hidden = total <= 1;
      document.getElementById('pagina-info').textContent = `Página ${r.pagina} de ${total}`;
      document.getElementById('anterior').disabled = r.pagina <= 1;
      document.getElementById('siguiente').disabled = r.pagina >= total;
    } catch (err) {
      cont.setAttribute('aria-busy', 'false');
      cont.innerHTML = `<div class="estado" role="alert"><h2>No pudimos cargar los eventos</h2><p>${esc(mensajeError(err))}</p><button class="btn" type="button" id="reintentar">Reintentar</button></div>`;
      document.getElementById('reintentar').addEventListener('click', cargar);
    }
  }

  async function cargarCategorias() {
    try {
      const cats = await api('GET', '/categorias');
      document.getElementById('categoria').insertAdjacentHTML('beforeend', cats.map((c) => `<option value="${esc(c.id)}">${esc(c.nombre)}</option>`).join(''));
    } catch { /* el filtro queda solo con "Todas" */ }
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); pagina = 1; cargar(); });
  document.getElementById('limpiar').addEventListener('click', () => { form.reset(); pagina = 1; cargar(); });
  document.getElementById('anterior').addEventListener('click', () => { pagina--; cargar(); });
  document.getElementById('siguiente').addEventListener('click', () => { pagina++; cargar(); });

  cargarCategorias();
  cargar();
})();
