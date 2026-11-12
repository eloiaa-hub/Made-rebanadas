
/* ===================== FABRICACIÓN: TABLEROS, DXF, SVG, DESPIECE ===================== */
const TABLEROS = [
  { n: '2440 × 1220 (estándar)', a: 2440, h: 1220 },
  { n: '2500 × 1250', a: 2500, h: 1250 },
  { n: '2500 × 1220', a: 2500, h: 1220 },
  { n: '1525 × 1525 (abedul báltico)', a: 1525, h: 1525 },
  { n: '2850 × 2070 (aglomerado / MDF)', a: 2850, h: 2070 },
  { n: '1220 × 610 (medio tablero)', a: 1220, h: 610 },
];
const TABLEROS_MAQ = [
  { n: '600 × 400 (láser)', a: 600, h: 400 },
  { n: '900 × 600 (láser)', a: 900, h: 600 },
  { n: '1000 × 600', a: 1000, h: 600 },
  { n: '420 × 297 (A3)', a: 420, h: 297 },
  { n: '1220 × 610 (medio tablero)', a: 1220, h: 610 },
];

/* ---------- maqueta: medidas de fabricación ---------- */
const enMaqueta = () => !!(P.maqueta && P.maqueta.activa);
const escalaFab = () => enMaqueta() ? 1 / P.maqueta.escala : 1;
const radioFab = () => enMaqueta() ? (P.maqueta.diam + P.maqueta.holgura) / 2 : radioAgujero();
const grosorFab = () => enMaqueta() ? P.maqueta.grosor : grosor();
const diamVarFab = () => enMaqueta() ? P.maqueta.diam : P.varillas.diam;
const textoEscala = () => enMaqueta() ? 'maqueta 1:' + P.maqueta.escala : 'tamaño real';
// medidas de una costilla tal y como se fabrica (a escala si es maqueta)
// todas las piezas que se cortan: costillas y, en la retícula, largueros
const piezasFab = () => [...R.costillas, ...(R.largueros || [])].filter(c => c.ok);
const holguraRanuraFab = () => enMaqueta() ? P.maqueta.holgura : P.reticula.holgura;
function geoFab(c) {
  const k = escalaFab();
  // las ranuras se rehacen con el grosor de fabricación (el de la maqueta, si lo es)
  const base = c.ranuras && c.ranuras.length ? ranurar(c.base, c.ranuras, (grosorFab() + holguraRanuraFab()) / k).poly : c.poly;
  const poly = base.map(p => [p[0] * k, p[1] * k]);
  return {
    c, poly, caja: cajaDe(poly), r: radioFab(), area: Math.abs(c.area) * k * k,
    agujeros: c.agujeros.map(j => [P.varillas.lista[j][0] * k, P.varillas.lista[j][1] * k]),
    etiqueta: puntoEtiqueta(c).map(v => v * k),
  };
}
function fabDefecto(maq) {
  return maq ? { ancho: 600, alto: 400, borde: 5, sep: 4, girar: true, modo: 'tableros', numeros: true }
             : { ancho: 2440, alto: 1220, borde: 10, sep: 12, girar: true, modo: 'tableros', numeros: true };
}
function fabActual() {
  const k = enMaqueta() ? 'fabMaq' : 'fab';
  return UI[k] || (UI[k] = fabDefecto(enMaqueta()));
}

