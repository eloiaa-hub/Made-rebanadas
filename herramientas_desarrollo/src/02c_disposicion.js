
/* ===================== DISPOSICIÓN DE LAS COSTILLAS =====================
   Dónde va cada costilla en el espacio y con qué orientación:
   - recta:  planos paralelos a lo largo de X (costillas, retícula)
   - curva:  planos perpendiculares a un eje curvo en planta (arco o S)
   - radial: planos que pasan por un eje vertical (lámparas, columnas); la posición es un ángulo en grados
   - pared:  como recta, con el fondo (u) saliendo de la pared hacia delante */
function disposicion() {
  if (P.tipo === 'radial') return 'radial';
  if (P.tipo === 'pared') return 'pared';
  if (P.tipo === 'costillas' && P.planta && P.planta.forma !== 'recta') return 'curva';
  return 'recta';
}
const unidadPos = () => P.tipo === 'radial' ? '°' : 'mm';
const textoPos = x => P.tipo === 'radial' ? fmt(x, 1) + '°' : fmt(x) + ' mm';

// eje de la planta curva: punto (X, Z) y ángulo de la tangente en la posición x (mm a lo largo)
function ejePlanta(x) {
  const L = P.largo, Pl = P.planta;
  if (Pl.forma === 'arco') {
    const Rr = Math.max(150, Pl.radio) * (Pl.sentido === -1 ? -1 : 1), f = (x - L / 2) / Rr;
    const zc = Rr * (1 - Math.cos(L / 2 / Rr)) / 2;
    return { X: Rr * Math.sin(f), Z: Rr * (1 - Math.cos(f)) - zc, f };
  }
  const k = PI2 * (Pl.ondas || 1) / L, A = Pl.amplitud || 0;
  return { X: x - L / 2, Z: A * Math.sin(k * x), f: Math.atan(A * k * Math.cos(k * x)) };
}
// marco de una costilla en la posición x: origen O y dirección del fondo Au (en el plano horizontal X-Z)
let ucActual = 0;   // centro del fondo del cálculo en curso
function marcoEn(x) {
  const d = disposicion(), uc = ucActual;
  if (d === 'radial') { const t = x * Math.PI / 180; return { O: [0, 0, 0], Au: [Math.cos(t), 0, -Math.sin(t)] }; }
  if (d === 'curva') { const s = ejePlanta(x), sf = Math.sin(s.f), cf = Math.cos(s.f); return { O: [s.X - sf * uc, 0, s.Z + cf * uc], Au: [sf, 0, -cf] }; }
  if (d === 'pared') {
    // lamas horizontales: la posición x es la altura y el perfil (v) va a lo ancho
    if (P.relieve && P.relieve.orient === 'h') return { O: [-anchoPerfil() / 2, x, 0], Au: [0, 0, 1], Av: [1, 0, 0] };
    return { O: [x - P.largo / 2, 0, 0], Au: [0, 0, 1] };
  }
  return { O: [x - P.largo / 2, 0, uc], Au: [0, 0, -1] };
}
// el eje del perfil (v) es la vertical salvo en las lamas horizontales (Av)
const ejeV = m => m.Av || [0, 1, 0];
const puntoMarco = (m, u, v) => { const av = ejeV(m); return [m.O[0] + m.Au[0] * u + av[0] * v, m.O[1] + m.Au[1] * u + av[1] * v, m.O[2] + m.Au[2] * u + av[2] * v]; };
const ejeGrosor = m => { const a = m.Au, b = ejeV(m); return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; };  // Au × Av

// ranura que entra de lado (por el borde de u pequeño): se traspone el polígono y se usa hacerRanura
function hacerRanuraLat(poly, r, w) {
  const tr = poly.map(p => [p[1], p[0]]).reverse();
  const res = hacerRanura(tr, { c: r.c, mid: r.mid, borde: r.borde, arriba: false }, w);
  if (!res) return null;
  const out = res.map(p => [p[1], p[0]]).reverse();
  out.esq = res.esq.map(p => out.find(q => q[0] === p[1] && q[1] === p[0]));
  return out;
}
// tramos horizontales [u0, u1] en los que la recta v = y corta al polígono
function intervalosH(poly, y) { return intervalosV(poly.map(p => [p[1], p[0]]), y); }

