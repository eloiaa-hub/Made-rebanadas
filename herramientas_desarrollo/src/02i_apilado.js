
/* ===================== FIGURAS APILADAS (PLANOS SERIADOS) =====================
   La figura se corta en capas horizontales del grosor del tablero (o de la plancha de porex), de abajo arriba,
   y las capas se pegan unas sobre otras sin separación. No llevan varillas: para alinearlas, unas «llaves»
   (listones cuadrados o triangulares) atraviesan las capas por un hueco de su forma. Las llaves son huecos
   (P.huecos con llave: true) que se mueven, giran y retocan en la vista ▦ Huecos; cada una llega, sola,
   de la primera a la última capa seguida en la que cabe.
   - Cada capa es el corte del modelo 3D por el centro de la capa, o la unión de sus cortes de abajo, del
     centro y de arriba («por fuera»: sobra material y se lija hasta la forma), o su intersección («por dentro»).
   - Si un corte sale en varios trozos (las orejas, dos patas), cada trozo es una pieza: 12a, 12b…
   - Las piezas son horizontales: se dibujan en planta, vistas desde arriba (u = x, v hacia atrás). */
const esApilado = () => !!P && P.tipo === 'apilado';
const APILADO_DEF = { corte: 'centro', minArea: 20, holgura: 0.2, lado: 8, margen: 2, grabar: true, hilo: false, anchoHilo: 1, llavesAuto: false, plantillaAplicada: null };
function apiladoP() {
  if (!P.apilado) P.apilado = {};
  Object.keys(APILADO_DEF).forEach(k => { if (P.apilado[k] === undefined) P.apilado[k] = APILADO_DEF[k]; });
  return P.apilado;
}
const apiladoActivo = () => esApilado() && !!(P.figura && P.figura.malla && P.figura.malla.v64);
const LLAVE_RANGO = new Map();   // id de la llave → [altura de abajo, altura de arriba] de las capas que atraviesa
const NOMBRE_CORTE = { centro: 'por el centro de cada capa', fuera: 'por fuera (sobra un poco: se lija)', dentro: 'por dentro (nunca sobra)' };

// ---- región (con sus huecos) de un juego de lazos cerrados, por la regla par-impar ----
function regionLazos(lazos) {
  const C = window.ClipperLib; if (!C || !lazos.length) return [];
  const c = new C.Clipper(); lazos.forEach(l => { if (l.length >= 3) c.AddPath(aCl(l), C.PolyType.ptSubject, true); });
  const arbol = new C.PolyTree(); c.Execute(C.ClipType.ctUnion, arbol, C.PolyFillType.pftEvenOdd, C.PolyFillType.pftEvenOdd);
  return C.JS.PolyTreeToExPolygons(arbol).map(ex => {
    let poly = deCl(ex.outer); if (areaFirmada(poly) < 0) poly.reverse();
    const int = ex.holes.map(deCl).filter(hh => Math.abs(areaFirmada(hh)) > 1).map(hh => areaFirmada(hh) < 0 ? hh : hh.slice().reverse());
    return { poly, int, area: Math.abs(areaFirmada(poly)) - int.reduce((s, hh) => s + Math.abs(areaFirmada(hh)), 0) };
  }).filter(p => p.poly.length >= 3 && p.area > 1);
}
const caminosRegion = reg => reg.flatMap(q => [q.poly, ...q.int]);   // contorno a derechas y huecos a izquierdas (regla «no cero»)
function regionCapa(k, n, alto, corte) {
  const sec = y => regionLazos(seccionFigura(y).map(l => l.poly));
  const yc = (k + 0.5) / n * alto, A = sec(yc);
  if (corte === 'centro') return A;
  const B = sec((k + 0.03) / n * alto), Cc = sec((k + 0.97) / n * alto);
  if (corte === 'fuera') return booleana([...caminosRegion(A), ...caminosRegion(B), ...caminosRegion(Cc)], [], 'union');
  let r = A; [B, Cc].forEach(o => { r = r.length && o.length ? booleana(caminosRegion(r), caminosRegion(o), 'interseccion') : []; });
  return r;
}
// recorta una polilínea abierta con una región (para grabar el contorno de la capa de encima)
function recortarAbierta(linea, region) {
  const C = window.ClipperLib; if (!C || linea.length < 2 || !region.length) return [];
  const c = new C.Clipper(); c.AddPath(aCl(linea), C.PolyType.ptSubject, false);
  region.forEach(r => { if (r.length >= 3) c.AddPath(aCl(r), C.PolyType.ptClip, true); });
  const arbol = new C.PolyTree(); c.Execute(C.ClipType.ctIntersection, arbol, C.PolyFillType.pftNonZero, C.PolyFillType.pftNonZero);
  return C.Clipper.OpenPathsFromPolyTree(arbol).map(deCl).filter(l => l.length >= 2);
}