// colocación por estantes (piezas por su rectángulo envolvente)
function colocarEnTableros(f) {
  const piezas = piezasFab().map(c => {
    const g = geoFab(c);
    let w = g.caja.w, h = g.caja.h, rot = false;
    if (f.girar && h > w) { rot = true; [w, h] = [h, w]; }
    const W = f.ancho - 2 * f.borde, H = f.alto - 2 * f.borde;
    if (f.girar && (w > W || h > H) && h <= W && w <= H) { rot = !rot; [w, h] = [h, w]; }
    return { c, g, w, h, rot, cabe: w <= W + 1e-6 && h <= H + 1e-6 };
  });
  const grandes = piezas.filter(p => !p.cabe);
  const lista = piezas.filter(p => p.cabe).sort((a, b) => b.h - a.h || b.w - a.w);
  const tableros = [];
  if (f.modo === 'fila') {
    let x = 0; const t = { piezas: [], ancho: 0, alto: 0 };
    piezas.sort((a, b) => a.c.i - b.c.i).forEach(p => { t.piezas.push({ ...p, x, y: 0 }); x += p.w + f.sep; t.alto = Math.max(t.alto, p.h); });
    t.ancho = Math.max(0, x - f.sep); tableros.push(t);
    return { tableros, grandes: [], uso: 0 };
  }
  for (const p of lista) {
    let puesto = false;
    for (const t of tableros) {
      for (const e of t.estantes) if (p.h <= e.h + 1e-6 && e.x + p.w <= f.ancho - f.borde + 1e-6) { t.piezas.push({ ...p, x: e.x, y: e.y }); e.x += p.w + f.sep; puesto = true; break; }
      if (puesto) break;
      const yN = t.yLibre;
      if (yN + p.h <= f.alto - f.borde + 1e-6) {
        const e = { y: yN, h: p.h, x: f.borde }; t.estantes.push(e); t.yLibre = yN + p.h + f.sep;
        t.piezas.push({ ...p, x: e.x, y: e.y }); e.x += p.w + f.sep; puesto = true; break;
      }
    }
    if (!puesto) {
      const t = { piezas: [], estantes: [], yLibre: f.borde, ancho: f.ancho, alto: f.alto };
      const e = { y: f.borde, h: p.h, x: f.borde }; t.estantes.push(e); t.yLibre = f.borde + p.h + f.sep;
      t.piezas.push({ ...p, x: e.x, y: e.y }); e.x += p.w + f.sep; tableros.push(t);
    }
  }
  const areaP = piezas.reduce((s, p) => s + p.g.area, 0);
  return { tableros, grandes, uso: tableros.length ? areaP / (tableros.length * f.ancho * f.alto) : 0 };
}
// pasa un punto de la costilla (ya a escala de fabricación) a coordenadas del tablero
function aTablero(pz, p) {
  const b = pz.g.caja; let x = p[0] - b.x0, y = p[1] - b.y0;
  if (pz.rot) [x, y] = [b.h - y, x];
  return [pz.x + x, pz.y + y];
}
const altoTexto = g => clamp(Math.min(g.caja.w, g.caja.h) * 0.08, 2.5, 12);