/* ---------- planta curva: varillas que siguen la curva ---------- */
function varillasCurvas(res) {
  const e = grosor(), V = P.varillas;
  res.varillas.forEach(rv => {
    if (!rv.usada) return;
    const pts = [];
    for (let i = rv.a; i <= rv.b; i++) { const m = marcoEn(res.costillas[i].x), p = puntoMarco(m, rv.u, rv.v); pts.push([p[0], p[2]]); }
    rv.dists = []; let L = 0;
    for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); rv.dists.push(d); L += d; }
    rv.largo = L + e + 2 * V.sobra;
    // radio de curvatura mínimo (por tres puntos)
    let rmin = Infinity;
    for (let i = 1; i + 1 < pts.length; i++) {
      const [a, b, c] = [pts[i - 1], pts[i], pts[i + 1]];
      const ab = Math.hypot(b[0] - a[0], b[1] - a[1]), bc = Math.hypot(c[0] - b[0], c[1] - b[1]), ca = Math.hypot(a[0] - c[0], a[1] - c[1]);
      const ar = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) / 2;
      if (ar > 1e-6) rmin = Math.min(rmin, ab * bc * ca / (4 * ar));
    }
    rv.radioMin = rmin;
  });
  // ¿se tocan las costillas por el lado de dentro de la curva?
  const toc = [];
  for (let i = 0; i + 1 < res.n; i++) {
    const a = res.costillas[i], b = res.costillas[i + 1]; if (!a.ok || !b.ok) continue;
    for (const u of [Math.min(a.caja.x0, b.caja.x0), Math.max(a.caja.x1, b.caja.x1)]) {
      const pa = puntoMarco(marcoEn(a.x), u, 0), pb = puntoMarco(marcoEn(b.x), u, 0);
      if (Math.hypot(pb[0] - pa[0], pb[2] - pa[2]) - e < 0.5) { toc.push(i); break; }
    }
  }
  res.tocanCurva = toc;
}