function resultadoVacio() {
  return { n: 0, sep: 0, hueco: 0, costillas: [], varillas: [], avisos: [], largueros: [], cruces: [], discos: [], rastreles: [], ranurasMal: [], trozos: [], modulos: [],
    uniones: [], pisan: [], otras: [], llaves: [], uc: 0, apilado: true, capas: 0, bbox: [[0, 1], [0, 1], [0, 1]] };
}
function calcularApilado() {
  const res = resultadoVacio(), A = apiladoP(), add = (tipo, txt, cost) => res.avisos.push({ tipo, txt, cost });
  LLAVE_RANGO.clear();
  if (!apiladoActivo()) {
    cargarModeloPlantillaApilado();
    add('atencion', 'Figura apilada: carga un modelo 3D (STL, OBJ, GLB o PLY) o elige uno de ejemplo en «Figura (modelo 3D)».');
    return res;
  }
  const e = grosor(), m = mallaFigura(), alto = m.alto, n = Math.max(1, Math.round(alto / e));
  res.capas = n; P.largo = n * e;
  const tol = clamp(e * 0.02, 0.05, 0.8), minA = Math.max(1, +A.minArea || 0), letras = 'abcdefghijklmnopqrstuvwxyz';
  let quitados = 0;
  const capas = [];
  for (let k = 0; k < n; k++) {
    const reg = regionCapa(k, n, alto, A.corte).filter(q => { if (q.area < minA) { quitados++; return false; } return true; }).sort((a, b) => b.area - a.area);
    capas.push(reg.map(q => ({ poly: simplificaCerrado(q.poly, tol), int: q.int.filter(hh => Math.abs(areaFirmada(hh)) >= minA).map(hh => simplificaCerrado(hh, tol)) })).filter(q => q.poly.length >= 3));
  }
  const pieza = (k, q) => {
    const y = (k + 0.5) * e, poly = areaFirmada(q.poly) < 0 ? q.poly.slice().reverse() : q.poly;
    return { i: 0, x: y, capa: k, plano: 'horizontal', F: { ex: [1, 0, 0], ey: [0, 0, -1], ez: [0, 1, 0], o: [0, y, 0] }, poly, base: poly, int: q.int, ok: true,
      caja: cajaDe(poly), area: Math.abs(areaFirmada(poly)) - q.int.reduce((s, hh) => s + Math.abs(areaFirmada(hh)), 0),
      agujeros: [], nVar: 0, ranuras: [], cajas: [], cajasT: [], dientes: [], uniones: [], taladros: [], huecos: [], etq: '', nombre: '' };
  };
  res.costillas = capas.flatMap((cs, k) => cs.map(q => pieza(k, q)));
  // ---- llaves: el tramo seguido de capas en el que caben (con su holgura y un margen de material alrededor) ----
  res.llaves = [];
  const porCapa = k => res.costillas.filter(c => c.capa === k);
  if (window.ClipperLib) huecosActivos().filter(h => h.llave).forEach(h => {
    const forma = formaHueco(h), conMargen = engordar(forma, Math.max(0, +A.holgura || 0) + Math.max(0, +A.margen || 0));
    const [d0, d1] = tramoX(h), cabe = [];
    for (let k = 0; k < n; k++) {
      const y = (k + 0.5) * e;
      cabe.push(y >= d0 && y <= d1 && porCapa(k).some(c => !booleana(conMargen, [c.poly]).length && !c.int.some(hh => booleana(conMargen, [hh], 'interseccion').length)));
    }
    let mejor = null;
    for (let k = 0; k < n;) { if (!cabe[k]) { k++; continue; } let j = k; while (j + 1 < n && cabe[j + 1]) j++; if (!mejor || j - k > mejor[1] - mejor[0]) mejor = [k, j]; k = j + 1; }
    const nL = P.huecos.indexOf(h) + 1;
    if (mejor) LLAVE_RANGO.set(h.id, [mejor[0] * e, (mejor[1] + 1) * e]);
    res.llaves.push({ h, n: nL, k0: mejor ? mejor[0] : -1, k1: mejor ? mejor[1] : -1, largo: mejor ? (mejor[1] - mejor[0] + 1) * e : 0, forma });
  });
  // ---- huecos y llaves: se restan a las capas que atraviesan (como los túneles de las costillas) ----
  res.costillas.forEach((c, i) => { c.i = i; });
  res.n = res.costillas.length;
  aplicarHuecos(res);
  const todas = [];
  res.costillas.forEach(p => { if (!p.ok) return; (p.partes || [p]).forEach(q => { if (q.ok === false || !q.poly || q.poly.length < 3) return;
    if (q !== p) Object.assign(q, { capa: p.capa, plano: 'horizontal', F: p.F, cajas: [], cajasT: [], dientes: [], uniones: [], taladros: [], huecos: [] });
    q.conHuecos = false; q.partes = null; q.padre = null; q.trozo = false; q.int = q.int || []; todas.push(q); }); });
  res.trozos = []; res.modulos = [];
  // ---- hilo caliente: los huecos de dentro necesitan una entrada desde el borde (un corte del ancho del hilo) ----
  if (A.hilo && window.ClipperLib) todas.forEach(c => {
    let guarda = 0;
    while (c.int.length && guarda++ < 20) {
      const hh = c.int[0]; let mej = null;
      hh.forEach(p => { for (let i = 0; i < c.poly.length; i++) { const a = c.poly[i], b = c.poly[(i + 1) % c.poly.length], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
        const t = L ? clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L, 0, 1) : 0, q = [a[0] + t * dx, a[1] + t * dy], d = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (!mej || d < mej.d) mej = { d, p, q }; } });
      if (!mej) break;
      const w = Math.max(0.3, +A.anchoHilo || 1) / 2, ux = (mej.q[0] - mej.p[0]) / (mej.d || 1), uy = (mej.q[1] - mej.p[1]) / (mej.d || 1), nx = -uy * w, ny = ux * w;
      const a0 = [mej.p[0] - ux * 0.5, mej.p[1] - uy * 0.5], a1 = [mej.q[0] + ux * 1.5, mej.q[1] + uy * 1.5];
      const ranura = [[a0[0] + nx, a0[1] + ny], [a1[0] + nx, a1[1] + ny], [a1[0] - nx, a1[1] - ny], [a0[0] - nx, a0[1] - ny]];
      const r = booleana([c.poly, ...c.int], [ranura]); if (!r.length) break;
      c.poly = r[0].poly; c.int = r[0].int; c.entradas = (c.entradas || 0) + 1;
    }
    c.base = c.poly; c.caja = cajaDe(c.poly);
  });
  // ---- números y nombres por capa (desde abajo: 1, 2, 3…; con varios trozos, 12a, 12b…) ----
  todas.sort((a, b) => a.capa - b.capa || b.area - a.area);
  todas.forEach((c, i) => { c.i = i; c.caja = cajaDe(c.poly); c.area = Math.abs(areaFirmada(c.poly)) - c.int.reduce((s, hh) => s + Math.abs(areaFirmada(hh)), 0); });
  const nCapa = {}; todas.forEach(c => { nCapa[c.capa] = (nCapa[c.capa] || 0) + 1; });
  const vistos = {}; todas.forEach(c => { const j = vistos[c.capa] = (vistos[c.capa] || 0) + 1, multi = nCapa[c.capa] > 1; c.etq = String(c.capa + 1) + (multi ? letras[(j - 1) % 26] : ''); c.nombre = 'Capa ' + c.etq; });
  res.costillas = todas; res.n = todas.length;
  // ---- grabado: el contorno de la capa de encima, para pegarla en su sitio ----
  if (A.grabar && window.ClipperLib) todas.forEach(c => {
    const arriba = todas.filter(o => o.capa === c.capa + 1), region = [c.poly, ...c.int];
    c.marcas = arriba.flatMap(o => recortarAbierta([...o.poly, o.poly[0]], region)).filter(l => l.reduce((s, p, i) => i ? s + Math.hypot(p[0] - l[i - 1][0], p[1] - l[i - 1][1]) : 0, 0) > 2);
  });
  // ---- caja del conjunto (x, altura, z) ----
  const bb = [[Infinity, -Infinity], [0, n * e], [Infinity, -Infinity]];
  todas.forEach(c => { bb[0][0] = Math.min(bb[0][0], c.caja.x0); bb[0][1] = Math.max(bb[0][1], c.caja.x1); bb[2][0] = Math.min(bb[2][0], -c.caja.y1); bb[2][1] = Math.max(bb[2][1], -c.caja.y0); });
  res.bbox = bb.map(r => isFinite(r[0]) ? r : [0, 0]);
  avisosApilado(res, add, { n, e, quitados });
  return res;
}
function avisosApilado(res, add, o) {
  const { n, e, quitados } = o, A = apiladoP(), cs = res.costillas;
  const multi = new Set(cs.filter(c => /[a-z]$/.test(c.etq)).map(c => c.capa)).size;
  add('info', `Figura apilada: ${n} capas de ${fmt(e, 1)} mm (${fmt(n * e)} mm de alto, cortadas ${NOMBRE_CORTE[A.corte] || ''}) en ${cs.length} piezas${multi ? `; ${multi} capa${multi > 1 ? 's' : ''} en varios trozos` : ''}.`);
  if (quitados) add('info', `Se han quitado ${quitados} trozo${quitados > 1 ? 's' : ''} de menos de ${fmt(A.minArea)} mm² (puntas sueltas que no se pueden cortar ni pegar bien).`);
  // capas que casi no se apoyan en la de abajo
  if (window.ClipperLib) {
    const flojas = [];
    cs.forEach(c => {
      if (c.capa === 0) return;
      const abajo = cs.filter(q => q.capa === c.capa - 1); if (!abajo.length) { flojas.push(c); return; }
      const comun = booleana([c.poly, ...c.int], abajo.flatMap(q => [q.poly, ...q.int]), 'interseccion').reduce((s, q) => s + q.area, 0);
      if (comun < 0.15 * c.area) flojas.push(c);
    });
    if (flojas.length) add('atencion', `${flojas.length === 1 ? 'La pieza' : 'Las piezas'} ${flojas.slice(0, 6).map(c => c.etq).join(', ')}${flojas.length > 6 ? '…' : ''} casi no se ${flojas.length === 1 ? 'apoya' : 'apoyan'} en la capa de abajo: ${flojas.length === 1 ? 'queda' : 'quedan'} en el aire. Pégala${flojas.length === 1 ? '' : 's'} con cuidado (con un soporte mientras seca), gira el modelo o usa el corte «por fuera».`, flojas[0].i);
  }
  // llaves
  const ll = res.llaves || [];
  if (!ll.length) add('atencion', 'Sin llaves: las capas se alinean a ojo. Pon una llave cuadrada y otra triangular (o pulsa «✨ Colocar las llaves solas» en «Capas»).');
  ll.forEach(l => {
    const nom = `Llave L${l.n} (${l.h.forma === 'rect' ? 'cuadrada' : l.h.forma === 'circulo' ? 'redonda' : 'triangular'})`;
    if (l.k0 < 0) { add('error', `${nom}: no cabe entera en ninguna capa (con ${fmt(A.margen, 1)} mm de material alrededor). Muévela hacia dentro o hazla más pequeña.`); return; }
    const nc = l.k1 - l.k0 + 1;
    add(nc < Math.max(2, 0.35 * n) ? 'atencion' : 'info', `${nom}: atraviesa de la capa ${l.k0 + 1} a la ${l.k1 + 1} (${nc} capas, ${fmt(l.largo)} mm)${nc < Math.max(2, 0.35 * n) ? '. Es corta: muévela a la parte más ancha de la figura' : ''}.`);
  });
  if (ll.length === 1 && ll[0].h.forma !== 'libre') add('info', 'Con una sola llave las capas aún pueden girar (o, con una cuadrada, ponerse a 90°): añade otra, mejor triangular.');
  if (A.hilo) { const nE = cs.reduce((s, c) => s + (c.entradas || 0), 0); if (nE) add('info', `Hilo caliente: ${nE} corte${nE > 1 ? 's' : ''} de entrada del hilo hasta los huecos de las llaves (se cierran al pegar).`); }
}