function abrirFabricar() {
  if (!R) return;
  const f = fabActual(), lista = enMaqueta() ? TABLEROS_MAQ : TABLEROS;
  const ops = lista.map(t => `<option value="${t.a}x${t.h}" ${t.a === f.ancho && t.h === f.alto ? 'selected' : ''}>${t.n}</option>`).join('');
  const maq = enMaqueta() ? `<div class="aviso-maq">Maqueta <b>1:${P.maqueta.escala}</b>: costillas a escala, tablero de ${fmt(P.maqueta.grosor, 1)} mm y agujeros de Ø ${fmt(P.maqueta.diam + P.maqueta.holgura, 2)} mm. Para el mueble real, quita «Fabricar como maqueta» en el panel izquierdo.</div>` : '';
  modal('🪚 Fabricar: costillas en tableros' + (enMaqueta() ? ' · maqueta 1:' + P.maqueta.escala : ''), `${maq}
    <div class="fab">
      <div class="opc">
        <label class="fila">Colocación <select id="fModo"><option value="tableros">En tableros</option><option value="fila">En fila (sin tablero)</option></select></label>
        <label class="fila">Tablero <select id="fTab">${ops}<option value="otro">Otro…</option></select></label>
        <label class="fila">Ancho (mm) <input type="number" id="fA" value="${f.ancho}" min="50" step="1"></label>
        <label class="fila">Alto (mm) <input type="number" id="fH" value="${f.alto}" min="50" step="1"></label>
        <label class="fila" title="Margen sin piezas en todo el borde del tablero">Margen al borde (mm) <input type="number" id="fB" value="${f.borde}" min="0" step="1"></label>
        <label class="fila" title="Espacio entre piezas: al menos el diámetro de la fresa más unos milímetros (en láser, 2 a 4 mm)">Separación entre piezas (mm) <input type="number" id="fS" value="${f.sep}" min="0" step="1"></label>
        <label class="fila chk"><input type="checkbox" id="fG" ${f.girar ? 'checked' : ''}> Permitir girar 90° (cuida la veta)</label>
        <label class="fila chk"><input type="checkbox" id="fN" ${f.numeros ? 'checked' : ''}> Grabar el número (o la letra) en cada pieza</label>
        <div class="info" id="fInfo"></div>
        <p class="nota" style="margin-top:10px">El DXF lleva las capas <b>CORTE</b> (contornos, con las ranuras), <b>TALADROS</b> (agujeros de las varillas), <b>GRABADO</b> (números) y <b>TABLERO</b> (borde del tablero).</p>
        <p class="nota">Esta colocación usa el rectángulo de cada costilla. Para encajarlas por su forma real, usa <b>🧩 Anidador</b>.</p>
      </div>
      <div><canvas id="fPrev" width="900" height="520"></canvas></div>
    </div>`,
    [['🧩 Anidador', () => { cerrarModal(); abrirAnidador(); }], ['⬇ CSV de cortes', () => exportarCSVCortes()], ['📄 SVG', () => exportarSVG()], ['📐 DXF', () => exportarDXF(), true]], true);
  const leer = () => {
    const t = $('#fTab').value;
    if (t !== 'otro') { const [a, h] = t.split('x').map(Number); $('#fA').value = a; $('#fH').value = h; }
    f.ancho = Math.max(50, +$('#fA').value); f.alto = Math.max(50, +$('#fH').value);
    f.borde = Math.max(0, +$('#fB').value); f.sep = Math.max(0, +$('#fS').value);
    f.girar = $('#fG').checked; f.numeros = $('#fN').checked; f.modo = $('#fModo').value;
    previsualizarFab();
  };
  $('#fModo').value = f.modo;
  if (!lista.some(t => t.a === f.ancho && t.h === f.alto)) $('#fTab').value = 'otro';
  ['#fTab', '#fB', '#fS', '#fG', '#fN', '#fModo'].forEach(s => $(s).onchange = leer);
  ['#fA', '#fH'].forEach(s => $(s).onchange = () => { $('#fTab').value = 'otro'; leer(); });
  previsualizarFab();
}
// dibuja los tableros con sus piezas en un lienzo (también para el plano)
function dibujarTableros(ctx, col, f, Wc, opciones = {}) {
  const n = col.tableros.length || 1;
  const tw = f.modo === 'fila' ? (col.tableros[0] ? col.tableros[0].ancho : 100) : f.ancho, th = f.modo === 'fila' ? (col.tableros[0] ? col.tableros[0].alto : 100) : f.alto;
  const porFila = f.modo === 'fila' ? 1 : (n > 1 ? 2 : 1), filas = Math.ceil(n / porFila), gap = 26;
  const sc = Math.min((Wc - (porFila + 1) * gap) / (porFila * tw), (opciones.altoMax || 330) / th);
  const Hc = filas * (th * sc + gap) + gap;
  if (opciones.soloAlto) return Hc;
  ctx.fillStyle = opciones.fondo || cssVar('--vista'); ctx.fillRect(0, 0, Wc, Hc);
  col.tableros.forEach((t, b) => {
    const ox = gap + (b % porFila) * (tw * sc + gap), oy = gap + Math.floor(b / porFila) * (th * sc + gap);
    const P2 = (x, y) => [ox + x * sc, oy + (th - y) * sc];
    if (f.modo !== 'fila') {
      ctx.fillStyle = '#efe2c9'; ctx.strokeStyle = '#a88b5c'; ctx.lineWidth = 1;
      ctx.fillRect(ox, oy, tw * sc, th * sc); ctx.strokeRect(ox + .5, oy + .5, tw * sc, th * sc);
      ctx.fillStyle = opciones.texto || cssVar('--suave'); ctx.font = '11px system-ui'; ctx.fillText(`Tablero ${b + 1}: ${t.piezas.length} piezas`, ox, oy - 6);
    }
    t.piezas.forEach(pz => {
      ctx.beginPath();
      pz.g.poly.forEach((p, i) => { const [x, y] = P2(...aTablero(pz, p)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.closePath(); ctx.fillStyle = 'rgba(168,116,63,.35)'; ctx.fill(); ctx.strokeStyle = '#7a5226'; ctx.stroke();
      pz.g.agujeros.forEach(q => { const [x, y] = P2(...aTablero(pz, q)); ctx.beginPath(); ctx.arc(x, y, Math.max(1.2, pz.g.r * sc), 0, PI2); ctx.strokeStyle = '#c0392b'; ctx.stroke(); });
      if (f.numeros) {
        const [x, y] = P2(...aTablero(pz, pz.g.etiqueta));
        ctx.fillStyle = '#1f4f8a'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(pz.c.etq, x, y);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      }
    });
  });
  return Hc;
}
function previsualizarFab() {
  const f = fabActual(), col = colocarEnTableros(f), cv = $('#fPrev'), ctx = cv.getContext('2d');
  const d = window.devicePixelRatio || 1, Wc = cv.clientWidth || 900;
  const Hc = dibujarTableros(null, col, f, Wc, { soloAlto: true });
  cv.width = Wc * d; cv.height = Hc * d; cv.style.height = Hc + 'px'; ctx.setTransform(d, 0, 0, d, 0, 0);
  dibujarTableros(ctx, col, f, Wc);
  const info = [];
  if (f.modo === 'fila') info.push(`${piezasFab().length} piezas en fila: ${fmt(col.tableros[0] ? col.tableros[0].ancho : 0)} × ${fmt(col.tableros[0] ? col.tableros[0].alto : 0)} mm.`);
  else {
    info.push(`<b>${col.tableros.length}</b> tablero${col.tableros.length === 1 ? '' : 's'} de ${fmt(f.ancho)} × ${fmt(f.alto)} mm · aprovechamiento <b>${fmt(col.uso * 100)} %</b>.`);
    if (col.grandes.length) info.push(`<span style="color:var(--peligro)">No caben en el tablero: ${col.grandes.map(p => p.c.nombre).join(', ')}.</span>`);
  }
  info.push(P.tipo === 'reticula' ? `Ranuras de ${fmt(grosorFab() + holguraRanuraFab(), 2)} mm · grosor del tablero ${fmt(grosorFab(), 1)} mm.` : `Agujeros: Ø ${fmt(2 * radioFab(), 2)} mm · grosor del tablero ${fmt(grosorFab(), 1)} mm.`);
  $('#fInfo').innerHTML = info.join('<br>');
}

// ---------- DXF (R12, el formato que abre cualquier programa) ----------
function dxf() {
  const f = fabActual(), col = colocarEnTableros(f), out = [];
  const g = (c, v) => out.push(String(c), String(v));
  const n = v => (Math.round(v * 1000) / 1000).toString();
  g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 4); g(9, '$MEASUREMENT'); g(70, 1); g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'TABLES'); g(0, 'TABLE'); g(2, 'LAYER'); g(70, 4);
  [['CORTE', 7], ['TALADROS', 1], ['GRABADO', 5], ['TABLERO', 8]].forEach(([nom, c]) => { g(0, 'LAYER'); g(2, nom); g(70, 0); g(62, c); g(6, 'CONTINUOUS'); });
  g(0, 'ENDTAB'); g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'ENTITIES');
  const poli = (capa, pts) => {
    g(0, 'POLYLINE'); g(8, capa); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, 1);
    pts.forEach(p => { g(0, 'VERTEX'); g(8, capa); g(10, n(p[0])); g(20, n(p[1])); g(30, 0); });
    g(0, 'SEQEND'); g(8, capa);
  };
  col.tableros.forEach((t, b) => {
    const ox = b * ((f.modo === 'fila' ? t.ancho : f.ancho) + 200);
    if (f.modo !== 'fila') poli('TABLERO', [[ox, 0], [ox + f.ancho, 0], [ox + f.ancho, f.alto], [ox, f.alto]]);
    t.piezas.forEach(pz => {
      poli('CORTE', simplificaCerrado(pz.g.poly, 0.05).map(p => { const q = aTablero(pz, p); return [ox + q[0], q[1]]; }));
      pz.g.agujeros.forEach(a => { const q = aTablero(pz, a); g(0, 'CIRCLE'); g(8, 'TALADROS'); g(10, n(ox + q[0])); g(20, n(q[1])); g(30, 0); g(40, n(pz.g.r)); });
      if (f.numeros) {
        const q = aTablero(pz, pz.g.etiqueta), h = altoTexto(pz.g);
        g(0, 'TEXT'); g(8, 'GRABADO'); g(10, n(ox + q[0])); g(20, n(q[1])); g(30, 0); g(40, n(h)); g(1, pz.c.etq); g(72, 1); g(11, n(ox + q[0])); g(21, n(q[1] - h / 2)); g(31, 0);
      }
    });
  });
  g(0, 'ENDSEC'); g(0, 'EOF');
  return out.join('\r\n') + '\r\n';
}
const sufijoFab = () => enMaqueta() ? '_maqueta_1-' + P.maqueta.escala : '';
function exportarDXF() { descargar(nombreArchivo(P.nombre) + '_costillas' + sufijoFab() + '.dxf', dxf(), 'application/dxf'); aviso('DXF guardado'); }

