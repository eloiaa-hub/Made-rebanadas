
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
function captura3D() {
  const cam = G.cam.position.clone(), tgt = G.ctl.target.clone(), fondo = G.scene.background, ex = P.vista.explosion, res = P.vista.resalta, fan = P.vista.fantasma;
  const r = G.renderer, pr = r.getPixelRatio();
  P.vista.explosion = 0; P.vista.resalta = false; P.vista.fantasma = false;
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

function planoPDF() {
  const ret = P.tipo === 'reticula', D = new PDFDoc(), k = escalaFab(), W = 297, H = 210, M = 12, maq = enMaqueta();
  const e = grosorFab(), cm = calcularCompraFab(), V = P.varillas, fecha = new Date().toLocaleDateString('es-ES');
  const gris = [110, 116, 125], azul = [31, 79, 138], madera = [168, 116, 63], rojo = [192, 57, 43];
  const hojas = [];
  const cabecera = titulo => {
    D.pagina(W, H); hojas.push(D.p);
    D.texto(M, M + 4, P.nombre, { pt: 14, b: true });
    D.texto(W - M, M + 4, 'Plano de montaje · ' + (maq ? 'maqueta 1:' + P.maqueta.escala : 'medidas en mm') + ' · ' + fecha, { pt: 9, al: 'r', col: gris });
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

  // ---- hoja 1: conjunto, datos y compra ----
  cabecera('1. Conjunto, datos y lista de compra');
  const cap = captura3D(), iw = 165, ih = Math.min(150, iw * cap.h / cap.w);
  D.imagen(cap.bin, cap.w, cap.h, M, M + 18, iw, ih);
  D.trazo([210, 210, 210]).grosor(0.2).rect(M, M + 18, iw, ih).trazo();
  const fondo = (G.fondo || 0), alto = (G.alto || 0), x2 = M + iw + 8, a2 = W - M - x2;
  let y = tabla(x2, M + 18, a2, [
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
  if (ret) hojaReticula(D, cabecera, tabla, oH);
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
  const mw = Math.max(...cs.map(c => c.caja.w)), mh = Math.max(...cs.map(c => c.caja.h));
  const s3 = Math.min((cw - 10) / mw, (ch - 16) / mh);
  for (let h0 = 0; h0 < cs.length; h0 += porHoja) {
    cabecera(`3. ${P.tipo === 'pared' ? 'Lamas' : 'Costillas'} ${cs[h0].i + 1} a ${cs[Math.min(cs.length, h0 + porHoja) - 1].i + 1} (todas a la misma escala, 1:${fmt(k / s3, 0)} aprox.)`);
    cs.slice(h0, h0 + porHoja).forEach((c, j) => {
      const g = geoFab(c), cx = M + (j % cols) * cw, cy = M + 18 + Math.floor(j / cols) * ch;
      D.trazo([225, 225, 225]).grosor(0.2).rect(cx + 1, cy + 1, cw - 2, ch - 2);
      const ox = cx + (cw - c.caja.w * s3) / 2, oy = cy + ch - 9;
      const PX = u => ox + (u - c.caja.x0) * s3, PY = v => oy - (v - c.caja.y0) * s3;
      D.relleno([240, 228, 208]).trazo(madera).grosor(0.35).poli(simplificaCerrado(c.poly, 0.05).map(p => [PX(p[0]), PY(p[1])]), true, 'b');
      D.relleno([255, 255, 255]).trazo(rojo).grosor(0.25);
      c.agujeros.forEach(j2 => D.circulo(PX(V.lista[j2][0]), PY(V.lista[j2][1]), Math.max(0.6, radioAgujero() * s3), 'b'));
      D.relleno([0, 0, 0]).trazo();
      const et = puntoEtiqueta(c);
      D.texto(PX(et[0]), PY(et[1]) + 2.2, c.etq, { pt: 14, b: true, al: 'c', col: azul });
      D.texto(cx + 3, cy + 6, `${P.tipo === 'pared' ? 'Lama' : 'Costilla'} ${c.i + 1}`, { pt: 9, b: true });
      D.texto(cx + cw - 3, cy + 6, `${fmt(g.caja.w, maq ? 1 : 0)} × ${fmt(g.caja.h, maq ? 1 : 0)} mm`, { pt: 8.5, al: 'r', col: gris });
      D.texto(cx + 3, cy + ch - 3.5, (P.tipo === 'radial' ? `a ${fmt(c.x, 1)}° · ` : `x = ${fmt(c.x * k)} mm · `) + (ret ? `${c.ranuras.length} ranuras` : P.tipo === 'radial' || P.tipo === 'pared' ? `${c.ranuras.length} muescas` : `${c.agujeros.length} agujeros`), { pt: 7.5, col: gris });
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

  // ---- tableros ----
  const f = fabActual(), col = colocarEnTableros(f);
  if (f.modo !== 'fila' && col.tableros.length) {
    const porH = 4;
    for (let t0 = 0; t0 < col.tableros.length; t0 += porH) {
      cabecera(`4. Corte: tableros de ${fmt(f.ancho)} × ${fmt(f.alto)} mm (${col.tableros.length} en total, aprovechamiento ${fmt(col.uso * 100)} %)`);
      const tw = (W - 2 * M - 10) / 2, th = (H - 2 * M - 30) / 2, s4 = Math.min(tw / f.ancho, (th - 6) / f.alto);
      col.tableros.slice(t0, t0 + porH).forEach((t, j) => {
        const bx = M + (j % 2) * (tw + 10), by = M + 24 + Math.floor(j / 2) * (th + 4);
        const BX = x => bx + x * s4, BY = yv => by + 5 + (f.alto - yv) * s4;
        D.texto(bx, by + 2.5, `Tablero ${t0 + j + 1}: ${t.piezas.length} piezas`, { pt: 8.5, b: true });
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
  const pasos = P.tipo === 'radial' ? [
    `Corta las ${R.n} costillas y los ${R.discos.length} discos en ${tabla2}. Las muescas y ranuras son de ${fmt(grosorFab() + holguraRanuraFab(), 2)} mm: prueba antes una en un retal.`,
    `Corta el tubo central de Ø ${fmt(P.radial.tubo * k, 1)} mm a ${fmt(cm.tubo)} mm.` + (maq ? '' : ' Si es una lámpara, pasa antes el cable por dentro.'),
    'Mete los discos en el tubo a su altura (hoja 2) y fíjalos con una gota de cola, con las ranuras de los dos discos alineadas.',
    `Encaja las costillas de una en una, en orden (1 a ${R.n}): cada una entra de lado en las ranuras de los discos y su muesca abraza el disco.`,
    'Comprueba que todas quedan a su ángulo y a la misma altura; encola si se quiere fijo.',
    maq ? 'Mira la maqueta desde todos los lados antes de cortar la pieza real.' : 'Acabado y, si es lámpara, usa una bombilla LED (no calienta) y un florón para colgarla.',
  ] : P.tipo === 'pared' ? [
    `Corta las ${R.n} lamas en ${tabla2}${R.rastreles.length ? `, con sus muescas de ${fmt((P.pared.alto + P.pared.holgura) * k, 1)} × ${fmt(P.pared.grueso * k, 1)} mm detrás` : ''}.`,
    R.rastreles.length ? `Corta ${R.rastreles.length} rastreles de ${fmt(P.pared.alto * k, 1)} × ${fmt(P.pared.grueso * k, 1)} mm a ${fmt(cm.rastrel)} mm.` : 'Prepara el tablero trasero (o las escuadras) donde irán las lamas.',
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
  pasos.forEach((t, i) => {
    D.relleno(madera).circulo(M + 4, yp - 1.2, 3.2, 'f'); D.relleno([0, 0, 0]);
    D.texto(M + 4, yp + 0.1, String(i + 1), { pt: 9, b: true, al: 'c', col: [255, 255, 255] });
    yp = D.parrafo(M + 11, yp, 170, t, { pt: 10 }) + 3;
  });
  D.texto(M, H - M - 4, 'Herramientas: ' + (P.tipo === 'radial' ? (maq ? 'cortadora láser o cúter, cola.' : 'CNC o láser, sierra para el tubo, cola, lija.') : P.tipo === 'pared' ? 'CNC o sierra de calar, taladro, tacos y tornillos, nivel, taco separador.' : ret ? (maq ? 'cortadora láser o cúter, lija fina.' : 'CNC (fresa menor que la ranura), formón o lima, mazo de goma, lija.') : maq ? 'cortadora láser o cúter, cola blanca.' : `CNC o sierra de calar, broca de Ø ${fmt(2 * radioFab(), 1)}, lija, llaves para las tuercas M${V.diam}.`), { pt: 9, col: gris });

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
  const cs = R.costillas.filter(c => c.ok), Pa = P.pared, e = grosor(), hor = P.relieve && P.relieve.orient === 'h';
  // rectángulo de cada lama visto de frente (X, Y del mundo)
  const rect = c => { const m = marcoEn(c.x), a = puntoMarco(m, 0, c.caja.y0), b = puntoMarco(m, 0, c.caja.y1), g = ejeGrosor(m);
    const xs = [a[0], b[0], a[0] + g[0] * e / 2, a[0] - g[0] * e / 2], ys = [a[1], b[1], a[1] + g[1] * e / 2, a[1] - g[1] * e / 2];
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
  const rs = cs.map(rect), X0 = Math.min(...rs.map(r => r[0])), X1 = Math.max(...rs.map(r => r[2])), Y1 = Math.max(...rs.map(r => r[3]));
  const zona = { x: M + 10, y: M + 24, w: W - 2 * M - 20, h: 100 }, s = Math.min(zona.w / (X1 - X0 + 80), zona.h / (Y1 + 20));
  const PX = x => zona.x + (x - X0 + 40) * s, PY = v => zona.y + zona.h - v * s;
  D.texto(zona.x, zona.y - 4, `Alzado (de frente): ${R.n} lamas ${hor ? 'horizontales' : 'verticales'} numeradas y ${R.rastreles.length} rastreles detrás.`, { pt: 8.5, col: gris });
  D.relleno([205, 179, 138]);
  R.rastreles.forEach(r => {
    const m0 = marcoEn(cs[0].x), m1 = marcoEn(cs[cs.length - 1].x), a = puntoMarco(m0, 0, r.v), b = puntoMarco(m1, 0, r.v);
    if (hor) D.rect(PX(a[0] - Pa.alto / 2), PY(Math.max(a[1], b[1]) + e / 2 + 30), Pa.alto * s, (Math.abs(b[1] - a[1]) + e + 60) * s, 'f');
    else D.rect(PX(Math.min(a[0], b[0]) - e / 2 - 30), PY(r.v + Pa.alto / 2), (Math.abs(b[0] - a[0]) + e + 60) * s, Pa.alto * s, 'f');
  });
  D.relleno([226, 205, 172]).trazo(madera).grosor(0.15);
  rs.forEach(r => D.rect(PX(r[0]), PY(r[3]), Math.max(0.3, (r[2] - r[0]) * s), Math.max(0.3, (r[3] - r[1]) * s), 'b'));
  D.relleno([0, 0, 0]).trazo();
  const paso = Math.max(1, Math.ceil(cs.length / (hor ? 25 : 40)));
  cs.forEach((c, i) => { if (i % paso === 0 || i === cs.length - 1) { const r = rs[i]; if (hor) D.texto(PX(r[0]) - 2, PY((r[1] + r[3]) / 2) + 1.2, String(c.i + 1), { pt: 6.5, al: 'r', col: azul }); else D.texto(PX((r[0] + r[2]) / 2), PY(r[3]) - 1.5, String(c.i + 1), { pt: 6.5, al: 'c', col: azul }); } });
  const filas = [{ titulo: hor ? 'Rastreles (posición de su centro desde la izquierda)' : 'Rastreles (altura de su centro desde abajo)' }];
  R.rastreles.forEach(r => filas.push([`Rastrel ${r.j + 1}`, `a ${fmt(r.v * k)} mm · ${fmt(Pa.alto * k, 1)} × ${fmt(Pa.grueso * k, 1)} × ${fmt(cm.rastrel)} mm`]));
  filas.push(['Separación entre lamas', `${fmt(cm.sep, 1)} mm entre centros (hueco ${fmt(Math.max(0, cm.hueco), 1)} mm)`]);
  filas.push(['Medidas del panel', `${(G.dims || [0, 0, 0]).map(v => fmt(v * k)).join(' × ')} mm (ancho × fondo × alto)`]);
  if (relieveActivo()) filas.push(['Relieve', P.relieve.fuente === 'texto' ? `texto «${P.relieve.texto.replace(/\n/g, ' / ')}»` : `modelo ${P.relieve.modelo ? P.relieve.modelo.nombre : ''}`]);
  tabla(M, M + 134, W - 2 * M, filas, { c1: 70 });
}