// ---- colocar las llaves solas: una cuadrada y otra triangular, lo más separadas posible,
//      en la zona común a las capas de abajo arriba hasta donde quepan las dos ----
function colocarLlavesAuto() {
  if (!R || !esApilado() || !window.ClipperLib) return 0;
  const A = apiladoP(), lado = Math.max(2, +A.lado || 8), r = lado * 0.75 + Math.max(0, +A.holgura || 0) + Math.max(0, +A.margen || 0);
  // las capas sin los huecos de las llaves que ya hay (se van a quitar)
  const guardadas = P.huecos || []; P.huecos = guardadas.filter(h => !h.llave);
  let Rb; try { Rb = calcular(); } finally { P.huecos = guardadas; }
  const n = Rb.capas || 0;
  // en cada capa, donde puede ir el centro de una llave (la capa encogida lo que mide media llave más la holgura y el margen)
  const zonas = Array.from({ length: n }, (_, k) => Rb.costillas.filter(c => c.capa === k).flatMap(c => { const s = engordar(c.poly, -r); if (!s || s.length < 3 || Math.abs(areaFirmada(s)) < 1) return []; return booleana(s, c.int.map(hh => engordar(hh, r))).map(q => q.poly); }));
  const mayorDe = zs => zs.reduce((m, q) => Math.abs(areaFirmada(q)) > Math.abs(areaFirmada(m)) ? q : m, zs[0]);
  // el tramo de capas seguidas más largo cuya zona común aún deja separar dos llaves (empezando en las capas de abajo)
  const tramo = (s, dos) => {
    let I = null, ult = null, fin = s - 1;
    for (let k = s; k < n; k++) {
      if (!zonas[k].length) break;
      const nuevo = I ? booleana(I, zonas[k], 'interseccion').map(q => q.poly) : zonas[k]; if (!nuevo.length) break;
      const m = mayorDe(nuevo), cb = cajaDe(m);
      if (dos && Math.max(cb.w, cb.h) < 2.8 * lado) break;
      I = nuevo; ult = m; fin = k;
    }
    return ult ? { s, fin, largo: fin - s + 1, zona: ult } : null;
  };
  let mejor = null;
  for (let s = 0; s < n && s <= Math.ceil(n * 0.4); s++) {
    if (mejor && mejor.largo >= n - s) break;   // ya no se puede mejorar
    const t = tramo(s, true); if (t && (!mejor || t.largo > mejor.largo)) mejor = t;
  }
  if (!mejor) mejor = tramo(0, false) || tramo(Math.max(0, zonas.findIndex(z => z.length)), false);
  if (!mejor) return 0;
  const ultimo = mejor.zona;
  // los dos puntos más separados de la zona, un poco hacia dentro
  let a = ultimo[0], b = ultimo[0], md = -1;
  for (let i = 0; i < ultimo.length; i++) for (let j = i + 1; j < ultimo.length; j++) { const d = Math.hypot(ultimo[i][0] - ultimo[j][0], ultimo[i][1] - ultimo[j][1]); if (d > md) { md = d; a = ultimo[i]; b = ultimo[j]; } }
  let cx = 0, cy = 0; ultimo.forEach(p => { cx += p[0]; cy += p[1]; }); cx /= ultimo.length; cy /= ultimo.length;
  if (!dentro(ultimo, cx, cy)) [cx, cy] = puntoDentro(ultimo, []);   // en una zona con entrantes, el centro de los vértices puede caer fuera
  const dentroDe = p => { const q = [p[0] + (cx - p[0]) * 0.12, p[1] + (cy - p[1]) * 0.12]; return dentro(ultimo, q[0], q[1]) ? q : p; };
  P.huecos = (P.huecos || []).filter(h => !h.llave);
  const r1 = v => Math.round(v * 10) / 10, base = { activo: true, modo: 'pasante', llave: true, giro: 0, radio: 0, prof: 40, holgura: 0, desde: 0, hasta: Math.round(P.largo + grosor()), mueble: { tipo: 'caja', fondo: 0, trasera: false, puerta: 'lisa', holguraPuerta: 3, grosor: 0 } };
  const cuadrada = c => Object.assign({}, base, { id: 'h' + Date.now().toString(36) + 'c', forma: 'rect', x: r1(c[0] - lado / 2), y: r1(c[1] - lado / 2), ancho: r1(lado), alto: r1(lado), pts: null });
  const triangular = c => { const s = lado * 1.3, h = s * Math.sqrt(3) / 2, pts = [[c[0] - s / 2, c[1] - h / 3], [c[0] + s / 2, c[1] - h / 3], [c[0], c[1] + 2 * h / 3]].map(p => [r1(p[0]), r1(p[1])]), cb = cajaDe(pts);
    return Object.assign({}, base, { id: 'h' + Date.now().toString(36) + 't', forma: 'libre', pts, x: cb.x0, y: cb.y0, ancho: cb.w, alto: cb.h }); };
  if (md < 2.6 * lado) { P.huecos.push(cuadrada([cx, cy])); return 1; }
  P.huecos.push(cuadrada(dentroDe(a)), triangular(dentroDe(b)));
  return 2;
}
// una llave nueva (cuadrada o triangular) en el centro de la capa seleccionada
function llaveNueva(forma) {
  const A = apiladoP(), lado = Math.max(2, +A.lado || 8), c = R && R.costillas[UI.costilla] && R.costillas[UI.costilla].ok ? R.costillas[UI.costilla] : (R && R.costillas[0]);
  const ctr = c ? puntoDentro(c.poly, c.int) : [0, 0], r1 = v => Math.round(v * 10) / 10;
  const h = huecoNuevo(forma === 'tri' ? 'libre' : 'rect');
  Object.assign(h, { llave: true, modo: 'pasante', desde: 0, hasta: Math.round(P.largo + grosor()), giro: 0 });
  if (forma === 'tri') { const s = lado * 1.3, hh = s * Math.sqrt(3) / 2; h.pts = [[ctr[0] - s / 2, ctr[1] - hh / 3], [ctr[0] + s / 2, ctr[1] - hh / 3], [ctr[0], ctr[1] + 2 * hh / 3]].map(p => [r1(p[0]), r1(p[1])]); const cb = cajaDe(h.pts); Object.assign(h, { x: cb.x0, y: cb.y0, ancho: cb.w, alto: cb.h }); }
  else Object.assign(h, { x: r1(ctr[0] - lado / 2), y: r1(ctr[1] - lado / 2), ancho: r1(lado), alto: r1(lado), pts: null });
  return h;
}
const nombreLlave = h => h.forma === 'rect' ? (Math.abs(h.ancho - h.alto) < 0.05 ? 'cuadrada' : 'rectangular') : h.forma === 'circulo' ? 'redonda' : (h.pts && h.pts.length === 3 ? 'triangular' : 'de forma libre');
// medidas del listón de una llave (su sección y su largo), para la lista de compra y el plano
function listonLlave(l) {
  const h = l.h, cb = cajaDe(l.forma);
  if (h.forma === 'rect') return `${fmt(h.ancho, 1)} × ${fmt(h.alto, 1)} mm`;
  if (h.forma === 'circulo') return `Ø ${fmt(h.ancho, 1)} mm`;
  if (h.pts && h.pts.length === 3) { const L = h.pts.map((p, i) => { const q = h.pts[(i + 1) % 3]; return Math.hypot(q[0] - p[0], q[1] - p[1]); }); return `triangular de ${fmt(Math.max(...L), 1)} mm de lado`; }
  return `de ${fmt(cb.w, 1)} × ${fmt(cb.h, 1)} mm (forma libre)`;
}