function svg() {
  const f = fabActual(), col = colocarEnTableros(f);
  let W = 0, H = 0; const partes = [];
  col.tableros.forEach(t => {
    const tw = f.modo === 'fila' ? t.ancho : f.ancho, th = f.modo === 'fila' ? t.alto : f.alto, ox = W;
    H = Math.max(H, th);
    const Y = y => th - y, n = v => Math.round(v * 100) / 100;
    if (f.modo !== 'fila') partes.push(`<rect x="${ox}" y="0" width="${tw}" height="${th}" fill="none" stroke="#999" stroke-width="0.5"/>`);
    t.piezas.forEach(pz => {
      const d = simplificaCerrado(pz.g.poly, 0.05).map((p, i) => { const q = aTablero(pz, p); return (i ? 'L' : 'M') + n(ox + q[0]) + ' ' + n(Y(q[1])); }).join(' ') + ' Z';
      partes.push(`<path d="${d}" fill="none" stroke="#000" stroke-width="0.2"/>`);
      pz.g.agujeros.forEach(a => { const q = aTablero(pz, a); partes.push(`<circle cx="${n(ox + q[0])}" cy="${n(Y(q[1]))}" r="${n(pz.g.r)}" fill="none" stroke="#d00" stroke-width="0.2"/>`); });
      if (f.numeros) { const q = aTablero(pz, pz.g.etiqueta); partes.push(`<text x="${n(ox + q[0])}" y="${n(Y(q[1]))}" font-family="Arial" font-size="${n(altoTexto(pz.g))}" text-anchor="middle" dominant-baseline="middle" fill="#00f">${pz.c.etq}</text>`); }
    });
    W += tw + 200;
  });
  W = Math.max(1, W - 200);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">\n<!-- ${esc(P.nombre)} — Made-rebanadas (${textoEscala()}) -->\n${partes.join('\n')}\n</svg>\n`;
}
function exportarSVG() { descargar(nombreArchivo(P.nombre) + '_costillas' + sufijoFab() + '.svg', svg(), 'image/svg+xml'); aviso('SVG guardado'); }

