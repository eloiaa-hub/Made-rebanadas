
/* ===================== FABRICACIÓN: TABLEROS, DXF, SVG, DESPIECE ===================== */
const TABLEROS = [
  { n: '2440 × 1220 (estándar)', a: 2440, h: 1220 },
  { n: '2500 × 1250', a: 2500, h: 1250 },
  { n: '2500 × 1220', a: 2500, h: 1220 },
  { n: '1525 × 1525 (abedul báltico)', a: 1525, h: 1525 },
  { n: '2850 × 2070 (aglomerado / MDF)', a: 2850, h: 2070 },
  { n: '1220 × 610 (medio tablero)', a: 1220, h: 610 },
];
function fabDefecto() { return { ancho: 2440, alto: 1220, borde: 10, sep: 12, girar: true, modo: 'tableros', numeros: true }; }

// colocación por estantes (piezas por su rectángulo envolvente)
function colocarEnTableros(f) {
  const piezas = R.costillas.filter(c => c.ok).map(c => {
    let w = c.caja.w, h = c.caja.h, rot = false;
    if (f.girar && h > w) { rot = true; [w, h] = [h, w]; }
    const W = f.ancho - 2 * f.borde, H = f.alto - 2 * f.borde;
    if (f.girar && (w > W || h > H) && h <= W && w <= H) { rot = !rot; [w, h] = [h, w]; }
    return { c, w, h, rot, cabe: w <= W + 1e-6 && h <= H + 1e-6 };
  });
  const grandes = piezas.filter(p => !p.cabe);
  const lista = piezas.filter(p => p.cabe).sort((a, b) => b.h - a.h || b.w - a.w);
  const tableros = [];
  if (f.modo === 'fila') {
    // todas en una fila, sin tablero
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
  const areaP = R.costillas.reduce((s, c) => s + (c.ok ? c.area : 0), 0);
  return { tableros, grandes, uso: tableros.length ? areaP / (tableros.length * f.ancho * f.alto) : 0 };
}
// pasa un punto de la costilla (u, v) a coordenadas del tablero
function aTablero(pz, p) {
  const b = pz.c.caja; let x = p[0] - b.x0, y = p[1] - b.y0;
  if (pz.rot) [x, y] = [b.h - y, x];
  return [pz.x + x, pz.y + y];
}

function abrirFabricar() {
  if (!R) return;
  UI.fab = UI.fab || fabDefecto();
  const f = UI.fab;
  const ops = TABLEROS.map(t => `<option value="${t.a}x${t.h}" ${t.a === f.ancho && t.h === f.alto ? 'selected' : ''}>${t.n}</option>`).join('');
  modal('🪚 Fabricar: costillas en tableros', `
    <div class="fab">
      <div class="opc">
        <label class="fila">Colocación <select id="fModo"><option value="tableros">En tableros</option><option value="fila">En fila (sin tablero)</option></select></label>
        <label class="fila">Tablero <select id="fTab">${ops}<option value="otro">Otro…</option></select></label>
        <label class="fila">Ancho (mm) <input type="number" id="fA" value="${f.ancho}" min="100" step="1"></label>
        <label class="fila">Alto (mm) <input type="number" id="fH" value="${f.alto}" min="100" step="1"></label>
        <label class="fila" title="Margen sin piezas en todo el borde del tablero">Margen al borde (mm) <input type="number" id="fB" value="${f.borde}" min="0" step="1"></label>
        <label class="fila" title="Espacio entre piezas: al menos el diámetro de la fresa más unos milímetros">Separación entre piezas (mm) <input type="number" id="fS" value="${f.sep}" min="0" step="1"></label>
        <label class="fila chk"><input type="checkbox" id="fG" ${f.girar ? 'checked' : ''}> Permitir girar 90° (cuida la veta)</label>
        <label class="fila chk"><input type="checkbox" id="fN" ${f.numeros ? 'checked' : ''}> Grabar el número en cada costilla</label>
        <div class="info" id="fInfo"></div>
        <p class="nota" style="margin-top:10px">El DXF lleva las capas <b>CORTE</b> (contornos), <b>TALADROS</b> (agujeros de las varillas), <b>GRABADO</b> (números) y <b>TABLERO</b> (borde del tablero).</p>
      </div>
      <div><canvas id="fPrev" width="900" height="520"></canvas></div>
    </div>`,
    [['📄 SVG', () => exportarSVG()], ['📐 DXF', () => exportarDXF(), true]], true);
  const leer = () => {
    const t = $('#fTab').value;
    if (t !== 'otro') { const [a, h] = t.split('x').map(Number); $('#fA').value = a; $('#fH').value = h; }
    f.ancho = Math.max(100, +$('#fA').value); f.alto = Math.max(100, +$('#fH').value);
    f.borde = Math.max(0, +$('#fB').value); f.sep = Math.max(0, +$('#fS').value);
    f.girar = $('#fG').checked; f.numeros = $('#fN').checked; f.modo = $('#fModo').value;
    previsualizarFab();
  };
  $('#fModo').value = f.modo;
  ['#fTab', '#fB', '#fS', '#fG', '#fN', '#fModo'].forEach(s => $(s).onchange = leer);
  ['#fA', '#fH'].forEach(s => $(s).onchange = () => { $('#fTab').value = 'otro'; leer(); });
  previsualizarFab();
}
function previsualizarFab() {
  const f = UI.fab, col = colocarEnTableros(f), cv = $('#fPrev'), ctx = cv.getContext('2d');
  const d = window.devicePixelRatio || 1, Wc = cv.clientWidth || 900, n = col.tableros.length || 1;
  const tw = f.modo === 'fila' ? (col.tableros[0] ? col.tableros[0].ancho : 100) : f.ancho, th = f.modo === 'fila' ? (col.tableros[0] ? col.tableros[0].alto : 100) : f.alto;
  const porFila = f.modo === 'fila' ? 1 : (n > 1 ? 2 : 1), filas = Math.ceil(n / porFila), gap = 26;
  const sc = Math.min((Wc - (porFila + 1) * gap) / (porFila * tw), 330 / th);
  const Hc = filas * (th * sc + gap) + gap;
  cv.width = Wc * d; cv.height = Hc * d; cv.style.height = Hc + 'px'; ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.fillStyle = cssVar('--vista'); ctx.fillRect(0, 0, Wc, Hc);
  col.tableros.forEach((t, b) => {
    const ox = gap + (b % porFila) * (tw * sc + gap), oy = gap + Math.floor(b / porFila) * (th * sc + gap);
    const P2 = (x, y) => [ox + x * sc, oy + (th - y) * sc];
    if (f.modo !== 'fila') {
      ctx.fillStyle = '#efe2c9'; ctx.strokeStyle = '#a88b5c'; ctx.lineWidth = 1;
      ctx.fillRect(ox, oy, tw * sc, th * sc); ctx.strokeRect(ox + .5, oy + .5, tw * sc, th * sc);
      ctx.fillStyle = cssVar('--suave'); ctx.font = '11px system-ui'; ctx.fillText(`Tablero ${b + 1}: ${t.piezas.length} piezas`, ox, oy - 6);
    }
    t.piezas.forEach(pz => {
      ctx.beginPath();
      pz.c.poly.forEach((p, i) => { const [x, y] = P2(...aTablero(pz, p)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.closePath(); ctx.fillStyle = 'rgba(168,116,63,.35)'; ctx.fill(); ctx.strokeStyle = '#7a5226'; ctx.stroke();
      pz.c.agujeros.forEach(k => { const [x, y] = P2(...aTablero(pz, P.varillas.lista[k])); ctx.beginPath(); ctx.arc(x, y, Math.max(1.2, radioAgujero() * sc), 0, PI2); ctx.strokeStyle = '#c0392b'; ctx.stroke(); });
      if (f.numeros) {
        const [x, y] = P2(...aTablero(pz, puntoEtiqueta(pz.c)));
        ctx.fillStyle = '#1f4f8a'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(pz.c.i + 1, x, y);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      }
    });
  });
  const info = [];
  if (f.modo === 'fila') info.push(`${R.costillas.filter(c => c.ok).length} costillas en fila: ${fmt(tw)} × ${fmt(th)} mm.`);
  else {
    info.push(`<b>${col.tableros.length}</b> tablero${col.tableros.length === 1 ? '' : 's'} de ${fmt(f.ancho)} × ${fmt(f.alto)} mm · aprovechamiento <b>${fmt(col.uso * 100)} %</b>.`);
    if (col.grandes.length) info.push(`<span style="color:var(--peligro)">No caben en el tablero: ${cst(col.grandes.map(p => p.c.i))}.</span>`);
  }
  info.push(`Agujeros: Ø ${fmt(P.varillas.diam + P.varillas.holgura, 1)} mm · grosor del tablero ${fmt(grosor(), 1)} mm.`);
  $('#fInfo').innerHTML = info.join('<br>');
}

// ---------- DXF (R12, el formato que abre cualquier programa) ----------
function dxf() {
  const f = UI.fab || fabDefecto(), col = colocarEnTableros(f), out = [];
  const g = (c, v) => out.push(String(c), String(v));
  const n = v => (Math.round(v * 1000) / 1000).toString();
  g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSUNITS'); g(70, 4); g(9, '$MEASUREMENT'); g(70, 1); g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'TABLES'); g(0, 'TABLE'); g(2, 'LAYER'); g(70, 4);
  [['CORTE', 7], ['TALADROS', 1], ['GRABADO', 5], ['TABLERO', 8]].forEach(([nom, col]) => { g(0, 'LAYER'); g(2, nom); g(70, 0); g(62, col); g(6, 'CONTINUOUS'); });
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
      const pts = simplificaCerrado(pz.c.poly, 0.05).map(p => { const q = aTablero(pz, p); return [ox + q[0], q[1]]; });
      poli('CORTE', pts);
      pz.c.agujeros.forEach(k => { const q = aTablero(pz, P.varillas.lista[k]); g(0, 'CIRCLE'); g(8, 'TALADROS'); g(10, n(ox + q[0])); g(20, n(q[1])); g(30, 0); g(40, n(radioAgujero())); });
      if (f.numeros) {
        const q = aTablero(pz, puntoEtiqueta(pz.c)), txt = String(pz.c.i + 1), h = 12;
        g(0, 'TEXT'); g(8, 'GRABADO'); g(10, n(ox + q[0])); g(20, n(q[1])); g(30, 0); g(40, h); g(1, txt); g(72, 1); g(11, n(ox + q[0])); g(21, n(q[1] - h / 2)); g(31, 0);
      }
    });
  });
  g(0, 'ENDSEC'); g(0, 'EOF');
  return out.join('\r\n') + '\r\n';
}
function exportarDXF() { descargar(nombreArchivo(P.nombre) + '_costillas.dxf', dxf(), 'application/dxf'); aviso('DXF guardado'); }

