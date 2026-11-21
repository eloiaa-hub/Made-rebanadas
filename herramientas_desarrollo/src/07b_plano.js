
/* ===================== PLANO DE MONTAJE EN PDF =====================
   Escritor de PDF propio (sin librerías): líneas, polígonos, círculos, texto Helvetica e imagen JPEG.
   Coordenadas en mm desde la esquina superior izquierda de la hoja. */
const ANCHOS_HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const WINANSI = { '€': 128, '‚': 130, '„': 132, '…': 133, '‘': 145, '’': 146, '“': 147, '”': 148, '•': 149, '–': 150, '—': 151 };
const MM = 72 / 25.4;
class PDFDoc {
  constructor() { this.pags = []; this.imgs = []; }
  pagina(w = 297, h = 210) { this.p = { w, h, s: [] }; this.pags.push(this.p); return this; }
  op(t) { this.p.s.push(t); return this; }
  X(x) { return (x * MM).toFixed(2); }
  Y(y) { return ((this.p.h - y) * MM).toFixed(2); }
  trazo(rgb = [0, 0, 0]) { return this.op(rgb.map(v => (v / 255).toFixed(3)).join(' ') + ' RG'); }
  relleno(rgb = [0, 0, 0]) { return this.op(rgb.map(v => (v / 255).toFixed(3)).join(' ') + ' rg'); }
  grosor(mm) { return this.op((mm * MM).toFixed(2) + ' w'); }
  rayas(on) { return this.op(on ? `[${(on * MM).toFixed(1)} ${(on * MM).toFixed(1)}] 0 d` : '[] 0 d'); }
  pintar(modo) { return this.op({ s: 'S', f: 'f', b: 'B', ss: 'S' }[modo || 's']); }
  linea(x1, y1, x2, y2) { return this.op(`${this.X(x1)} ${this.Y(y1)} m ${this.X(x2)} ${this.Y(y2)} l S`); }
  rect(x, y, w, h, modo) { this.op(`${this.X(x)} ${this.Y(y + h)} ${(w * MM).toFixed(2)} ${(h * MM).toFixed(2)} re`); return this.pintar(modo); }
  poli(pts, cerrar = true, modo) {
    if (pts.length < 2) return this;
    this.op(pts.map((p, i) => `${this.X(p[0])} ${this.Y(p[1])} ${i ? 'l' : 'm'}`).join(' ') + (cerrar ? ' h' : ''));
    return this.pintar(modo);
  }
  circulo(cx, cy, r, modo) {
    const k = 0.5523 * r, P2 = (x, y) => `${this.X(x)} ${this.Y(y)}`;
    this.op(`${P2(cx + r, cy)} m ${P2(cx + r, cy - k)} ${P2(cx + k, cy - r)} ${P2(cx, cy - r)} c ${P2(cx - k, cy - r)} ${P2(cx - r, cy - k)} ${P2(cx - r, cy)} c ${P2(cx - r, cy + k)} ${P2(cx - k, cy + r)} ${P2(cx, cy + r)} c ${P2(cx + k, cy + r)} ${P2(cx + r, cy + k)} ${P2(cx + r, cy)} c h`);
    return this.pintar(modo);
  }
  static cod(t) { // texto → bytes WinAnsi escapados para una cadena PDF
    let s = '';
    for (const ch of String(t)) {
      let c = ch.charCodeAt(0);
      if (WINANSI[ch]) c = WINANSI[ch]; else if (c > 255) continue;
      if (c === 40 || c === 41 || c === 92) s += '\\' + ch;
      else if (c < 32) s += ' ';
      else if (c > 126) s += '\\' + c.toString(8).padStart(3, '0');
      else s += ch;
    }
    return s;
  }
  static ancho(t, pt, negrita) { // en mm
    let u = 0;
    for (const ch of String(t)) { const b = ch.normalize('NFD').charCodeAt(0); u += b >= 32 && b <= 126 ? ANCHOS_HELV[b - 32] : 556; }
    return u / 1000 * pt * (negrita ? 1.06 : 1) / MM;
  }
  texto(x, y, t, o = {}) {
    const pt = o.pt || 9, w = PDFDoc.ancho(t, pt, o.b);
    const x0 = o.al === 'c' ? x - w / 2 : o.al === 'r' ? x - w : x;
    if (o.col) this.relleno(o.col);
    this.op(`BT /${o.b ? 'F2' : 'F1'} ${pt} Tf ${this.X(x0)} ${this.Y(y)} Td (${PDFDoc.cod(t)}) Tj ET`);
    if (o.col) this.relleno([0, 0, 0]);
    return w;
  }
  // texto en varias líneas; devuelve la y siguiente
  parrafo(x, y, ancho, t, o = {}) {
    const pt = o.pt || 9, alto = (o.int || 1.35) * pt / MM, pal = String(t).split(' ');
    let lin = '';
    for (const p of pal) {
      const prueba = lin ? lin + ' ' + p : p;
      if (PDFDoc.ancho(prueba, pt, o.b) > ancho && lin) { this.texto(x, y, lin, o); y += alto; lin = p; } else lin = prueba;
    }
    if (lin) { this.texto(x, y, lin, o); y += alto; }
    return y;
  }
  imagen(jpegBin, wpx, hpx, x, y, w, h) {
    this.imgs.push({ d: jpegBin, w: wpx, h: hpx }); const n = this.imgs.length;
    return this.op(`q ${(w * MM).toFixed(2)} 0 0 ${(h * MM).toFixed(2)} ${this.X(x)} ${this.Y(y + h)} cm /Im${n} Do Q`);
  }
  generar() {
    const obj = [], off = [];
    let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
    const add = s => { off.push(out.length); out += `${off.length} 0 obj\n${s}\nendobj\n`; return off.length; };
    // 1 catálogo, 2 páginas (se reservan), 3-4 fuentes, imágenes, páginas
    const nPag = this.pags.length, nImg = this.imgs.length;
    const idPag = 2, idF1 = 3, idF2 = 4, img0 = 5, pag0 = img0 + nImg;
    add(`<< /Type /Catalog /Pages ${idPag} 0 R >>`);
    add(`<< /Type /Pages /Kids [${this.pags.map((_, i) => (pag0 + 2 * i) + ' 0 R').join(' ')}] /Count ${nPag} >>`);
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    this.imgs.forEach(im => add(`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.d.length} >>\nstream\n${im.d}\nendstream`));
    const xo = this.imgs.map((_, i) => `/Im${i + 1} ${img0 + i} 0 R`).join(' ');
    this.pags.forEach((p, i) => {
      const cont = p.s.join('\n');
      add(`<< /Type /Page /Parent ${idPag} 0 R /MediaBox [0 0 ${(p.w * MM).toFixed(2)} ${(p.h * MM).toFixed(2)}] /Resources << /Font << /F1 ${idF1} 0 R /F2 ${idF2} 0 R >> /XObject << ${xo} >> >> /Contents ${pag0 + 2 * i + 1} 0 R >>`);
      add(`<< /Length ${cont.length} >>\nstream\n${cont}\nendstream`);
    });
    const xref = out.length;
    out += `xref\n0 ${off.length + 1}\n0000000000 65535 f \n` + off.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
    out += `trailer\n<< /Size ${off.length + 1} /Root 1 0 R /Info << /Producer (Made-rebanadas) /Title (${PDFDoc.cod(P.nombre + ' - plano de montaje')}) >> >>\nstartxref\n${xref}\n%%EOF\n`;
    const b = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) b[i] = out.charCodeAt(i) & 255;
    return b;
  }
}

// captura del 3D en JPEG (fondo blanco, sin resaltar, montado y en vista ¾)
function captura3D(expl) {
  const cam = G.cam.position.clone(), tgt = G.ctl.target.clone(), fondo = G.scene.background, ex = P.vista.explosion, res = P.vista.resalta, fan = P.vista.fantasma;
  const r = G.renderer, pr = r.getPixelRatio();
  P.vista.explosion = expl || 0; P.vista.resalta = false; P.vista.fantasma = false;
  colocarExplosion(); resaltar3D(); construirFantasma();
  G.scene.background = new T.Color('#ffffff'); if (G.rejilla) G.rejilla.visible = false;
  r.setPixelRatio(2); ajustar3D(); camara('tres4'); r.render(G.scene, G.cam);
  const url = r.domElement.toDataURL('image/jpeg', 0.9), w = r.domElement.width, h = r.domElement.height;
  P.vista.explosion = ex; P.vista.resalta = res; P.vista.fantasma = fan;
  G.scene.background = fondo; if (G.rejilla) G.rejilla.visible = true;
  r.setPixelRatio(pr); ajustar3D(); colocarExplosion(); resaltar3D(); construirFantasma();
  G.cam.position.copy(cam); G.ctl.target.copy(tgt); G.ctl.update(); pedirRender();
  return { bin: atob(url.split(',')[1]), w, h };
}

