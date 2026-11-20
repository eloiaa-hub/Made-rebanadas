
/* ===================== PIEZA DE PRUEBA DE HOLGURA =====================
   Un retal con ranuras (desde el borde) y cajas (agujeros) de varios anchos alrededor del grosor del
   tablero, con el ancho grabado debajo de cada una. Se corta con la misma máquina y la misma fresa que el
   mueble, se prueban con un trozo del mismo tablero y se elige la holgura con la que entra a mano. */
function geoPrueba(o) {
  const e = o.e, hs = o.holguras, n = hs.length, wMax = e + Math.max(...hs);
  const paso = Math.max(wMax + 26, 44), L = n * paso + 20, H = 125, prof = 35;
  let poly = [[0, 0], [L, 0], [L, H], [0, H]]; const esq = [], int = [], textos = [];
  hs.forEach((h, i) => {
    const cx = 10 + paso * (i + 0.5), w = e + h;
    const r = hacerRanura(poly, { c: cx, mid: H - prof, borde: H, arriba: true }, w);
    if (r) { poly = r; esq.push(...r.esq); }
    int.push(rectCaja({ eje: 'v', c: cx, lo: 18, hi: 58 }, w, 0));
    textos.push({ x: cx, y: H - prof - 14, t: fmt(w, 2) }, { x: cx, y: H - prof - 24, t: (h >= 0 ? '+' : '') + fmt(h, 2) });
  });
  textos.push({ x: L / 2, y: 6, t: `Prueba de holgura · tablero de ${fmt(e, 2)} mm · fresa Ø ${fmt(o.fresa, 1)}`, alto: 3.5 });
  if (o.fresa > 0 && o.hueso) {
    poly = huesoDePerro(poly, esq, o.fresa / 2).poly;
    for (let k = 0; k < int.length; k++) int[k] = huesoDePerro(int[k], int[k], o.fresa / 2).poly;
  }
  return { poly, int, textos, L, H };
}
function leerHolguras(t) {
  const v = String(t || '').split(/[;\s]+/).map(s => +s.replace(',', '.')).filter(x => isFinite(x) && x > -2 && x < 5);
  return [...new Set(v.map(x => Math.round(x * 100) / 100 || 0))].sort((a, b) => a - b).slice(0, 12);
}
function dxfPrueba(g) {
  const out = [], q = (c, v) => out.push(String(c), String(v)), n = v => (Math.round(v * 1000) / 1000).toString();
  q(0, 'SECTION'); q(2, 'HEADER'); q(9, '$ACADVER'); q(1, 'AC1009'); q(9, '$INSUNITS'); q(70, 4); q(0, 'ENDSEC');
  q(0, 'SECTION'); q(2, 'TABLES'); q(0, 'TABLE'); q(2, 'LAYER'); q(70, 2);
  [['CORTE', 7], ['GRABADO', 5]].forEach(([nom, c]) => { q(0, 'LAYER'); q(2, nom); q(70, 0); q(62, c); q(6, 'CONTINUOUS'); });
  q(0, 'ENDTAB'); q(0, 'ENDSEC'); q(0, 'SECTION'); q(2, 'ENTITIES');
  const poli = pts => { q(0, 'POLYLINE'); q(8, 'CORTE'); q(66, 1); q(10, 0); q(20, 0); q(30, 0); q(70, 1); pts.forEach(p => { q(0, 'VERTEX'); q(8, 'CORTE'); q(10, n(p[0])); q(20, n(p[1])); q(30, 0); }); q(0, 'SEQEND'); q(8, 'CORTE'); };
  g.int.forEach(poli); poli(g.poly);
  g.textos.forEach(t => { const h = t.alto || 5; q(0, 'TEXT'); q(8, 'GRABADO'); q(10, n(t.x)); q(20, n(t.y)); q(30, 0); q(40, n(h)); q(1, t.t); q(72, 1); q(11, n(t.x)); q(21, n(t.y)); q(31, 0); });
  q(0, 'ENDSEC'); q(0, 'EOF');
  return out.join('\r\n') + '\r\n';
}
function svgPrueba(g) {
  const Y = y => g.H + 5 - y, d = p => 'M' + p.map(q => `${(q[0] + 5).toFixed(3)},${Y(q[1]).toFixed(3)}`).join('L') + 'Z';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${g.L + 10}mm" height="${g.H + 10}mm" viewBox="0 0 ${g.L + 10} ${g.H + 10}">\n<!-- Pieza de prueba de holgura — Made-rebanadas (rojo: cortar; azul: interiores; negro: grabar) -->\n`
    + g.int.map(h => `<path d="${d(h)}" fill="none" stroke="#0000ff" stroke-width="0.1"/>`).join('\n') + '\n'
    + `<path d="${d(g.poly)}" fill="none" stroke="#ff0000" stroke-width="0.1"/>\n`
    + g.textos.map(t => `<text x="${(t.x + 5).toFixed(2)}" y="${Y(t.y).toFixed(2)}" font-family="Arial" font-size="${t.alto || 5}" text-anchor="middle" fill="#000">${esc(t.t)}</text>`).join('\n') + '\n</svg>\n';
}
function dialogoPrueba() {
  const e = grosorFab(), hol = holguraRanuraFab(), h0 = Math.max(0, Math.round((hol - 0.3) * 10) / 10), def = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6].map(x => Math.round((h0 + x) * 100) / 100 || 0);
  modal('🧪 Pieza de prueba de holgura', `
    <p class="nota">Un retal con <b>ranuras</b> (desde el borde) y <b>cajas</b> (agujeros) de varios anchos, con su medida grabada. Córtalo con la misma máquina y la misma fresa que el mueble, prueba en cada una un trozo del <b>mismo tablero</b> y quédate con la que entra a mano, con un poco de roce. Esa diferencia con el grosor es la holgura que hay que poner.</p>
    <label class="fila" title="Mídelo con el calibre en varios puntos del tablero: casi nunca es el grosor nominal">Grosor real del tablero (mm) <input type="number" id="prE" value="${e}" min="1" max="80" step="0.05"></label>
    <label class="fila" title="Separadas por «;». Se suman al grosor">Holguras a probar (mm) <input type="text" id="prH" value="${def.map(x => fmt(x, 2)).join('; ')}" style="width:52%"></label>
    <label class="fila">Ø de la fresa (mm) <input type="number" id="prF" value="${fresaFab()}" min="0" step="0.5"></label>
    <label class="fila chk"><input type="checkbox" id="prHueso" ${P.cnc.hueso ? 'checked' : ''}> Hueso de perro en las esquinas</label>
    <canvas id="prPrev" width="760" height="220" style="width:100%;background:var(--vista);border-radius:6px;margin-top:6px"></canvas>
    <p class="nota" id="prInfo"></p>
    <p class="nota">Cuando sepas la buena, ponla en la holgura de las ranuras del mueble (${esPlano() ? '«Piezas planas: uniones»' : P.tipo === 'radial' ? '«Radial: tubo y discos»' : P.tipo === 'pared' ? 'los rastreles' : '«Retícula: largueros»'}${enMaqueta() ? ' o de la maqueta' : ''}).</p>`,
    [['📄 SVG', () => { const g = leer(); descargar('prueba_holgura_' + String(fmt(g.e, 1)).replace(',', '_') + 'mm.svg', svgPrueba(g.g), 'image/svg+xml'); }],
     ['📐 DXF', () => { const g = leer(); descargar('prueba_holgura_' + String(fmt(g.e, 1)).replace(',', '_') + 'mm.dxf', dxfPrueba(g.g), 'application/dxf'); aviso('DXF de la pieza de prueba guardado'); }, true]], true);
  const leer = () => {
    const eR = clamp(+$('#prE').value || e, 1, 80), hs = leerHolguras($('#prH').value), fr = Math.max(0, +$('#prF').value || 0);
    const g = geoPrueba({ e: eR, holguras: hs.length ? hs : [hol], fresa: fr, hueso: $('#prHueso').checked });
    const cv = $('#prPrev'), ctx = cv.getContext('2d'), s = Math.min((cv.width - 20) / g.L, (cv.height - 20) / g.H), ox = (cv.width - g.L * s) / 2, oy = cv.height - (cv.height - g.H * s) / 2;
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#e8d3ad'; ctx.strokeStyle = '#a8743f'; ctx.lineWidth = 1.2; ctx.beginPath();
    [g.poly, ...g.int].forEach(pol => pol.forEach((p, i) => { const x = ox + p[0] * s, y = oy - p[1] * s; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }) || ctx.closePath());
    ctx.fill('evenodd'); ctx.stroke();
    ctx.fillStyle = '#1f4f8a'; ctx.textAlign = 'center';
    g.textos.forEach(t => { ctx.font = `${Math.max(8, (t.alto || 5) * s * 1.1)}px system-ui`; ctx.fillText(t.t, ox + t.x * s, oy - t.y * s + 3); });
    $('#prInfo').textContent = `Retal de ${fmt(g.L)} × ${fmt(g.H)} mm con ${g.int.length} ranuras y ${g.int.length} cajas: de ${fmt(eR + Math.min(...(hs.length ? hs : [hol])), 2)} a ${fmt(eR + Math.max(...(hs.length ? hs : [hol])), 2)} mm.`;
    return { e: eR, g };
  };
  ['#prE', '#prH', '#prF', '#prHueso'].forEach(s => $(s).onchange = leer);
  leer();
}
