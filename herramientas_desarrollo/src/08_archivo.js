
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
  if (extra) {
    if (extra.params) Object.assign(p.params, extra.params);
    if (extra.costillas) Object.assign(p.costillas, extra.costillas);
    if (extra.varillas) Object.assign(p.varillas, extra.varillas);
    if (extra.nombre) p.nombre = extra.nombre;
  }
  return p;
}
function cargarProyecto(p, autoVar) {
  P = p; UI.clave = 0; UI.punto = -1; UI.varilla = -1; UI.costilla = 0;
  if (!P.claves || !P.claves.length) aplicarPlantilla();
  R = calcular();
  if (autoVar && !P.varillas.lista.length) { autoVarillas(P.varillas.autoN); }
  HIST.pila = []; HIST.pos = -1; guardarHistoria();
  ponerControles(); recalcular(); refrescarClaves();
  // edita de entrada el perfil clave más cercano al centro del mueble
  const C = clavesOrdenadas(); let mejor = 0;
  C.forEach((k, i) => { if (Math.abs(k.x - P.largo / 2) < Math.abs(C[mejor].x - P.largo / 2)) mejor = i; });
  UI.clave = mejor; refrescarClaves();
  encuadrarPerfil(); selCostilla(Math.floor(R.n / 2)); camara('tres4'); colores3D();
  UI.sucio = false;
}
function validarProyecto(o) {
  if (!o || o.app !== 'Made-rebanadas' || !Array.isArray(o.claves) || !o.claves.length) throw new Error('No es un proyecto de Made-rebanadas.');
  const b = proyectoBase(), p = Object.assign(b, o);
  p.costillas = Object.assign(proyectoBase().costillas, o.costillas || {});
  p.varillas = Object.assign(proyectoBase().varillas, o.varillas || {});
  p.vista = Object.assign(proyectoBase().vista, o.vista || {});
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
  const items = Object.entries(PLANTILLAS).map(([id, pl]) => `<button data-nuevo="${id}"><b>${pl.nombre}</b><small>${pl.desc}</small></button>`).join('');
  modal('🗋 Mueble nuevo', `<p class="nota">Elige una plantilla. Después puedes cambiar sus medidas y retocar los perfiles a mano.</p><div class="ejemplos">${items}</div>`);
  $$('[data-nuevo]').forEach(b => b.onclick = () => {
    if (UI.sucio && !confirm('Hay cambios sin guardar. ¿Empezar un mueble nuevo?')) return;
    cerrarModal(); cargarProyecto(proyectoDePlantilla(b.dataset.nuevo), true);
  });
}
function dialogoEjemplos() {
  const E = window.MADE_EJEMPLOS || [];
  const items = E.map((e, i) => `<button data-ej="${i}"><b>${esc(e.nombre)}</b><small>${esc(e.desc)}</small></button>`).join('');
  modal('🪑 Ejemplos', `<p class="nota">Muebles de ejemplo para ver cómo funciona. Se abren como un proyecto nuevo.</p><div class="ejemplos">${items || '<p>No se encuentra assets/ejemplos/ejemplos.js</p>'}</div>`);
  $$('[data-ej]').forEach(b => b.onclick = () => {
    if (UI.sucio && !confirm('Hay cambios sin guardar. ¿Abrir el ejemplo?')) return;
    const e = E[+b.dataset.ej]; cerrarModal();
    cargarProyecto(proyectoDePlantilla(e.plantilla, e), true);
    aviso('Ejemplo: ' + esc(e.nombre));
  });
}