function planoPDF(F = null) {   // F: opciones de la ficha de práctica (enunciado y rúbrica)
  const ret = P.tipo === 'reticula', D = new PDFDoc(), k = escalaFab(), W = 297, H = 210, M = 12, maq = enMaqueta();
  const e = grosorFab(), cm = calcularCompraFab(), V = P.varillas, fecha = new Date().toLocaleDateString('es-ES');
  const gris = [110, 116, 125], azul = [31, 79, 138], madera = [168, 116, 63], rojo = [192, 57, 43];
  const hojas = [];
  const cabecera = titulo => {
    D.pagina(W, H); hojas.push(D.p);
    D.texto(M, M + 4, P.nombre, { pt: 14, b: true });
    D.texto(W - M, M + 4, (F ? 'Ficha de práctica · ' : 'Plano de montaje · ') + (maq ? 'maqueta 1:' + P.maqueta.escala : 'medidas en mm') + ' · ' + fecha, { pt: 9, al: 'r', col: gris });
    D.texto(M, M + 11, titulo, { pt: 11, b: true, col: azul });
    D.trazo([200, 200, 200]).grosor(0.3).linea(M, M + 13.5, W - M, M + 13.5).trazo();
  };
  const tabla = (x, y, ancho, filas, o = {}) => {
    const alto = o.alto || 5.2, c1 = o.c1 || ancho * 0.58;
    filas.forEach((f, i) => {
      if (f.titulo) { D.texto(x, y + alto * 0.75, f.titulo, { pt: 9.5, b: true, col: azul }); y += alto + 0.6; return; }
      const yy = D.parrafo(x, y + alto * 0.72, c1 - 2, f[0], { pt: 8.5 });
      D.parrafo(x + c1, y + alto * 0.72, ancho - c1, f[1], { pt: 8.5, b: true });
      const h = Math.max(alto, yy - y - alto * 0.72 + alto);
      D.trazo([225, 225, 225]).grosor(0.2).linea(x, y + h, x + ancho, y + h).trazo();
      y += h;
    });
    return y;
  };

  if (F) hojaEnunciado(D, cabecera, { M, W, H, gris, azul, madera, F });
  // ---- hoja 1: conjunto, datos y compra ----
  cabecera('1. Conjunto, datos y lista de compra');
  const cap = captura3D(), iw = 165, ih = Math.min(150, iw * cap.h / cap.w);
  D.imagen(cap.bin, cap.w, cap.h, M, M + 18, iw, ih);
  D.trazo([210, 210, 210]).grosor(0.2).rect(M, M + 18, iw, ih).trazo();
  const fondo = (G.fondo || 0), alto = (G.alto || 0), x2 = M + iw + 8, a2 = W - M - x2;
  let y = esPlano() ? tabla(x2, M + 18, a2, [
    { titulo: 'Datos' },
    ['Medidas (ancho × fondo × alto)', `${fmt((G.dims || [0])[0] * k)} × ${fmt(fondo * k)} × ${fmt(alto * k)} mm`],
    ['Piezas', `${R.n} de ${fmt(e, 1)} mm`],
    ['Material', maq ? `Maqueta de ${fmt(P.maqueta.grosor, 1)} mm` : MATERIALES[P.costillas.material].nombre],
    ['Uniones a media madera', String(R.uniones.filter(u => u.tipo === 'media').length)],
    ['Espigas en caja pasante', String(R.uniones.filter(u => u.tipo === 'caja').length)],
    ...(R.uniones.some(u => u.tipo === 'dentada') ? [['Uniones dentadas', `${R.uniones.filter(u => u.tipo === 'dentada' && u.esquina).length} esquinas y ${R.uniones.filter(u => u.tipo === 'dentada' && !u.esquina).length} cantos en T`]] : []),
    ...(R.uniones.some(u => u.tipo === 'solape') ? [['Piezas solapadas', `${R.uniones.filter(u => u.tipo === 'solape').length}, con ${R.uniones.reduce((s, u) => s + (u.puntos || []).length, 0)} ${solapeP().tipo} de Ø ${fmt(solapeP().diam, 1)} mm`]] : []),
    ...(R.uniones.some(u => u.tipo === 'herraje') ? [['Uniones con herraje', `${R.uniones.filter(u => u.tipo === 'herraje').length} a tope, ${R.uniones.reduce((s, u) => s + (u.tipo === 'herraje' ? u.puntos.length : 0), 0)} × ${NOMBRE_HERRAJE[planoP().herraje] || 'herraje'}`]] : []),
    ['Ancho de ranuras y cajas', `${fmt(grosorFab() + holguraRanuraFab(), 2)} mm`],
    ...(planoP().flexion !== false ? analisisFlexion(R).slice(0, 4).map(c => [`Flexión: ${c.lamas ? 'lamas del asiento' : c.asiento ? 'asiento' : c.H.nombre.toLowerCase()}`, `${fmt(c.flecha, 1)} mm (máx. ${fmt(c.lim, 1)}) con ${c.carga.replace('²', '2')}`]) : []),
  ]) : tabla(x2, M + 18, a2, [
    { titulo: 'Datos' },
    ['Medidas (largo × fondo × alto)', `${fmt(P.largo * k)} × ${fmt(fondo * k)} × ${fmt(alto * k)} mm`],
    [P.tipo === 'pared' ? 'Lamas' : 'Costillas', `${R.n} de ${fmt(e, 1)} mm`],
    ...(P.tipo === 'radial' ? [['Ángulo entre costillas', `${fmt(R.sep, 1)}°`], ['Tubo central', `Ø ${fmt(P.radial.tubo * k, 1)} mm`], ['Discos de unión', `${R.discos.length}`]]
      : [['Separación entre centros', `${fmt(cm.sep, 1)} mm${disposicion() === 'curva' ? ' (en el eje de la curva)' : ''}`], ['Hueco entre costillas', `${fmt(Math.max(0, cm.hueco), 1)} mm`]]),
    ...(P.tipo === 'pared' ? [['Rastreles', R.rastreles.length ? `${R.rastreles.length} de ${fmt(P.pared.alto * k, 1)} × ${fmt(P.pared.grueso * k, 1)} mm` : 'sin rastreles']] : []),
    ['Material', maq ? `Maqueta de ${fmt(P.maqueta.grosor, 1)} mm` : MATERIALES[P.costillas.material].nombre],
    ...(P.tipo === 'radial' || P.tipo === 'pared' ? [] : ret ? [['Largueros', `${R.largueros.length} de ${fmt(e, 1)} mm`], ['Cruces a media madera', `${R.cruces.length}, ranura de ${fmt(grosorFab() + holguraRanuraFab(), 2)} mm`]] : [
    ['Varillas', maq ? `${cm.varillas.length} de Ø ${fmt(P.maqueta.diam, 1)} mm` : `${cm.varillas.length} × ${VARILLA_TIPOS[V.tipo].nombre} Ø ${V.diam}`],
    ['Agujeros', `Ø ${fmt(2 * radioFab(), 2)} mm`]]),
  ]);
  y = tabla(x2, y + 4, a2, [{ titulo: 'Lista de compra' }, ...listaCompra()]);
  const aviso1 = R.avisos.filter(a => a.tipo === 'error');
  if (aviso1.length) D.parrafo(M, M + 22 + ih, iw, '¡Atención! El proyecto tiene errores: ' + aviso1.map(a => a.txt).join(' '), { pt: 8.5, col: rojo });

  const cs = R.costillas.filter(c => c.ok);
  const oH = { M, W, H, k, e, maq, gris, azul, madera, rojo, cm };
  hojaVistas(D, cabecera, oH);
  if (esPlano()) hojaPlano(D, cabecera, tabla, oH);
  else if (ret) hojaReticula(D, cabecera, tabla, oH);
  else if (P.tipo === 'radial') hojaRadial(D, cabecera, tabla, oH);
  else if (P.tipo === 'pared') hojaPared(D, cabecera, tabla, oH);
  else if (disposicion() === 'curva') hojaCurva(D, cabecera, tabla, oH);
  else {
  // ---- hoja 2: vista lateral (orden de montaje) y perfil con las varillas ----
  cabecera('2. Orden de montaje y posición de las varillas');
  // vista lateral: X a lo largo, Y alto
  const zona1 = { x: M + 8, y: M + 24, w: W - 2 * M - 16, h: 70 };
  const sobra = maq ? Math.max(2, V.sobra * k) : V.sobra;
  const xmin = -sobra / k - 5, xmax = P.largo + sobra / k + 5, ymax = Math.max(...cs.map(c => c.caja.y1));
  const s1 = Math.min(zona1.w / (xmax - xmin), zona1.h / ymax);
  const LX = x => zona1.x + (x - xmin) * s1, LY = v => zona1.y + zona1.h - v * s1;
  D.trazo([150, 150, 150]).grosor(0.3).linea(zona1.x - 4, LY(0), zona1.x + zona1.w + 4, LY(0));
  cs.forEach(c => {
    D.relleno([226, 205, 172]).trazo(madera).grosor(0.15);
    D.rect(LX(c.x - grosor() / 2), LY(c.caja.y1), Math.max(0.25, grosor() * s1), (c.caja.y1 - c.caja.y0) * s1, 'b');
  });
  D.relleno([0, 0, 0]);
  R.varillas.filter(v => v.usada).forEach(v => {
    const xa = R.costillas[v.a].x - grosor() / 2 - sobra / k, xb = R.costillas[v.b].x + grosor() / 2 + sobra / k;
    D.trazo(v.fallan.length ? rojo : [80, 88, 98]).grosor(0.5).linea(LX(xa), LY(v.v), LX(xb), LY(v.v));
    if (v.k % 2) D.texto(LX(xa) - 1.5, LY(v.v) + 1.2, 'V' + (v.k + 1), { pt: 7.5, b: true, al: 'r', col: [80, 88, 98] });
    else D.texto(LX(xb) + 1.5, LY(v.v) + 1.2, 'V' + (v.k + 1), { pt: 7.5, b: true, col: [80, 88, 98] });
  });
  const paso = Math.max(1, Math.ceil(cs.length / Math.floor(zona1.w / 5)));
  cs.forEach((c, i) => { if (i % paso === 0 || i === cs.length - 1) D.texto(LX(c.x), LY(c.caja.y1) - 1.5, String(c.i + 1), { pt: 6.5, al: 'c', col: azul }); });
  // cota del largo
  const yc = LY(0) + 7;
  D.trazo(azul).grosor(0.2).linea(LX(0), yc, LX(P.largo), yc).linea(LX(0), yc - 2, LX(0), yc + 2).linea(LX(P.largo), yc - 2, LX(P.largo), yc + 2).trazo();
  D.texto((LX(0) + LX(P.largo)) / 2, yc - 1.2, fmt(P.largo * k) + ' mm', { pt: 8, al: 'c', col: azul });
  D.texto(zona1.x, zona1.y - 3, `Vista lateral: ${R.n} costillas de ${fmt(e, 1)} mm cada ${fmt(cm.sep, 1)} mm (de centro a centro). Monta de la 1 a la ${R.n}.`, { pt: 8.5, col: gris });
  // perfil frontal con las varillas
  const zona2 = { x: M + 8, y: M + 112, w: 120, h: 68 };
  let u0 = Infinity, u1 = -Infinity; cs.forEach(c => { u0 = Math.min(u0, c.caja.x0); u1 = Math.max(u1, c.caja.x1); });
  const s2 = Math.min(zona2.w / (u1 - u0), zona2.h / ymax), FX = u => zona2.x + (u - u0) * s2, FY = v => zona2.y + zona2.h - v * s2;
  D.trazo([215, 195, 165]).grosor(0.15); cs.forEach(c => D.poli(simplificaCerrado(c.poly, 0.5).map(p => [FX(p[0]), FY(p[1])])));
  const cMed = R.costillas[Math.floor(R.n / 2)];
  if (cMed.ok) D.trazo(madera).grosor(0.45).poli(simplificaCerrado(cMed.poly, 0.2).map(p => [FX(p[0]), FY(p[1])]));
  D.trazo([150, 150, 150]).grosor(0.3).linea(zona2.x - 3, FY(0), zona2.x + zona2.w + 3, FY(0));
  V.lista.forEach((p, i) => {
    const mal = R.varillas[i] && (R.varillas[i].fallan.length || !R.varillas[i].usada);
    D.trazo(mal ? rojo : [60, 66, 74]).grosor(0.35).circulo(FX(p[0]), FY(p[1]), Math.max(0.8, radioAgujero() * s2));
    D.texto(FX(p[0]) + 2.5, FY(p[1]) - 1.5, 'V' + (i + 1), { pt: 7.5, b: true });
  });
  D.trazo();
  D.texto(zona2.x, zona2.y - 3, `Perfil: todas las costillas superpuestas y, más marcada, la ${cMed.i + 1}.`, { pt: 8.5, col: gris });
  // tabla de varillas
  const filasV = [{ titulo: 'Varillas (medidas desde la parte trasera y desde el suelo)' }];
  R.varillas.forEach((v, i) => filasV.push([`V${i + 1}: atrás ${fmt(v.u * k, 1)} · suelo ${fmt(v.v * k, 1)} mm`, v.usada ? `largo ${fmt(cm.varillas.find(q => q.k === v.k).largo)} mm · costillas ${v.a + 1}-${v.b + 1}` : 'no cabe']));
  filasV.push(['Agujero en las costillas', `Ø ${fmt(2 * radioFab(), 2)} mm`]);
  if (cm.nSep) filasV.push(['Separadores', `${cm.nSep} de ${fmt(cm.hueco, 1)} mm`]);
  tabla(zona2.x + zona2.w + 14, zona2.y - 6, W - M - (zona2.x + zona2.w + 14), filasV, { c1: 70 });
  }

  // ---- hojas de costillas: 4 × 2 por hoja, todas a la misma escala ----
  const porHoja = 8, cols = 4, filas = 2, cw = (W - 2 * M) / cols, ch = (H - 2 * M - 22) / filas;
  // con huecos, los trozos van junto a su lama o costilla (12a, 12b…)
  const csP = cs.flatMap(c => (c.partes || [c]).filter(q => q.ok));
  const mw = Math.max(...csP.map(c => c.caja.w)), mh = Math.max(...csP.map(c => c.caja.h));
  const s3 = Math.min((cw - 10) / mw, (ch - 16) / mh);
  for (let h0 = 0; h0 < csP.length; h0 += porHoja) {
    cabecera(`3. ${esPlano() ? 'Piezas' : P.tipo === 'pared' ? 'Lamas' : 'Costillas'} ${csP[h0].etq} a ${csP[Math.min(csP.length, h0 + porHoja) - 1].etq} (todas a la misma escala, 1:${fmt(k / s3, 0)} aprox.)`);
    csP.slice(h0, h0 + porHoja).forEach((c, j) => {
      const g = geoFab(c), cx = M + (j % cols) * cw, cy = M + 18 + Math.floor(j / cols) * ch;
      D.trazo([225, 225, 225]).grosor(0.2).rect(cx + 1, cy + 1, cw - 2, ch - 2);
      const ox = cx + (cw - c.caja.w * s3) / 2, oy = cy + ch - 9;
      const PX = u => ox + (u - c.caja.x0) * s3, PY = v => oy - (v - c.caja.y0) * s3;
      D.relleno([240, 228, 208]).trazo(madera).grosor(0.35).poli(simplificaCerrado(c.poly, 0.05).map(p => [PX(p[0]), PY(p[1])]), true, 'b');
      (c.int || []).forEach(hh => D.relleno([255, 255, 255]).trazo(madera).grosor(0.35).poli(hh.map(p => [PX(p[0]), PY(p[1])]), true, 'b'));
      D.relleno([255, 255, 255]).trazo(rojo).grosor(0.25);
      c.agujeros.forEach(j2 => D.circulo(PX(V.lista[j2][0]), PY(V.lista[j2][1]), Math.max(0.6, radioAgujero() * s3), 'b'));
      (c.taladros || []).forEach(t => D.circulo(PX(t[0]), PY(t[1]), Math.max(0.5, t[2] * s3), t[3] === 'ciego' ? 's' : 'b'));
      (c.cantos || []).forEach(m => D.linea(PX(m.a[0]), PY(m.a[1]), PX(m.b[0]), PY(m.b[1])));
      D.relleno([0, 0, 0]).trazo();
      const et = puntoEtiqueta(c);
      D.texto(PX(et[0]), PY(et[1]) + 2.2, c.etq, { pt: 14, b: true, al: 'c', col: azul });
      D.texto(cx + 3, cy + 6, c.nombre, { pt: 9, b: true });
      D.texto(cx + cw - 3, cy + 6, `${fmt(g.caja.w, maq ? 1 : 0)} × ${fmt(g.caja.h, maq ? 1 : 0)} mm`, { pt: 8.5, al: 'r', col: gris });
      if (esPlano()) D.texto(cx + 3, cy + ch - 3.5, `${PLANOS[c.plano].normal} = ${fmt(c.x * k)} mm · ${textoUnionesPieza(c)}`, { pt: 6.5, col: gris });
      else D.texto(cx + 3, cy + ch - 3.5, (P.tipo === 'radial' ? `a ${fmt(c.x, 1)}° · ` : `x = ${fmt(c.x * k)} mm · `) + (ret ? `${c.ranuras.length} ranuras` : P.tipo === 'radial' || P.tipo === 'pared' ? `${c.ranuras.length} muescas` : `${c.agujeros.length} agujeros`), { pt: 7.5, col: gris });
    });
  }

  // ---- largueros (retícula): 3 por hoja, a lo ancho ----
  const zs = (R.largueros || []).filter(z => z.ok);
  if (ret && zs.length) {
    const zw = W - 2 * M - 10, zh = (H - 2 * M - 26) / 3;
    const s5 = Math.min(zw / Math.max(...zs.map(z => z.caja.w)), (zh - 14) / Math.max(...zs.map(z => z.caja.h)));
    for (let h0 = 0; h0 < zs.length; h0 += 3) {
      cabecera(`3b. Largueros ${zs[h0].etq} a ${zs[Math.min(zs.length, h0 + 3) - 1].etq} (a la misma escala, 1:${fmt(k / s5, 0)} aprox.)`);
      zs.slice(h0, h0 + 3).forEach((z, j) => {
        const g = geoFab(z), cy = M + 20 + j * zh, ox = M + 5, oy = cy + zh - 6;
        const PX = x => ox + (x - z.caja.x0) * s5, PY = v => oy - (v - z.caja.y0) * s5;
        D.relleno([240, 228, 208]).trazo(madera).grosor(0.35).poli(simplificaCerrado(z.poly, 0.05).map(p => [PX(p[0]), PY(p[1])]), true, 'b');
        D.relleno([0, 0, 0]).trazo();
        z.ranuras.forEach(rr => D.texto(PX(rr.c), rr.arriba ? PY(z.caja.y1) - 1.2 : PY(z.caja.y0) + 3.2, String(rr.x + 1), { pt: 6, al: 'c', col: gris }));
        const et = puntoEtiqueta(z);
        D.texto(PX(et[0]), PY(et[1]) + 2.2, z.etq, { pt: 14, b: true, al: 'c', col: azul });
        D.texto(M, cy + 3, `Larguero ${z.etq}`, { pt: 9, b: true });
        D.texto(W - M, cy + 3, `${fmt(g.caja.w, maq ? 1 : 0)} × ${fmt(g.caja.h, maq ? 1 : 0)} mm · z = ${fmt(z.u * k)} mm desde atrás · ${z.ranuras.length} ranuras (números: costilla que encaja)`, { pt: 8, al: 'r', col: gris });
      });
    }
  }

  // ---- muebles de los huecos: lista de tableros ----
  const mods = (R.modulos || []);
  if (huecosActivos().length) {
    cabecera('3c. Huecos y sus muebles');
    const filas = [{ titulo: P.tipo === 'pared' ? 'Huecos (medidas desde la esquina de abajo a la izquierda del panel)' : 'Huecos (túneles, en el perfil: u fondo, v altura)' }];
    huecosActivos().forEach(h => { const cb = cajaHueco(h), n = P.huecos.indexOf(h) + 1, mod = (h.forma === 'texto' ? `texto «${String(h.texto || '').replace(/\n/g, ' ')}», ` : '') + { pasante: 'pasante', rebaje: `rebaje a ${fmt(h.prof * k)} mm de la pared`, saliente: `sale ${fmt((h.relieve || 0) * k)} mm hacia fuera`, hundido: `hundido ${fmt((h.relieve || 0) * k)} mm`, mueble: { balda: 'con balda', caja: 'con caja (hornacina)', armario: `con armario y puerta ${h.mueble.puerta === 'lamas' ? 'de lamas' : 'lisa'}` }[h.mueble.tipo] }[h.modo];
      const [x0, x1] = P.tipo === 'pared' ? [0, 0] : tramoX(h);
      filas.push([`Hueco H${n}`, `${{ rect: 'rectángulo', redondeado: 'redondeado', arco: 'arco', circulo: 'círculo', libre: 'forma libre' }[h.forma]} ${fmt(cb.w * k)} × ${fmt(cb.h * k)} mm en (${fmt(cb.x0 * k)}, ${fmt(cb.y0 * k)})${P.tipo === 'pared' ? '' : ` · de x = ${fmt(x0 * k)} a ${fmt(x1 * k)} mm`} · ${mod}`]); });
    if (mods.length) {
      const gsM = [...new Set(mods.map(m => m.grosorPieza || grosor()))], propio = gsM.some(e => Math.abs(e - grosor()) > 0.01);
      filas.push({ titulo: propio ? `Tableros de los muebles (cada uno con su grosor; el que no lleva el de las ${P.tipo === 'pared' ? 'lamas' : 'costillas'} va en tablero aparte)` : `Tableros de los muebles: ${fmt(grosor() * k, 1)} mm (el mismo grosor que las ${P.tipo === 'pared' ? 'lamas' : 'costillas'})` });
      mods.forEach(m => filas.push([`${m.etq} · ${m.nombre}`, `${fmt(m.medidas[0] * k)} × ${fmt(m.medidas[1] * k)} mm${propio ? ` · grosor ${fmt((m.grosorPieza || grosor()) * k, 1)} mm` : ''}`]));
    }
    tabla(M, M + 22, W - 2 * M, filas, { c1: 70 });
  }
  // ---- tableros ----
  const f = fabActual(), col = colocarEnTableros(f);
  if (f.modo !== 'fila' && col.tableros.length && (!F || F.corte !== false)) {
    const porH = 4;
    for (let t0 = 0; t0 < col.tableros.length; t0 += porH) {
      const variosG = (col.grosores || []).length > 1;
      cabecera(`4. Corte: tableros de ${fmt(f.ancho)} × ${fmt(f.alto)} mm (${col.tableros.length} en total, aprovechamiento ${fmt(col.uso * 100)} %${vetaOn() ? ' · la veta, a lo largo del tablero' : ''})`);
      const tw = (W - 2 * M - 10) / 2, th = (H - 2 * M - 30) / 2, s4 = Math.min(tw / f.ancho, (th - 6) / f.alto);
      col.tableros.slice(t0, t0 + porH).forEach((t, j) => {
        const bx = M + (j % 2) * (tw + 10), by = M + 24 + Math.floor(j / 2) * (th + 4);
        const BX = x => bx + x * s4, BY = yv => by + 5 + (f.alto - yv) * s4;
        D.texto(bx, by + 2.5, `Tablero ${t0 + j + 1}: ${t.piezas.length} piezas` + (variosG ? ` · grosor ${fmt(t.grosor, 1)} mm` : ''), { pt: 8.5, b: true });
        D.relleno([244, 235, 218]).trazo([168, 139, 92]).grosor(0.3).rect(BX(0), BY(f.alto), f.ancho * s4, f.alto * s4, 'b');
        t.piezas.forEach(pz => {
          D.relleno([226, 205, 172]).trazo(madera).grosor(0.2).poli(simplificaCerrado(pz.g.poly, 0.3 * (maq ? 0.2 : 1)).map(p => { const q = aTablero(pz, p); return [BX(q[0]), BY(q[1])]; }), true, 'b');
          const q = aTablero(pz, pz.g.etiqueta); D.texto(BX(q[0]), BY(q[1]) + 1.2, pz.c.etq, { pt: 6.5, b: true, al: 'c', col: azul });
        });
        D.relleno([0, 0, 0]);
      });
    }
  }

  // ---- montaje paso a paso ----
  cabecera('5. Montaje paso a paso');
  const wR = fmt(grosorFab() + holguraRanuraFab(), 2), nZ = (R.largueros || []).length, ultZ = nZ ? R.largueros[nZ - 1].etq : '';
  const tabla2 = maq ? `tablero de ${fmt(P.maqueta.grosor, 1)} mm` : `${MATERIALES[P.costillas.material].nombre.toLowerCase()} de ${fmt(grosor(), 1)} mm`;
  const pasos = esPlano() ? pasosPlano(k, maq) : P.tipo === 'radial' ? [
    `Corta las ${R.n} costillas y los ${R.discos.length} discos en ${tabla2}. Las muescas y ranuras son de ${fmt(grosorFab() + holguraRanuraFab(), 2)} mm: prueba antes una en un retal.`,
    `Corta el tubo central de Ø ${fmt(P.radial.tubo * k, 1)} mm a ${fmt(cm.tubo)} mm.` + (maq ? '' : ' Si es una lámpara, pasa antes el cable por dentro.'),
    'Mete los discos en el tubo a su altura (hoja 2) y fíjalos con una gota de cola, con las ranuras de los dos discos alineadas.',
    `Encaja las costillas de una en una, en orden (1 a ${R.n}): cada una entra de lado en las ranuras de los discos y su muesca abraza el disco.`,
    'Comprueba que todas quedan a su ángulo y a la misma altura; encola si se quiere fijo.',
    maq ? 'Mira la maqueta desde todos los lados antes de cortar la pieza real.' : 'Acabado y, si es lámpara, usa una bombilla LED (no calienta) y un florón para colgarla.',
  ] : P.tipo === 'pared' ? [
    `Corta las ${R.n} lamas en ${tabla2}${R.rastreles.length ? `, con sus muescas de ${fmt((P.pared.alto + P.pared.holgura) * k, 1)} × ${fmt(P.pared.grueso * k, 1)} mm detrás` : ''}.`,
    R.rastreles.length ? `Corta los rastreles de ${fmt(P.pared.alto * k, 1)} × ${fmt(P.pared.grueso * k, 1)} mm: ${textoRastreles(k, cm)}.` : 'Prepara el tablero trasero (o las escuadras) donde irán las lamas.',
    R.rastreles.length ? 'Marca en la pared la altura de cada rastrel (hoja 2) con nivel, y atorníllalos con tacos (uno cada 50 cm).' : 'Fija el tablero trasero a la pared con tacos y tornillos.',
    `Coloca las lamas en orden de la 1 a la ${R.n}, encajadas en los rastreles, a ${fmt(cm.sep, 1)} mm entre centros (usa un taco separador de ${fmt(Math.max(0, cm.hueco), 1)} mm).`,
    'Fija cada lama con un tornillo o cola en cada rastrel. Empieza por el centro si quieres que el dibujo quede centrado en la pared.',
    'Acabado: mejor antes de montar (aceite, barniz o pintura), para llegar a todas las caras.',
  ] : ret ? [
    `Corta las ${R.n} costillas (1 a ${R.n}) y los ${nZ} largueros (A a ${ultZ}) en ${maq ? 'tablero de ' + fmt(P.maqueta.grosor, 1) + ' mm' : MATERIALES[P.costillas.material].nombre.toLowerCase() + ' de ' + fmt(grosor(), 1) + ' mm'}. Las ranuras son de ${wR} mm: ${maq ? 'prueba antes una en un retal' : 'en la CNC, con una fresa menor que el ancho de la ranura, y repasa las esquinas interiores con formón o lima (o déjalas en «hueso de perro»)'}.`,
    'Lija los cantos y comprueba con un retal que una ranura entra en otra sin forzar: tiene que entrar a mano, con un poco de roce.',
    `Pon las costillas de pie, en orden de la 1 a la ${R.n}, con sus ranuras ${P.reticula.xArriba !== false ? 'hacia arriba' : 'hacia abajo'}, más o menos a su distancia.`,
    `Encaja los largueros ${P.reticula.xArriba !== false ? 'desde arriba' : 'desde abajo'}, de uno en uno (A, B…): mete primero los extremos y baja el larguero poco a poco, costilla a costilla. Un mazo de goma ayuda.`,
    'Comprueba que todas las costillas quedan a escuadra y que el mueble apoya bien. Si se quiere fijo, pon cola en los cruces.',
    maq ? 'Mira la maqueta desde todos los lados antes de cortar el mueble real.' : 'Acabado: aceite, cera o barniz (mejor antes de montar, para llegar a todas las caras).',
  ] : maq ? [
    `Corta las ${R.n} costillas en tablero de ${fmt(P.maqueta.grosor, 1)} mm (DXF o SVG en «Fabricar»). Haz los agujeros de Ø ${fmt(2 * radioFab(), 2)} mm antes que el contorno.`,
    `Corta ${cm.varillas.length} varillas de Ø ${fmt(P.maqueta.diam, 1)} mm al largo de la tabla de la hoja 2.` + (cm.nSep ? ` Prepara ${cm.nSep} separadores de ${fmt(cm.hueco, 1)} mm (tubito, pajita o arandela de cartón).` : ''),
    `Ensarta las costillas en orden, de la 1 a la ${R.n}, con un separador entre cada dos en cada varilla.`,
    'Comprueba que todas apoyan en la mesa y fija los extremos de las varillas con una gota de cola.',
    'Mira la maqueta desde todos los lados: si algo no gusta, cambia el diseño antes de cortar el mueble real.',
  ] : [
    `Corta las ${R.n} costillas en ${MATERIALES[P.costillas.material].nombre.toLowerCase()} de ${fmt(grosor(), 1)} mm (DXF en «Fabricar»: capas CORTE, TALADROS y GRABADO). Taladra o vacía los agujeros de Ø ${fmt(2 * radioFab(), 1)} mm antes que el contorno.`,
    'Lija los cantos y las caras de cada costilla y comprueba que lleva su número (grabado o a lápiz en una cara que no se vea).',
    `Corta ${cm.varillas.length} varillas a su largo (tabla de la hoja 2).` + (cm.nSep ? ` Corta ${cm.nSep} separadores de ${fmt(cm.hueco, 1)} mm, todos iguales.` : ''),
    V.tipo === 'madera' ? 'Pon la costilla 1 tumbada sobre el banco, pon cola en sus agujeros y mete las espigas.' : V.tipo === 'tubo' ? 'Pon la tapa roscada (embellecedor y tornillo) en un extremo de cada tubo y mete los tubos en la costilla 1, tumbada sobre el banco.' : 'Pon una tuerca y una arandela en un extremo de cada varilla y mete las varillas en la costilla 1, tumbada sobre el banco.',
    V.tipo === 'madera' ? `Encola y mete la costilla siguiente, con un taco de ${fmt(cm.hueco, 1)} mm entre costillas para dejar el hueco igual. Repite en orden hasta la costilla ${R.n} y deja secar.` : `Ensarta un separador en cada varilla y después la costilla siguiente. Repite en orden hasta la costilla ${R.n}.`,
    V.tipo === 'madera' ? 'Enrasa o redondea los extremos de las espigas y lija.' : V.tipo === 'tubo' ? 'Pon la otra tapa roscada en cada tubo y aprieta poco a poco y por igual, alternando los tubos, hasta que no quede holgura.' : 'Pon arandela y tuerca en el otro extremo y aprieta poco a poco y por igual, alternando las varillas, hasta que no quede holgura.',
    'Pon el mueble de pie sobre una superficie plana y comprueba que apoyan todas las costillas que deben llegar al suelo.',
    'Acabado: aceite, cera o barniz. Si va al exterior, usa varilla inoxidable y un acabado para exterior.',
  ];
  let yp = M + 24;
  if (P.tipo === 'pared' && (R.modulosPared || []).length > 1) pasos.splice(Math.max(1, pasos.length - 1), 0,
    `Módulos (hoja 2): el panel va en ${R.modulosPared.length} módulos ${lamasH() ? 'a lo alto' : 'a lo ancho'} (${R.modulosPared.map((m, j) => `M${j + 1}: lamas ${m.desde + 1}–${m.hasta + 1}`).join(', ')}). Monta cada módulo en el taller, con sus trozos de rastrel, y cuélgalos uno junto al otro; el hueco entre módulos es el mismo que entre lamas.`);
  if (P.tipo === 'pared' && partirActivo() && JUNTAS && JUNTAS.bases.length) {
    const Pp = partirP(), mods = Pp.patron === 'alineado' && Pp.rastreles;
    pasos.splice(Math.max(1, pasos.length - 1), 0, `Lamas partidas (${1 + JUNTAS.bases.length} trozos cada una: «a» abajo${lamasH() ? ' (a la izquierda)' : ''}, luego «b»…): ` +
      (mods ? `con las juntas a la misma altura y un rastrel a cada lado, cada banda es un módulo: puedes montarlo en el taller y colgarlo entero.`
            : `coloca primero todos los trozos «a» y luego los demás, comprobando que cada trozo llega a un rastrel.`) +
      (Pp.junta === 'sombra' ? ` Deja la sombra de ${fmt(anchoJunta() * k, 1)} mm con un taco del mismo grueso.` : ` A tope: lija un poco la arista de las testas para que la junta no se marque.`));
  }
  if (huecosActivos().length) pasos.splice(Math.max(1, pasos.length - 1), 0, P.tipo === 'pared'
    ? 'Huecos (hoja 3c): cuelga primero los muebles de los huecos (cajas, armarios, baldas) atornillados a la pared; después pon las lamas de alrededor. Los trozos de lama (12a, 12b…) van en su sitio, cada uno en su rastrel o atornillado por detrás al mueble.'
    : 'Huecos (hoja 3c): monta el forro del túnel (suelo, techo y laterales) a la vez que las costillas, encolado o atornillado; los trozos de costilla (12a, 12b…) van en su sitio en las varillas.');
  pasos.forEach((t, i) => {
    D.relleno(madera).circulo(M + 4, yp - 1.2, 3.2, 'f'); D.relleno([0, 0, 0]);
    D.texto(M + 4, yp + 0.1, String(i + 1), { pt: 9, b: true, al: 'c', col: [255, 255, 255] });
    yp = D.parrafo(M + 11, yp, 170, t, { pt: 10 }) + 3;
  });
  D.texto(M, H - M - 4, 'Herramientas: ' + (esPlano() ? (maq ? 'cortadora láser, lija fina; cola si se quiere fijo.' : 'CNC (o sierra de calar y escoplo), lija, maza de goma; cola si se quiere fijo.') : P.tipo === 'radial' ? (maq ? 'cortadora láser o cúter, cola.' : 'CNC o láser, sierra para el tubo, cola, lija.') : P.tipo === 'pared' ? 'CNC o sierra de calar, taladro, tacos y tornillos, nivel, taco separador.' : ret ? (maq ? 'cortadora láser o cúter, lija fina.' : 'CNC (fresa menor que la ranura), formón o lima, mazo de goma, lija.') : maq ? 'cortadora láser o cúter, cola blanca.' : `CNC o sierra de calar, broca de Ø ${fmt(2 * radioFab(), 1)}, lija, llaves para las tuercas M${V.diam}.`), { pt: 9, col: gris });

  // ---- última hoja: tiempo de mecanizado y presupuesto (o, en la ficha, la rúbrica) ----
  if (F) hojaRubrica(D, cabecera, { M, W, H, gris, azul, madera, F });
  else { const r = calcularPresupuesto(), fl = filasPresupuesto(r).map(f => f.titulo ? f : f.map(t => String(t).replace(/²/g, '2'))), i = fl.findIndex(f => f.titulo && /^Presupuesto/.test(f.titulo));
    cabecera('Tiempo de mecanizado y presupuesto');
    const a = (W - 2 * M - 12) / 2;
    tabla(M, M + 18, a, fl.slice(0, i), { c1: a * 0.55 });
    tabla(M + a + 12, M + 18, a, fl.slice(i), { c1: a * 0.55 });
    D.parrafo(M, H - M - 14, W - 2 * M, `Estimación orientativa con fresa de Ø ${fmt(fresaFab(), 1)} mm, pasadas de ${fmt(r.B.pasada, 1)} mm, avance de ${fmt(r.B.avance)} mm/min y tableros de ${fmt(fabActual().ancho)} × ${fmt(fabActual().alto)} mm. Los datos y los precios se cambian en Fabricar > Tiempo y presupuesto.`, { pt: 8, col: gris });
  }
  // pies de página
  hojas.forEach((p, i) => { D.p = p; D.trazo([200, 200, 200]).grosor(0.2).linea(M, H - 8, W - M, H - 8); D.texto(M, H - 4.5, 'Made-rebanadas', { pt: 7.5, col: gris }); D.texto(W - M, H - 4.5, `Hoja ${i + 1} de ${hojas.length}`, { pt: 7.5, al: 'r', col: gris }); });
  return D.generar();
}
function exportarPlano() {
  if (!R) return;
  try {
    const b = planoPDF();
    descargar(nombreArchivo(P.nombre) + '_plano_montaje' + sufijoFab() + '.pdf', new Blob([b], { type: 'application/pdf' }));
    aviso('Plano de montaje guardado (PDF)');
  } catch (e) { console.error(e); aviso('⚠ No se pudo crear el PDF: ' + esc(e.message), 5000); }
}