/* ---------- radial: tubo central y discos de unión ---------- */
function radioTubo() { return P.radial.tubo / 2 + P.radial.holguraTubo; }
function radialExtras(res) {
  const Rd = P.radial, e = grosor(), rT = radioTubo(), cs = res.costillas.filter(c => c.ok);
  res.discos = []; res.discosMal = [];
  // tramo vertical común del borde de dentro (junto al tubo)
  let vA = -Infinity, vB = Infinity;
  cs.forEach(c => {
    const ints = intervalosV(c.poly, rT + 0.5); if (!ints.length) { vA = Infinity; return; }
    const I = ints.reduce((m, J) => J[1] - J[0] > m[1] - m[0] ? J : m);
    vA = Math.max(vA, I[0]); vB = Math.min(vB, I[1]);
  });
  res.tuboV = [Math.min(...cs.map(c => c.caja.y0)), Math.max(...cs.map(c => c.caja.y1))];
  res.comun = [vA, vB];
  const nd = Math.max(0, Math.round(Rd.discos));
  if (!nd || !(vB - vA > 4 * e)) return;
  const m = Math.max(2 * e, 0.12 * (vB - vA));
  const alturas = nd === 1 ? [(vA + vB) / 2] : Array.from({ length: nd }, (_, j) => vA + m + j * (vB - vA - 2 * m) / (nd - 1));
  const angs = res.costillas.map(c => c.x);
  alturas.forEach((vD, j) => {
    // radio del disco: el pedido o, con 0, el que cabe a esa altura (60 % de lo que queda de costilla)
    let libre = Infinity;
    res.costillas.forEach(c => { if (!c.ok) return; const I = intervalosH(c.poly, vD).find(J => J[0] <= rT + 1 && J[1] >= rT + 0.5); libre = Math.min(libre, I ? I[1] : rT); });
    const rD = Rd.rDisco > 0 ? Math.max(rT + 3 * e, Rd.rDisco) : Math.max(rT + 2 * e, rT + 0.6 * (libre - rT)), mid = (rT + rD) / 2;
    res.costillas.forEach(c => {
      if (!c.ok) return;
      const I = intervalosH(c.poly, vD).find(J => J[0] <= rT + 1 && J[1] >= rT + 0.5);
      if (!I || I[1] < rD + 2) res.discosMal.push({ j, i: c.i });
      c.ranuras.push({ lat: true, c: vD, mid, borde: rT, disco: j });
    });
    const d = {
      i: 0, k: j, z: true, disco: true, etq: 'D' + (j + 1), nombre: 'Disco ' + (j + 1), v: vD, x: vD, u: 0, rD, ok: true,
      agujeros: [], ranuras: [], nVar: 0, huecos: [{ x: 0, y: 0, r: rT }],
      generar: w => poligonoDisco(rD, mid, angs, w),
    };
    d.base = d.poly = d.generar(e + Rd.holgura); d.caja = cajaDe(d.poly); d.area = areaFirmada(d.poly) - Math.PI * rT * rT;
    res.discos.push(d);
  });
}
// disco con una ranura radial por costilla, desde el borde hasta mid, de ancho w
function poligonoDisco(rD, mid, angulosGrados, w) {
  const ts = angulosGrados.map(a => a * Math.PI / 180).sort((a, b) => a - b), dl = Math.asin(Math.min(0.99, (w / 2) / rD)), out = [], esq = [];
  ts.forEach((t, i) => {
    const tPrev = (i ? ts[i - 1] : ts[ts.length - 1] - PI2) + dl, t0 = t - dl;
    const nArc = Math.max(1, Math.ceil((t0 - tPrev) / (Math.PI / 60)));
    for (let k = 0; k <= nArc; k++) { const a = tPrev + (t0 - tPrev) * k / nArc; out.push([rD * Math.cos(a), rD * Math.sin(a)]); }
    const c = [Math.cos(t), Math.sin(t)], pp = [-Math.sin(t), Math.cos(t)];
    const e1 = [mid * c[0] - w / 2 * pp[0], mid * c[1] - w / 2 * pp[1]], e2 = [mid * c[0] + w / 2 * pp[0], mid * c[1] + w / 2 * pp[1]];
    out.push(e1, e2); esq.push(e1, e2);
  });
  out.esq = esq;
  return out;
}

/* ---------- pared: rastreles detrás de las lamas ---------- */
function paredExtras(res) {
  const Pa = P.pared, cs = res.costillas.filter(c => c.ok);
  res.rastreles = []; res.rastrelesMal = [];
  const n = Math.max(0, Math.round(Pa.rastreles));
  if (!n || !cs.length) return;
  let vA = -Infinity, vB = Infinity;
  cs.forEach(c => { const ints = intervalosV(c.poly, c.caja.x0 + 0.5); if (!ints.length) return; const I = ints.reduce((m, J) => J[1] - J[0] > m[1] - m[0] ? J : m); vA = Math.max(vA, I[0]); vB = Math.min(vB, I[1]); });
  if (!(vB - vA > Pa.alto * 1.5)) return;
  const m = clamp(Pa.margen, Pa.alto / 2, (vB - vA) / 2 - Pa.alto / 2);
  const alturas = n === 1 ? [(vA + vB) / 2] : Array.from({ length: n }, (_, j) => vA + m + j * (vB - vA - 2 * m) / (n - 1));
  alturas.forEach((v, j) => {
    res.rastreles.push({ j, v });
    cs.forEach(c => {
      const I = intervalosH(c.poly, v).find(J => J[0] <= c.caja.x0 + 1);
      if (!I || I[1] < c.caja.x0 + Pa.grueso + 8) res.rastrelesMal.push(c.i);
      c.ranuras.push({ lat: true, c: v, mid: c.caja.x0 + Pa.grueso, borde: c.caja.x0, ancho: Pa.alto + Pa.holgura, rastrel: j });
    });
  });
}
// aplica a todas las piezas sus ranuras (de la retícula, discos o rastreles) con el ancho real
function aplicarRanuras(res, w) {
  res.ranurasMal = res.ranurasMal || [];
  res.costillas.forEach(p => {
    if (!p.ok || !p.ranuras.length) return;
    const r = ranurar(p.base, p.ranuras, w);
    p.poly = r.poly; p.caja = cajaDe(p.poly); p.area = areaFirmada(p.poly);
    if (r.fallan.length && !res.ranurasMal.includes(p)) res.ranurasMal.push(p);
  });
}

