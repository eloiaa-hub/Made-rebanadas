
/* ===================== TIEMPO DE MECANIZADO Y PRESUPUESTO =====================
   Estimación: largo de corte de cada pieza (contorno, interiores y agujeros) × pasadas / avance,
   más las entradas de la fresa, el taladrado de los agujeros pequeños y el tiempo de poner y quitar cada tablero.
   El coste suma los tableros, las horas de máquina, los herrajes y el acabado. Los precios son orientativos
   y se cambian en la ventana (se guardan con el proyecto). */
const PRECIO_TABLERO = { abedul: 75, chopo: 40, pino_ply: 45, roble: 120, nogal: 140, pino: 45, mdf: 30, lacado: 60 };
function presupuestoP() { return P.presupuesto = Object.assign(proyectoBase().presupuesto, P.presupuesto || {}); }
const perimetro = pol => pol.reduce((s, p, i) => { const q = pol[(i + 1) % pol.length]; return s + Math.hypot(q[0] - p[0], q[1] - p[1]); }, 0);
function calcularPresupuesto() {
  const B = presupuestoP(), k = escalaFab(), fr = fresaFab(), maq = enMaqueta();
  let largo = 0, contornos = 0, taladros = 0, largoTal = 0;
  const piezas = piezasFab().map(c => {
    const g = geoFab(c), e = grosorDe(c), pas = Math.max(1, Math.ceil(e / Math.max(0.5, B.pasada)));
    let L = perimetro(g.poly) + g.interiores.reduce((s, h) => s + perimetro(h), 0), nC = 1 + g.interiores.length, nT = 0;
    g.agujeros.forEach(a => { if (2 * a[2] > fr * 1.05) { L += 2 * Math.PI * Math.max(0, a[2] - fr / 2); nC++; } else nT++; });   // los agujeros pequeños se taladran
    largo += L * pas; contornos += nC * pas; taladros += nT; largoTal += nT * e;
    return { nombre: c.nombre, L, pas, nC, nT };
  });
  const col = colocarEnTableros(fabActual()), nTab = col.tableros.length;
  const minCorte = largo / Math.max(1, B.avance), minEntradas = contornos * (B.entrada / 60) + largoTal / Math.max(1, B.bajada) + taladros * 0.05;
  const minTableros = nTab * B.minTablero, minTotal = (minCorte + minEntradas) * (1 + B.extra / 100) + minTableros;
  // material
  const cm = calcularCompraFab(), V = P.varillas, filas = [];
  const precioTab = maq ? B.precioMaqueta : (B.precios[P.costillas.material] != null ? B.precios[P.costillas.material] : PRECIO_TABLERO[P.costillas.material] || 50);
  filas.push([maq ? `Tableros de maqueta` : `Tableros de ${MATERIALES[P.costillas.material].nombre.toLowerCase()}`, nTab, precioTab]);
  const h = minTotal / 60; filas.push(['Horas de CNC' + (maq ? ' o láser' : ''), Math.round(h * 100) / 100, B.hora]);
  if (P.tipo === 'costillas' && !maq) {
    const mV = cm.varillas.reduce((s, v) => s + v.largo, 0) / 1000;
    if (mV) filas.push([`${VARILLA_TIPOS[V.tipo].nombre} (m)`, Math.round(mV * 100) / 100, B.varilla]);
    if (cm.nSep) filas.push(['Separadores (m)', Math.round(cm.seps.reduce((a, b) => a + b, 0) / 10) / 100, B.separador]);
    if (cm.nTuercas) filas.push([V.tipo === 'tubo' ? 'Tapas roscadas' : 'Tuercas y arandelas', cm.nTuercas, B.tuerca]);
  }
  if (P.tipo === 'radial' && cm.tubo) filas.push(['Tubo central (m)', Math.round(cm.tubo / 10) / 100, B.varilla]);
  if (P.tipo === 'pared' && R.rastreles.length) filas.push(['Rastrel (m)', Math.round(trozosRastreles(k).reduce((a, b) => a + b, 0) / 10) / 100, B.rastrel]);
  if (esPlano()) {
    const nF = R.uniones.reduce((s, u) => s + (u.puntos || []).length, 0);
    if (nF) filas.push([solapeP().tipo === 'tornillos' ? 'Tornillos' : 'Tacos de madera', nF, solapeP().tipo === 'tornillos' ? B.tornillo : B.taco]);
    const nh = herrajesTotales();
    if (nh.barril) filas.push(['Pernos con tuerca de barril', nh.barril, B.barril]);
    if (nh.excentrica) filas.push(['Excéntricas con perno', nh.excentrica, B.excentrica]);
  }
  if (!maq && B.cola) filas.push(['Cola, lija y varios', 1, B.cola]);
  const m2 = cm.area / 1e6 * 2 * 1.1;   // las dos caras y un poco de canto
  if (!maq && B.acabado) filas.push(['Acabado (m², dos caras)', Math.round(m2 * 100) / 100, B.acabado]);
  filas.forEach(f => f.push(f[1] * f[2]));
  const subtotal = filas.reduce((s, f) => s + f[3], 0), margen = subtotal * B.margen / 100;
  return { piezas, largo, contornos, taladros, nTab, minCorte, minEntradas, minTableros, minTotal, filas, subtotal, margen, total: subtotal + margen, B };
}
const fmtMin = m => m < 60 ? `${fmt(m, 0)} min` : `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')} min`;
const fmtEur = v => fmt(v, 2) + ' €';
function filasPresupuesto(r) {   // para la tabla del plano
  return [
    { titulo: 'Tiempo de mecanizado (estimado)' },
    ['Largo de corte (con todas las pasadas)', `${fmt(r.largo / 1000, 1)} m a ${fmt(r.B.avance)} mm/min · ${fmtMin(r.minCorte)}`],
    ['Entradas de fresa y taladros', `${r.contornos} entradas y ${r.taladros} taladros · ${fmtMin(r.minEntradas)}`],
    ['Poner y quitar tableros', `${r.nTab} × ${fmt(r.B.minTablero, 0)} min · ${fmtMin(r.minTableros)}`],
    ['Total (con un ' + fmt(r.B.extra, 0) + ' % de imprevistos)', fmtMin(r.minTotal)],
    { titulo: 'Presupuesto (orientativo)' },
    ...r.filas.map(f => [f[0], `${fmt(f[1], f[1] % 1 ? 2 : 0)} × ${fmtEur(f[2])} = ${fmtEur(f[3])}`]),
    ['Subtotal', fmtEur(r.subtotal)],
    ...(r.margen ? [[`Margen (${fmt(r.B.margen, 0)} %)`, fmtEur(r.margen)]] : []),
    ['TOTAL', fmtEur(r.total)],
  ];
}
const guardado = () => { UI.sucio = true; guardarHistoria(); };
function dialogoPresupuesto() {
  const B = presupuestoP(), maq = enMaqueta(), mat = P.costillas.material;
  const n = (id, txt, v, paso, tit) => `<label class="fila"${tit ? ` title="${tit}"` : ''}>${txt} <input type="number" id="${id}" value="${v}" min="0" step="${paso}"></label>`;
  modal('⏱ Tiempo de mecanizado y presupuesto', `
    <div class="fab">
      <div class="opc">
        <p class="nota">Una estimación para preparar el trabajo o un presupuesto. Cambia los datos a los de tu máquina y tus precios: se guardan con el proyecto.</p>
        <h4>Máquina</h4>
        ${n('psAv', 'Avance de corte (mm/min)', B.avance, 100, 'Velocidad de la fresa recorriendo el contorno')}
        ${n('psPas', 'Profundidad de cada pasada (mm)', B.pasada, 0.5, 'Con una fresa de 6 mm, entre 3 y 6 mm por pasada en contrachapado')}
        ${n('psBaj', 'Velocidad de bajada (mm/min)', B.bajada, 50, 'Para los taladros')}
        ${n('psEnt', 'Tiempo por entrada de fresa (s)', B.entrada, 0.5, 'Subir, moverse en vacío y bajar en cada contorno y pasada')}
        ${n('psTab', 'Poner y quitar cada tablero (min)', B.minTablero, 1, 'Sujetar, poner el cero, sacar las piezas y limpiar')}
        ${n('psExtra', 'Imprevistos sobre el corte (%)', B.extra, 5, 'Aceleraciones, curvas y esperas que el cálculo no ve')}
        <h4>Precios (€)</h4>
        ${n('psPTab', maq ? 'Tablero de maqueta' : `Tablero (${MATERIALES[mat].nombre.toLowerCase()})`, maq ? B.precioMaqueta : (B.precios[mat] != null ? B.precios[mat] : PRECIO_TABLERO[mat]), 1)}
        ${n('psHora', 'Hora de máquina', B.hora, 1, 'Máquina y operario')}
        ${P.tipo === 'costillas' ? n('psVar', 'Varilla o tubo (€/m)', B.varilla, 0.5) + n('psSep', 'Separador (€/m)', B.separador, 0.5) + n('psTue', 'Tuerca y arandela (cada)', B.tuerca, 0.05) : ''}
        ${P.tipo === 'radial' ? n('psVar', 'Tubo central (€/m)', B.varilla, 0.5) : ''}
        ${P.tipo === 'pared' ? n('psRas', 'Rastrel (€/m)', B.rastrel, 0.5) : ''}
        ${esPlano() ? n('psTac', 'Taco de madera (cada)', B.taco, 0.01) + n('psTor', 'Tornillo (cada)', B.tornillo, 0.01) + n('psBar', 'Perno y tuerca de barril (juego)', B.barril, 0.05) + n('psExc', 'Excéntrica con perno (juego)', B.excentrica, 0.05) : ''}
        ${n('psCola', 'Cola, lija y varios (total)', B.cola, 1)}
        ${n('psAcab', 'Acabado (€/m²)', B.acabado, 1, 'Aceite, barniz o laca, por m² de superficie')}
        ${n('psMarg', 'Margen (%)', B.margen, 5)}
      </div>
      <div><div id="psRes" style="font-size:13px"></div></div>
    </div>`, [['Precios por defecto', () => { P.presupuesto = proyectoBase().presupuesto; guardado(); dialogoPresupuesto(); }], ['⬇ CSV', () => exportarCSVPresupuesto()]], true);
  const mapa = { psAv: 'avance', psPas: 'pasada', psBaj: 'bajada', psEnt: 'entrada', psTab: 'minTablero', psExtra: 'extra', psHora: 'hora', psVar: 'varilla', psSep: 'separador', psTue: 'tuerca', psRas: 'rastrel', psTac: 'taco', psTor: 'tornillo', psBar: 'barril', psExc: 'excentrica', psCola: 'cola', psAcab: 'acabado', psMarg: 'margen' };
  const pintar = () => {
    const r = calcularPresupuesto(), filas = filasPresupuesto(r);
    $('#psRes').innerHTML = '<table class="tabla">' + filas.map(f => f.titulo ? `<tr><th colspan="2">${esc(f.titulo)}</th></tr>` : `<tr><td>${esc(f[0])}</td><td style="text-align:right"><b>${esc(f[1])}</b></td></tr>`).join('') + '</table>'
      + `<p class="nota">Piezas: ${r.piezas.length}. Tablero de ${fmt(fabActual().ancho)} × ${fmt(fabActual().alto)} mm (se cambia en 🛠 Fabricar). Es una estimación: el tiempo real depende de las aceleraciones de la máquina y del orden de corte.</p>`;
  };
  Object.entries(mapa).forEach(([id, key]) => { const el = $('#' + id); if (el) el.onchange = () => { B[key] = Math.max(0, +el.value || 0); guardado(); pintar(); }; });
  $('#psPTab').onchange = () => { const v = Math.max(0, +$('#psPTab').value || 0); if (maq) B.precioMaqueta = v; else B.precios = Object.assign({}, B.precios, { [mat]: v }); guardado(); pintar(); };
  pintar();
}
function exportarCSVPresupuesto() {
  const r = calcularPresupuesto(), q = s => `"${String(s).replace(/"/g, '""')}"`;
  const lin = [['Concepto', 'Cantidad', 'Precio', 'Importe'].join(';'), ...r.filas.map(f => [q(f[0]), fmt(f[1], 2), fmt(f[2], 2), fmt(f[3], 2)].join(';')),
    ['Subtotal', '', '', fmt(r.subtotal, 2)].join(';'), [q(`Margen ${fmt(r.B.margen, 0)} %`), '', '', fmt(r.margen, 2)].join(';'), ['TOTAL', '', '', fmt(r.total, 2)].join(';'), '',
    ['Pieza', 'Largo de corte (mm)', 'Pasadas', 'Contornos', 'Taladros'].join(';'), ...r.piezas.map(p => [q(p.nombre), fmt(p.L, 0), p.pas, p.nC, p.nT].join(';')), '',
    [q('Tiempo total estimado'), q(fmtMin(r.minTotal))].join(';')];
  descargar(nombreArchivo(P.nombre) + '_presupuesto' + sufijoFab() + '.csv', '﻿' + lin.join('\r\n') + '\r\n', 'text/csv');
  aviso('CSV del presupuesto guardado');
}