// hoja 2 de la retícula: planta con la retícula y alzado de un larguero con las costillas
function hojaReticula(D, cabecera, tabla, o) {
  const { M, W, k, e, gris, azul, madera } = o;
  cabecera('2. La retícula: planta y orden de montaje');
  const cs = R.costillas.filter(c => c.ok), zs = R.largueros.filter(z => z.ok);
  let u0 = Infinity, u1 = -Infinity; cs.forEach(c => { u0 = Math.min(u0, c.caja.x0); u1 = Math.max(u1, c.caja.x1); });
  // planta: X horizontal, fondo (u) hacia abajo, delante abajo
  const zona = { x: M + 10, y: M + 24, w: W - 2 * M - 20, h: 62 };
  const s = Math.min(zona.w / P.largo, zona.h / (u1 - u0)), PX = x => zona.x + x * s, PU = u => zona.y + (u - u0) * s;
  D.texto(zona.x, zona.y - 4, `Planta: ${R.n} costillas (números) y ${zs.length} largueros (letras), vistos desde arriba. Medidas en mm.`, { pt: 8.5, col: gris });
  D.relleno([226, 205, 172]).trazo(madera).grosor(0.15);
  cs.forEach(c => D.rect(PX(c.x - grosor() / 2), PU(c.caja.x0), Math.max(0.3, grosor() * s), (c.caja.x1 - c.caja.x0) * s, 'b'));
  D.relleno([200, 170, 130]);
  zs.forEach(z => D.rect(PX(z.caja.x0), PU(z.u - grosor() / 2), z.caja.w * s, Math.max(0.3, grosor() * s), 'b'));
  D.relleno([0, 0, 0]);
  const paso = Math.max(1, Math.ceil(cs.length / Math.floor(zona.w / 5)));
  cs.forEach((c, i) => { if (i % paso === 0 || i === cs.length - 1) D.texto(PX(c.x), PU(u0) - 1.5, c.etq, { pt: 6.5, al: 'c', col: azul }); });
  const vistos = new Set();
  zs.forEach(z => { if (vistos.has(z.u)) return; vistos.add(z.u); D.texto(PX(P.largo) + 3, PU(z.u) + 1.2, letra(z.j), { pt: 8, b: true, col: azul }); });
  // alzado del primer larguero, con las costillas que lo cruzan
  const z0 = zs.reduce((m, z) => z.ranuras.length > m.ranuras.length ? z : m, zs[0]);
  if (z0) {
    const zona2 = { x: M + 10, y: M + 104, w: 160, h: 66 };
    const s2 = Math.min(zona2.w / z0.caja.w, zona2.h / z0.caja.y1), AX = x => zona2.x + (x - z0.caja.x0) * s2, AY = v => zona2.y + zona2.h - v * s2;
    D.texto(zona2.x, zona2.y - 4, `Larguero ${z0.etq} visto de lado, con las costillas que encajan en él.`, { pt: 8.5, col: gris });
    D.trazo([215, 195, 165]).grosor(0.15);
    cs.forEach(c => D.rect(AX(c.x - grosor() / 2), AY(c.caja.y1), Math.max(0.3, grosor() * s2), (c.caja.y1 - c.caja.y0) * s2));
    D.relleno([240, 228, 208]).trazo(madera).grosor(0.35).poli(simplificaCerrado(z0.poly, 0.1).map(p => [AX(p[0]), AY(p[1])]), true, 'b');
    D.relleno([0, 0, 0]).trazo([150, 150, 150]).grosor(0.3).linea(zona2.x - 3, AY(0), zona2.x + zona2.w + 3, AY(0)).trazo();
  }
  const filas = [{ titulo: 'Largueros (z: distancia desde la parte trasera)' }];
  zs.forEach(z => filas.push([`${z.etq}: z = ${fmt(z.u * k, 1)} mm`, `${fmt(z.caja.w * k)} × ${fmt(z.caja.h * k)} mm · ${z.ranuras.length} ranuras`]));
  filas.push(['Ranuras', `${fmt(grosorFab() + holguraRanuraFab(), 2)} mm de ancho, hasta la mitad del cruce`]);
  filas.push(['Costillas', P.reticula.xArriba !== false ? 'ranuras desde arriba' : 'ranuras desde abajo']);
  filas.push(['Largueros', P.reticula.xArriba !== false ? 'ranuras desde abajo' : 'ranuras desde arriba']);
  tabla(M + 184, M + 98, W - M - (M + 184), filas, { c1: 38 });
}