function svg() {
  const f = UI.fab || fabDefecto(), col = colocarEnTableros(f);
  let W = 0, H = 0; const partes = [];
  col.tableros.forEach((t, b) => {
    const tw = f.modo === 'fila' ? t.ancho : f.ancho, th = f.modo === 'fila' ? t.alto : f.alto, ox = W;
    H = Math.max(H, th);
    const Y = y => th - y, n = v => Math.round(v * 100) / 100;
    if (f.modo !== 'fila') partes.push(`<rect x="${ox}" y="0" width="${tw}" height="${th}" fill="none" stroke="#999" stroke-width="1"/>`);
    t.piezas.forEach(pz => {
      const d = simplificaCerrado(pz.c.poly, 0.05).map((p, i) => { const q = aTablero(pz, p); return (i ? 'L' : 'M') + n(ox + q[0]) + ' ' + n(Y(q[1])); }).join(' ') + ' Z';
      partes.push(`<path d="${d}" fill="none" stroke="#000" stroke-width="0.5"/>`);
      pz.c.agujeros.forEach(k => { const q = aTablero(pz, P.varillas.lista[k]); partes.push(`<circle cx="${n(ox + q[0])}" cy="${n(Y(q[1]))}" r="${n(radioAgujero())}" fill="none" stroke="#d00" stroke-width="0.5"/>`); });
      if (f.numeros) { const q = aTablero(pz, puntoEtiqueta(pz.c)); partes.push(`<text x="${n(ox + q[0])}" y="${n(Y(q[1]))}" font-family="Arial" font-size="12" text-anchor="middle" dominant-baseline="middle" fill="#00f">${pz.c.i + 1}</text>`); }
    });
    W += tw + 200;
  });
  W = Math.max(1, W - 200);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">\n<!-- ${esc(P.nombre)} — Made-rebanadas -->\n${partes.join('\n')}\n</svg>\n`;
}
function exportarSVG() { descargar(nombreArchivo(P.nombre) + '_costillas.svg', svg(), 'image/svg+xml'); aviso('SVG guardado'); }