// ---- plantillas: ajustes de cada una y su modelo de ejemplo ----
function ajustesApilado(id, Pp) {
  Pp = Pp || P;
  const pl = PLANTILLAS[id]; if (!pl || !pl.ajustes) return;
  const a = pl.ajustes, A = Pp.apilado = Object.assign({}, APILADO_DEF, Pp.apilado || {});
  Pp.costillas.grosor = a.grosor; Pp.costillas.material = a.material;
  ['corte', 'minArea', 'holgura', 'lado', 'margen', 'grabar', 'hilo', 'anchoHilo'].forEach(k => { if (a[k] !== undefined) A[k] = a[k]; });
  UI.fab = null;   // la plancha de Fabricar sale de la plantilla (fabDefecto)
  // si el modelo era el de ejemplo de otra plantilla, se cambia por el de esta
  const otros = Object.values(PLANTILLAS).filter(q => q.modelo && q !== pl).map(q => q.modelo);
  if (!Pp.figura.malla || (Pp.figura.malla.ejemplo && otros.includes(Pp.figura.malla.ejemplo))) { Pp.figura.malla = null; Pp.huecos = (Pp.huecos || []).filter(h => !h.llave); }
  Pp.figura.giro = 0; Pp.figura.alto = (Pp.params && Pp.params.alto) || Pp.figura.alto; A.plantillaAplicada = id; A.llavesAuto = true;
}
let cargandoApilado = false;
function cargarModeloPlantillaApilado() {
  const pl = PLANTILLAS[P.plantilla]; if (cargandoApilado || !pl || !pl.modelo || P.figura.malla) return;
  cargandoApilado = true;
  cargarRecurso('modelos').then(() => {
    cargandoApilado = false;
    if (!esApilado() || P.figura.malla) return;
    const r = triangulosEjemplo(pl.modelo); if (!r) return;
    cargarFiguraTriangulos(r.tri, r.M.nombre, pl.modelo); apiladoP().llavesAuto = true;
    if (typeof recalcular === 'function' && VP) { recalcular(); ponerControles(); encuadrarSiHaceFalta(); selCostilla(Math.floor(R.n / 3)); if (UI.vistaHuecos) encuadrarHuecos(); if (typeof camara === 'function') camara('tres4'); }
  }).catch(e => { cargandoApilado = false; if (typeof aviso === 'function') aviso('⚠ ' + esc(e.message), 5000); });
}
// después de cargar un modelo o una plantilla: las llaves se colocan solas (una vez)
function llavesTrasCalcular() {
  if (!esApilado() || !apiladoActivo() || !apiladoP().llavesAuto || !R || !R.capas) return false;
  apiladoP().llavesAuto = false;
  if ((P.huecos || []).some(h => h.llave)) return false;
  return colocarLlavesAuto() > 0;
}