// hoja 2 de la planta curva: vista desde arriba con el eje, las costillas y las varillas
function hojaCurva(D, cabecera, tabla, o) {
  const { M, W, k, gris, azul, madera, cm } = o;
  cabecera('2. Planta curva: orden de montaje, varillas y separadores');
  const cs = R.costillas.filter(c => c.ok), segs = [];
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  cs.forEach(c => { const m = marcoEn(c.x); const a = puntoMarco(m, c.caja.x0, 0), b = puntoMarco(m, c.caja.x1, 0); segs.push([a, b, c]); [a, b].forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[2]); z1 = Math.max(z1, p[2]); }); });
  const zona = { x: M + 8, y: M + 24, w: W - 2 * M - 16, h: 92 }, s = Math.min(zona.w / (x1 - x0), zona.h / (z1 - z0));
  const PX = x => zona.x + (x - x0) * s + (zona.w - (x1 - x0) * s) / 2, PZ = z => zona.y + (z - z0) * s;
  D.texto(zona.x, zona.y - 4, `Planta (vista desde arriba): ${R.n} costillas perpendiculares a la curva y las varillas, que la siguen.`, { pt: 8.5, col: gris });
  D.trazo(madera).grosor(Math.max(0.25, grosor() * s));
  segs.forEach(([a, b]) => D.linea(PX(a[0]), PZ(a[2]), PX(b[0]), PZ(b[2])));
  D.trazo([80, 88, 98]).grosor(0.45);
  R.varillas.filter(v => v.usada).forEach(v => {
    const pts = []; for (let i = v.a; i <= v.b; i++) { const p = puntoMarco(marcoEn(R.costillas[i].x), v.u, v.v); pts.push([PX(p[0]), PZ(p[2])]); }
    D.poli(pts, false); D.texto(pts[pts.length - 1][0] + 2, pts[pts.length - 1][1] + 1, 'V' + (v.k + 1), { pt: 7.5, b: true });
  });
  D.trazo();
  const paso = Math.max(1, Math.ceil(cs.length / 30));
  segs.forEach(([a, b, c], i) => { if (i % paso === 0 || i === segs.length - 1) D.texto(PX(a[0]), PZ(a[2]) - 1.5, String(c.i + 1), { pt: 6.5, al: 'c', col: azul }); });
  const filas = [{ titulo: 'Varillas y separadores' }];
  R.varillas.filter(v => v.usada).forEach(v => {
    const L = cm.varillas.find(q => q.k === v.k).largo, sp = v.dists.map(d => d * k - grosorFab()).filter(x => x > 0.5);
    filas.push([`V${v.k + 1}: atrás ${fmt(v.u * k, 1)} · suelo ${fmt(v.v * k, 1)} mm`, `largo ${fmt(L)} mm · radio mín. ${fmt(v.radioMin * k)} mm` + (sp.length ? ` · separadores de ${fmt(Math.min(...sp), 1)} a ${fmt(Math.max(...sp), 1)} mm` : '')]);
  });
  const fy = tabla(M, M + 126, W - 2 * M, filas, { c1: 80 });
  // largos de los separadores, costilla a costilla
  if (conSeparadores()) {
    const us = R.varillas.filter(v => v.usada);
    let txt = 'Separadores (entre la costilla n y la n+1, en mm): ';
    us.forEach(v => { txt += `V${v.k + 1}: ` + v.dists.map((d, i) => `${v.a + i + 1}-${v.a + i + 2} ${fmt(d * k - grosorFab(), 1)}`).join(', ') + '. '; });
    D.parrafo(M, fy + 6, W - 2 * M, txt, { pt: 7.5, col: gris });
  }
}
// hoja 2 radial: planta con las costillas alrededor del tubo y perfil con los discos
function hojaRadial(D, cabecera, tabla, o) {
  const { M, W, k, gris, azul, madera } = o;
  cabecera('2. Planta, discos de unión y orden de montaje');
  const cs = R.costillas.filter(c => c.ok), rT = radioTubo(), rmax = Math.max(...cs.map(c => c.caja.x1));
  const cx = M + 52, cy = M + 72, s = 46 / rmax;
  D.texto(M, M + 22, 'Planta: costillas en orden.', { pt: 8.5, col: gris });
  D.trazo([150, 150, 150]).grosor(0.3).circulo(cx, cy, rT * s);
  R.discos.forEach(d => D.trazo([190, 190, 190]).rayas(1).circulo(cx, cy, d.rD * s).rayas(0));
  D.trazo(madera).grosor(Math.max(0.3, grosor() * s));
  cs.forEach(c => { const t = c.x * Math.PI / 180, ca = Math.cos(t), sa = -Math.sin(t); D.linea(cx + ca * c.caja.x0 * s, cy + sa * c.caja.x0 * s, cx + ca * c.caja.x1 * s, cy + sa * c.caja.x1 * s); D.texto(cx + ca * (c.caja.x1 * s + 4), cy + sa * (c.caja.x1 * s + 4) + 1.2, String(c.i + 1), { pt: 7, al: 'c', col: azul }); });
  D.trazo();
  // perfil de la costilla central con los discos
  const c0 = cs[0], zx = M + 125, zy = M + 30, zh = 150, sp = Math.min(70 / (c0.caja.x1), zh / c0.caja.y1);
  const PX = u => zx + u * sp, PY = v => zy + zh - v * sp;
  D.texto(zx + 14, zy - 2, 'Costilla 1 y altura de los discos.', { pt: 8.5, col: gris });
  D.relleno([200, 200, 200]).rect(PX(0), PY(c0.caja.y1 + 10), rT * sp, (c0.caja.y1 + 20) * sp, 'f');
  D.relleno([240, 228, 208]).trazo(madera).grosor(0.35).poli(simplificaCerrado(c0.poly, 0.1).map(p => [PX(p[0]), PY(p[1])]), true, 'b');
  D.relleno([0, 0, 0]).trazo([95, 107, 120]).grosor(0.3);
  R.discos.forEach(d => { D.linea(PX(0), PY(d.v), PX(d.rD) + 6, PY(d.v)); D.texto(PX(d.rD) + 7, PY(d.v) + 1.2, d.etq, { pt: 8, b: true }); });
  D.trazo();
  const filas = [{ titulo: 'Tubo y discos' }, ['Tubo central', `Ø ${fmt(P.radial.tubo * k, 1)} mm · largo ${fmt(o.cm.tubo)} mm`], ['Ángulo entre costillas', `${fmt(R.sep, 2)}°`]];
  R.discos.forEach(d => filas.push([`Disco ${d.etq}`, `a ${fmt(d.v * k)} mm del suelo · Ø ${fmt(2 * d.rD * k)} mm · ${R.n} ranuras`]));
  filas.push(['Muescas y ranuras', `${fmt(grosorFab() + holguraRanuraFab(), 2)} mm de ancho`]);
  tabla(M + 200, M + 24, W - M - (M + 200), filas, { c1: 30 });
}
// hoja 2 de la pared: alzado con las lamas y los rastreles
function hojaPared(D, cabecera, tabla, o) {
  const { M, W, k, gris, azul, madera, cm } = o;
  cabecera('2. Alzado de la pared, rastreles y orden de colocación');
  const cs = R.costillas.filter(c => c.ok), Pa = P.pared, e = grosor(), hor = P.relieve && P.relieve.orient === 'h', tz = (R.trozos || []).filter(t => t.ok);
  // rectángulo de cada lama visto de frente (X, Y del mundo)
  const rect = c => { const m = marcoEn(c.x), a = puntoMarco(m, 0, c.caja.y0), b = puntoMarco(m, 0, c.caja.y1), g = ejeGrosor(m);
    const xs = [a[0], b[0], a[0] + g[0] * e / 2, a[0] - g[0] * e / 2], ys = [a[1], b[1], a[1] + g[1] * e / 2, a[1] - g[1] * e / 2];
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
  const rs = [...cs, ...tz].map(rect), X0 = Math.min(...rs.map(r => r[0])), X1 = Math.max(...rs.map(r => r[2])), Y1 = Math.max(...rs.map(r => r[3]));   // con los trozos (lamas partidas o con huecos)
  // pared más alta que ancha (paredes altas, lamas partidas): el alzado, grande a la izquierda, y la tabla a su derecha
  const altaP = (Y1 + 20) / (X1 - X0 + 80) > 0.75;
  const zona = altaP ? { x: M + 10, y: M + 24, w: (W - 2 * M - 20) * 0.42, h: (D.p ? D.p.h : 210) - 2 * M - 40 } : { x: M + 10, y: M + 24, w: W - 2 * M - 20, h: 100 }, s = Math.min(zona.w / (X1 - X0 + 80), zona.h / (Y1 + 20));
  const PX = x => zona.x + (x - X0 + 40) * s, PY = v => zona.y + zona.h - v * s;
  D.texto(zona.x, zona.y - 4, `Alzado (de frente): ${R.n} lamas ${hor ? 'horizontales' : 'verticales'} numeradas y ${R.rastreles.length} rastreles detrás.`, { pt: 8.5, col: gris });
  D.relleno([205, 179, 138]);
  R.rastreles.forEach(r => (r.tramos || [[cs[0].x - e / 2 - 30, cs[cs.length - 1].x + e / 2 + 30]]).forEach(([xa, xb]) => {
    const a = puntoMarco(marcoEn(xa), 0, r.v), b = puntoMarco(marcoEn(xb), 0, r.v);
    if (hor) D.rect(PX(a[0] - Pa.alto / 2), PY(Math.max(a[1], b[1])), Pa.alto * s, Math.abs(b[1] - a[1]) * s, 'f');
    else D.rect(PX(Math.min(a[0], b[0])), PY(r.v + Pa.alto / 2), Math.abs(b[0] - a[0]) * s, Pa.alto * s, 'f');
  }));
  D.relleno([226, 205, 172]).trazo(madera).grosor(0.15);
  rs.forEach(r => D.rect(PX(r[0]), PY(r[3]), Math.max(0.3, (r[2] - r[0]) * s), Math.max(0.3, (r[3] - r[1]) * s), 'b'));
  // módulos: una raya discontinua entre uno y otro, y su nombre con su medida
  if ((R.modulosPared || []).length > 1) {
    let v0 = Infinity, v1 = -Infinity; [...cs, ...tz].forEach(c => { v0 = Math.min(v0, c.caja.y0); v1 = Math.max(v1, c.caja.y1); });
    const W2 = (pos, v) => { const q = puntoMarco(marcoEn(pos), 0, v); return [PX(q[0]), PY(q[1])]; };
    D.trazo([40, 90, 160]).grosor(0.3).rayas(1.2);
    R.modulosPared.slice(0, -1).forEach(m => { const c = m.corte != null ? m.corte : m.x1, a = W2(c, v0 - 40), b = W2(c, v1 + 40); D.linea(a[0], a[1], b[0], b[1]); });
    D.rayas(0);
    R.modulosPared.forEach((m, j) => { const q = W2((m.x0 + m.x1) / 2, v0 - 60); D.relleno([40, 90, 160]); D.texto(q[0], q[1] + (hor ? 0 : 3), `M${j + 1} · ${fmt(m.ancho * k)}`, { pt: 7, al: 'c', col: [40, 90, 160] }); });
  }
  // huecos: su contorno, en rojo, con su número
  huecosActivos().forEach(h => {
    const pts = formaHueco(h).map(([X, Y]) => { const [x, v] = aXUV(X, Y), q = puntoMarco(marcoEn(x), 0, v); return [PX(q[0]), PY(q[1])]; });
    D.trazo([200, 60, 40]).grosor(0.35).poli(pts, true, 's');
    const cb = cajaHueco(h), [xc, vc] = aXUV(cb.x0 + cb.w / 2, cb.y0 + cb.h / 2), q = puntoMarco(marcoEn(xc), 0, vc);
    D.relleno([200, 60, 40]); D.texto(PX(q[0]), PY(q[1]) + 1.5, 'H' + (P.huecos.indexOf(h) + 1), { pt: 8, al: 'c', col: [200, 60, 40] });
  });
  D.relleno([0, 0, 0]).trazo();
  const paso = Math.max(1, Math.ceil(cs.length / (hor ? 25 : 40)));
  cs.forEach((c, i) => { if (i % paso === 0 || i === cs.length - 1) { const r = rs[i]; if (hor) D.texto(PX(r[0]) - 2, PY((r[1] + r[3]) / 2) + 1.2, String(c.i + 1), { pt: 6.5, al: 'r', col: azul }); else D.texto(PX((r[0] + r[2]) / 2), PY(r[3]) - 1.5, String(c.i + 1), { pt: 6.5, al: 'c', col: azul }); } });
  const filas = [{ titulo: hor ? 'Rastreles (posición de su centro desde la izquierda)' : 'Rastreles (altura de su centro desde abajo)' }];
  R.rastreles.forEach(r => { const ts = (r.tramos || []).map(([a, b]) => fmt((b - a) * k)); filas.push([`Rastrel ${r.j + 1}`, `a ${fmt(r.v * k)} mm · ${fmt(Pa.alto * k, 1)} × ${fmt(Pa.grueso * k, 1)} mm · ` + (ts.length > 1 ? `${ts.length} trozos: ${ts.join(' + ')} mm` : `${ts[0] || fmt(cm.rastrel)} mm`)]); });
  if ((R.modulosPared || []).length > 1) filas.push([`${R.modulosPared.length} módulos ${hor ? 'a lo alto' : 'a lo ancho'}`, R.modulosPared.map((m, j) => `M${j + 1}: lamas ${m.desde + 1}–${m.hasta + 1}, ${fmt(m.ancho * k)} mm`).join(' · ')]);
  filas.push(['Separación entre lamas', `${fmt(cm.sep, 1)} mm entre centros (hueco ${fmt(Math.max(0, cm.hueco), 1)} mm${huecoModulos() && (R.modulosPared || []).length > 1 ? `; entre módulos, ${fmt((Math.max(0, cm.hueco / k) + huecoModulos()) * k, 1)} mm` : ''})`]);
  filas.push(['Medidas del panel', `${(G.dims || [0, 0, 0]).map(v => fmt(v * k)).join(' × ')} mm (ancho × fondo × alto)`]);
  if (relieveActivo()) filas.push(['Relieve', P.relieve.fuente === 'texto' ? `texto «${P.relieve.texto.replace(/\n/g, ' / ')}»` : `modelo ${P.relieve.modelo ? P.relieve.modelo.nombre : ''}`]);
  if (altaP) { const tx = zona.x + Math.min(zona.w, (X1 - X0 + 80) * s) + 14; tabla(tx, M + 24, W - M - tx, filas, { c1: 34 }); }
  else tabla(M, M + 134, W - 2 * M, filas, { c1: 70, alto: filas.length > 6 ? 4.3 : 5.2 });
}

// piezas planas: hoja 2 con el despiece explosionado, la lista de piezas y las uniones
function hojaPlano(D, cabecera, tabla, o) {
  const { M, W, H, k, gris, azul } = o;
  cabecera('2. Piezas y uniones');
  const cap = captura3D(0.6), iw = 130, ih = Math.min(150, iw * cap.h / cap.w);
  D.imagen(cap.bin, cap.w, cap.h, M, M + 18, iw, ih);
  D.trazo([210, 210, 210]).grosor(0.2).rect(M, M + 18, iw, ih).trazo();
  D.texto(M, M + 22 + ih, 'Las piezas separadas (explosión) para ver cómo encajan.', { pt: 8, col: gris });
  const x2 = M + iw + 8, a2 = W - M - x2;
  const filas = [{ titulo: 'Piezas (posición: el centro del tablero; x desde el centro, y desde el suelo, z desde el centro)' }];
  R.costillas.forEach(c => { if (!c.ok) return; const g = geoFab(c); filas.push([`${c.etq} · ${c.nombre}`, `${fmt(g.caja.w)} × ${fmt(g.caja.h)} mm · ${PLANOS[c.plano].nombre.toLowerCase()}, ${PLANOS[c.plano].normal} = ${fmt(c.x * k)}`]); });
  let y = tabla(x2, M + 18, a2, filas, { c1: a2 * 0.45, alto: 4.6 });
  const nom = i => R.costillas[i].etq + ' ' + R.costillas[i].nombre;
  const fU = [{ titulo: 'Uniones' }];
  R.uniones.forEach(u => {
    if (u.tipo === 'dentada') { fU.push([`${nom(u.a)} + ${nom(u.b)}`, u.esquina ? `esquina dentada de ${u.dientes} dientes` : `${(u.dientes - 1) / 2} espigas de ${nom(u.pasa)} en cajas de ${nom(u.en)}`]); return; }
    if (u.tipo === 'solape') { const So = solapeP(), lt = largoTaco(grosorFab()); fU.push([`${nom(u.a)} + ${nom(u.b)}`, So.tipo === 'tornillos' ? `solapadas: ${u.puntos.length} tornillos Ø ${fmt(So.diam, 1)} desde la ${R.costillas[u.fuera].etq}` : `solapadas: ${u.puntos.length} tacos Ø ${fmt(So.diam, 1)} × ${fmt(lt.largo)} mm`]); return; }
    if (u.tipo === 'herraje') { fU.push([`${nom(u.pasa)} a tope en ${nom(u.en)}`, `${u.puntos.length} × ${NOMBRE_HERRAJE[u.herraje]}`]); return; }
    if (u.tipo === 'caja') fU.push([`${nom(u.pasa)} en ${nom(u.en)}`, `espiga en caja de ${fmt((u.hi - u.lo + holguraRanuraFab()) * k, 1)} × ${fmt(grosorFab() + holguraRanuraFab(), 2)} mm`]);
    else { const arriba = u.aArriba ? u.a : u.b, abajo = u.aArriba ? u.b : u.a; fU.push([`${nom(arriba)} × ${nom(abajo)}`, `media madera de ${fmt((u.hi - u.lo) / 2 * k, 1)} mm (la ${R.costillas[arriba].etq} desde arriba)`]); }
  });
  let y2 = y + 6, x3 = x2, a3 = a2;
  if (y2 + fU.length * 5.2 > H - M - 12) { cabecera('2b. Uniones'); y2 = M + 20; x3 = M; a3 = W - 2 * M; }
  tabla(x3, y2, a3, fU, { c1: a3 * 0.45, alto: 4.6 });
}
// pasos de montaje de las piezas planas, por tipo de unión
function pasosPlano(k, maq) {
  const nom = i => `${R.costillas[i].nombre} (${R.costillas[i].etq})`, lista2 = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' y ' + a[a.length - 1] : a[0] || '';
  const w = fmt(grosorFab() + holguraRanuraFab(), 2), tabla2 = maq ? `tablero de ${fmt(P.maqueta.grosor, 1)} mm` : `${MATERIALES[P.costillas.material].nombre.toLowerCase()} de ${fmt(grosor(), 1)} mm`;
  const pasos = [
    `Corta las ${R.n} piezas en ${tabla2} (DXF o SVG en «Fabricar»; hojas 3 y 4). Las ranuras y las cajas son de ${w} mm: prueba antes una en un retal; tiene que entrar a mano, con un poco de roce.`,
    'Lija los cantos (sin redondear los de las ranuras y las espigas) y marca cada pieza con su número en una cara que no se vea.',
  ];
  const horiz = i => R.costillas[i].plano === 'horizontal';
  // 0) piezas solapadas: se unen antes que nada (cada lateral de dos capas es un subconjunto)
  const So = solapeP(), lt = largoTaco(grosorFab());
  R.uniones.filter(u => u.tipo === 'solape' && u.puntos.length).forEach(u => pasos.push(So.tipo === 'tornillos'
    ? `Une ${nom(u.a)} y ${nom(u.b)} cara con cara, en su sitio (las zonas grises de la hoja 3): ${u.puntos.length} tornillos de Ø ${fmt(So.diam, 1)} desde ${nom(u.fuera)}, por sus agujeros avellanados; la otra lleva un agujero guía. Un poco de cola entre las dos caras lo deja más firme.`
    : `Une ${nom(u.a)} y ${nom(u.b)} cara con cara: taladra los ${u.puntos.length} agujeros de Ø ${fmt(So.diam, 1)} a ${fmt(lt.prof)} mm de profundidad en las dos piezas (marcados en el DXF, capa de taladros; usa un tope en la broca), encola, mete los tacos de ${fmt(lt.largo)} mm y aprieta con sargentos hasta que seque.`));
  // 1) travesaños y espigas que pasan por cajas de piezas no horizontales
  const pasan = {}; R.uniones.filter(u => u.tipo === 'caja' && !horiz(u.en)).forEach(u => { (pasan[u.pasa] = pasan[u.pasa] || []).push(u.en); });
  Object.entries(pasan).forEach(([p, en]) => pasos.push(`Pasa ${nom(+p)} por ${en.length > 1 ? 'las cajas de' : 'la caja de'} ${lista2([...new Set(en)].map(nom))}.`));
  // cantos con espigas en T y esquinas dentadas
  const enT = {}; R.uniones.filter(u => u.tipo === 'dentada' && !u.esquina).forEach(u => { (enT[u.pasa] = enT[u.pasa] || []).push(u.en); });
  Object.entries(enT).forEach(([p, en]) => pasos.push(`Mete las espigas de ${nom(+p)} en las cajas de ${lista2([...new Set(en)].map(nom))}. Si va entre dos piezas, presenta las dos a la vez y cierra apretando con sargentos.`));
  const esq = R.uniones.filter(u => u.tipo === 'dentada' && u.esquina);
  if (esq.length) pasos.push(`Esquinas dentadas: ${lista2(esq.map(u => `${R.costillas[u.a].etq} con ${R.costillas[u.b].etq}`))}. Encaja los dientes de cada esquina (con cola, si se quiere fijo) y aprieta con un sargento; los de una pieza entran en los huecos de la otra.`);
  // uniones a tope con herraje desmontable
  const hj = R.uniones.filter(u => u.tipo === 'herraje');
  if (hj.length) {
    const D = hj[0].datos, ex = hj[0].herraje === 'excentrica', Tb = datosTubillon(grosor()), nTub = hj.reduce((s, u) => s + (u.tubillones || []).length, 0);
    const volt = R.costillas.filter(c => c.ok && !c.cuna && geoFab(c).volteada).map(c => c.etq);
    const tub = nTub ? ` Los ${nTub} tubillones de Ø 8 × ${Tb.largo} mm llevan un taladro ciego de ${fmt(Tb.prof)} mm en la cara (en el DXF) y otro de ${fmt(Tb.largo - Tb.prof + 2)} mm en el canto (a mano).` : '';
    const caras = ` Los taladros ciegos van por la cara que no se ve (debajo de tapas y baldas, por dentro en las demás); ${volt.length ? `por eso las piezas ${lista2(volt)} salen en espejo en el DXF: se cortan con esa cara hacia arriba.` : 'en el DXF ya salen hacia arriba.'}`;
    pasos.splice(2, 0, (ex
      ? `Taladros de las excéntricas: ciego de Ø 15 y ${fmt(D.profC, 1)} mm en las piezas que llegan a tope, a ${fmt(D.dB)} mm del canto, y ciego de Ø 5 y ${fmt(D.profP)} mm para los pernos en la otra pieza. Después, a mano y con una guía, el taladro de Ø 8 en el canto hasta la excéntrica (raya de la capa CANTO).`
      : `Taladros de los pernos: Ø 7 pasante en la pieza que recibe y ${D.ciego ? `ciego de Ø 10 y ${fmt(D.profC)} mm` : 'pasante de Ø 10'} para la tuerca de barril a ${fmt(D.dB)} mm del canto en la que llega a tope. Después, a mano y con una guía, el taladro de Ø 7 en el canto, de ${fmt(D.profCanto)} mm, hasta el de la tuerca (raya de la capa CANTO).`) + tub + caras);
    const porP = {}; hj.forEach(u => { (porP[u.en] = porP[u.en] || []).push(u); });
    Object.entries(porP).forEach(([en, us]) => pasos.push(ex
      ? `${nom(+en)}: rosca sus ${us.reduce((s, u) => s + u.puntos.length, 0)} pernos en los taladros de Ø 5${nTub ? ' y encola los tubillones en sus taladros' : ''}. Presenta ${lista2([...new Set(us.map(u => nom(u.pasa)))])} a tope (los pernos entran por el canto), mete las excéntricas con la flecha hacia el canto y gíralas con el destornillador hasta que aprieten.`
      : `Une ${lista2([...new Set(us.map(u => nom(u.pasa)))])} a ${nom(+en)}${nTub ? ' (con los tubillones encolados en ' + R.costillas[+en].etq + ')' : ''}: mete las tuercas de barril en sus taladros (con la ranura hacia el canto), pasa los pernos M6 de ${fmt(D.L)} mm desde fuera de ${R.costillas[+en].etq} y rosca con la llave Allen, sin apretar del todo hasta tener todas puestas.`));
  }
  // cuñas de las espigas que asoman
  const cun = R.costillas.filter(c => c.cuna);
  if (cun.length) pasos.push(`Mete las cuñas (${lista2(cun.map(c => c.etq))}) en los agujeros de las espigas que asoman${cun.length > 1 ? '' : ''}: por el lado ancho hacia fuera, y golpéalas con la maza hasta que la unión quede apretada. Para desmontar, sácalas golpeando por el lado estrecho.`);
  // 2) medias maderas: la pieza con la ranura desde abajo baja sobre las que la tienen desde arriba
  const baja = {}; R.uniones.filter(u => u.tipo === 'media').forEach(u => { const ar = u.aArriba ? u.a : u.b, ab = u.aArriba ? u.b : u.a; (baja[ab] = baja[ab] || []).push(ar); });
  const ord = Object.keys(baja).map(Number).sort((a, b) => (R.costillas[a].caja.y0 || 0) - (R.costillas[b].caja.y0 || 0));
  if (ord.length > 4) pasos.push(`Encaja a media madera, de abajo arriba: ${lista2(ord.map(i => `${nom(i)} sobre ${lista2([...new Set(baja[i])].map(j => R.costillas[j].etq))}`))}. Cada pieza baja con su ranura (la de abajo) sobre la ranura de arriba de la otra; si cuesta, da golpes suaves con una maza de goma y un taco.`);
  else ord.forEach(i => pasos.push(`Baja ${nom(i)} sobre ${lista2([...new Set(baja[i])].map(nom))}: sus ranuras a media madera encajan una en la otra hasta quedar enrasadas.`));
  // 3) tableros horizontales (asientos, tapas, baldas) sobre sus espigas
  const tapas = {}; R.uniones.filter(u => u.tipo === 'caja' && horiz(u.en)).forEach(u => { (tapas[u.en] = tapas[u.en] || []).push(u.pasa); });
  Object.entries(tapas).forEach(([t, de]) => pasos.push(`Pon ${nom(+t)} encima: las espigas de ${lista2([...new Set(de)].map(nom))} entran por sus cajas. Presiona por igual por todos los lados.`));
  if (hj.length) pasos.push('Aprieta todos los herrajes por igual, comprobando la escuadra con las diagonales (tienen que medir lo mismo). Se desmonta aflojándolos.');
  pasos.push('Comprueba que el mueble queda a escuadra y apoya bien. Si se quiere fijo, desmonta, pon cola en las uniones y vuelve a montar (o fija las espigas con una cuña).');
  pasos.push(maq ? 'Mira la maqueta desde todos los lados antes de cortar el mueble real.' : 'Acabado: aceite, cera o barniz (mejor antes de montar, para llegar a todas las caras).');
  return pasos;
}

/* ---------- vistas acotadas (sistema europeo): alzado, planta y perfil izquierdo ----------
   Se dibujan desde el 3D con cámara ortográfica: piezas en blanco y sus aristas en negro (las ocultas no se ven).
   Escala normalizada (1:1, 1:2, 1:5, 1:10, 1:20, 1:25, 1:50, 1:100) y cotas generales y parciales. */
const VISTAS_ORTO = {
  alzado: { R: [1, 0, 0], U: [0, 1, 0], B: [0, 0, 1] },
  planta: { R: [1, 0, 0], U: [0, 0, -1], B: [0, 1, 0] },
  perfil: { R: [0, 0, 1], U: [0, 1, 0], B: [-1, 0, 0] },
};
function mallasVista() {
  const ms = [];
  G.modelo.updateMatrixWorld(true);
  G.modelo.traverse(o => { if (o.isMesh && o.visible && o.userData.extra !== 'pared' && o !== G.fantasma) ms.push(o); });
  return ms;
}
function cajaModelo3D() {
  const b = new T.Box3(); mallasVista().forEach(m => b.expandByObject(m));
  return b;
}
function capturaOrto(vista, sK, pxmm) {
  if (G.montaje) pararMontaje();
  const r = G.renderer, pr = r.getPixelRatio(), fondo = G.scene.background, ex = P.vista.explosion, res = P.vista.resalta, fan = P.vista.fantasma;
  P.vista.explosion = 0; P.vista.resalta = false; P.vista.fantasma = false; colocarExplosion(); resaltar3D(); construirFantasma();
  const ms = mallasVista(), V = VISTAS_ORTO[vista], box = new T.Box3(); ms.forEach(m => box.expandByObject(m));
  const ocultos = []; G.modelo.children.forEach(o => { if (o.visible && !ms.includes(o) && !o.isGroup) { o.visible = false; ocultos.push(o); } });
  [G.suelo, G.rejilla].forEach(o => { if (o && o.visible) { o.visible = false; ocultos.push(o); } });
  const blanco = new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }), negro = new T.LineBasicMaterial({ color: 0x111111 });
  const mats = ms.map(m => m.material), lineas = ms.map(m => { const l = new T.LineSegments(new T.EdgesGeometry(m.geometry, 25), negro); m.add(l); return l; });
  ms.forEach(m => { m.material = blanco; });
  const dot = (p, d) => p.x * d[0] + p.y * d[1] + p.z * d[2];
  const cs = []; for (let i = 0; i < 8; i++) cs.push(new T.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z));
  const us = cs.map(p => dot(p, V.R)), vs = cs.map(p => dot(p, V.U)), u0 = Math.min(...us), u1 = Math.max(...us), v0 = Math.min(...vs), v1 = Math.max(...vs);
  const pad = Math.max(u1 - u0, v1 - v0) * 0.01 + 1, c = box.getCenter(new T.Vector3()), cu = dot(c, V.R), cv = dot(c, V.U), dist = box.getSize(new T.Vector3()).length() + 100;
  const cam = new T.OrthographicCamera(u0 - pad - cu, u1 + pad - cu, v1 + pad - cv, v0 - pad - cv, 1, dist * 2 + 10);
  cam.position.set(c.x + V.B[0] * dist, c.y + V.B[1] * dist, c.z + V.B[2] * dist); cam.up.set(V.U[0], V.U[1], V.U[2]); cam.lookAt(c); cam.updateProjectionMatrix();
  const wpx = Math.round(clamp((u1 - u0 + 2 * pad) * sK * pxmm, 50, 3000)), hpx = Math.round(clamp((v1 - v0 + 2 * pad) * sK * pxmm, 50, 3000));
  G.scene.background = new T.Color('#ffffff');
  r.setPixelRatio(1); r.setSize(wpx, hpx, false); r.render(G.scene, cam);
  const url = r.domElement.toDataURL('image/jpeg', 0.92);
  // deja todo como estaba
  ms.forEach((m, i) => { m.material = mats[i]; m.remove(lineas[i]); lineas[i].geometry.dispose(); });
  blanco.dispose(); negro.dispose(); ocultos.forEach(o => { o.visible = true; });
  G.scene.background = fondo; P.vista.explosion = ex; P.vista.resalta = res; P.vista.fantasma = fan;
  r.setPixelRatio(pr); ajustar3D(); colocarExplosion(); resaltar3D(); construirFantasma(); pedirRender();
  return { bin: atob(url.split(',')[1]), w: wpx, h: hpx, u0: u0 - pad, u1: u1 + pad, v0: v0 - pad, v1: v1 + pad };
}
// una cota: de p1 a p2 (en el papel), con la línea de cota desplazada «off» mm hacia fuera (eje 'h' o 'v')
function cotaPDF(D, eje, a, b, ref, pos, txt, o = {}) {
  const col = o.col || [31, 79, 138], fl = 1.8, an = 0.55;
  if (Math.abs(b - a) < 0.3) return;
  D.trazo(col).relleno(col).grosor(0.15);
  if (eje === 'h') {
    const s = pos < ref ? -1 : 1;
    D.linea(a, ref + s * 1, a, pos + s * 1.5).linea(b, ref + s * 1, b, pos + s * 1.5).linea(a, pos, b, pos);
    const dirF = b - a > 2 * fl + 1 ? 1 : -1;   // flechas por dentro o, si no caben, por fuera
    D.poli([[a, pos], [a + dirF * fl, pos - an], [a + dirF * fl, pos + an]], true, 'f').poli([[b, pos], [b - dirF * fl, pos - an], [b - dirF * fl, pos + an]], true, 'f');
    D.texto((a + b) / 2, pos - 1, txt, { pt: o.pt || 7, al: 'c', col });
  } else {
    const s = pos < ref ? -1 : 1;
    D.linea(ref + s * 1, a, pos + s * 1.5, a).linea(ref + s * 1, b, pos + s * 1.5, b).linea(pos, a, pos, b);
    const dirF = Math.abs(b - a) > 2 * fl + 1 ? 1 : -1, sg = b > a ? 1 : -1;
    D.poli([[pos, a], [pos - an, a + sg * dirF * fl], [pos + an, a + sg * dirF * fl]], true, 'f').poli([[pos, b], [pos - an, b - sg * dirF * fl], [pos + an, b - sg * dirF * fl]], true, 'f');
    D.texto(pos + (s < 0 ? -1 : 1), (a + b) / 2 + 1.1, txt, { pt: o.pt || 7, al: s < 0 ? 'r' : 'l', col });
  }
  D.trazo([0, 0, 0]).relleno([0, 0, 0]);
}
// cotas parciales: valores únicos ordenados entre min y max, sin tramos de menos de «minimo»
const cadenaCotas = (vals, mn, mx, minimo) => { const v = [mn, ...vals.filter(x => x > mn + minimo && x < mx - minimo), mx].sort((a, b) => a - b); const r = [v[0]]; v.slice(1).forEach((x, i) => { if (i === v.length - 2) { if (x - r[r.length - 1] < minimo && r.length > 1) r.pop(); r.push(x); } else if (x - r[r.length - 1] >= minimo) r.push(x); }); return r; };
function hojaVistas(D, cabecera, o) {
  const { M, W, H, k, gris, azul } = o, box = cajaModelo3D();
  if (box.isEmpty()) return;
  const X0 = box.min.x, X1 = box.max.x, Y0 = box.min.y, Y1 = box.max.y, Z0 = box.min.z, Z1 = box.max.z;
  const lx = (X1 - X0) * k, ly = (Y1 - Y0) * k, lz = (Z1 - Z0) * k;
  const AW = W - 2 * M - 46, AH = H - (M + 26) - M - 34;   // sitio para las tres vistas, quitando el de las cotas
  const escalas = [1, 2, 5, 10, 20, 25, 50, 100, 200];
  const N = escalas.find(n => (lx + lz) / n <= AW && (ly + lz) / n <= AH) || 200, sO = 1 / N, sK = k * sO;
  cabecera('1b. Vistas acotadas');
  D.texto(M, M + 19.5, `Escala 1:${N} · sistema europeo (el perfil izquierdo va a la derecha del alzado y la planta, debajo) · medidas en mm${enMaqueta() ? ' de la maqueta' : ''}`, { pt: 8.5, col: gris });
  // posiciones de las vistas en el papel
  const gx = 30, gy = 26, ancho = (X1 - X0) * sK, alto = (Y1 - Y0) * sK, fondo = (Z1 - Z0) * sK;
  const totW = ancho + gx + fondo, totH = alto + gy + fondo;
  const xA = M + 16 + Math.max(0, (W - 2 * M - 46 - totW) / 2), yA = M + 34 + Math.max(0, (H - (M + 26) - M - 34 - totH) / 2);
  const xL = xA + ancho + gx, yP = yA + alto + gy;
  const poner = (vista, x, y) => {
    const c = capturaOrto(vista, sK, 10);
    // la imagen cubre [u0, u1] × [v0, v1]; el punto (u = mín. del modelo, v = máx.) cae en (x, y)
    const umin = vista === 'perfil' ? Z0 : X0, vmax = vista === 'planta' ? -Z0 : Y1;
    D.imagen(c.bin, c.w, c.h, x - (umin - c.u0) * sK, y - (c.v1 - vmax) * sK, (c.u1 - c.u0) * sK, (c.v1 - c.v0) * sK);
  };
  poner('alzado', xA, yA); poner('perfil', xL, yA); poner('planta', xA, yP);
  const tit = (x, y, t) => D.texto(x, y, t, { pt: 8, b: true, col: gris });
  tit(xA, yA + alto + 6.5, 'ALZADO'); tit(xL, yA + alto + 6.5, 'PERFIL IZQUIERDO'); tit(xA + ancho + 8, yP + fondo / 2 + 1, 'PLANTA');
  const f = v => fmt(v * k);
  // posiciones en el papel
  const AX = x => xA + (x - X0) * sK, AY = y => yA + (Y1 - y) * sK, LX = z => xL + (z - Z0) * sK, PY = z => yP + (z - Z0) * sK;
  // cotas generales
  cotaPDF(D, 'h', AX(X0), AX(X1), yA, yA - 7, f(X1 - X0));
  cotaPDF(D, 'v', AY(Y1), AY(Y0), xA, xA - 8, f(Y1 - Y0));
  cotaPDF(D, 'h', LX(Z0), LX(Z1), yA, yA - 7, f(Z1 - Z0));
  cotaPDF(D, 'v', PY(Z0), PY(Z1), xA, xA - 8, f(Z1 - Z0));
  // cotas parciales: alturas de los tableros horizontales (perfil), laterales (planta)
  const e = grosor(), hz = [], lados = []; let aEjes = false;
  void e;
  if (esPlano()) mallasVista().forEach(m => {   // medidas tomadas del propio 3D (ya colocado y centrado)
    const c = m.userData.i != null && R.costillas[m.userData.i]; if (!c || !c.ok || c.giro || c.cuna) return;
    const bb = new T.Box3().setFromObject(m);
    if (c.plano === 'horizontal') hz.push(bb.max.y); if (c.plano === 'lado') { if (bb.max.x - bb.min.x >= Math.max(6, 3 / sK)) lados.push(bb.min.x, bb.max.x); else { lados.push((bb.min.x + bb.max.x) / 2); aEjes = true; } }
  });
  const cadY = cadenaCotas(hz, Y0, Y1, Math.max(8, 4 / sK));
  if (cadY.length > 2) for (let i = 1; i < cadY.length; i++) cotaPDF(D, 'v', AY(cadY[i]), AY(cadY[i - 1]), xL + fondo, xL + fondo + 7, f(cadY[i] - cadY[i - 1]));
  cotaPDF(D, 'v', AY(Y1), AY(Y0), xL + fondo, xL + fondo + (cadY.length > 2 ? 17 : 7), f(Y1 - Y0));
  const cadX = cadenaCotas(lados, X0, X1, Math.max(6, 3 / sK));
  if (cadX.length > 2 && cadX.length <= 10) for (let i = 1; i < cadX.length; i++) cotaPDF(D, 'h', AX(cadX[i - 1]), AX(cadX[i]), yP + fondo, yP + fondo + 7, f(cadX[i] - cadX[i - 1]));
  cotaPDF(D, 'h', AX(X0), AX(X1), yP + fondo, yP + fondo + (cadX.length > 2 && cadX.length <= 10 ? 15 : 7), f(X1 - X0));
  if (aEjes && cadX.length > 2 && cadX.length <= 10) D.texto(xA + ancho + 4, yP + fondo + 8, 'a ejes de las piezas', { pt: 6.5, col: gris });
  // cuadro de datos
  D.texto(W - M, H - M - 6, `${P.nombre} · ${fmt(lx)} × ${fmt(lz)} × ${fmt(ly)} mm (ancho × fondo × alto)`, { pt: 8, al: 'r', col: azul });
}