// ---------- despiece y lista de compra ----------
function calcularCompraFab() { // como calcularCompra, pero con las medidas de fabricación (maqueta o real)
  const V = P.varillas, k = escalaFab(), f = fabActual(), col = colocarEnTableros(f);
  const usadas = P.tipo === 'reticula' ? [] : R.varillas.filter(v => v.usada);
  const sepF = R.sep * k, hueco = sepF - grosorFab(), sobra = enMaqueta() ? Math.max(2, V.sobra * k) : V.sobra;
  let nSep = 0;
  if (V.separadores && hueco > 0.5 && P.tipo !== 'reticula') usadas.forEach(v => { for (let i = v.a; i < v.b; i++) if (v.cabe[i] && v.cabe[i + 1]) nSep++; });
  return {
    area: piezasFab().reduce((s, c) => s + Math.abs(c.area) * k * k, 0), nSep, hueco, sep: sepF,
    varillas: usadas.map(v => ({ k: v.k, largo: (v.b - v.a) * sepF + grosorFab() + 2 * sobra })),
    nTuercas: V.tipo === 'madera' || enMaqueta() ? 0 : usadas.length * 2,
    tablero: [f.ancho, f.alto], nTableros: col.tableros.length, colocacion: col,
  };
}
function filasDespiece() {
  const mat = enMaqueta() ? `Maqueta ${fmt(P.maqueta.grosor, 1)} mm` : MATERIALES[P.costillas.material].nombre;
  return piezasFab().map(c => { const g = geoFab(c); return { n: c.etq, nombre: c.nombre, x: (c.z ? c.u : c.x) * escalaFab(), eje: c.z ? 'z' : 'x', ranuras: c.ranuras.length, w: g.caja.w, h: g.caja.h, e: grosorFab(), area: g.area, ag: c.agujeros.length, dA: fmt(2 * g.r, 2), mat }; });
}
function listaCompra() {
  const cm = calcularCompraFab(), V = P.varillas, tv = VARILLA_TIPOS[V.tipo], L = [];
  if (P.tipo === 'reticula') {
    const nX = R.costillas.filter(c => c.ok).length, nZ = (R.largueros || []).filter(z => z.ok).length;
    L.push([enMaqueta() ? `Tablero de maqueta de ${fmt(P.maqueta.grosor, 1)} mm` : `${MATERIALES[P.costillas.material].nombre}, ${fmt(grosor(), 1)} mm`, `${cm.nTableros} tablero${cm.nTableros === 1 ? '' : 's'} de ${fmt(cm.tablero[0])} × ${fmt(cm.tablero[1])} mm (${enMaqueta() ? fmt(cm.area / 100, 0) + ' cm²' : fmt(cm.area / 1e6, 2) + ' m²'} de piezas)`]);
    L.push(['Piezas', `${nX} costillas y ${nZ} largueros, con ${R.cruces.length} cruces`]);
    L.push(['Ranuras a media madera', `${fmt(grosorFab() + holguraRanuraFab(), 2)} mm de ancho`]);
    L.push(['Herrajes', 'ninguno (cola en los cruces, si se quiere fijo)']);
    return L;
  }
  if (enMaqueta()) {
    L.push([`Tablero de maqueta (DM, contrachapado…) de ${fmt(P.maqueta.grosor, 1)} mm`, `${cm.nTableros} de ${fmt(cm.tablero[0])} × ${fmt(cm.tablero[1])} mm (${fmt(cm.area / 100, 0)} cm² de piezas)`]);
    cm.varillas.forEach(v => L.push([`Varilla de Ø ${fmt(P.maqueta.diam, 1)} mm (bambú, madera o alambre) — varilla ${v.k + 1}`, fmt(v.largo) + ' mm']));
    if (cm.nSep) L.push([`Separadores de ${fmt(cm.hueco, 1)} mm (tubito, pajita o arandela de cartón)`, `${cm.nSep} piezas`]);
    L.push(['Agujeros', `Ø ${fmt(P.maqueta.diam + P.maqueta.holgura, 2)} mm`]);
    return L;
  }
  L.push([`${MATERIALES[P.costillas.material].nombre}, ${fmt(grosor(), 1)} mm`, `${cm.nTableros} tablero${cm.nTableros === 1 ? '' : 's'} de ${fmt(cm.tablero[0])} × ${fmt(cm.tablero[1])} mm (${fmt(cm.area / 1e6, 2)} m² de piezas)`]);
  cm.varillas.forEach(v => L.push([`${tv.nombre} ${V.tipo === 'roscada' ? 'M' : 'Ø '}${V.diam} — varilla ${v.k + 1}`, fmt(v.largo) + ' mm']));
  if (cm.nSep) L.push([`${tv.sep} Ø ${V.sepD} mm (agujero interior > ${V.diam} mm)`, `${cm.nSep} piezas de ${fmt(cm.hueco, 1)} mm (${fmt(cm.nSep * cm.hueco)} mm en total)`]);
  if (cm.nTuercas) L.push([`Tuercas M${V.diam} (mejor ciegas) y arandelas`, `${cm.nTuercas} + ${cm.nTuercas}`]);
  L.push(['Broca para los agujeros', `Ø ${fmt(V.diam + V.holgura, 1)} mm`]);
  return L;
}
function abrirDespiece() {
  if (!R) return;
  const F = filasDespiece(), L = listaCompra();
  modal('📋 Despiece y lista de compra' + (enMaqueta() ? ' · maqueta 1:' + P.maqueta.escala : ''), `
    <h4>Costillas</h4>
    <div style="max-height:46vh;overflow:auto"><table class="tabla"><tr><th class="n">Pieza</th><th class="n">Posición</th><th class="n">Ancho</th><th class="n">Alto</th><th class="n">Grosor</th><th class="n">Superficie</th><th class="n">Agujeros / ranuras</th></tr>
    ${F.map(f => `<tr><td class="n">${esc(f.nombre)}</td><td class="n">${f.eje} = ${fmt(f.x)} mm</td><td class="n">${fmt(f.w, enMaqueta() ? 1 : 0)}</td><td class="n">${fmt(f.h, enMaqueta() ? 1 : 0)}</td><td class="n">${fmt(f.e, 1)}</td><td class="n">${fmt(f.area / 100)} cm²</td><td class="n">${f.ranuras ? f.ranuras + ' ranuras' : f.ag + ' × Ø' + f.dA}</td></tr>`).join('')}
    </table></div>
    <h4>Lista de compra</h4>
    <table class="tabla">${L.map(l => `<tr><td>${esc(l[0])}</td><td class="n">${esc(l[1])}</td></tr>`).join('')}</table>`,
    [['⬇ CSV de cortes', () => exportarCSVCortes()], ['⬇ Despiece (CSV)', () => exportarCSV(), true]], true);
}
const csvQ = v => '"' + String(v).replace(/"/g, '""') + '"';
const csvN = (v, d = 1) => fmt(v, d).replace(/\./g, '');
function exportarCSV() {
  const filas = [['Pieza', 'Eje', 'Posición (mm)', 'Ancho (mm)', 'Alto (mm)', 'Grosor (mm)', 'Superficie (cm²)', 'Agujeros', 'Ø agujero (mm)', 'Ranuras', 'Material'].map(csvQ).join(';')];
  filasDespiece().forEach(f => filas.push([csvQ(f.nombre), f.eje, csvN(f.x), csvN(f.w), csvN(f.h), csvN(f.e), csvN(f.area / 100, 0), f.ag, f.dA, f.ranuras, csvQ(f.mat)].join(';')));
  filas.push('', csvQ('Lista de compra (' + textoEscala() + ')'));
  listaCompra().forEach(l => filas.push(csvQ(l[0]) + ';' + csvQ(l[1])));
  descargar(nombreArchivo(P.nombre) + '_despiece' + sufijoFab() + '.csv', '﻿' + filas.join('\r\n'), 'text/csv');
}
// lista de cortes con el formato de despiece del Anidador (nombre; largo; ancho; cantidad; veta…):
// cada costilla con su rectángulo envolvente, para abrirla en el Anidador o en una hoja de cálculo
function exportarCSVCortes() {
  const filas = ['nombre;largo;ancho;cantidad;veta;canto largo;canto ancho;tipo de canto'];
  piezasFab().forEach(c => { const g = geoFab(c); filas.push([c.nombre, csvN(g.caja.w, 1), csvN(g.caja.h, 1), 1, 'no', 0, 0, ''].join(';')); });
  descargar(nombreArchivo(P.nombre) + '_cortes' + sufijoFab() + '.csv', '﻿' + filas.join('\r\n') + '\r\n', 'text/csv');
  aviso('CSV de cortes guardado');
}