/* ---------- comprobaciones de radial y pared ---------- */
function avisosRadial(res) {
  const A = res.avisos, e = grosor(), Rd = P.radial, add = (tipo, txt, cost) => A.push({ tipo, txt, cost });
  const vacias = res.costillas.filter(c => !c.ok).map(c => c.i);
  if (vacias.length) add('error', `Sin forma (más estrechas que el tubo): ${cst(vacias)}.`, vacias[0]);
  const paso = PI2 * radioTubo() / res.n;
  if (paso < e + 0.5) add('error', `Las ${res.n} costillas de ${fmt(e, 1)} mm se tocan junto al tubo: hace falta un tubo de al menos Ø ${fmt((res.n * (e + 1)) / Math.PI - 2 * Rd.holguraTubo, 0)} mm o menos costillas.`);
  if (!Math.round(Rd.discos)) add('atencion', 'Sin discos de unión: las costillas solo se pueden encolar al tubo.');
  else if (!res.discos.length) add('error', 'No caben los discos: el borde de dentro de las costillas es muy corto o no es común a todas.');
  const malD = [...new Set(res.discosMal.map(d => d.i))];
  if (malD.length) add('error', `El disco sobresale de ${cstLa(malD)} (la costilla es más estrecha que el disco a esa altura): baja el radio de los discos.`, malD[0]);
  if (res.ranurasMal.length) add('error', `No se pudo hacer la muesca de algún disco en ${cstLa(res.ranurasMal.map(p => p.i))}.`, res.ranurasMal[0].i);
  avisosMaqueta(res, add);
  if (!A.some(a => a.tipo === 'error' || a.tipo === 'atencion')) add('ok', `Todo correcto: ${res.n} costillas alrededor de un tubo de Ø ${fmt(Rd.tubo)} mm` + (res.discos.length ? ` con ${res.discos.length} disco${res.discos.length > 1 ? 's' : ''} de unión.` : '.'));
}
function avisosPared(res) {
  const A = res.avisos, e = grosor(), Pa = P.pared, add = (tipo, txt, cost) => A.push({ tipo, txt, cost });
  if (res.hueco < -0.01) add('error', `La separación (${fmt(res.sep, 1)} mm) es menor que el grosor (${fmt(e, 1)} mm): las lamas se pisan.`);
  const vacias = res.costillas.filter(c => !c.ok).map(c => c.i);
  if (vacias.length) add('error', `Sin forma: ${cst(vacias)}.`, vacias[0]);
  if (!Math.round(Pa.rastreles)) add('info', 'Sin rastreles: las lamas se fijan a un tablero trasero (va en la lista de compra) o directamente a la pared con escuadras.');
  else if (!res.rastreles.length) add('error', 'No caben los rastreles: las lamas son demasiado bajas para su altura y margen.');
  const mal = [...new Set(res.rastrelesMal)];
  if (mal.length) add('atencion', `Lamas poco profundas a la altura de un rastrel (la muesca de ${fmt(Pa.grueso)} mm las deja muy finas): ${cst(mal)}.`, mal[0]);
  if (res.ranurasMal.length) add('error', `No se pudo hacer la muesca del rastrel en ${cstLa(res.ranurasMal.map(p => p.i))}.`, res.ranurasMal[0].i);
  avisosMaqueta(res, add);
  if (!A.some(a => a.tipo === 'error' || a.tipo === 'atencion')) add('ok', `Todo correcto: ${res.n} lamas` + (res.rastreles.length ? ` sobre ${res.rastreles.length} rastreles de ${fmt(Pa.alto)} × ${fmt(Pa.grueso)} mm.` : '.'));
}
