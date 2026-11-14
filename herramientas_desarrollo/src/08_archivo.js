
/* ===================== VENTANAS, ARCHIVOS, DESHACER, EJEMPLOS ===================== */
function modal(titulo, html, botones = [], ancha = false) {
  $('#mTitulo').textContent = titulo; $('#mCuerpo').innerHTML = html;
  const pie = $('#mPie'); pie.innerHTML = '';
  botones.forEach(([txt, fn, prim]) => { const b = document.createElement('button'); b.textContent = txt; if (prim) b.className = 'primario'; b.onclick = fn; pie.appendChild(b); });
  const cerrar = document.createElement('button'); cerrar.textContent = 'Cerrar'; cerrar.onclick = cerrarModal; pie.appendChild(cerrar);
  const caja = $('#modal .caja'); caja.classList.toggle('ancha', ancha); caja.style.transform = '';
  $('#modal').classList.remove('oculto');
}
function cerrarModal() { $('#modal').classList.add('oculto'); }
function arrastrarModal() { // la ventana se mueve arrastrando el título
  const t = $('.mtit'), caja = $('#modal .caja'); let ini = null;
  t.addEventListener('pointerdown', ev => { if (ev.target.tagName === 'BUTTON') return; const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(caja.style.transform) || [0, 0, 0]; ini = [ev.clientX - m[1], ev.clientY - m[2]]; t.setPointerCapture(ev.pointerId); });
  t.addEventListener('pointermove', ev => { if (ini) caja.style.transform = `translate(${ev.clientX - ini[0]}px, ${ev.clientY - ini[1]}px)`; });
  t.addEventListener('pointerup', () => ini = null);
}

// ---------- deshacer / rehacer ----------
const HIST = { pila: [], pos: -1 };
function guardarHistoria() {
  const s = JSON.stringify(P);
  if (HIST.pila[HIST.pos] === s) return;
  HIST.pila = HIST.pila.slice(0, HIST.pos + 1); HIST.pila.push(s);
  if (HIST.pila.length > 80) HIST.pila.shift();
  HIST.pos = HIST.pila.length - 1;
}
function irHistoria(d) {
  const p = HIST.pos + d; if (p < 0 || p >= HIST.pila.length) { aviso(d < 0 ? 'Nada que deshacer' : 'Nada que rehacer'); return; }
  HIST.pos = p; P = JSON.parse(HIST.pila[p]); UI.punto = -1; UI.varilla = -1;
  ponerControles(); recalcular(); refrescarClaves();
  $('#estado').textContent = d < 0 ? 'Deshecho' : 'Rehecho';
}