// ---------- despiece y lista de compra ----------
function filasDespiece() {
  const mat = MATERIALES[P.costillas.material].nombre, dA = fmt(P.varillas.diam + P.varillas.holgura, 1);
  return R.costillas.map(c => ({ n: c.i + 1, x: c.x, w: c.caja.w, h: c.caja.h, e: grosor(), area: c.area, ag: c.agujeros.length, dA, mat }));
}
function listaCompra() {
  const cm = calcularCompra(), V = P.varillas, tv = VARILLA_TIPOS[V.tipo], L = [];
  L.push([`${MATERIALES[P.costillas.material].nombre}, ${fmt(grosor(), 1)} mm`, `${cm.nTableros} tablero${cm.nTableros === 1 ? '' : 's'} de ${fmt(cm.tablero[0])} × ${fmt(cm.tablero[1])} mm (${fmt(cm.area / 1e6, 2)} m² de piezas)`]);
  R.varillas.filter(v => v.usada).forEach(v => L.push([`${tv.nombre} ${V.tipo === 'roscada' ? 'M' : 'Ø '}${V.diam} — varilla ${v.k + 1}`, fmt(v.largo) + ' mm']));
  if (cm.nSep) L.push([`${tv.sep} Ø ${V.sepD} mm (agujero interior > ${V.diam} mm)`, `${cm.nSep} piezas de ${fmt(R.hueco, 1)} mm (${fmt(cm.nSep * R.hueco)} mm en total)`]);
  if (cm.nTuercas) L.push([`Tuercas M${V.diam} (mejor ciegas) y arandelas`, `${cm.nTuercas} + ${cm.nTuercas}`]);
  L.push(['Broca para los agujeros', `Ø ${fmt(V.diam + V.holgura, 1)} mm`]);
  return L;
}
function abrirDespiece() {
  if (!R) return;
  const F = filasDespiece(), L = listaCompra();
  modal('📋 Despiece y lista de compra', `
    <h4>Costillas</h4>
    <div style="max-height:46vh;overflow:auto"><table class="tabla"><tr><th class="n">Nº</th><th class="n">Posición x</th><th class="n">Ancho</th><th class="n">Alto</th><th class="n">Grosor</th><th class="n">Superficie</th><th class="n">Agujeros</th></tr>
    ${F.map(f => `<tr><td class="n">${f.n}</td><td class="n">${fmt(f.x)} mm</td><td class="n">${fmt(f.w)}</td><td class="n">${fmt(f.h)}</td><td class="n">${fmt(f.e, 1)}</td><td class="n">${fmt(f.area / 100)} cm²</td><td class="n">${f.ag} × Ø${f.dA}</td></tr>`).join('')}
    </table></div>
    <h4>Lista de compra</h4>
    <table class="tabla">${L.map(l => `<tr><td>${esc(l[0])}</td><td class="n">${esc(l[1])}</td></tr>`).join('')}</table>`,
    [['⬇ CSV', () => exportarCSV(), true]], true);
}
function exportarCSV() {
  const q = v => '"' + String(v).replace(/"/g, '""') + '"', num = (v, d = 1) => fmt(v, d).replace(/\./g, '');
  const filas = [['Nº', 'Posición x (mm)', 'Ancho (mm)', 'Alto (mm)', 'Grosor (mm)', 'Superficie (cm²)', 'Agujeros', 'Ø agujero (mm)', 'Material'].map(q).join(';')];
  filasDespiece().forEach(f => filas.push([f.n, num(f.x), num(f.w), num(f.h), num(f.e), num(f.area / 100, 0), f.ag, f.dA, q(f.mat)].join(';')));
  filas.push('', q('Lista de compra'));
  listaCompra().forEach(l => filas.push(q(l[0]) + ';' + q(l[1])));
  descargar(nombreArchivo(P.nombre) + '_despiece.csv', '﻿' + filas.join('\r\n'), 'text/csv');
}