// ---------- proyecto ----------
function proyectoDePlantilla(id, extra) {
  const p = proyectoBase(); p.plantilla = id; p.params = paramsDefecto(id); p.nombre = PLANTILLAS[id].nombre;
  // paneles de pared: lamas finas y juntas (tablero de 12 mm cada 26 mm, hueco de 14 mm)
  if (grupoDe(id) === 'pared') { p.tipo = 'pared'; p.costillas.grosor = 12; p.costillas.separacion = 26; }
  // radiales: tablero fino, reparto por número y un tubo en el que quepan las costillas
  if (grupoDe(id) === 'radial') { p.tipo = 'radial'; p.costillas.grosor = 6; p.costillas.modo = 'numero'; p.costillas.numero = 12; p.radial.tubo = Math.max(p.radial.tubo, Math.ceil(p.costillas.numero * (p.costillas.grosor + 1) / Math.PI)); }
  if (extra) {
    if (extra.params) Object.assign(p.params, extra.params);
    if (extra.costillas) Object.assign(p.costillas, extra.costillas);
    if (extra.varillas) Object.assign(p.varillas, extra.varillas);
    if (extra.reticula) Object.assign(p.reticula, extra.reticula);
    if (extra.tipo) p.tipo = extra.tipo;
    ['planta', 'radial', 'pared', 'relieve', 'figura'].forEach(k => { if (extra[k]) Object.assign(p[k], extra[k]); });
    if (Array.isArray(extra.huecos)) p.huecos = extra.huecos.map(h => { const b = huecoNuevo(h.forma || 'rect'); return Object.assign(b, JSON.parse(JSON.stringify(h)), { mueble: Object.assign(b.mueble, h.mueble || {}) }); });
    if (extra.nombre) p.nombre = extra.nombre;
  }
  return p;
}
function cargarProyecto(p, autoVar) {
  P = p; UI.clave = 0; UI.punto = -1; UI.varilla = -1; UI.costilla = 0;
  if (!P.claves || !P.claves.length) aplicarPlantilla();
  R = calcular();
  if (autoVar && P.tipo === 'costillas' && !P.varillas.lista.length) { autoVarillas(P.varillas.autoN); }
  HIST.pila = []; HIST.pos = -1; guardarHistoria();
  ponerControles(); recalcular(); refrescarClaves();
  // edita de entrada el perfil clave más cercano al centro del mueble
  const C = clavesOrdenadas(); let mejor = 0;
  C.forEach((k, i) => { if (Math.abs(k.x - P.largo / 2) < Math.abs(C[mejor].x - P.largo / 2)) mejor = i; });
  UI.clave = mejor; refrescarClaves();
  encuadrarPerfil(); selCostilla(Math.floor(R.n / 2)); camara('tres4'); colores3D();
  registrarLetras();
  UI.sucio = false;
}
function validarProyecto(o) {
  if (!o || o.app !== 'Made-rebanadas' || !Array.isArray(o.claves) || !o.claves.length) throw new Error('No es un proyecto de Made-rebanadas.');
  const b = proyectoBase(), p = Object.assign(b, o);
  p.costillas = Object.assign(proyectoBase().costillas, o.costillas || {});
  p.varillas = Object.assign(proyectoBase().varillas, o.varillas || {});
  p.vista = Object.assign(proyectoBase().vista, o.vista || {});
  p.maqueta = Object.assign(proyectoBase().maqueta, o.maqueta || {});
  p.cnc = Object.assign(proyectoBase().cnc, o.cnc || {});
  p.reticula = Object.assign(proyectoBase().reticula, o.reticula || {});
  ['planta', 'radial', 'pared', 'relieve', 'figura'].forEach(k => p[k] = Object.assign(proyectoBase()[k], o[k] || {}));
  p.relieve.capa = Object.assign(proyectoBase().relieve.capa, (o.relieve || {}).capa || {});
  p.huecos = Array.isArray(o.huecos) ? o.huecos.map(h => { const b = huecoNuevo(h.forma || 'rect'); return Object.assign(b, h, { mueble: Object.assign(b.mueble, h.mueble || {}) }); }) : [];
  if (!['reticula', 'radial', 'pared'].includes(p.tipo)) p.tipo = 'costillas';
  if (!PLANTILLAS[p.plantilla]) p.plantilla = 'libre';
  p.params = Object.assign(paramsDefecto(p.plantilla), o.params || {});
  const n = p.claves[0].pts.length;
  if (p.claves.some(c => !Array.isArray(c.pts) || c.pts.length !== n || !isFinite(c.x))) throw new Error('Los perfiles clave del archivo están dañados.');
  if (!Array.isArray(p.esquinas) || p.esquinas.length !== n) p.esquinas = new Array(n).fill(false);
  if (!MATERIALES[p.costillas.material]) p.costillas.material = 'abedul';
  return p;
}
function guardarArchivo() {
  P.versionPrograma = VERSION;
  descargar(nombreArchivo(P.nombre) + '.json', JSON.stringify(P, null, 1), 'application/json');
  UI.sucio = false; aviso('Proyecto guardado');
}
function abrirArchivo() {
  const f = $('#fArchivo'); f.value = '';
  f.onchange = () => {
    const a = f.files[0]; if (!a) return;
    const rd = new FileReader();
    rd.onload = () => {
      try { cargarProyecto(validarProyecto(JSON.parse(rd.result))); aviso('Abierto: ' + esc(a.name)); }
      catch (e) { aviso('⚠ ' + esc(e.message || 'No se pudo abrir el archivo'), 5000); }
    };
    rd.readAsText(a);
  };
  f.click();
}
function dialogoNuevo() {
  const items = Object.entries(PLANTILLAS).map(([id, pl]) => `<button data-nuevo="${id}"><img src="assets/miniaturas/${id}.jpg" alt="" loading="lazy" onerror="this.style.display='none'"><b>${pl.nombre}</b><small>${pl.desc}</small></button>`).join('');
  modal('🗋 Mueble nuevo', `<p class="nota">Elige una plantilla. Después puedes cambiar sus medidas y retocar los perfiles a mano.</p><div class="plantillas">${items}</div>`, [], true);
  $$('[data-nuevo]').forEach(b => b.onclick = () => {
    if (UI.sucio && !confirm('Hay cambios sin guardar. ¿Empezar un mueble nuevo?')) return;
    cerrarModal(); cargarProyecto(proyectoDePlantilla(b.dataset.nuevo), true);
  });
}
async function dialogoModelos(paraFigura) {
  try { aviso('Cargando los modelos…'); await cargarRecurso('modelos'); } catch (e) { aviso('⚠ ' + esc(e.message), 5000); return; }
  const M = modelosEjemplo();
  const items = M.map(m => `<button data-mod="${m.id}"><b>${esc(m.nombre)}</b><small>${esc(m.desc)} · ${m.triangulos.toLocaleString('es-ES')} triángulos · <a href="assets/modelos/${m.archivo}" download data-stl>${m.archivo}</a></small></button>`).join('');
  modal('🗿 Modelos 3D de ejemplo', `<p class="nota">${paraFigura ? 'Modelos para probar la figura: cada costilla será un corte del modelo. Al elegir uno se carga a 800 mm de alto; después cambia el alto, los cortes, el giro o la separación.' : 'Modelos para probar el relieve. Al elegir uno se carga con su vista y unas medidas de panel adecuadas; después cambia la vista, el giro, el relieve o las lamas para ver qué pasa.'} Los mismos modelos están como STL en <b>assets/modelos</b>.</p><div class="ejemplos">${items || '<p>No se encuentra assets/modelos/modelos.js</p>'}</div>`);
  $$('[data-stl]').forEach(a => a.onclick = e => e.stopPropagation());
  $$('[data-mod]').forEach(b => b.onclick = () => {
    cerrarModal();
    if (paraFigura) {
      try {
        const r = triangulosEjemplo(b.dataset.mod); if (!r) throw new Error('No se encuentra el modelo');
        cargarFiguraTriangulos(r.tri, r.M.nombre, b.dataset.mod);
        R = calcular(); if (P.tipo === 'costillas') autoVarillas(P.varillas.autoN);
        UI.costilla = 0; ponerControles(); cambio('Figura: ' + r.M.nombre); encuadrarSiHaceFalta(); encuadrarPerfil(); camara('tres4');
        aviso(esc(r.M.nombre));
      } catch (e) { aviso('⚠ ' + esc(e.message), 5000); }
      return;
    }
    try {
      // fuera de un panel de pared, empieza un panel nuevo (preguntando si hay cambios)
      const nuevo = P.tipo !== 'pared';
      if (nuevo && UI.sucio && !confirm('El relieve se hace en un panel de pared nuevo. Hay cambios sin guardar. ¿Seguir?')) return;
      const ant = P; if (nuevo) P = proyectoDePlantilla('pared_ondas');
      let n; try { n = cargarModeloEjemplo(b.dataset.mod, true); } catch (e) { P = ant; throw e; }
      if (P.pared.rastreles && P.relieve.fondo < P.pared.grueso + 15) P.relieve.fondo = P.pared.grueso + 15;
      if (nuevo) { P.nombre = 'Relieve ' + P.relieve.modelo.nombre; const p = P; P = ant; cargarProyecto(p, true); }
      else { ponerControles(); cambio('Modelo: ' + P.relieve.modelo.nombre); encuadrarSiHaceFalta(); camara('tres4'); }
      aviso(`${esc(P.relieve.modelo.nombre)}: ${n.toLocaleString('es-ES')} triángulos`);
    } catch (e) { aviso('⚠ ' + esc(e.message), 5000); }
  });
}
async function dialogoImagenes() {
  try { await cargarRecurso('imagenes'); } catch (e) { aviso('⚠ ' + esc(e.message), 5000); return; }
  const I = imagenesEjemplo();
  const items = I.map(m => `<button data-img="${m.id}" style="display:flex;gap:10px;align-items:center;text-align:left"><img src="${m.png}" alt="" style="width:64px;height:64px;object-fit:contain;background:#000;border-radius:4px;flex:none"><span><b>${esc(m.nombre)}</b><small>${esc(m.desc)} · <a href="assets/imagenes/${m.archivo}" download data-png>${m.archivo}</a></small></span></button>`).join('');
  modal('🖼 Imágenes de ejemplo', `<p class="nota">Imágenes en escala de grises para probar el relieve: <b>lo blanco sale más y lo negro queda en el fondo</b>. Al elegir una se carga con unas medidas de panel adecuadas. Las mismas imágenes están como PNG en <b>assets/imagenes</b>: ábrelas o retócalas en un programa de dibujo y vuelve a cargarlas.</p><div class="ejemplos">${items || '<p>No se encuentra assets/imagenes/imagenes.js</p>'}</div>`);
  $$('[data-png]').forEach(a => a.onclick = e => e.stopPropagation());
  $$('[data-img]').forEach(b => b.onclick = () => {
    cerrarModal();
    try {
      const nuevo = P.tipo !== 'pared';
      if (nuevo && UI.sucio && !confirm('El relieve se hace en un panel de pared nuevo. Hay cambios sin guardar. ¿Seguir?')) return;
      const ant = P; if (nuevo) P = proyectoDePlantilla('pared_ondas');
      let E; try { E = cargarImagenEjemplo(b.dataset.img, true); } catch (e) { P = ant; throw e; }
      if (P.pared.rastreles && P.relieve.fondo < P.pared.grueso + 15) P.relieve.fondo = P.pared.grueso + 15;
      if (nuevo) { P.nombre = 'Relieve ' + E.nombre; const p = P; P = ant; cargarProyecto(p, true); }
      else { ponerControles(); cambio('Imagen: ' + E.nombre); encuadrarSiHaceFalta(); camara('tres4'); }
      aviso(esc(E.nombre));
    } catch (e) { aviso('⚠ ' + esc(e.message), 5000); }
  });
}
function dialogoEjemplos() {
  const E = window.MADE_EJEMPLOS || [];
  const items = E.map((e, i) => `<button data-ej="${i}"><b>${esc(e.nombre)}</b><small>${esc(e.desc)}</small></button>`).join('');
  modal('🪑 Ejemplos', `<p class="nota">Muebles de ejemplo para ver cómo funciona. Se abren como un proyecto nuevo.</p><div class="ejemplos">${items || '<p>No se encuentra assets/ejemplos/ejemplos.js</p>'}</div>`);
  $$('[data-ej]').forEach(b => b.onclick = async () => {
    if (UI.sucio && !confirm('Hay cambios sin guardar. ¿Abrir el ejemplo?')) return;
    const e = E[+b.dataset.ej]; cerrarModal();
    const p = proyectoDePlantilla(e.plantilla, e);
    if (e.modeloEjemplo || e.imagenEjemplo || e.figuraEjemplo) {
      const ant = P;
      try {
        if (e.imagenEjemplo) await cargarRecurso('imagenes'); else { aviso('Cargando el modelo…'); await cargarRecurso('modelos'); }
        P = p;
        if (e.modeloEjemplo) cargarModeloEjemplo(e.modeloEjemplo, false, true);
        else if (e.imagenEjemplo) cargarImagenEjemplo(e.imagenEjemplo);
        else { const r = triangulosEjemplo(e.figuraEjemplo); if (!r) throw new Error('No se encuentra el modelo «' + e.figuraEjemplo + '»'); cargarFiguraTriangulos(r.tri, r.M.nombre, e.figuraEjemplo); }
      } catch (er) { aviso('⚠ ' + esc(er.message), 5000); }
      P = ant;
    }
    cargarProyecto(p, true);
    aviso('Ejemplo: ' + esc(e.nombre));
  });
}
