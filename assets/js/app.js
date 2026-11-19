/* Made-rebanadas — Por Eloi A.A.
   Programa: EUPL-1.2 · Manual: CC BY-SA 4.0
   Muebles por rebanadas (costillas separadas unidas con varillas).
   Unidades: milímetros. Ejes 3D: X largo del mueble (donde se reparten las costillas), Y alto, Z fondo.
   Cada costilla es un perfil 2D en el plano (u, v): u = fondo, v = alto.
   Este archivo se genera uniendo las partes de la carpeta herramientas_desarrollo/src (01_base … 09_inicio). */
(function () {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const VERSION = '1.5';
const T = window.THREE;

/* ===================== UTILIDADES ===================== */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const clonar = o => JSON.parse(JSON.stringify(o));
function fmt(v, d = 0) {
  if (!isFinite(v)) return '—';
  return Number(v).toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
let tAviso = 0;
function aviso(msg, ms = 2600) {
  const a = $('#aviso'); a.innerHTML = msg; a.classList.add('ver');
  clearTimeout(tAviso); tAviso = setTimeout(() => a.classList.remove('ver'), ms);
}
function lsGet(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : v; } catch (e) { return def; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
// carga diferida de los archivos grandes (modelos e imágenes de ejemplo): solo cuando hacen falta
const VERSION_ARCHIVOS = (() => { try { const m = /[?&]v=([^&]+)/.exec(document.currentScript.src); return m ? m[1] : VERSION; } catch (e) { return VERSION; } })();
const RECURSOS = { modelos: ['assets/modelos/modelos.js', 'MADE_MODELOS'], imagenes: ['assets/imagenes/imagenes.js', 'MADE_IMAGENES'] };
const cargandoRecurso = {};
function cargarRecurso(k) {
  const [src, glob] = RECURSOS[k];
  if (window[glob]) return Promise.resolve(window[glob]);
  if (!cargandoRecurso[k]) cargandoRecurso[k] = new Promise((ok, mal) => {
    const s = document.createElement('script'); s.src = src + '?v=' + VERSION_ARCHIVOS;
    s.onload = () => ok(window[glob]); s.onerror = () => { cargandoRecurso[k] = null; mal(new Error('No se puede cargar ' + src)); };
    document.head.appendChild(s);
  });
  return cargandoRecurso[k];
}
// con espiga de madera no hay separadores: las costillas se encolan a la espiga (mismo diámetro en todo el largo)
const conSeparadores = () => !!P.varillas.separadores && P.varillas.tipo !== 'madera';
function descargar(nombre, contenido, tipo) {
  const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo || 'text/plain' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function nombreArchivo(s) { return (s || 'mueble').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'mueble'; }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ===================== MATERIALES DEL TABLERO ===================== */
// cara: textura de madera de la biblioteca (80 x 80 cm); canto: alma del tablero
const MATERIALES = {
  abedul:   { nombre: 'Contrachapado de abedul', cara: 'fresno', canto: 'alma_contrachapado', hex: '#dcc49c' },
  chopo:    { nombre: 'Contrachapado de chopo', cara: 'haya', canto: 'alma_contrachapado', hex: '#d9b892' },
  pino_ply: { nombre: 'Contrachapado de pino', cara: 'pino', canto: 'alma_contrachapado', hex: '#ddb77f' },
  roble:    { nombre: 'Contrachapado chapa roble', cara: 'roble', canto: 'alma_contrachapado', hex: '#b88d5e' },
  nogal:    { nombre: 'Contrachapado chapa nogal', cara: 'nogal', canto: 'alma_contrachapado', hex: '#6a4630' },
  pino:     { nombre: 'Tablero alistonado de pino', cara: 'pino', canto: 'pino', hex: '#ddb77f' },
  mdf:      { nombre: 'MDF crudo', cara: 'alma_mdf', canto: 'alma_mdf', hex: '#a9845c', mm: 200 },
  lacado:   { nombre: 'MDF lacado (color a elegir)', color: true, hex: '#f2efe8' },
};
const VARILLA_TIPOS = {
  roscada: { nombre: 'Varilla roscada', sep: 'Tubo separador', hex: '#b8bcc0', metal: true },
  madera:  { nombre: 'Redondo de madera', sep: 'Tubo / casquillo separador', hex: '#d2b07c', metal: false },
  tubo:    { nombre: 'Tubo de acero', sep: 'Tubo separador', hex: '#c7c9cb', metal: true },
};

/* ===================== ESTADO ===================== */
let P = null;          // proyecto (lo que se guarda)
let R = null;          // resultado calculado: costillas, varillas, avisos
const UI = {
  clave: 0,            // índice de la clave que se edita
  punto: -1,           // punto de control seleccionado
  varilla: -1,         // varilla seleccionada
  costilla: 0,         // pieza seleccionada: 0…n-1 costillas, n… largueros (retícula)
  modo: 'normal',      // 'normal' | 'varilla' (colocar varilla con un clic)
  sucio: false,        // cambios sin guardar
};

function proyectoBase() {
  return {
    app: 'Made-rebanadas', version: 1, versionPrograma: VERSION,
    nombre: 'Mueble', tipo: 'costillas', plantilla: 'banco', params: {}, editado: false,
    largo: 1600,
    esquinas: [],                // por punto de control: true = esquina, false = curva
    claves: [],                  // [{ x: mm a lo largo, pts: [[u, v], …] }]
    interp: 'curva',
    costillas: { grosor: 18, modo: 'separacion', separacion: 60, numero: 25, base: true, tope: false, topeAlt: 400, material: 'mdf', color: '#f2efe8' },
    varillas: { tipo: 'roscada', diam: 10, holgura: 0.5, margen: 20, tramo: 'todas', separadores: true, sepD: 22, sobra: 12, autoN: 3, lista: [] },
    vista: { explosion: 0, fantasma: false, varillas: true, resalta: true, claves: true, rasante: false, rasAng: 30 },
    maqueta: { activa: false, escala: 5, grosor: 3, diam: 3, holgura: 0.2, fresa: 0 },
    cnc: { fresa: 6, hueso: true, arcos: true, tolArco: 0.05, veta: 'no' },
    reticula: { num: 4, margen: 40, holgura: 0.3, xArriba: true, vuelo: 25 },
    planta: { forma: 'recta', radio: 2500, sentido: 1, amplitud: 150, ondas: 1 },
    radial: { tubo: 20, holguraTubo: 0.5, discos: 2, rDisco: 0, holgura: 0.3 },
    pared: { rastreles: 3, alto: 45, grueso: 20, margen: 120, holgura: 0.5, verPared: true,
      partir: { modo: 'no', alturas: '', largoMax: 0, junta: 'tope', sombra: 8, patron: 'alineado', desfase: 300, rastreles: true },
      modulos: { modo: 'no', n: 2, medidas: '', hueco: 0 } },
    relieve: { fuente: 'plantilla', orient: 'v', ancho: 1200, alto: 500, fondo: 20, relieve: 60, suavizado: 10, invertir: false,
      texto: 'Made', letra: 'Arial Black', tamLetra: 320, negrita: true, interlinea: 1.05, ondaAmp: 0, ondas: 2,
      vista: 'frente', giro: 0, base: 0.15, modelo: null, gama: 1, imagen: null,
      letras: [],
      capa: { activa: false, texto: 'Hola', letra: 'Arial Black', negrita: true, tamLetra: 160, relieve: 30, x: 50, y: 15, modo: 'sale' } },
    huecos: [],
    figura: { activa: false, malla: null, alto: 800, eje: 'x', giro: 0, minArea: 2, unir: true },
    plano: { holgura: 0.3, piezas: [] },
  };
}

/* ===================== GEOMETRÍA 2D ===================== */
const MUESTRAS = 12;   // puntos de la curva por cada tramo entre puntos de control
const TENSION = 1.05;  // tamaño de las tangentes (1 ≈ curva natural)

// Tangentes unitarias en cada punto de control (0 en las esquinas → tramos rectos entre esquinas)
function tangentes(pts, esq) {
  const n = pts.length, Tg = [];
  for (let i = 0; i < n; i++) {
    if (esq[i]) { Tg.push([0, 0]); continue; }
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    Tg.push([dx / L, dy / L]);
  }
  return Tg;
}
function hermite(p0, p1, m0, m1, s) {
  const s2 = s * s, s3 = s2 * s;
  const h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  return [h00 * p0[0] + h10 * m0[0] + h01 * p1[0] + h11 * m1[0], h00 * p0[1] + h10 * m0[1] + h01 * p1[1] + h11 * m1[1]];
}
// punto del tramo j (entre el punto j y el j+1) en el parámetro s ∈ [0,1]
function puntoTramo(pts, esq, j, s, Tg) {
  const n = pts.length; Tg = Tg || tangentes(pts, esq);
  const p0 = pts[j], p1 = pts[(j + 1) % n], ch = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) * TENSION;
  return hermite(p0, p1, [Tg[j][0] * ch, Tg[j][1] * ch], [Tg[(j + 1) % n][0] * ch, Tg[(j + 1) % n][1] * ch], s);
}
// curva cerrada muestreada (polígono denso); devuelve también el tramo de cada muestra
function curvaCerrada(pts, esq, S = MUESTRAS) {
  const n = pts.length, Tg = tangentes(pts, esq), out = [];
  for (let j = 0; j < n; j++) {
    const recto = esq[j] && esq[(j + 1) % n];
    const k = recto ? 1 : S;
    for (let m = 0; m < k; m++) out.push(puntoTramo(pts, esq, j, m / k, Tg));
  }
  return out;
}
function curvaConTramos(pts, esq, S = MUESTRAS) {
  const n = pts.length, Tg = tangentes(pts, esq), out = [];
  for (let j = 0; j < n; j++) for (let m = 0; m < S; m++) out.push({ p: puntoTramo(pts, esq, j, m / S, Tg), j, s: m / S });
  return out;
}

function areaFirmada(poly) {
  let a = 0;
  for (let i = 0, n = poly.length; i < n; i++) { const p = poly[i], q = poly[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; }
  return a / 2;
}
function cajaDe(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of poly) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}
function dentro(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}
function distSeg(px, py, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  let t = L2 ? ((px - a[0]) * dx + (py - a[1]) * dy) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const x = a[0] + t * dx - px, y = a[1] + t * dy - py;
  return Math.sqrt(x * x + y * y);
}
// distancia con signo al borde: positiva dentro
function distBorde(poly, x, y) {
  let d = Infinity;
  for (let i = 0, n = poly.length; i < n; i++) { const v = distSeg(x, y, poly[i], poly[(i + 1) % n]); if (v < d) d = v; }
  return dentro(poly, x, y) ? d : -d;
}
// recorte de un polígono por un semiplano horizontal (Sutherland–Hodgman)
function recortaY(poly, y0, quedarArriba) {
  const ok = p => quedarArriba ? p[1] >= y0 : p[1] <= y0;
  const out = [];
  for (let i = 0, n = poly.length; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n], ia = ok(a), ib = ok(b);
    if (ia) out.push(a);
    if (ia !== ib) { const t = (y0 - a[1]) / (b[1] - a[1]); out.push([a[0] + (b[0] - a[0]) * t, y0]); }
  }
  // quita puntos repetidos
  return out.filter((p, i) => { const q = out[(i + 1) % out.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6; });
}
// recorte por la recta vertical u = u0 (se queda lo de la derecha)
function recortaU(poly, u0) { return recortaY(poly.map(p => [p[1], p[0]]), u0, true).map(p => [p[1], p[0]]); }
// simplificación Douglas–Peucker de un polígono cerrado (para DXF / SVG)
function simplificaCerrado(poly, tol) {
  if (poly.length < 5) return poly.slice();
  let ia = 0, ib = 0, dmax = -1;
  for (let i = 0; i < poly.length; i++) { const d = Math.hypot(poly[i][0] - poly[0][0], poly[i][1] - poly[0][1]); if (d > dmax) { dmax = d; ib = i; } }
  const dp = arr => {
    if (arr.length < 3) return arr;
    let md = -1, mi = 0; const a = arr[0], b = arr[arr.length - 1];
    for (let i = 1; i < arr.length - 1; i++) { const d = distSeg(arr[i][0], arr[i][1], a, b); if (d > md) { md = d; mi = i; } }
    if (md <= tol) return [a, b];
    const l = dp(arr.slice(0, mi + 1)), r = dp(arr.slice(mi));
    return l.slice(0, -1).concat(r);
  };
  const A = dp(poly.slice(ia, ib + 1)), B = dp(poly.slice(ib).concat([poly[0]]));
  return A.slice(0, -1).concat(B.slice(0, -1));
}

/* ===================== PERFILES CLAVE ===================== */
function clavesOrdenadas() { return P.claves.slice().sort((a, b) => a.x - b.x); }
// puntos de control interpolados en la posición x (mm) a lo largo del mueble
function perfilEn(x) {
  const C = clavesOrdenadas(), K = C.length;
  if (K === 1 || x <= C[0].x) return clonar(C[0].pts);
  if (x >= C[K - 1].x) return clonar(C[K - 1].pts);
  let k = 0; while (k < K - 2 && x > C[k + 1].x) k++;
  const x0 = C[k].x, x1 = C[k + 1].x, h = x1 - x0 || 1, s = (x - x0) / h;
  const n = C[k].pts.length, out = [];
  if (P.interp === 'recta' || K === 2) {
    for (let i = 0; i < n; i++) out.push([lerp(C[k].pts[i][0], C[k + 1].pts[i][0], s), lerp(C[k].pts[i][1], C[k + 1].pts[i][1], s)]);
    return out;
  }
  // Hermite a lo largo de x con pendientes por diferencias (suave, como una curva por los perfiles)
  const pend = (kk, i, c) => {
    if (kk === 0) return (C[1].pts[i][c] - C[0].pts[i][c]) / ((C[1].x - C[0].x) || 1);
    if (kk === K - 1) return (C[K - 1].pts[i][c] - C[K - 2].pts[i][c]) / ((C[K - 1].x - C[K - 2].x) || 1);
    return (C[kk + 1].pts[i][c] - C[kk - 1].pts[i][c]) / ((C[kk + 1].x - C[kk - 1].x) || 1);
  };
  const s2 = s * s, s3 = s2 * s, h00 = 2 * s3 - 3 * s2 + 1, h10 = s3 - 2 * s2 + s, h01 = -2 * s3 + 3 * s2, h11 = s3 - s2;
  for (let i = 0; i < n; i++) {
    const p = [0, 0];
    for (let c = 0; c < 2; c++) p[c] = h00 * C[k].pts[i][c] + h10 * h * pend(k, i, c) + h01 * C[k + 1].pts[i][c] + h11 * h * pend(k + 1, i, c);
    out.push(p);
  }
  return out;
}
// contorno final de un perfil (curva + recortes de base y techo), en sentido antihorario
function contornoDe(ctrl) {
  let poly = curvaCerrada(ctrl, P.esquinas);
  if (P.costillas.base) poly = recortaY(poly, 0, true);
  if (P.costillas.tope) poly = recortaY(poly, P.costillas.topeAlt, false);
  if (P.tipo === 'radial') poly = recortaU(poly, radioTubo());
  if (poly.length >= 3 && areaFirmada(poly) < 0) poly.reverse();
  return poly;
}

/* ===================== COSTILLAS Y VARILLAS ===================== */
function grosor() { return P.costillas.grosor; }
// en la retícula, las costillas de los extremos se meten hacia dentro el «vuelo» de los largueros
const vueloRet = () => P.tipo === 'reticula' ? clamp(P.reticula.vuelo || 0, 0, P.largo / 4) : 0;
function reparto() {
  if (P.tipo === 'radial') { // costillas repartidas en la vuelta completa (grados)
    const n = clamp(Math.round(P.costillas.numero), 3, 360), s = 360 / n;
    return { n, s, hueco: PI2 * radioTubo() / n - grosor(), ini: 0, xs: Array.from({ length: n }, (_, i) => i * s), radial: true };
  }
  const e = grosor(), v = vueloRet(), L = P.largo - 2 * v, c = P.costillas;
  let n;
  if (c.modo === 'numero') n = Math.max(2, Math.round(c.numero));
  else n = Math.max(2, Math.round((L - e) / Math.max(1, c.separacion)) + 1);
  n = Math.min(n, 600);
  const s = (L - e) / (n - 1);
  return { n, s, hueco: s - e, ini: v, xs: Array.from({ length: n }, (_, i) => v + e / 2 + i * s) };
}
function radioAgujero() { return (P.varillas.diam + P.varillas.holgura) / 2; }

function calcular() {
  if (P.tipo === 'plano') return calcularPlano();
  if (relieveActivo()) P.largo = P.relieve.orient === 'h' ? P.relieve.alto : P.relieve.ancho;
  else if (figuraActiva()) P.largo = Math.max(50, Math.round(mallaFigura().largo * 10) / 10);
  const e = grosor(), rep = reparto(), V = P.varillas;
  const res = { n: rep.n, sep: rep.s, hueco: rep.hueco, costillas: [], varillas: [], avisos: [] };
  for (let i = 0; i < rep.n; i++) {
    const x = rep.xs[i], poly = contornoEnX(x);
    const ok = poly.length >= 3 && Math.abs(areaFirmada(poly)) > 25;
    const caja = ok ? cajaDe(poly) : { x0: 0, y0: 0, x1: 0, y1: 0, w: 0, h: 0 };
    res.costillas.push({ i, x, poly: ok ? poly : [], base: ok ? poly : [], ok, caja, area: ok ? areaFirmada(poly) : 0, agujeros: [], nVar: 0, ranuras: [], etq: String(i + 1), nombre: (P.tipo === 'pared' ? 'Lama ' : 'Costilla ') + (i + 1) });
  }
  // figura: fuera las costillas muy pequeñas de los extremos (puntas de los hombros, orejas…)
  if (figuraActiva() && P.figura.minArea > 0) {
    const amax = Math.max(0, ...res.costillas.map(c => Math.abs(c.area)));
    res.costillas.forEach(c => { if (c.ok && Math.abs(c.area) < amax * P.figura.minArea / 100) { c.ok = false; c.poly = []; c.base = []; c.pequeña = true; } });
  }
  res.largueros = []; res.cruces = []; res.discos = []; res.rastreles = []; res.ranurasMal = [];
  // centro del fondo de las costillas (en radial y pared, el eje o la pared: 0)
  const okc = res.costillas.filter(c => c.ok);
  res.uc = P.tipo === 'radial' || P.tipo === 'pared' || !okc.length ? 0 : (Math.min(...okc.map(c => c.caja.x0)) + Math.max(...okc.map(c => c.caja.x1))) / 2;
  ucActual = res.uc;
  const fin = () => {
    res.trozos = res.trozos || []; res.modulos = res.modulos || [];
    res.otras = [...res.largueros, ...res.discos, ...res.trozos, ...res.modulos]; res.otras.forEach((o, k) => o.i = res.n + k);
    const nh = {}; res.modulos.forEach(m => { nh[m.hueco] = (nh[m.hueco] || 0) + 1; m.etq = 'H' + (m.hueco + 1) + '-' + nh[m.hueco]; });
    return res;
  };
  if (P.tipo === 'reticula') { reticula(res); aplicarHuecos(res); avisosHuecos(res); avisosReticula(res); return fin(); }
  if (P.tipo === 'radial') { radialExtras(res); aplicarRanuras(res, e + P.radial.holgura); avisosRadial(res); return fin(); }
  if (P.tipo === 'pared') {
    separarModulos(res); paredExtras(res); aplicarRanuras(res, e); aplicarHuecos(res);
    if (res.rastreles.length && R0ok(res)) { const cs = res.costillas, xA = cs[0].x - e / 2 - 30, xB = cs[cs.length - 1].x + e / 2 + 30; res.rastreles.forEach(r => { r.tramos = usaHuecos() ? tramosRastrel(r.v, P.pared.alto, xA, xB) : [[xA, xB]]; }); }
    if (res.rastreles.length && R0ok(res)) cortarRastrelesModulos(res); avisosModulos(res);
    avisosHuecos(res); avisosPared(res); return fin();
  }
  aplicarHuecos(res);
  // varillas: ¿caben en cada costilla?
  const need = radioAgujero() + V.margen;
  V.lista.forEach((p, k) => {
    const parte = res.costillas.map(c => c.ok ? (c.partes ? parteConPunto(c, p[0], p[1], need) : (distBorde(c.poly, p[0], p[1]) >= need - 1e-6 ? c : null)) : null);
    const cabe = parte.map(q => !!q);
    // de la primera a la última costilla que existe (en las figuras, las de los extremos pueden faltar)
    let a = Math.max(0, res.costillas.findIndex(c => c.ok)), b = rep.n - 1, usada = true;
    while (b > a && !res.costillas[b].ok) b--;
    if (V.tramo === 'cabe') {
      // el tramo seguido más largo donde cabe
      let mejor = [-1, -2], ini = -1;
      for (let i = 0; i <= rep.n; i++) {
        if (i < rep.n && cabe[i]) { if (ini < 0) ini = i; }
        else if (ini >= 0) { if (i - 1 - ini > mejor[1] - mejor[0]) mejor = [ini, i - 1]; ini = -1; }
      }
      if (mejor[0] < 0) usada = false; else { a = mejor[0]; b = mejor[1]; }
    }
    const fallan = [];
    for (let i = a; i <= b && usada; i++) { if (cabe[i]) { parte[i].agujeros.push(k); res.costillas[i].nVar++; } else fallan.push(i); }
    res.varillas.push({ k, u: p[0], v: p[1], cabe, a, b, usada, fallan,
      largo: usada ? (b - a) * rep.s + e + 2 * V.sobra : 0, dists: usada ? new Array(b - a).fill(rep.s) : [] });
  });
  if (disposicion() === 'curva') varillasCurvas(res);
  avisosHuecos(res);
  avisosDe(res, need);
  return fin();
}

const R0ok = res => res.costillas.length > 0;
function lista(nums) { // «3, 4, 5 y 9» a partir de índices (se muestran desde 1)
  const v = nums.map(i => i + 1);
  if (v.length > 6) return v.slice(0, 5).join(', ') + '… (' + v.length + ')';
  return v.length > 1 ? v.slice(0, -1).join(', ') + ' y ' + v[v.length - 1] : String(v[0]);
}
const cst = v => (v.length > 1 ? 'costillas ' : 'costilla ') + lista(v);
const cstLa = v => (v.length > 1 ? 'las ' : 'la ') + cst(v);
function avisosDe(res, need) {
  const A = res.avisos, V = P.varillas, e = grosor();
  const add = (tipo, txt, cost) => A.push({ tipo, txt, cost });
  if (res.hueco < -0.01) add('error', `La separación (${fmt(res.sep, 1)} mm) es menor que el grosor del tablero (${fmt(e, 1)} mm): las costillas se pisan.`);
  else if (res.hueco < 0.5) add('info', 'Costillas apiladas (sin hueco entre ellas): no hacen falta separadores; conviene encolarlas.');
  const vacias = res.costillas.filter(c => !c.ok).map(c => c.i);
  if (vacias.length && figuraActiva()) add('info', `Figura: ${cst(vacias)} ${vacias.length > 1 ? 'quedan' : 'queda'} fuera del modelo o ${vacias.length > 1 ? 'son' : 'es'} más pequeña${vacias.length > 1 ? 's' : ''} que el ${P.figura.minArea} % de la mayor: no se ${vacias.length > 1 ? 'fabrican' : 'fabrica'}.`, vacias[0]);
  else if (vacias.length) add('error', `Sin forma tras los recortes: ${cst(vacias)}.`, vacias[0]);
  if (!V.lista.length) add('atencion', 'No hay varillas: pulsa ✨ Auto o ＋ Varilla para unir las costillas.');
  res.varillas.forEach(r => {
    const nom = 'Varilla ' + (r.k + 1);
    const pista = usaHuecos() ? ' Si es por un hueco, muévelo o pulsa ✨ Auto para recolocar las varillas.' : '';
    if (!r.usada) { add('error', `${nom}: no cabe en ninguna costilla (necesita ${fmt(2 * need, 0)} mm de madera alrededor).${pista}`); return; }
    if (r.fallan.length) add('error', `${nom}: no cabe con ${fmt(V.margen, 0)} mm de madera al borde en ${cstLa(r.fallan)}.${pista}`, r.fallan[0]);
  });
  // varillas demasiado juntas
  for (let i = 0; i < V.lista.length; i++) for (let j = i + 1; j < V.lista.length; j++) {
    const d = Math.hypot(V.lista[i][0] - V.lista[j][0], V.lista[i][1] - V.lista[j][1]);
    if (d < 2 * radioAgujero() + V.margen) add('error', `Las varillas ${i + 1} y ${j + 1} están demasiado juntas (${fmt(d, 0)} mm entre centros).`);
  }
  // planta curva
  if (disposicion() === 'curva') {
    if (res.tocanCurva && res.tocanCurva.length) add('error', `Por el lado de dentro de la curva se tocan con la siguiente: ${cst(res.tocanCurva)}. Sube la separación o abre la curva.`, res.tocanCurva[0]);
    const curvas = res.varillas.filter(v => v.usada && isFinite(v.radioMin));
    if (curvas.length) { const rm = Math.min(...curvas.map(v => v.radioMin)); add(rm < 25 * V.diam ? 'atencion' : 'info', `Planta curva: las varillas se curvan hasta un radio de ${fmt(rm)} mm${rm < 25 * V.diam ? ' (muy cerrado para Ø ' + V.diam + ': usa varilla más fina o abre la curva)' : ''}. Los separadores tienen largos distintos (ver Despiece).`); }
  }
  if (V.lista.length) {
    const sueltas = res.costillas.filter(c => c.ok && c.nVar === 0).map(c => c.i);
    if (sueltas.length) add('error', `Sueltas, sin ninguna varilla: ${cst(sueltas)}.`, sueltas[0]);
    const una = res.costillas.filter(c => c.ok && c.nVar === 1).map(c => c.i);
    if (una.length) add('atencion', `Con una sola varilla (pueden girar; hacen falta 2): ${cst(una)}.`, una[0]);
    if (V.tipo === 'madera' && res.hueco > 0.5) add('info', `Espiga de madera: las costillas se encolan a la espiga, sin separadores. Usa un taco de ${fmt(res.hueco, 1)} mm como plantilla para dejar el hueco entre costillas.`);
    if (conSeparadores() && res.hueco > 0.5 && V.sepD <= V.diam + 1) add('error', `El separador (Ø ${V.sepD}) tiene que ser más ancho que la varilla (Ø ${V.diam}).`);
    if (conSeparadores() && res.hueco > 0.5) {
      const r2 = V.sepD / 2, malos = [];
      res.costillas.forEach(c => { if (!c.ok) return; for (const k of c.agujeros) if (distBorde(c.poly, V.lista[k][0], V.lista[k][1]) < r2 - 0.01) { malos.push(c.i); break; } });
      if (malos.length) add('atencion', `El separador asoma por el borde en ${cstLa(malos)}.`, malos[0]);
    }
  }
  const alto = res.costillas.filter(c => c.ok && c.caja.y0 > 1).map(c => c.i);
  if (P.costillas.base && alto.length && alto.length < res.n) add('info', `No llegan al suelo (cuelgan de las varillas): ${cst(alto)}.`, alto[0]);
  avisosFigura(res, add);
  avisosMaqueta(res, add);
  if (!A.some(a => a.tipo === 'error' || a.tipo === 'atencion')) add('ok', 'Todo correcto: las varillas caben y todas las costillas están sujetas.');
}
// maqueta a escala
function avisosMaqueta(res, add) {
  const M = P.maqueta, e = grosor(), V = P.varillas;
  if (M && M.activa) {
    const k = 1 / M.escala, huecoM = res.sep * k - M.grosor, rM = (M.diam + M.holgura) / 2;
    if (huecoM < -0.01) add('error', `Maqueta 1:${M.escala}: las costillas de ${fmt(M.grosor, 1)} mm se pisan (separación ${fmt(res.sep * k, 1)} mm). Baja el grosor de la maqueta o la escala.`);
    const justas = [];
    res.costillas.forEach(c => { if (!c.ok) return; for (const j of c.agujeros) if (distBorde(c.poly, V.lista[j][0], V.lista[j][1]) * k - rM < 1.5) { justas.push(c.i); break; } });
    if (justas.length) add('atencion', `Maqueta 1:${M.escala}: queda menos de 1,5 mm de material alrededor de algún agujero en ${cstLa(justas)}.`, justas[0]);
    if (Math.abs(M.grosor * M.escala - e) > e * 0.2) add('info', `Maqueta 1:${M.escala}: ${fmt(M.grosor, 1)} mm equivalen a ${fmt(M.grosor * M.escala)} mm reales (el tablero real es de ${fmt(e, 1)} mm): la maqueta se verá ${M.grosor * M.escala > e ? 'más llena' : 'más calada'}.`);
    if (P.tipo === 'reticula' && res.sep / M.escala - M.grosor < 0.5) add('error', `Maqueta 1:${M.escala}: con ${fmt(M.grosor, 1)} mm las costillas se tocan.`);
  }
}

// Busca sitio para n varillas que atraviesen las costillas, lo más separadas posible
function autoVarillas(n) {
  const res = R || calcular(), V = P.varillas;
  const cs = res.costillas.filter(c => c.ok);
  if (!cs.length) return 0;
  const need = radioAgujero() + V.margen + 2;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  cs.forEach(c => { x0 = Math.min(x0, c.caja.x0); y0 = Math.min(y0, c.caja.y0); x1 = Math.max(x1, c.caja.x1); y1 = Math.max(y1, c.caja.y1); });
  const paso = Math.max(3, Math.min(x1 - x0, y1 - y0) / 45);
  const medio = Math.floor(res.n / 2), cand = [];
  // en «solo donde caben» se puntúa por cuántas costillas seguidas (alrededor de la central) atraviesa
  for (let y = y0 + paso / 2; y < y1; y += paso) for (let x = x0 + paso / 2; x < x1; x += paso) {
    if (V.tramo === 'todas') {
      let m = Infinity;
      for (const c of cs) { const d = distBorde(c.poly, x, y); if (d < m) m = d; if (m < need) break; }
      if (m >= need) cand.push({ x, y, m, cuenta: cs.length });
    } else {
      const c0 = res.costillas[medio]; if (!c0.ok || distBorde(c0.poly, x, y) < need) continue;
      let cuenta = 1;
      for (let i = medio - 1; i >= 0 && res.costillas[i].ok && distBorde(res.costillas[i].poly, x, y) >= need; i--) cuenta++;
      for (let i = medio + 1; i < res.n && res.costillas[i].ok && distBorde(res.costillas[i].poly, x, y) >= need; i++) cuenta++;
      cand.push({ x, y, m: need, cuenta });
    }
  }
  if (!cand.length) return 0;
  const maxC = Math.max(...cand.map(c => c.cuenta));
  const validos = cand.filter(c => c.cuenta >= Math.ceil(maxC * 0.85));
  const minSep = 2 * radioAgujero() + V.margen + 4;
  const elegidos = [];
  // primera: la más baja y centrada (estabilidad); luego, la más alejada de las ya elegidas
  validos.sort((a, b) => a.y - b.y || Math.abs(a.x - (x0 + x1) / 2) - Math.abs(b.x - (x0 + x1) / 2));
  elegidos.push(validos[0]);
  while (elegidos.length < n) {
    let mejor = null, md = -1;
    for (const c of validos) {
      let d = Infinity; for (const e of elegidos) d = Math.min(d, Math.hypot(c.x - e.x, c.y - e.y));
      if (d >= minSep && d > md) { md = d; mejor = c; }
    }
    if (!mejor) break;
    elegidos.push(mejor);
  }
  V.lista = elegidos.map(c => [Math.round(c.x), Math.round(c.y)]);
  return elegidos.length;
}

// punto interior bien separado del borde y de los agujeros (para grabar el número)
// sitio para el número de la pieza: el punto más alejado del borde, de los agujeros y de los huecos.
// Rejilla gruesa (unos 500 puntos, aunque la pieza sea muy alargada) y luego se afina alrededor del mejor.
// Se guarda en la pieza (cambia solo si cambian las varillas).
function puntoEtiqueta(c) {
  if (!c.ok || !c.poly || c.poly.length < 3) return [0, 0];
  const r = radioAgujero(), clave = c.agujeros.map(k => P.varillas.lista[k].join(',')).join(';') + '|' + r;
  if (c._etq && c._etq.clave === clave && c._etq.poly === c.poly) return c._etq.p;
  const b = c.caja, val = (x, y) => {
    let d = distBorde(c.poly, x, y); if (d <= 0) return -Infinity;
    if (c.int && c.int.length) { if (c.int.some(hh => dentro(hh, x, y))) return -Infinity; c.int.forEach(hh => { d = Math.min(d, -distBorde(hh, x, y)); }); }
    for (const k of c.agujeros) d = Math.min(d, Math.hypot(x - P.varillas.lista[k][0], y - P.varillas.lista[k][1]) - r);
    return d;
  };
  let paso = Math.max(1, Math.min(b.w, b.h) / 30, Math.sqrt(b.w * b.h / 500));
  let mejor = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2], md = -Infinity;
  for (let y = b.y0 + paso / 2; y < b.y1; y += paso) for (let x = b.x0 + paso / 2; x < b.x1; x += paso) { const d = val(x, y); if (d > md) { md = d; mejor = [x, y]; } }
  // afinar: 4 rondas de 5 × 5 alrededor del mejor, con paso cada vez más pequeño
  for (let ronda = 0; ronda < 4 && md > -Infinity; ronda++) {
    paso /= 2.5; const [cx, cy] = mejor;
    for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const x = cx + i * paso, y = cy + j * paso, d = val(x, y); if (d > md) { md = d; mejor = [x, y]; } }
  }
  c._etq = { clave, poly: c.poly, p: mejor };
  return mejor;
}

/* ===================== RETÍCULA ENTRELAZADA (WAFFLE) =====================
   Además de las costillas (planos perpendiculares a X), unos «largueros»: planos perpendiculares
   a Z, en el plano (x, v), que se sacan cortando el volumen. En cada cruce, ranura a media madera:
   la costilla desde arriba y el larguero desde abajo (o al revés). */
const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const letra = k => k < 26 ? LETRAS[k] : LETRAS[Math.floor(k / 26) - 1] + LETRAS[k % 26];

// tramos [v0, v1] en los que la recta vertical h = x corta al polígono (coordenadas [h, v])
function intervalosV(poly, x) {
  const vs = [];
  for (let i = 0, n = poly.length; i < n; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    if ((p[0] < x) !== (q[0] < x)) vs.push(p[1] + (x - p[0]) / (q[0] - p[0]) * (q[1] - p[1]));
  }
  vs.sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i + 1 < vs.length; i += 2) if (vs[i + 1] - vs[i] > 0.3) out.push([vs[i], vs[i + 1]]);
  return out;
}
// ranura que entra por el borde de arriba (o de abajo) del polígono, centrada en h = c, de ancho w, hasta v = vMid
function hacerRanura(poly, r, w) {
  const n = poly.length, a = r.c - w / 2, b = r.c + w / 2, arriba = r.arriba;
  const cruce = x => {
    let mejor = null, md = Infinity;
    for (let i = 0; i < n; i++) {
      const p = poly[i], q = poly[(i + 1) % n];
      if ((p[0] < x) === (q[0] < x)) continue;
      const dir = q[0] - p[0];
      if (arriba ? dir > 0 : dir < 0) continue;      // arriba: el borde va hacia -h; abajo: hacia +h (sentido antihorario)
      const v = p[1] + (x - p[0]) / (q[0] - p[0]) * (q[1] - p[1]), d = Math.abs(v - r.borde);
      if (d < md) { md = d; mejor = { i, v }; }
    }
    return mejor;
  };
  const A = cruce(a), B = cruce(b);
  if (!A || !B) return null;
  const pri = arriba ? B : A, seg = arriba ? A : B, xp = arriba ? b : a, xs = arriba ? a : b;
  if ((arriba ? pri.v < r.mid : pri.v > r.mid) || (arriba ? seg.v < r.mid : seg.v > r.mid)) return null;
  if (((seg.i - pri.i + n) % n) > n / 2) return null;
  const out = [];
  for (let k = seg.i + 1; ; k++) { const idx = k % n; out.push(poly[idx]); if (idx === pri.i) break; }
  const e1 = [xp, r.mid], e2 = [xs, r.mid];
  out.push([xp, pri.v], e1, e2, [xs, seg.v]);
  out.esq = [e1, e2];                      // esquinas interiores (para el hueso de perro)
  return out;
}
// aplica las ranuras de una pieza con un ancho dado (en sus coordenadas); devuelve el polígono y las que fallan
function ranurar(base, ranuras, w) {
  let poly = base; const fallan = [], esq = [];
  for (const r of ranuras) {
    const ww = r.ancho != null ? r.ancho : w, nuevo = r.lat ? hacerRanuraLat(poly, r, ww) : hacerRanura(poly, r, ww);
    if (nuevo) { poly = nuevo; if (nuevo.esq) esq.push(...nuevo.esq); } else fallan.push(r);
  }
  if (poly !== base) poly.esq = esq;     // todas las esquinas, para dibujar el hueso de perro en las vistas
  return { poly, fallan, esq };
}

function reticula(res) {
  const Rt = P.reticula, e = grosor(), L = P.largo;
  const cs = res.costillas.filter(c => c.ok);
  if (!cs.length) return;
  // posiciones de los largueros en el fondo (u)
  // dentro de la zona común a las costillas principales (las de al menos el 70 % del fondo mayor),
  // para que los largueros no caigan donde el frente o la espalda ondulan
  const wMax = Math.max(...cs.map(c => c.caja.w)), princ = cs.filter(c => c.caja.w >= 0.7 * wMax);
  let u0 = -Infinity, u1 = Infinity; princ.forEach(c => { u0 = Math.max(u0, c.caja.x0); u1 = Math.min(u1, c.caja.x1); });
  if (!(u1 - u0 > 2 * e)) { u0 = Math.min(...cs.map(c => c.caja.x0)); u1 = Math.max(...cs.map(c => c.caja.x1)); }
  const n = Math.max(1, Math.round(Rt.num)), m = clamp(Rt.margen, 0, (u1 - u0) / 2 - 1);
  const us = n === 1 ? [(u0 + u1) / 2] : Array.from({ length: n }, (_, j) => u0 + m + j * (u1 - u0 - 2 * m) / (n - 1));
  // perfiles en columnas a lo largo de x (compartidos por todos los largueros)
  const NX = clamp(Math.round(L / 5), 80, 420), xs = Array.from({ length: NX + 1 }, (_, i) => L * i / NX);
  const cols = xs.map(x => contornoEnX(x));
  res.largueros = []; res.cruces = []; res.partidos = [];
  us.forEach((u, j) => {
    // seguir los tramos verticales columna a columna; cada tramo seguido es una pieza
    let activos = []; const piezas = [];
    xs.forEach((x, ix) => {
      const ints = cols[ix].length >= 3 ? intervalosV(cols[ix], u) : [];
      const usados = new Set(), nuevos = [];
      ints.forEach(I => {
        const cand = activos.filter(A => A.ult[0] < I[1] && I[0] < A.ult[1]);
        const otros = cand.length === 1 ? ints.filter(J => J !== I && cand[0].ult[0] < J[1] && J[0] < cand[0].ult[1]) : [];
        if (cand.length === 1 && !otros.length && !usados.has(cand[0])) {
          const A = cand[0]; usados.add(A); A.abajo.push([x, I[0]]); A.arriba.push([x, I[1]]); A.ult = I; nuevos.push(A);
        } else nuevos.push({ abajo: [[x, I[0]]], arriba: [[x, I[1]]], ult: I });
      });
      activos.forEach(A => { if (!nuevos.includes(A)) piezas.push(A); });
      activos = nuevos;
    });
    piezas.push(...activos);
    // los trozos demasiado bajos o cortos para encajar en las costillas se descartan
    const validas = [];
    piezas.filter(p => p.abajo.length >= 2).forEach(p => {
      let poly = simplificaCerrado(p.abajo.concat(p.arriba.slice().reverse()), 0.02);
      if (areaFirmada(poly) < 0) poly.reverse();
      const b = cajaDe(poly);
      if (b.h < 4 * e || b.w < Math.min(2 * res.sep, L / 2)) { res.descartados = (res.descartados || 0) + 1; return; }
      validas.push(poly);
    });
    if (validas.length > 1) res.partidos.push(j);
    validas.forEach((poly, ip) => {
      const k = res.largueros.length, et = letra(j) + (validas.length > 1 ? (ip + 1) : '');
      res.largueros.push({ i: res.n + k, k, j, u, z: true, etq: et, nombre: 'Larguero ' + et, base: poly, poly, ok: Math.abs(areaFirmada(poly)) > 25, caja: cajaDe(poly), area: areaFirmada(poly), agujeros: [], ranuras: [], nVar: 0, x: u });
    });
  });
  // cruces y ranuras a media madera
  const xArriba = Rt.xArriba !== false;
  res.costillas.forEach(c => {
    if (!c.ok) return;
    res.largueros.forEach(z => {
      if (!z.ok) return;
      const ix = intervalosV(c.poly, z.u), iz = intervalosV(z.base, c.x);
      ix.forEach(I => iz.forEach(J => {
        const a = Math.max(I[0], J[0]), b = Math.min(I[1], J[1]);
        if (b - a < 0.5) return;
        const mid = (a + b) / 2;
        c.ranuras.push({ c: z.u, mid, borde: xArriba ? I[1] : I[0], arriba: xArriba, z: z.k });
        z.ranuras.push({ c: c.x, mid, borde: xArriba ? J[0] : J[1], arriba: !xArriba, x: c.i });
        res.cruces.push({ i: c.i, k: z.k, a, b });
      }));
    });
  });
  // ranuras con el ancho real (grosor + holgura)
  const w = e + Rt.holgura;
  res.ranurasMal = [];
  [...res.costillas, ...res.largueros].forEach(p => {
    if (!p.ok || !p.ranuras.length) return;
    const r = ranurar(p.base, p.ranuras, w);
    p.poly = r.poly; p.caja = cajaDe(p.poly); p.area = areaFirmada(p.poly);
    if (r.fallan.length) res.ranurasMal.push(p);
  });
}

function avisosReticula(res) {
  const A = res.avisos, e = grosor(), add = (tipo, txt, cost) => A.push({ tipo, txt, cost });
  if (res.hueco < 0.5) add('error', `Retícula: la separación de las costillas (${fmt(res.sep, 1)} mm) tiene que ser mayor que el grosor (${fmt(e, 1)} mm).`);
  const vacias = res.costillas.filter(c => !c.ok).map(c => c.i);
  if (vacias.length && figuraActiva()) add('info', `Figura: ${cst(vacias)} ${vacias.length > 1 ? 'quedan' : 'queda'} fuera del modelo o ${vacias.length > 1 ? 'son' : 'es'} más pequeña${vacias.length > 1 ? 's' : ''} que el ${P.figura.minArea} % de la mayor: no se ${vacias.length > 1 ? 'fabrican' : 'fabrica'}.`, vacias[0]);
  else if (vacias.length) add('error', `Sin forma tras los recortes: ${cst(vacias)}.`, vacias[0]);
  if (!res.largueros.length) { add('error', 'Retícula: no sale ningún larguero. Revisa el número de largueros y el margen.'); return; }
  // separación entre largueros
  const us = [...new Set(res.largueros.map(z => z.u))].sort((a, b) => a - b);
  for (let i = 1; i < us.length; i++) if (us[i] - us[i - 1] < e + 0.5) { add('error', `Retícula: dos largueros están a ${fmt(us[i] - us[i - 1], 1)} mm (menos que el grosor): se pisan.`); break; }
  res.ranurasMal.forEach(p => add('error', `No se pudo hacer alguna ranura en ${p.z ? 'el larguero ' + p.etq : 'la costilla ' + p.etq} (el borde es casi vertical en el cruce).`, p.i));
  const sinCruce = res.costillas.filter(c => c.ok && !c.ranuras.length).map(c => c.i);
  if (sinCruce.length) add('error', `Sueltas, sin ningún larguero que las cruce: ${cst(sinCruce)}.`, sinCruce[0]);
  const zPocos = res.largueros.filter(z => z.ok && z.ranuras.length < 2);
  if (zPocos.length) add('atencion', `Largueros que cruzan menos de 2 costillas: ${zPocos.map(z => z.etq).join(', ')}.`, zPocos[0].i);
  const debiles = [...new Set(res.cruces.filter(c => c.b - c.a < 2.5 * e).map(c => c.i))];
  if (debiles.length) add('atencion', `Cruces muy bajos (menos de ${fmt(2.5 * e)} mm de madera en común): unión floja en ${cstLa(debiles)}.`, debiles[0]);
  if (res.descartados) add('info', `Se han quitado ${res.descartados} trozo${res.descartados > 1 ? 's' : ''} de larguero demasiado pequeño${res.descartados > 1 ? 's' : ''} para encajar (cerca de un lateral inclinado). Si quieres ese larguero, cambia el margen.`);
  if (res.partidos.length) add('info', `Largueros partidos en varias piezas porque la forma tiene huecos: ${res.partidos.map(letra).join(', ')}.`);
  const alto = res.costillas.filter(c => c.ok && c.caja.y0 > 1).map(c => c.i);
  if (P.costillas.base && alto.length && alto.length < res.n) add('info', `No llegan al suelo (las sujetan los largueros): ${cst(alto)}.`, alto[0]);
  avisosFigura(res, add);
  avisosMaqueta(res, add);
  if (!A.some(a => a.tipo === 'error' || a.tipo === 'atencion')) add('ok', `Todo correcto: ${res.cruces.length} cruces a media madera entre ${res.costillas.filter(c => c.ok).length} costillas y ${res.largueros.length} largueros.`);
}

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
  let alturas = n === 1 ? [(vA + vB) / 2] : Array.from({ length: n }, (_, j) => vA + m + j * (vB - vA - 2 * m) / (n - 1));
  // lamas partidas con las juntas alineadas: un rastrel a cada lado de cada junta (cada banda, un módulo)
  prepararJuntas(cs);
  if (JUNTAS && JUNTAS.bases.length && JUNTAS.patron === 'alineado' && partirP().rastreles) {
    const dj = anchoJunta() / 2 + 20 + Pa.alto / 2, cerca = v => JUNTAS.bases.some(b => Math.abs(v - b) < dj + Pa.alto);
    alturas = alturas.filter(v => !cerca(v));
    JUNTAS.bases.forEach(b => alturas.push(b - dj, b + dj));
    alturas = alturas.filter(v => v > vA + Pa.alto / 2 && v < vB - Pa.alto / 2).sort((p, q) => p - q);
  }
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

/* ===================== RELIEVE DESDE TEXTO O MODELO 3D (paneles de pared) =====================
   La forma de las lamas no sale de los perfiles clave sino de un «mapa de profundidad» del panel:
   - texto: se dibuja con una fuente del sistema, se suaviza y sus letras salen (o se hunden)
   - modelo: un STL, OBJ, GLB o PLY proyectado desde un lado; lo más cercano sale más
   - imagen: una foto o dibujo en escala de grises (mapa de alturas); lo claro sale más
   El mapa cubre el panel (ancho × alto, en mm) y vale de 0 (fondo) a 1 (lo que más sale). */
const relieveActivo = () => P.tipo === 'pared' && P.relieve && ['texto', 'modelo', 'imagen'].includes(P.relieve.fuente);
// medidas del panel: ancho (horizontal) y alto (vertical)
function medidasPanel() {
  if (relieveActivo()) return [P.relieve.ancho, P.relieve.alto];
  // con perfiles clave: la lama mide lo que el alto de los perfiles
  const H = altoPerfiles();
  return P.relieve && P.relieve.orient === 'h' ? [H, P.largo] : [P.largo, H];
}
function altoPerfiles() {
  let a = 0, b = 0; (P.claves || []).forEach(k => k.pts.forEach(q => { a = Math.min(a, q[1]); b = Math.max(b, q[1]); }));
  return b - a || (P.params && P.params.alto) || 1000;
}
// a lo ancho del perfil (lo que mide cada lama a lo largo): en lamas horizontales, el ancho del panel
const anchoPerfil = () => medidasPanel()[0];

const CACHE_MAPA = { clave: '', mapa: null };
function mapaRelieve() {
  const Rl = P.relieve, clave = JSON.stringify([Rl.fuente, Rl.ancho, Rl.alto, Rl.texto, Rl.letra, Rl.tamLetra, Rl.negrita, Rl.interlinea, Rl.suavizado, Rl.invertir, Rl.ondaAmp, Rl.ondas, Rl.modelo && Rl.modelo.id, Rl.imagen && Rl.imagen.id, Rl.gama, UI.letrasCargadas || 0]);
  if (CACHE_MAPA.clave === clave) return CACHE_MAPA.mapa;
  let m = Rl.fuente === 'texto' ? mapaTexto(Rl) : Rl.fuente === 'imagen' ? mapaImagen(Rl) : mapaModelo(Rl);
  if (m && Rl.suavizado > 0) m = suavizarMapa(m, Rl.suavizado / m.mm);
  if (m && Rl.invertir) for (let i = 0; i < m.d.length; i++) m.d[i] = 1 - m.d[i];
  CACHE_MAPA.clave = clave; CACHE_MAPA.mapa = m;
  return m;
}
// «texto añadido»: un texto encima de cualquier relieve (sale o se hunde)
const CACHE_CAPA = { clave: '', mapa: null };
function mapaCapa() {
  const Rl = P.relieve, C = Rl.capa;
  if (!C || !C.activa || !String(C.texto || '').trim()) return null;
  const clave = JSON.stringify([Rl.ancho, Rl.alto, Rl.suavizado, C.texto, C.letra, C.negrita, C.tamLetra, C.x, C.y, UI.letrasCargadas || 0]);
  if (CACHE_CAPA.clave === clave) return CACHE_CAPA.mapa;
  let m = mapaTexto(Rl, { texto: C.texto, letra: C.letra, negrita: C.negrita, tamLetra: C.tamLetra, interlinea: 1.05 }, C.x, C.y);
  if (m && Rl.suavizado > 0) m = suavizarMapa(m, Math.min(Rl.suavizado, C.tamLetra / 8) / m.mm);
  CACHE_CAPA.clave = clave; CACHE_CAPA.mapa = m;
  return m;
}
function muestraMapa(m, X, Y, alto) {
  const fx = clamp(X / m.mm, 0, m.w - 1), fy = clamp((alto - Y) / (m.mmY || m.mm), 0, m.h - 1);
  const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(m.w - 1, x0 + 1), y1 = Math.min(m.h - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
  const g = (x, y) => m.d[y * m.w + x];
  return (g(x0, y0) * (1 - tx) + g(x1, y0) * tx) * (1 - ty) + (g(x0, y1) * (1 - tx) + g(x1, y1) * tx) * ty;
}
// profundidad (mm) en el punto (X horizontal, Y vertical) del panel
function profundidadEn(X, Y) {
  const Rl = P.relieve, m = mapaRelieve();
  let h = 0;
  if (m) {
    const fx = clamp(X / m.mm, 0, m.w - 1), fy = clamp((Rl.alto - Y) / (m.mmY || m.mm), 0, m.h - 1);
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(m.w - 1, x0 + 1), y1 = Math.min(m.h - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
    const g = (x, y) => m.d[y * m.w + x];
    h = (g(x0, y0) * (1 - tx) + g(x1, y0) * tx) * (1 - ty) + (g(x0, y1) * (1 - tx) + g(x1, y1) * tx) * ty;
  }
  const onda = Rl.ondaAmp ? Rl.ondaAmp * (0.5 + 0.5 * Math.sin(PI2 * (Rl.ondas || 1) * X / Rl.ancho)) : 0;
  const mc = mapaCapa(), capa = mc ? (Rl.capa.modo === 'hundir' ? -1 : 1) * Rl.capa.relieve * muestraMapa(mc, X, Y, Rl.alto) : 0;
  return Math.max(2, Rl.fondo + Rl.relieve * h + onda + capa);
}
// contorno de la lama en la posición x (horizontal en lamas verticales, altura en las horizontales)
function poligonoRelieve(x, denso) {
  const [W, H] = medidasPanel(), hor = P.relieve.orient === 'h', largoV = hor ? W : H;
  const paso = Math.max(1.5, largoV / 260), out = [[0, 0]];
  for (let v = 0; v <= largoV + 1e-6; v += paso) out.push([hor ? profundidadEn(v, x) : profundidadEn(x, v), Math.min(v, largoV)]);
  if (out[out.length - 1][1] < largoV) out.push([hor ? profundidadEn(largoV, x) : profundidadEn(x, largoV), largoV]);
  out.push([0, largoV]);
  return denso ? out : simplificaCerrado(out, 0.02);
}
// contorno de la costilla en la posición x, venga de los perfiles clave o del relieve
function contornoEnX(x) { return relieveActivo() ? poligonoRelieve(x) : figuraActiva() ? poligonoFigura(x) : contornoDe(perfilEn(x)); }

/* ---------- texto ---------- */
const LETRAS_SISTEMA = ['Arial Black', 'Arial', 'Impact', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Georgia', 'Times New Roman', 'Courier New', 'Comic Sans MS', 'serif', 'sans-serif', 'monospace'];
// letras propias (.ttf, .otf, .woff): se guardan dentro del proyecto y se registran con FontFace
const letrasRegistradas = new Set();
function registrarLetras() {
  const L = (P && P.relieve && P.relieve.letras) || [];
  L.forEach(f => {
    const k = f.nombre + '|' + f.b64.length; if (letrasRegistradas.has(k) || typeof FontFace === 'undefined') return;
    letrasRegistradas.add(k);
    try {
      const ff = new FontFace(f.nombre, bufferDeB64(f.b64));
      ff.load().then(x => { document.fonts.add(x); UI.letrasCargadas = (UI.letrasCargadas || 0) + 1; if (relieveActivo() || (P.huecos || []).some(h => h.forma === 'texto')) { recalcular(); } })
        .catch(() => aviso('⚠ No se puede usar la letra «' + esc(f.nombre) + '»', 5000));
    } catch (e) { aviso('⚠ ' + esc(e.message), 5000); }
  });
}
function cargarLetraArchivo(file) {
  return file.arrayBuffer().then(buf => {
    if (buf.byteLength > 3e6) throw new Error('La letra pesa más de 3 MB: busca una versión más ligera.');
    const nombre = file.name.replace(/\.[^.]+$/, '').replace(/[^\wÀ-ÿ \-]+/g, ' ').trim() || 'Mi letra';
    const ff = new FontFace(nombre, buf);
    return ff.load().then(x => {
      document.fonts.add(x);
      const L = P.relieve.letras || (P.relieve.letras = []), i = L.findIndex(f => f.nombre === nombre), d = { nombre, b64: b64DeBuffer(buf) };
      if (i >= 0) L[i] = d; else L.push(d);
      letrasRegistradas.add(nombre + '|' + d.b64.length); UI.letrasCargadas = (UI.letrasCargadas || 0) + 1;
      return nombre;
    });
  });
}
function llenarLetras() {
  const propias = ((P && P.relieve && P.relieve.letras) || []).map(f => f.nombre);
  $$('.selLetra').forEach(sel => {
    const v = sel.value; sel.innerHTML = '';
    if (propias.length) { const g = document.createElement('optgroup'); g.label = 'Tus letras'; propias.forEach(l => g.appendChild(new Option(l, l))); sel.appendChild(g); }
    const g2 = document.createElement('optgroup'); g2.label = 'Del ordenador'; LETRAS_SISTEMA.forEach(l => g2.appendChild(new Option(l, l))); sel.appendChild(g2);
    if (v) sel.value = v;
  });
}
function mapaTexto(Rl, T, cx, cy) {
  T = T || Rl;   // T: el texto que se dibuja (el principal o el «texto añadido»); cx, cy: centro en % del panel
  const mm = Math.max(1, Math.max(Rl.ancho, Rl.alto) / 700), w = Math.max(8, Math.round(Rl.ancho / mm)), h = Math.max(8, Math.round(Rl.alto / mm));
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  const lineas = String(T.texto || '').split('\n'), pt = T.tamLetra / mm;
  ctx.font = `${T.negrita ? 'bold ' : ''}${pt}px "${T.letra}", sans-serif`;
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const alto = pt * (T.interlinea || 1.1), X = w * (cx == null ? 50 : cx) / 100, Y = h * (1 - (cy == null ? 50 : cy) / 100);
  lineas.forEach((l, i) => ctx.fillText(l, X, Y + (i - (lineas.length - 1) / 2) * alto));
  const px = ctx.getImageData(0, 0, w, h).data, d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = px[i * 4] / 255;
  return { w, h, mm, d };
}
// desenfoque por cajas (tres pasadas ≈ gaussiano): letras y bordes redondeados
function suavizarMapa(m, rad) {
  const r = Math.max(1, Math.round(rad / 2)), w = m.w, h = m.h; let a = Float32Array.from(m.d), b = new Float32Array(w * h);
  for (let pas = 0; pas < 3; pas++) {
    for (let y = 0; y < h; y++) { let s = 0; for (let x = -r; x <= r; x++) s += a[y * w + clamp(x, 0, w - 1)]; for (let x = 0; x < w; x++) { b[y * w + x] = s / (2 * r + 1); s += a[y * w + clamp(x + r + 1, 0, w - 1)] - a[y * w + clamp(x - r, 0, w - 1)]; } }
    for (let x = 0; x < w; x++) { let s = 0; for (let y = -r; y <= r; y++) s += b[clamp(y, 0, h - 1) * w + x]; for (let y = 0; y < h; y++) { a[y * w + x] = s / (2 * r + 1); s += b[clamp(y + r + 1, 0, h - 1) * w + x] - b[clamp(y - r, 0, h - 1) * w + x]; } }
  }
  return { ...m, d: a };
}

/* ---------- modelo 3D ---------- */
// lee un STL (binario o de texto), un OBJ, un GLB / glTF o un PLY y devuelve los triángulos [[x,y,z]×3]
function leerMalla(buf, nombre) {
  const u8 = new Uint8Array(buf), tri = [];
  const txt = () => new TextDecoder().decode(u8), cab = String.fromCharCode(...u8.subarray(0, 4));
  if (/\.(glb|gltf)$/i.test(nombre) || cab === 'glTF') return leerGLTF(buf).filter(t => t.every(p => p && p.every(isFinite)));
  if (/\.ply$/i.test(nombre) || cab.slice(0, 3) === 'ply') return leerPLY(buf).filter(t => t.every(p => p && p.every(isFinite)));
  if (/\.obj$/i.test(nombre)) {
    const vs = [];
    txt().split(/\r?\n/).forEach(l => {
      const t = l.trim().split(/\s+/);
      if (t[0] === 'v') vs.push([+t[1], +t[2], +t[3]]);
      else if (t[0] === 'f') { const ix = t.slice(1).map(s => { const k = parseInt(s, 10); return k < 0 ? vs.length + k : k - 1; }); for (let i = 1; i + 1 < ix.length; i++) tri.push([vs[ix[0]], vs[ix[i]], vs[ix[i + 1]]]); }
    });
  } else {
    const dv = new DataView(buf), n = u8.length >= 84 ? dv.getUint32(80, true) : 0;
    if (u8.length >= 84 && 84 + n * 50 === u8.length) {
      for (let i = 0; i < n; i++) { const o = 84 + i * 50 + 12, p = k => [dv.getFloat32(o + k * 12, true), dv.getFloat32(o + k * 12 + 4, true), dv.getFloat32(o + k * 12 + 8, true)]; tri.push([p(0), p(1), p(2)]); }
    } else {
      const v = []; txt().replace(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g, (_, a, b, c) => { v.push([+a, +b, +c]); return ''; });
      for (let i = 0; i + 2 < v.length; i += 3) tri.push([v[i], v[i + 1], v[i + 2]]);
    }
  }
  return tri.filter(t => t.every(p => p && p.every(isFinite)));
}
/* GLB (glTF binario) o .gltf con los datos dentro: recorre la escena con las matrices de cada nodo.
   Las mallas comprimidas (Draco, Meshopt) no se leen. */
function leerGLTF(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(buf); let js = null, bin = null;
  if (u8.length >= 20 && dv.getUint32(0, true) === 0x46546C67) {
    for (let o = 12; o + 8 <= u8.length;) {
      const len = dv.getUint32(o, true), tipo = dv.getUint32(o + 4, true), d = u8.subarray(o + 8, o + 8 + len);
      if (tipo === 0x4E4F534A) js = JSON.parse(new TextDecoder().decode(d)); else if (tipo === 0x004E4942 && !bin) bin = d;
      o += 8 + len;
    }
  } else { try { js = JSON.parse(new TextDecoder().decode(u8)); } catch (e) { /* abajo */ } }
  if (!js || !js.asset) throw new Error('No parece un archivo glTF / GLB.');
  const req = js.extensionsRequired || [];
  if (req.some(x => /draco|meshopt/i.test(x))) throw new Error('El modelo está comprimido (Draco o Meshopt). Vuelve a exportarlo sin compresión (en Blender: Exportar glTF → desmarca «Compresión»).');
  const bufs = (js.buffers || []).map(b => {
    if (b.uri == null) return bin;
    const m = /^data:[^,]*;base64,(.*)$/.exec(b.uri);
    if (!m) throw new Error('Este .gltf guarda los datos en un archivo .bin aparte: guárdalo como .glb (un solo archivo).');
    const t = atob(m[1]), out = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) out[i] = t.charCodeAt(i); return out;
  });
  const COMP = { 5120: [1, 'getInt8', 127], 5121: [1, 'getUint8', 255], 5122: [2, 'getInt16', 32767], 5123: [2, 'getUint16', 65535], 5125: [4, 'getUint32', 0], 5126: [4, 'getFloat32', 0] };
  const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const accesor = i => {
    const a = js.accessors[i], [tam, fn, max] = COMP[a.componentType] || [], nc = NC[a.type] || 1, out = [];
    if (!tam) throw new Error('Tipo de datos glTF no admitido.');
    if (a.bufferView == null) { for (let k = 0; k < a.count; k++) out.push(new Array(nc).fill(0)); return out; }
    const bv = js.bufferViews[a.bufferView], b = bufs[bv.buffer]; if (!b) throw new Error('Al glTF le faltan datos.');
    const d = new DataView(b.buffer, b.byteOffset, b.byteLength), paso = bv.byteStride || tam * nc, base = (bv.byteOffset || 0) + (a.byteOffset || 0);
    for (let k = 0; k < a.count; k++) {
      const v = []; for (let c = 0; c < nc; c++) { let x = d[fn](base + k * paso + c * tam, true); if (a.normalized && max) x = Math.max(x / max, -1); v.push(x); }
      out.push(v);
    }
    return out;
  };
  const mul4 = (A, B) => { const C = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) C[c * 4 + r] += A[k * 4 + r] * B[c * 4 + k]; return C; };
  const local = n => {
    if (n.matrix) return n.matrix.slice();
    const [tx, ty, tz] = n.translation || [0, 0, 0], [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1];
    return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
      2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
      2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
  };
  const tri = [], nodos = js.nodes || [], cache = {};
  const malla = (mi, M) => {
    (js.meshes[mi].primitives || []).forEach(pr => {
      const modo = pr.mode == null ? 4 : pr.mode; if (modo < 4 || pr.attributes.POSITION == null) return;
      const ck = pr.attributes.POSITION, P0 = cache[ck] || (cache[ck] = accesor(ck));
      const V = P0.map(p => [M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12], M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13], M[2] * p[0] + M[6] * p[1] + M[10] * p[2] + M[14]]);
      const I = pr.indices != null ? accesor(pr.indices).map(v => v[0]) : V.map((_, k) => k);
      if (modo === 4) for (let k = 0; k + 2 < I.length; k += 3) tri.push([V[I[k]], V[I[k + 1]], V[I[k + 2]]]);
      else if (modo === 5) for (let k = 0; k + 2 < I.length; k++) tri.push(k % 2 ? [V[I[k + 1]], V[I[k]], V[I[k + 2]]] : [V[I[k]], V[I[k + 1]], V[I[k + 2]]]);
      else if (modo === 6) for (let k = 1; k + 1 < I.length; k++) tri.push([V[I[0]], V[I[k]], V[I[k + 1]]]);
    });
  };
  const visitar = (ni, M, prof) => {
    const n = nodos[ni]; if (!n || prof > 64) return;
    const M2 = mul4(M, local(n));
    if (n.mesh != null && js.meshes[n.mesh]) malla(n.mesh, M2);
    (n.children || []).forEach(h => visitar(h, M2, prof + 1));
  };
  const I4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  let raices = js.scenes && js.scenes.length ? (js.scenes[js.scene || 0] || js.scenes[0]).nodes || [] : null;
  if (!raices) { const hijos = new Set(); nodos.forEach(n => (n.children || []).forEach(h => hijos.add(h))); raices = nodos.map((_, i) => i).filter(i => !hijos.has(i)); }
  raices.forEach(r => visitar(r, I4, 0));
  if (!nodos.length && js.meshes) js.meshes.forEach((_, i) => malla(i, I4));
  if (!tri.length) throw new Error('El glTF no tiene ninguna malla de triángulos.');
  return tri;
}
/* PLY de texto o binario (escáneres, fotogrametría, MeshLab) */
function leerPLY(buf) {
  const u8 = new Uint8Array(buf), cab = new TextDecoder('latin1').decode(u8.subarray(0, Math.min(u8.length, 1 << 16)));
  const fin = cab.indexOf('end_header');
  if (!/^ply\s/.test(cab) || fin < 0) throw new Error('No parece un archivo PLY.');
  let o = fin + 10; if (cab[o] === '\r') o++; if (cab[o] === '\n') o++;
  const TIPOS = { char: [1, 'getInt8'], int8: [1, 'getInt8'], uchar: [1, 'getUint8'], uint8: [1, 'getUint8'], short: [2, 'getInt16'], int16: [2, 'getInt16'], ushort: [2, 'getUint16'], uint16: [2, 'getUint16'], int: [4, 'getInt32'], int32: [4, 'getInt32'], uint: [4, 'getUint32'], uint32: [4, 'getUint32'], float: [4, 'getFloat32'], float32: [4, 'getFloat32'], double: [8, 'getFloat64'], float64: [8, 'getFloat64'] };
  let formato = 'ascii'; const els = [];
  cab.slice(0, fin).split(/\r?\n/).forEach(l => {
    const t = l.trim().split(/\s+/);
    if (t[0] === 'format') formato = t[1];
    else if (t[0] === 'element') els.push({ nombre: t[1], n: +t[2], props: [] });
    else if (t[0] === 'property' && els.length) els[els.length - 1].props.push(t[1] === 'list' ? { lista: true, tn: t[2], tv: t[3], nombre: t[4] } : { tipo: t[1], nombre: t[2] });
  });
  const V = [], F = [];
  const guardar = (el, fila) => {
    if (el.nombre === 'vertex') { const ix = k => el.props.findIndex(p => p.nombre === k); V.push([+fila[ix('x')], +fila[ix('y')], +fila[ix('z')]]); }
    else if (el.nombre === 'face') { const li = el.props.findIndex(p => p.lista && /vertex_ind/.test(p.nombre)); const L = fila[li >= 0 ? li : el.props.findIndex(p => p.lista)]; if (L) F.push(L); }
  };
  if (formato === 'ascii') {
    const tk = new TextDecoder('latin1').decode(u8.subarray(o)).trim().split(/\s+/); let k = 0;
    els.forEach(el => { for (let r = 0; r < el.n; r++) { const fila = el.props.map(p => { if (!p.lista) return +tk[k++]; const n = +tk[k++], L = []; for (let j = 0; j < n; j++) L.push(+tk[k++]); return L; }); guardar(el, fila); } });
  } else {
    const le = formato === 'binary_little_endian'; if (!le && formato !== 'binary_big_endian') throw new Error('Formato PLY desconocido: ' + formato);
    const d = new DataView(buf);
    const leer = tipo => { const T2 = TIPOS[tipo]; if (!T2) throw new Error('Tipo PLY desconocido: ' + tipo); const v = d[T2[1]](o, le); o += T2[0]; return v; };
    els.forEach(el => { for (let r = 0; r < el.n; r++) { const fila = el.props.map(p => { if (!p.lista) return leer(p.tipo); const n = leer(p.tn), L = []; for (let j = 0; j < n; j++) L.push(leer(p.tv)); return L; }); guardar(el, fila); } });
  }
  if (!F.length) throw new Error(V.length ? 'Este PLY solo tiene puntos (una nube de puntos), sin caras: conviértelo antes en una malla (en MeshLab, «Surface Reconstruction»).' : 'El PLY no tiene ninguna malla.');
  const tri = [];
  F.forEach(L => { for (let j = 1; j + 1 < L.length; j++) { const a = V[L[0]], b = V[L[j]], c = V[L[j + 1]]; if (a && b && c) tri.push([a, b, c]); } });
  return tri;
}
// proyecta los triángulos desde una vista: devuelve [x imagen, y imagen, profundidad (más = más cerca)]
const VISTAS = {
  frente: p => [p[0], p[1], p[2]], atras: p => [-p[0], p[1], -p[2]],
  izquierda: p => [-p[2], p[1], -p[0]], derecha: p => [p[2], p[1], p[0]],
  arriba: p => [p[0], -p[2], p[1]], abajo: p => [p[0], p[2], -p[1]],
};
// de malla a mapa de profundidad, ajustado al panel (rasterizado con z-buffer)
function mapaDesdeMalla(tri, vista, giro, ancho, alto, mmPx) {
  const pr = VISTAS[vista] || VISTAS.frente, g = ((giro || 0) % 360 + 360) % 360;
  const rot = p => g === 90 ? [-p[1], p[0], p[2]] : g === 180 ? [-p[0], -p[1], p[2]] : g === 270 ? [p[1], -p[0], p[2]] : p;
  const T3 = tri.map(t => t.map(p => rot(pr(p))));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  T3.forEach(t => t.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }));
  const w = Math.max(8, Math.round(ancho / mmPx)), h = Math.max(8, Math.round(alto / mmPx));
  const s = 0.94 * Math.min(w / (x1 - x0 || 1), h / (y1 - y0 || 1)), ox = (w - (x1 - x0) * s) / 2, oy = (h - (y1 - y0) * s) / 2;
  const z = new Float32Array(w * h).fill(-Infinity);
  T3.forEach(t => {
    const q = t.map(p => [ox + (p[0] - x0) * s, h - (oy + (p[1] - y0) * s), p[2]]);
    const minX = Math.max(0, Math.floor(Math.min(q[0][0], q[1][0], q[2][0]))), maxX = Math.min(w - 1, Math.ceil(Math.max(q[0][0], q[1][0], q[2][0])));
    const minY = Math.max(0, Math.floor(Math.min(q[0][1], q[1][1], q[2][1]))), maxY = Math.min(h - 1, Math.ceil(Math.max(q[0][1], q[1][1], q[2][1])));
    const den = (q[1][1] - q[2][1]) * (q[0][0] - q[2][0]) + (q[2][0] - q[1][0]) * (q[0][1] - q[2][1]);
    if (Math.abs(den) < 1e-12) return;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      const a = ((q[1][1] - q[2][1]) * (px - q[2][0]) + (q[2][0] - q[1][0]) * (py - q[2][1])) / den;
      const b = ((q[2][1] - q[0][1]) * (px - q[2][0]) + (q[0][0] - q[2][0]) * (py - q[2][1])) / den, c = 1 - a - b;
      if (a < -1e-6 || b < -1e-6 || c < -1e-6) continue;
      const zz = a * q[0][2] + b * q[1][2] + c * q[2][2], k = y * w + x;
      if (zz > z[k]) z[k] = zz;
    }
  });
  let zmin = Infinity, zmax = -Infinity;
  for (let i = 0; i < z.length; i++) if (z[i] > -Infinity) { zmin = Math.min(zmin, z[i]); zmax = Math.max(zmax, z[i]); }
  const d = new Uint8Array(w * h);
  for (let i = 0; i < z.length; i++) d[i] = z[i] > -Infinity ? 1 + Math.round(254 * (z[i] - zmin) / ((zmax - zmin) || 1)) : 0;
  return { w, h, mm: mmPx, d8: d };
}
function mapaModelo(Rl) {
  const M = Rl.modelo; if (!M || !M.d64) return null;
  const bin = atob(M.d64), d = new Float32Array(bin.length);
  // 0 = fondo; 1…255 = profundidad del modelo; el fondo del modelo queda en «base»
  for (let i = 0; i < bin.length; i++) { const v = bin.charCodeAt(i); d[i] = v ? (Rl.base || 0) + (1 - (Rl.base || 0)) * (v - 1) / 254 : 0; }
  // el mapa guardado puede tener otro tamaño que el panel: se estira al panel
  return { w: M.w, h: M.h, mm: Rl.ancho / M.w, d, mmY: Rl.alto / M.h };
}
/* ---------- imagen en escala de grises ---------- */
// se guarda reducida (lado mayor ≤ 600 px) en grises de 0 a 255; lo transparente cuenta como negro (fondo)
function cargarImagenDesde(img, nombre) {
  const k = Math.min(1, 600 / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const w = Math.max(2, Math.round((img.naturalWidth || img.width) * k)), h = Math.max(2, Math.round((img.naturalHeight || img.height) * k));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data; let s = '';
  for (let i = 0; i < w * h; i++) { const a = px[i * 4 + 3] / 255; s += String.fromCharCode(Math.round((0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) * a)); }
  P.relieve.imagen = { nombre, w, h, d64: btoa(s), id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) };
  return { w, h };
}
// carga un archivo de imagen (png, jpg, webp…) y, si se pide, ajusta el alto del panel a sus proporciones
function cargarImagenArchivo(file, ajustarAlto) {
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { try { const r = cargarImagenDesde(img, file.name); if (ajustarAlto) ajustarAltoImagen(); ok(r); } catch (e) { mal(e); } finally { URL.revokeObjectURL(url); } };
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('No se puede leer la imagen «' + file.name + '»')); };
    img.src = url;
  });
}
function ajustarAltoImagen() {
  const I = P.relieve.imagen; if (!I) return;
  P.relieve.alto = Math.max(100, Math.round(P.relieve.ancho * I.h / I.w / 10) * 10);
}
function mapaImagen(Rl) {
  const I = Rl.imagen; if (!I || !I.d64) return null;
  const bin = atob(I.d64), d = new Float32Array(bin.length), g = Rl.gama > 0 ? Rl.gama : 1;
  for (let i = 0; i < bin.length; i++) d[i] = Math.pow(bin.charCodeAt(i) / 255, g);
  return { w: I.w, h: I.h, mm: Rl.ancho / I.w, d, mmY: Rl.alto / I.h };
}
// imágenes de ejemplo (assets/imagenes/imagenes.js): ya en grises (d64), con su png para verla
const imagenesEjemplo = () => window.MADE_IMAGENES || [];
function cargarImagenEjemplo(id, conMedidas) {
  const E = imagenesEjemplo().find(e => e.id === id); if (!E) throw new Error('No se encuentra la imagen de ejemplo «' + id + '» (assets/imagenes/imagenes.js)');
  const Rl = P.relieve; Rl.fuente = 'imagen';
  Rl.imagen = { nombre: E.nombre, w: E.w, h: E.h, d64: E.d64, id: E.id + '-' + Date.now().toString(36) };
  if (conMedidas && E.ancho) { Rl.ancho = E.ancho; Rl.alto = E.alto; }
  return E;
}

/* ---------- convertir el relieve en perfiles clave (no se puede deshacer, salvo con ↶) ----------
   Una clave en cada lama (como mucho 60) y en cada una el mismo número de puntos, repartidos a lo largo de la lama. */
function convertirRelieveEnPerfiles(maxClaves = 60) {
  if (!relieveActivo()) return 0;
  const Rl = P.relieve, [W, H] = medidasPanel(), hor = Rl.orient === 'h', largo = hor ? H : W, largoV = hor ? W : H;
  const xs = (R && R.costillas && R.costillas.length ? R.costillas.map(c => c.x) : []).filter(x => x >= 0 && x <= largo);
  let pos = xs.length >= 2 ? xs : Array.from({ length: 13 }, (_, i) => largo * i / 12);
  const mc = Math.max(2, Math.round(maxClaves));
  if (pos.length > mc) pos = Array.from({ length: mc }, (_, i) => pos[Math.round(i * (pos.length - 1) / (mc - 1))]);
  if (pos[0] > 0.5) pos.unshift(0); if (pos[pos.length - 1] < largo - 0.5) pos.push(largo);
  const M = clamp(Math.round(largoV / 12), 24, 90);
  const claves = pos.map(x => {
    const pts = [[0, 0]];
    for (let j = 0; j < M; j++) { const v = largoV * j / (M - 1); pts.push([Math.round((hor ? profundidadEn(v, x) : profundidadEn(x, v)) * 10) / 10, Math.round(v * 10) / 10]); }
    pts.push([0, largoV]);
    return { x: Math.round(x * 10) / 10, pts };
  });
  P.claves = claves; P.esquinas = [true, true, ...new Array(M - 2).fill(false), true, true];
  P.largo = largo; P.plantilla = 'pared_libre'; P.params = { largo, alto: largoV }; P.editado = true;
  Rl.fuente = 'plantilla'; Rl.modelo = null; Rl.imagen = null;
  return claves.length;
}

function cargarModelo(buf, nombre) { return cargarTriangulos(leerMalla(buf, nombre), nombre); }
function cargarTriangulos(tri, nombre, ejemplo) {
  if (!tri.length) throw new Error('No se han encontrado triángulos en «' + nombre + '»');
  const Rl = P.relieve, mmPx = Math.max(1, Math.max(Rl.ancho, Rl.alto) / 500);
  const m = mapaDesdeMalla(tri, Rl.vista, Rl.giro, Rl.ancho, Rl.alto, mmPx);
  let s = ''; for (let i = 0; i < m.d8.length; i++) s += String.fromCharCode(m.d8[i]);
  const mallaId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  Rl.modelo = { nombre, w: m.w, h: m.h, d64: btoa(s), id: mallaId, mallaId, triangulos: tri.length };
  if (ejemplo) Rl.modelo.ejemplo = ejemplo;
  UI.malla = { tri, nombre, id: mallaId };     // para volver a proyectar si cambia la vista (no se guarda)
  return tri.length;
}
// ---- modelos 3D de ejemplo (assets/modelos/modelos.js): vértices int16 en décimas de mm + caras uint32 ----
const modelosEjemplo = () => window.MADE_MODELOS || [];
function triangulosEjemplo(id) {
  const M = modelosEjemplo().find(m => m.id === id); if (!M) return null;
  const bin = b => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; };
  const v = new Int16Array(bin(M.v)), f = new Uint32Array(bin(M.f)), V = i => [v[3 * i] / 10, v[3 * i + 1] / 10, v[3 * i + 2] / 10], tri = [];
  for (let k = 0; k < f.length; k += 3) tri.push([V(f[k]), V(f[k + 1]), V(f[k + 2])]);
  return { M, tri };
}
// carga un modelo de ejemplo con su vista y medidas propuestas (las medidas solo si se pide)
function cargarModeloEjemplo(id, conMedidas, mantenerVista) {
  const r = triangulosEjemplo(id); if (!r) throw new Error('No se encuentra el modelo de ejemplo «' + id + '» (assets/modelos/modelos.js)');
  const Rl = P.relieve; Rl.fuente = 'modelo'; if (!mantenerVista) { Rl.vista = r.M.vista || 'frente'; Rl.giro = r.M.giro || 0; }
  if (conMedidas && r.M.ancho) { Rl.ancho = r.M.ancho; Rl.alto = r.M.alto; }
  return cargarTriangulos(r.tri, r.M.nombre, id);
}
// la malla en memoria solo vale para el modelo del proyecto actual (al abrir otro o deshacer, cambia)
function mallaVigente() {
  const mo = P.relieve && P.relieve.modelo;
  if (UI.malla && !(mo && mo.mallaId === UI.malla.id)) UI.malla = null;
  if (!UI.malla && mo && mo.ejemplo) { const r = triangulosEjemplo(mo.ejemplo); if (r) UI.malla = { tri: r.tri, nombre: r.M.nombre, id: mo.mallaId }; }
  return UI.malla;
}
function reproyectarModelo() {
  mallaVigente();
  if (!UI.malla) return false;
  const Rl = P.relieve, mmPx = Math.max(1, Math.max(Rl.ancho, Rl.alto) / 500);
  const m = mapaDesdeMalla(UI.malla.tri, Rl.vista, Rl.giro, Rl.ancho, Rl.alto, mmPx);
  let s = ''; for (let i = 0; i < m.d8.length; i++) s += String.fromCharCode(m.d8[i]);
  Rl.modelo = { ...Rl.modelo, w: m.w, h: m.h, d64: btoa(s), id: Date.now().toString(36) };
  return true;
}

/* ===================== FIGURAS DE PIE DESDE UN MODELO 3D (secciones reales) =====================
   Para costillas con varillas y retícula: cada costilla es el corte de la malla por un plano.
   - El modelo se guarda en el proyecto (vértices en int16 y caras en uint32, en base64), reducido
     a unos 60 000 triángulos como mucho.
   - Ejes del modelo: Y arriba y la cara mirando a +Z (como los modelos de ejemplo).
   - eje 'x': cortes de lado a lado (cada costilla es un perfil); eje 'z': de delante a atrás.
   - En cada corte se queda el contorno mayor; los trozos sueltos (orejas, brazos…) y los huecos se avisan. */
const figuraActiva = () => (P.tipo === 'costillas' || P.tipo === 'reticula') && P.figura && P.figura.activa && !!(P.figura.malla && P.figura.malla.v64);
const formaCalculada = () => relieveActivo() || figuraActiva();

// ---- guardar y leer la malla ----
function b64DeBuffer(buf) { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); }
function bufferDeB64(b) { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; }
// reduce la malla juntando los vértices de una rejilla (rápido y suficiente para cortar)
function reducirMalla(tri, maxTri) {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  tri.forEach(t => t.forEach(p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); z0 = Math.min(z0, p[2]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); z1 = Math.max(z1, p[2]); }));
  const tam = Math.max(x1 - x0, y1 - y0, z1 - z0) || 1;
  let celdas = tri.length > maxTri ? Math.round(Math.sqrt(maxTri / 2) * 1.15) : 0;   // sin reducir si ya es pequeña
  for (let intento = 0; intento < 8; intento++) {
    const paso = celdas ? tam / celdas : tam / 4000, mapa = new Map(), V = [], cuenta = [], F = [];
    const id = p => {
      const k = Math.round((p[0] - x0) / paso) + ',' + Math.round((p[1] - y0) / paso) + ',' + Math.round((p[2] - z0) / paso);
      let i = mapa.get(k); if (i === undefined) { i = V.length; mapa.set(k, i); V.push([0, 0, 0]); cuenta.push(0); }
      V[i][0] += p[0]; V[i][1] += p[1]; V[i][2] += p[2]; cuenta[i]++; return i;
    };
    tri.forEach(t => { const a = id(t[0]), b = id(t[1]), c = id(t[2]); if (a !== b && b !== c && a !== c) F.push(a, b, c); });
    V.forEach((v, i) => { v[0] /= cuenta[i]; v[1] /= cuenta[i]; v[2] /= cuenta[i]; });
    if (!celdas || F.length / 3 <= maxTri * 1.1) return { V, F };
    celdas = Math.round(celdas * 0.85);
  }
}
function guardarMallaFigura(tri, nombre, ejemplo) {
  const { V, F } = reducirMalla(tri, 60000);
  let m = 0; V.forEach(v => { m = Math.max(m, Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])); });
  const k = m ? 32000 / m : 1, v16 = new Int16Array(V.length * 3);
  V.forEach((v, i) => { v16[3 * i] = Math.round(v[0] * k); v16[3 * i + 1] = Math.round(v[1] * k); v16[3 * i + 2] = Math.round(v[2] * k); });
  P.figura.malla = { nombre, ejemplo: ejemplo || null, k, nv: V.length, nt: F.length / 3, v64: b64DeBuffer(v16.buffer), f64: b64DeBuffer(new Uint32Array(F).buffer), id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), original: tri.length };
  return P.figura.malla;
}

// ---- malla colocada: girada, a escala (alto pedido), apoyada en y = 0 ----
const CACHE_FIG = { clave: '', m: null };
function mallaFigura() {
  const Fg = P.figura, M = Fg.malla, clave = [M.id, Fg.alto, Fg.eje, Fg.giro].join('|');
  if (CACHE_FIG.clave === clave) return CACHE_FIG.m;
  const v16 = new Int16Array(bufferDeB64(M.v64)), F = new Uint32Array(bufferDeB64(M.f64)), n = v16.length / 3;
  const g = (Fg.giro || 0) * Math.PI / 180, cg = Math.cos(g), sg = Math.sin(g);
  const X = new Float64Array(n), Y = new Float64Array(n), Z = new Float64Array(n);
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = v16[3 * i] / M.k, y = v16[3 * i + 1] / M.k, z = v16[3 * i + 2] / M.k;
    X[i] = x * cg + z * sg; Y[i] = y; Z[i] = -x * sg + z * cg;
    x0 = Math.min(x0, X[i]); x1 = Math.max(x1, X[i]); y0 = Math.min(y0, Y[i]); y1 = Math.max(y1, Y[i]); z0 = Math.min(z0, Z[i]); z1 = Math.max(z1, Z[i]);
  }
  const s = (Fg.alto || 800) / ((y1 - y0) || 1);
  // a coordenadas del mueble: c = posición del corte (a lo largo), u = fondo del perfil, v = altura
  const C = new Float64Array(n), U = new Float64Array(n), Vv = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const xx = (X[i] - x0) * s, yy = (Y[i] - y0) * s, zz = (Z[i] - z0) * s;
    if (Fg.eje === 'z') { C[i] = (z1 - z0) * s - zz; U[i] = xx; } else { C[i] = xx; U[i] = (z1 - z0) * s - zz; }   // la cara, hacia u = 0 (el frente)
    Vv[i] = yy;
  }
  const largo = Fg.eje === 'z' ? (z1 - z0) * s : (x1 - x0) * s;
  // por triángulo, el tramo en c (para descartar rápido)
  const nt = F.length / 3, cmin = new Float64Array(nt), cmax = new Float64Array(nt);
  for (let t = 0; t < nt; t++) { const a = C[F[3 * t]], b = C[F[3 * t + 1]], c = C[F[3 * t + 2]]; cmin[t] = Math.min(a, b, c); cmax[t] = Math.max(a, b, c); }
  const m = { C, U, V: Vv, F, nt, cmin, cmax, largo, ancho: (Fg.eje === 'z' ? (x1 - x0) : (z1 - z0)) * s, alto: (y1 - y0) * s };
  CACHE_FIG.clave = clave; CACHE_FIG.m = m; CACHE_SEC.clave = '';
  return m;
}
// ---- corte por el plano c = x: lazos cerrados en (u, v) ----
const CACHE_SEC = { clave: '', mapa: new Map() };
function seccionFigura(x) {
  const m = mallaFigura(), clave = CACHE_FIG.clave;
  if (CACHE_SEC.clave !== clave) { CACHE_SEC.clave = clave; CACHE_SEC.mapa = new Map(); }
  const kx = Math.round(x * 100) / 100; if (CACHE_SEC.mapa.has(kx)) return CACHE_SEC.mapa.get(kx);
  let c = kx; const { C, U, V, F } = m;
  // si el plano pasa justo por un vértice, se mueve un pelo
  for (let t = 0; t < m.nt; t++) if (m.cmin[t] <= c && m.cmax[t] >= c) { for (let j = 0; j < 3; j++) if (C[F[3 * t + j]] === c) { c += 1e-4; t = m.nt; break; } }
  const pt = new Map(), vecinos = new Map(), aristaClave = (a, b) => a < b ? a * 4294967296 + b : b * 4294967296 + a;
  const punto = (a, b) => { const k = aristaClave(a, b); if (!pt.has(k)) { const s = (c - C[a]) / (C[b] - C[a]); pt.set(k, [U[a] + s * (U[b] - U[a]), V[a] + s * (V[b] - V[a])]); } return k; };
  const unir = (p, q) => { if (!vecinos.has(p)) vecinos.set(p, []); if (!vecinos.has(q)) vecinos.set(q, []); vecinos.get(p).push(q); vecinos.get(q).push(p); };
  for (let t = 0; t < m.nt; t++) {
    if (m.cmin[t] > c || m.cmax[t] < c) continue;
    const i = [F[3 * t], F[3 * t + 1], F[3 * t + 2]], arriba = i.map(k => C[k] > c), cruces = [];
    for (let j = 0; j < 3; j++) { const a = i[j], b = i[(j + 1) % 3]; if (arriba[j] !== arriba[(j + 1) % 3]) cruces.push(punto(a, b)); }
    if (cruces.length === 2) unir(cruces[0], cruces[1]);
  }
  // encadenar los tramos en lazos
  const usados = new Set(), lazos = [];
  vecinos.forEach((_, ini) => {
    if (usados.has(ini)) return;
    const lazo = [ini]; usados.add(ini); let prev = -1, act = ini;
    for (;;) {
      const sig = (vecinos.get(act) || []).find(q => q !== prev && !usados.has(q));
      if (sig === undefined) break;
      lazo.push(sig); usados.add(sig); prev = act; act = sig;
    }
    if (lazo.length >= 3) lazos.push(lazo.map(k => pt.get(k)));
  });
  const res = lazos.map(l => { const a = areaFirmada(l); return { poly: a < 0 ? l.slice().reverse() : l, area: Math.abs(a) }; }).sort((a, b) => b.area - a.area);
  CACHE_SEC.mapa.set(kx, res);
  return res;
}
// contorno de la costilla en x: el lazo mayor; si hay trozos sueltos y «unir» está activo,
// se juntan con puentes (en una rejilla) y se saca un solo contorno
const CACHE_POLI = { clave: '', mapa: new Map() };
function poligonoFigura(x) {
  // se guarda por posición (la retícula pide cientos de cortes al sacar los largueros)
  mallaFigura();   // pone al día CACHE_FIG.clave si ha cambiado el alto, el giro o los cortes
  const clave = CACHE_FIG.clave + '|' + (P.figura.unir !== false) + '|' + P.costillas.base + '|' + P.costillas.tope + '|' + P.costillas.topeAlt + '|' + grosor();
  if (CACHE_POLI.clave !== clave) { CACHE_POLI.clave = clave; CACHE_POLI.mapa = new Map(); }
  const kx = Math.round(x * 100) / 100;
  if (!CACHE_POLI.mapa.has(kx)) CACHE_POLI.mapa.set(kx, poligonoFiguraSin(x));
  return CACHE_POLI.mapa.get(kx).map(p => p.slice());
}
function poligonoFiguraSin(x) {
  const ls = seccionFigura(x); if (!ls.length || ls[0].area < 20) return [];
  const sig = ls.filter((l, i) => i === 0 || (l.area >= Math.max(30, ls[0].area * 0.01) && !dentroPoligono(ls[0].poly, l.poly[0][0], l.poly[0][1])));
  let poly = P.figura.unir !== false && sig.length > 1 ? unirTrozos(sig.map(l => l.poly)) : ls[0].poly;
  poly = simplificaCerrado(poly, 0.15);
  if (P.costillas.base) poly = recortaY(poly, 0, true);
  if (P.costillas.tope) poly = recortaY(poly, P.costillas.topeAlt, false);
  if (poly.length >= 3 && areaFirmada(poly) < 0) poly.reverse();
  return poly;
}
// une varios contornos con puentes del ancho pedido y devuelve el contorno exterior
function unirTrozos(lazos) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  lazos.forEach(l => l.forEach(p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); }));
  const g = Math.max(0.8, Math.max(x1 - x0, y1 - y0) / 700), pad = 3;
  const W = Math.ceil((x1 - x0) / g) + 2 * pad + 1, H = Math.ceil((y1 - y0) / g) + 2 * pad + 1, M = new Uint8Array(W * H);
  const aG = (p) => [(p[0] - x0) / g + pad, (p[1] - y0) / g + pad];
  // relleno de cada lazo (por filas, regla par-impar dentro de cada lazo: los huecos se rellenan igual al unir con OR)
  const rellenar = l => {
    const q = l.map(aG);
    for (let j = 0; j < H; j++) {
      const yc = j + 0.5, xs = [];
      for (let i = 0, k = q.length - 1; i < q.length; k = i++) { const a = q[i], b = q[k]; if ((a[1] > yc) !== (b[1] > yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
      xs.sort((a, b) => a - b);
      for (let t = 0; t + 1 < xs.length; t += 2) for (let i = Math.max(0, Math.ceil(xs[t] - 0.5)); i <= Math.min(W - 1, Math.floor(xs[t + 1] - 0.5)); i++) M[j * W + i] = 1;
    }
  };
  lazos.forEach(rellenar);
  // puentes: cada trozo, con el más cercano de los ya unidos (empezando por el mayor)
  const ancho = Math.max(12, 2 * grosor(), (P.figura.puente || 0)) / g;
  const unidos = [lazos[0]];
  lazos.slice(1).forEach(l => {
    let mej = Infinity, pa = null, pb = null;
    unidos.forEach(u => { for (let i = 0; i < l.length; i += Math.max(1, l.length >> 7)) for (let j = 0; j < u.length; j += Math.max(1, u.length >> 7)) { const d = Math.hypot(l[i][0] - u[j][0], l[i][1] - u[j][1]); if (d < mej) { mej = d; pa = l[i]; pb = u[j]; } } });
    if (pa) {
      const a = aG(pa), b = aG(pb), L = Math.hypot(b[0] - a[0], b[1] - a[1]), r = ancho / 2;
      const i0 = Math.max(0, Math.floor(Math.min(a[0], b[0]) - r)), i1 = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0]) + r));
      const j0 = Math.max(0, Math.floor(Math.min(a[1], b[1]) - r)), j1 = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1]) + r));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const px = i + 0.5, py = j + 0.5; let t = L ? ((px - a[0]) * (b[0] - a[0]) + (py - a[1]) * (b[1] - a[1])) / (L * L) : 0; t = clamp(t, 0, 1);
        if (Math.hypot(px - (a[0] + t * (b[0] - a[0])), py - (a[1] + t * (b[1] - a[1]))) <= r) M[j * W + i] = 1;
      }
    }
    unidos.push(l);
  });
  // contorno exterior: seguir el borde de la mancha que contiene el primer punto del lazo mayor
  const borde = contornoMascara(M, W, H);
  if (!borde || borde.length < 3) return lazos[0];
  // suavizado (Chaikin, una pasada) y vuelta a mm
  const sv = []; for (let i = 0; i < borde.length; i++) { const p = borde[i], q = borde[(i + 1) % borde.length]; sv.push([0.75 * p[0] + 0.25 * q[0], 0.75 * p[1] + 0.25 * q[1]], [0.25 * p[0] + 0.75 * q[0], 0.25 * p[1] + 0.75 * q[1]]); }
  return sv.map(p => [(p[0] - pad) * g + x0, (p[1] - pad) * g + y0]);
}
// borde exterior (por las esquinas de los píxeles) de la mancha mayor de una máscara
function contornoMascara(M, W, H) {
  const lleno = (i, j) => i >= 0 && j >= 0 && i < W && j < H && M[j * W + i] === 1;
  // aristas del borde orientadas (lleno a la izquierda), de esquina a esquina
  const sig = new Map(), clave = (i, j) => j * (W + 1) + i;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!lleno(i, j)) continue;
    if (!lleno(i, j - 1)) sig.set(clave(i, j), clave(i + 1, j));
    if (!lleno(i + 1, j)) sig.set(clave(i + 1, j), clave(i + 1, j + 1));
    if (!lleno(i, j + 1)) sig.set(clave(i + 1, j + 1), clave(i, j + 1));
    if (!lleno(i - 1, j)) sig.set(clave(i, j + 1), clave(i, j));
  }
  // el lazo más largo es el exterior de la mancha mayor
  const vistos = new Set(); let mejor = null;
  sig.forEach((_, ini) => {
    if (vistos.has(ini)) return;
    const l = []; let k = ini, n = 0;
    while (!vistos.has(k) && sig.has(k) && n++ < 1e6) { vistos.add(k); l.push([k % (W + 1), Math.floor(k / (W + 1))]); k = sig.get(k); }
    if (!mejor || l.length > mejor.length) mejor = l;
  });
  // quitar los puntos intermedios de los tramos rectos
  if (!mejor) return null;
  return mejor.filter((p, i) => { const a = mejor[(i - 1 + mejor.length) % mejor.length], b = mejor[(i + 1) % mejor.length]; return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0; });
}
// trozos sueltos y huecos que se pierden en cada costilla (para los avisos)
function perdidasFigura(x) {
  const ls = seccionFigura(x); if (ls.length < 2) return { sueltos: 0, huecos: 0 };
  const P0 = ls[0].poly; let sueltos = 0, huecos = 0;
  ls.slice(1).forEach(l => { if (l.area < Math.max(30, ls[0].area * 0.01)) return; if (dentroPoligono(P0, l.poly[0][0], l.poly[0][1])) huecos++; else sueltos++; });
  return { sueltos, huecos };
}
function dentroPoligono(poly, x, y) {
  let d = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) d = !d; }
  return d;
}
function avisosFigura(res, add) {
  if (!figuraActiva()) return;
  const con = res.costillas.filter(c => c.ok).map(c => ({ c, p: perdidasFigura(c.x) })).filter(o => o.p.sueltos || o.p.huecos);
  const s = con.filter(o => o.p.sueltos).map(o => o.c.i), h = con.filter(o => o.p.huecos).map(o => o.c.i);
  if (s.length && P.figura.unir !== false) add('info', `Figura: en ${s.length} costilla${s.length > 1 ? 's' : ''} el corte tenía trozos sueltos (orejas, hombros…) y se han unido con puentes de madera (${cst(s.slice(0, 6))}${s.length > 6 ? '…' : ''}).`, s[0]);
  else if (s.length) add('info', `Figura: en ${s.length} costilla${s.length > 1 ? 's' : ''} el corte tiene trozos sueltos (orejas, brazos…) que no se fabrican; solo se usa el contorno mayor (${cst(s.slice(0, 6))}${s.length > 6 ? '…' : ''}).`, s[0]);
  if (h.length) add('info', `Figura: ${h.length} costilla${h.length > 1 ? 's tienen' : ' tiene'} huecos por dentro que se rellenan (${cst(h.slice(0, 6))}${h.length > 6 ? '…' : ''}).`, h[0]);
}

// ---- convertir la figura en perfiles clave (uno por costilla, mismos puntos en todos) ----
function remuestrearLazo(poly, M) {
  // empieza en el punto más bajo cerca del centro y reparte M puntos por la longitud
  let cx = 0; poly.forEach(p => cx += p[0]); cx /= poly.length;
  let i0 = 0, mej = Infinity; poly.forEach((p, i) => { const d = p[1] * 4 + Math.abs(p[0] - cx); if (d < mej) { mej = d; i0 = i; } });
  const L = poly.slice(i0).concat(poly.slice(0, i0)); L.push(L[0]);
  const acum = [0]; for (let i = 1; i < L.length; i++) acum.push(acum[i - 1] + Math.hypot(L[i][0] - L[i - 1][0], L[i][1] - L[i - 1][1]));
  const tot = acum[acum.length - 1], out = []; let j = 0;
  for (let k = 0; k < M; k++) {
    const d = tot * k / M; while (j < acum.length - 2 && acum[j + 1] < d) j++;
    const s = (d - acum[j]) / ((acum[j + 1] - acum[j]) || 1);
    out.push([Math.round((L[j][0] + s * (L[j + 1][0] - L[j][0])) * 10) / 10, Math.round((L[j][1] + s * (L[j + 1][1] - L[j][1])) * 10) / 10]);
  }
  return out;
}
function convertirFiguraEnPerfiles(maxClaves = 60) {
  if (!figuraActiva() || !R) return 0;
  let cs = R.costillas.filter(c => c.ok && c.poly.length >= 3);
  const mc = Math.max(2, Math.round(maxClaves));
  if (cs.length > mc) cs = Array.from({ length: mc }, (_, i) => cs[Math.round(i * (cs.length - 1) / (mc - 1))]);
  if (cs.length < 2) return 0;
  const M = 64;
  // el mueble pasa a ir de la primera a la última costilla que existía (las de los extremos que se quitaron no vuelven)
  const e = grosor(), x0 = Math.max(0, cs[0].x - e / 2), x1 = cs[cs.length - 1].x + e / 2;
  P.claves = cs.map(c => ({ x: Math.round((c.x - x0) * 10) / 10, pts: remuestrearLazo(c.poly, M) }));
  P.largo = Math.round((x1 - x0) * 10) / 10;
  P.esquinas = new Array(M).fill(false);
  P.plantilla = 'libre'; P.params = { largo: P.largo, fondo: Math.round(mallaFigura().ancho), alto: Math.round(mallaFigura().alto) };
  P.editado = true; P.figura.activa = false; P.figura.malla = null;
  return P.claves.length;
}

// ---- cargar ----
function cargarFiguraTriangulos(tri, nombre, ejemplo) {
  if (!tri.length) throw new Error('No se han encontrado triángulos en «' + nombre + '»');
  const m = guardarMallaFigura(tri, nombre, ejemplo); P.figura.activa = true;
  return m;
}

/* ---------- simplificar los perfiles clave: quitar puntos a la vez en todas las claves ----------
   Todas las claves tienen los mismos puntos (y las mismas esquinas), así que se quita el mismo punto
   en todas: cada vez el que menos cambia la forma (la mayor separación de ese punto a la recta entre
   sus vecinos, mirando todas las claves). Las esquinas no se quitan. */
function simplificarPerfiles(n) {
  const K = P.claves; if (!K.length) return 0;
  let idx = K[0].pts.map((_, i) => i);
  const esq = i => !!P.esquinas[i], minimo = Math.max(3, idx.filter(esq).length + 2);
  n = Math.max(minimo, Math.round(n));
  const dSeg = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy; let t = L ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L : 0; t = clamp(t, 0, 1); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
  while (idx.length > n) {
    let mej = -1, md = Infinity;
    for (let j = 0; j < idx.length; j++) {
      if (esq(idx[j])) continue;
      const a = idx[(j - 1 + idx.length) % idx.length], i = idx[j], b = idx[(j + 1) % idx.length];
      let d = 0; for (const k of K) d = Math.max(d, dSeg(k.pts[i], k.pts[a], k.pts[b]));
      if (d < md) { md = d; mej = j; }
    }
    if (mej < 0) break;
    idx.splice(mej, 1);
  }
  K.forEach(k => { k.pts = idx.map(i => k.pts[i]); });
  P.esquinas = idx.map(i => !!P.esquinas[i]);
  return idx.length;
}

/* ===================== HUECOS: RECORTES Y MUEBLES INSERTADOS =====================
   Un hueco es una forma (rectángulo, redondeado, arco, círculo o libre) que se resta de las piezas:
   - Panel de pared: se dibuja en la vista de frente (X a lo ancho, Y a lo alto, desde abajo a la izquierda).
       pasante: quita las lamas (se ve la pared) · rebaje: recorta las lamas a una profundidad
       hundido: el canto de las lamas se hunde N mm dentro de la forma · saliente: sale N mm por delante
       mueble: quita las lamas y pone una balda, una caja (hornacina) o un armario con puerta.
     La forma «texto» son las letras de un texto (varios contornos con sus agujeros), en su caja.
   - Costillas y retícula: se dibuja en el perfil (u, v) y atraviesa las piezas entre «desde» y «hasta»
       (un túnel); también puede llevar balda o caja por dentro.
   Las restas se hacen con Clipper (assets/js/clipper.js). Una lama o costilla puede quedar en varias
   piezas (Lama 12a, 12b…) y con agujeros por dentro. */
const ESC_CL = 1000;
const usaHuecos = () => ['pared', 'costillas', 'reticula'].includes(P.tipo) && ((P.huecos || []).some(h => h.activo !== false) || partirActivo()) && !!window.ClipperLib;

/* ---- partir las lamas de un panel de pared (paredes altas o para aprovechar el tablero) ----
   Cada junta es una franja (0,1 mm a tope, o la sombra) que se resta de la lama, como un hueco: los trozos
   salen como «Lama 12a, 12b…» (de abajo arriba, o de izquierda a derecha en lamas horizontales).
   Juntas alineadas, alternas (al tresbolillo) o en escalera; con las alineadas se pueden poner rastreles a los
   dos lados de cada junta, y cada banda queda como un módulo que se monta por separado. */
const partirP = () => (P.pared && P.pared.partir) || { modo: 'no' };
const partirActivo = () => P.tipo === 'pared' && partirP().modo && partirP().modo !== 'no';
const anchoJunta = () => partirP().junta === 'sombra' ? clamp(+partirP().sombra || 0, 0.5, 200) : 0.1;
let JUNTAS = null;   // { V0, V1, bases, d, Lmax } del último cálculo (lo usa también Fabricar al rehacer las piezas)
// largo máximo de un trozo: el que se escriba o el lado largo del tablero de Fabricar menos sus bordes
function largoMaxTrozo() {
  const q = +partirP().largoMax; if (q > 0) return q;
  const f = typeof fabActual === 'function' ? fabActual() : { ancho: 2440, alto: 1220, borde: 10 };
  return Math.max(f.ancho, f.alto) - 2 * (f.borde || 0) - 10;
}
function prepararJuntas(lamas) {
  JUNTAS = null; if (!partirActivo() || !lamas.length) return;
  const Pp = partirP(); let V0 = Infinity, V1 = -Infinity;
  lamas.forEach(c => { V0 = Math.min(V0, c.caja.y0); V1 = Math.max(V1, c.caja.y1); });
  const L = V1 - V0, d = Pp.patron === 'alineado' ? 0 : Math.max(0, +Pp.desfase || 0), spread = Pp.patron === 'escalera' ? 2 * d : d, Lmax = largoMaxTrozo();
  let bases = [];
  if (Pp.modo === 'auto') {
    const n = Math.max(1, Math.ceil(L / Math.max(100, Lmax - spread - anchoJunta())));
    bases = Array.from({ length: n - 1 }, (_, k) => V0 + L * (k + 1) / n);
  } else {
    bases = String(Pp.alturas || '').split(/[;,\s]+/).map(t => +t).filter(v => isFinite(v) && v > 0).map(v => V0 + v).filter(v => v > V0 + 20 && v < V1 - 20).sort((a, b) => a - b);
  }
  JUNTAS = { V0, V1, bases, d, Lmax, patron: Pp.patron };
}
/* ---- dividir el panel a lo ancho (lamas verticales: columnas) o a lo alto (lamas horizontales: filas) ----
   Las lamas no se cortan: se agrupan en módulos y los rastreles se cortan entre un módulo y el siguiente
   (justo en el hueco entre dos lamas), así cada módulo se monta y se cuelga por separado. */
const modulosP = () => (P.pared && P.pared.modulos) || { modo: 'no' };
const modulosActivos = () => P.tipo === 'pared' && modulosP().modo && modulosP().modo !== 'no';
function modulosPared(cs) {
  cs = cs.filter(c => c.ok).sort((a, b) => a.x - b.x); const e = grosor();
  if (!modulosActivos() || cs.length < 2) return [];
  const X0 = cs[0].x - e / 2, X1 = cs[cs.length - 1].x + e / 2, W = X1 - X0, M = modulosP();
  let cortes = [];
  if (M.modo === 'iguales') { const n = clamp(Math.round(+M.n || 2), 1, cs.length); cortes = Array.from({ length: n - 1 }, (_, k) => X0 + W * (k + 1) / n); }
  else { let acc = X0; String(M.medidas || '').split(/[;,\s]+/).map(t => +t).filter(v => isFinite(v) && v > 0).forEach(v => { acc += v; if (acc < X1 - e) cortes.push(acc); }); }
  // cada corte, al hueco entre dos lamas más cercano
  const medios = cs.slice(0, -1).map((c, k) => ({ k, m: (c.x + cs[k + 1].x) / 2 }));
  const ks = [...new Set(cortes.map(t => medios.reduce((a, b) => Math.abs(b.m - t) < Math.abs(a.m - t) ? b : a).k))].sort((a, b) => a - b);
  const out = []; let i0 = 0;
  [...ks, cs.length - 1].forEach(k => { const a = cs[i0], b = cs[k]; out.push({ desde: a.i, hasta: b.i, x0: i0 ? (cs[i0 - 1].x + a.x) / 2 : X0, x1: k < cs.length - 1 ? (b.x + cs[k + 1].x) / 2 : X1, n: k - i0 + 1 }); i0 = k + 1; });
  out.forEach(m => { m.ancho = m.x1 - m.x0; });
  return out;
}
// hueco extra entre módulos: cada módulo se corre ese hueco respecto al anterior (las lamas guardan la forma de su sitio
// original, así el dibujo sigue seguido y solo se abre una raya). Se hace antes de los rastreles y los huecos.
const huecoModulos = () => modulosActivos() ? clamp(+modulosP().hueco || 0, 0, 2000) : 0;
function separarModulos(res) {
  res.modulosPared = modulosPared(res.costillas);
  const ms = res.modulosPared, g = huecoModulos(); if (ms.length < 2) return;
  const cs = res.costillas.filter(c => c.ok).sort((a, b) => a.x - b.x), e = grosor();
  const difs = cs.slice(1).map((c, k) => c.x - cs[k].x).sort((a, b) => a - b), paso = difs.length ? difs[Math.floor(difs.length / 2)] : e * 2;
  if (g > 0) ms.forEach((m, j) => { if (j) res.costillas.forEach(c => { if (c.i >= m.desde && c.i <= m.hasta) c.x += j * g; }); });
  // bordes de cada módulo (medio paso fuera de sus lamas de los extremos) y raya entre módulos
  ms.forEach((m, j) => {
    const a = res.costillas[m.desde], b = res.costillas[m.hasta];
    m.x0 = j ? a.x - paso / 2 : a.x - e / 2; m.x1 = j < ms.length - 1 ? b.x + paso / 2 : b.x + e / 2; m.ancho = m.x1 - m.x0;
  });
  ms.slice(0, -1).forEach((m, j) => { m.corte = (m.x1 + ms[j + 1].x0) / 2; });
}
// corta los tramos de los rastreles entre módulos (deja 3 mm de corte de sierra)
function cortarRastrelesModulos(res) {
  const mods = res.modulosPared || []; if (mods.length < 2) return;
  // entre dos módulos se quita del rastrel lo que hay entre el borde de uno y el del siguiente (como mínimo, 3 mm de sierra)
  const cortes = mods.slice(0, -1).map((m, j) => { const c = m.corte != null ? m.corte : m.x1, h = Math.max(1.5, (mods[j + 1].x0 - m.x1) / 2); return [c - h, c + h]; });
  res.rastreles.forEach(r => { r.tramos = (r.tramos || []).flatMap(([a, b]) => { let ts = [[a, b]]; cortes.forEach(([c0, c1]) => { ts = ts.flatMap(([p, q]) => c1 <= p || c0 >= q ? [[p, q]] : [[p, c0], [c1, q]]); }); return ts.filter(([p, q]) => q - p > 20); }); });
}
// alturas de las juntas de una lama (en su eje v); i: número de la lama
function juntasLama(i) {
  if (!JUNTAS || !JUNTAS.bases.length) return [];
  const { d, patron, V0, V1 } = JUNTAS, k = patron === 'alterno' ? (i % 2 ? 0.5 : -0.5) : patron === 'escalera' ? (i % 3) - 1 : 0;
  return JUNTAS.bases.map(v => clamp(v + k * d, V0 + 30, V1 - 30));
}
const huecosActivos = () => usaHuecos() ? P.huecos.filter(h => h.activo !== false) : [];
let sigHueco = 1;
function huecoNuevo(forma) {
  const fr = P.tipo === 'pared', [W, H] = fr ? medidasPanel() : [0, 0];
  const caja = !fr && R ? (() => { const cs = R.costillas.filter(c => c.ok); if (!cs.length) return { x0: 0, y0: 0, w: 400, h: 400 }; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; cs.forEach(c => { x0 = Math.min(x0, c.caja.x0); y0 = Math.min(y0, c.caja.y0); x1 = Math.max(x1, c.caja.x1); y1 = Math.max(y1, c.caja.y1); }); return { x0, y0, w: x1 - x0, h: y1 - y0 }; })() : null;
  const w = fr ? Math.round(Math.min(600, W * 0.3) / 10) * 10 : Math.round(caja.w * 0.35 / 10) * 10, h = fr ? Math.round(Math.min(500, H * 0.35) / 10) * 10 : Math.round(caja.h * 0.3 / 10) * 10;
  const x = fr ? Math.round((W - w) / 20) * 10 : Math.round((caja.x0 + (caja.w - w) / 2) / 10) * 10, y = fr ? Math.round((H - h) / 20) * 10 : Math.round((caja.y0 + (caja.h - h) / 2) / 10) * 10;
  const hu = { id: 'h' + Date.now().toString(36) + (sigHueco++), activo: true, forma, giro: 0, x, y, ancho: w, alto: h, radio: Math.round(Math.min(w, h) / 5), pts: null,
    modo: 'pasante', prof: 40, holgura: 2, desde: 0, hasta: Math.round(P.largo), mueble: { tipo: 'caja', fondo: fr ? 150 : 0, trasera: true, puerta: 'lisa', holguraPuerta: 3, grosor: 0 } };
  if (forma === 'libre') hu.pts = [[x, y], [x + w, y], [x + w * 0.85, y + h], [x + w * 0.15, y + h * 0.8]];
  if (forma === 'texto') {   // letras de 300 mm (o menos en paneles pequeños); el ancho sale de la letra
    Object.assign(hu, { texto: 'HOLA', letra: 'Arial', negrita: true, modo: 'saliente', relieve: 20 });
    hu.alto = Math.round(Math.min(300, (fr ? H : 400) * 0.3) / 10) * 10; ajustarCajaTexto(hu, true);
    hu.x = fr ? Math.round((W - hu.ancho) / 20) * 10 : hu.x; hu.y = fr ? Math.round((H - hu.alto) / 20) * 10 : hu.y;
  }
  return hu;
}
// contorno de la forma en su plano (frente o perfil)
// giro: alrededor del centro del rectángulo del hueco (en la forma libre se aplica a los vértices al girar)
const giraHueco = h => (h.forma !== 'libre' && h.modo !== 'mueble' && h.giro) ? h.giro : 0;
function rotarPunto(p, c, g) { const a = g * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a), dx = p[0] - c[0], dy = p[1] - c[1]; return [c[0] + dx * cs - dy * sn, c[1] + dx * sn + dy * cs]; }
const centroHueco = h => [h.x + h.ancho / 2, h.y + h.alto / 2];
function formaHueco(h) {
  const f = formaBase(h), g = giraHueco(h);
  return g ? f.map(p => rotarPunto(p, centroHueco(h), g)) : f;
}
function formaBase(h) {
  const x = h.x, y = h.y, w = Math.max(1, h.ancho), a = Math.max(1, h.alto);
  if (h.forma === 'libre' && h.pts && h.pts.length >= 3) return h.pts.map(p => [p[0], p[1]]);
  if (h.forma === 'circulo') return Array.from({ length: 64 }, (_, i) => { const t = PI2 * i / 64; return [x + w / 2 + w / 2 * Math.cos(t), y + a / 2 + a / 2 * Math.sin(t)]; });
  if (h.forma === 'arco') {
    const r = w / 2, yc = y + Math.max(0, a - r), out = [[x, y], [x + w, y]];
    for (let i = 0; i <= 24; i++) { const t = Math.PI * i / 24; out.push([x + r + r * Math.cos(t), yc + r * Math.sin(t)]); }
    return out;
  }
  if (h.forma === 'redondeado') {
    const r = clamp(h.radio || 0, 0, Math.min(w, a) / 2), out = [];
    if (r < 0.5) return [[x, y], [x + w, y], [x + w, y + a], [x, y + a]];
    [[x + w - r, y + r, -90], [x + w - r, y + a - r, 0], [x + r, y + a - r, 90], [x + r, y + r, 180]].forEach(([cx, cy, a0]) => {
      for (let i = 0; i <= 8; i++) { const t = (a0 + 90 * i / 8) * Math.PI / 180; out.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
    });
    return out;
  }
  return [[x, y], [x + w, y], [x + w, y + a], [x, y + a]];
}
function cajaHueco(h) { return cajaDe(formaHueco(h)); }

/* ---- texto: las letras como contornos (se dibujan en un lienzo, se sigue el borde de los píxeles y se simplifica) ---- */
const fuenteTexto = (h, pt) => `${h.negrita ? 'bold ' : ''}${pt}px "${h.letra || 'Arial'}", sans-serif`;
const lineasTexto = h => String(h.texto == null ? '' : h.texto).split('\n');
// medidas del texto con letra de 100 px: ancho de la línea más larga y alto del bloque (sin sobrantes)
function medidaTexto(h) {
  if (typeof document === 'undefined') return { w: 300, h: 100 };
  const ctx = (medidaTexto.cv = medidaTexto.cv || document.createElement('canvas')).getContext('2d'); ctx.font = fuenteTexto(h, 100);
  const ls = lineasTexto(h); let w = 1, sube = 0, baja = 0;
  ls.forEach((l, i) => { const m = ctx.measureText(l || ' '); w = Math.max(w, (m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || m.width)); if (i === 0) sube = m.actualBoundingBoxAscent || 72; if (i === ls.length - 1) baja = m.actualBoundingBoxDescent || 0; });
  return { w, h: Math.max(10, sube + baja + (ls.length - 1) * 100 * 1.15) };
}
// pone el ancho de la caja a la proporción del texto (con el alto de ahora), sin mover su centro
function ajustarCajaTexto(h, sinCentro) {
  const m = medidaTexto(h), c = centroHueco(h);
  h.ancho = Math.max(10, Math.round(h.alto * m.w / m.h));
  if (!sinCentro) { h.x = c[0] - h.ancho / 2; h.y = c[1] - h.alto / 2; }
}
// lazos de borde de una máscara (lleno a la izquierda: exteriores en un sentido y agujeros en el otro)
function lazosMascara(M, W, H) {
  const lleno = (i, j) => i >= 0 && j >= 0 && i < W && j < H && M[j * W + i] === 1;
  const sig = new Map(), clave = (i, j) => j * (W + 1) + i;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!lleno(i, j)) continue;
    if (!lleno(i, j - 1)) sig.set(clave(i, j), clave(i + 1, j));
    if (!lleno(i + 1, j)) sig.set(clave(i + 1, j), clave(i + 1, j + 1));
    if (!lleno(i, j + 1)) sig.set(clave(i + 1, j + 1), clave(i, j + 1));
    if (!lleno(i - 1, j)) sig.set(clave(i, j + 1), clave(i, j));
  }
  const vistos = new Set(), out = [];
  sig.forEach((_, ini) => {
    if (vistos.has(ini)) return;
    const l = []; let k = ini, n = 0;
    while (!vistos.has(k) && sig.has(k) && n++ < 1e6) { vistos.add(k); l.push([k % (W + 1), Math.floor(k / (W + 1))]); k = sig.get(k); }
    if (l.length >= 8) out.push(l);
  });
  return out;
}
// Douglas-Peucker sobre un lazo cerrado
function simplificarLetra(L, tol) {
  if (L.length < 8) return L;
  const d2s = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], q = dx * dx + dy * dy; if (!q) return (p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2; const t = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / q, 0, 1); return (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dy) ** 2; };
  const dp = (pts) => {
    const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1; const pila = [[0, pts.length - 1]], t2 = tol * tol;
    while (pila.length) { const [i, j] = pila.pop(); let m = -1, md = t2; for (let k = i + 1; k < j; k++) { const d = d2s(pts[k], pts[i], pts[j]); if (d > md) { md = d; m = k; } } if (m > 0) { keep[m] = 1; pila.push([i, m], [m, j]); } }
    return pts.filter((_, k) => keep[k]);
  };
  const mid = Math.floor(L.length / 2), r = [...dp(L.slice(0, mid + 1)).slice(0, -1), ...dp([...L.slice(mid), L[0]]).slice(0, -1)];
  return r.length >= 3 ? r : L;
}
const CACHE_TXT = new Map();
// contornos de las letras en el plano del hueco (mm), girados con el hueco
function formasTexto(h) {
  const clave = JSON.stringify([h.texto, h.letra, h.negrita, h.x, h.y, h.ancho, h.alto, h.giro, UI.letrasCargadas || 0]);
  if (CACHE_TXT.has(clave)) return CACHE_TXT.get(clave);
  if (CACHE_TXT.size > 40) CACHE_TXT.clear();
  let res = [];
  if (typeof document !== 'undefined' && String(h.texto || '').trim()) {
    const m = medidaTexto(h), mmPx = Math.max(0.25, Math.max(h.ancho, h.alto) / 1600);   // ≤ 1600 px de lado
    const W = Math.max(8, Math.ceil(h.ancho / mmPx) + 4), H = Math.max(8, Math.ceil(h.alto / mmPx) + 4);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'), k = Math.min((W - 4) / m.w, (H - 4) / m.h);   // escala de la letra de 100 px
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = '#fff';
    ctx.font = fuenteTexto(h, 100 * k); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const ls = lineasTexto(h), c0 = ctx.measureText(ls[0] || ' '), sube = (c0.actualBoundingBoxAscent || 72) * 1;   // en px de la letra escalada
    const y0 = (H - m.h * k) / 2 + sube;
    ls.forEach((l, i) => ctx.fillText(l, W / 2, y0 + i * 100 * k * 1.15));
    const px = ctx.getImageData(0, 0, W, H).data, M = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) M[i] = px[i * 4] > 127 ? 1 : 0;
    const g = giraHueco(h), C = centroHueco(h), ox = h.x + h.ancho / 2 - W / 2 * mmPx, oy = h.y + h.alto / 2 + H / 2 * mmPx;
    res = lazosMascara(M, W, H).map(L => simplificarLetra(L, 0.7)).map(L => L.map(([i, j]) => { const p = [ox + i * mmPx, oy - j * mmPx]; return g ? rotarPunto(p, C, g) : p; }))
      .filter(L => Math.abs(areaFirmada(L)) > 1);
  }
  CACHE_TXT.set(clave, res);
  return res;
}
// todas las formas de un hueco (una, o las letras del texto)
const formasDe = h => h.forma === 'texto' ? formasTexto(h) : [formaHueco(h)];
// desplaza un polígono a lo largo del primer eje (hacia fuera de la pared en las lamas)
const desplazarU = (poly, d) => poly.map(q => [q[0] + d, q[1]]);

// ---- Clipper ----
const aCl = poly => poly.map(p => ({ X: Math.round(p[0] * ESC_CL), Y: Math.round(p[1] * ESC_CL) }));
const deCl = path => path.map(q => [q.X / ESC_CL, q.Y / ESC_CL]);
// sujeto: un polígono o una lista de polígonos (las letras de un texto, con sus agujeros en sentido contrario)
function booleana(sujeto, recortes, tipo) {
  const C = window.ClipperLib, c = new C.Clipper();
  (Array.isArray(sujeto[0] && sujeto[0][0]) ? sujeto : [sujeto]).forEach(s => { if (s.length >= 3) c.AddPath(aCl(s), C.PolyType.ptSubject, true); });
  recortes.forEach(r => { if (r.length >= 3) c.AddPath(aCl(r), C.PolyType.ptClip, true); });
  const arbol = new C.PolyTree();
  c.Execute(tipo === 'interseccion' ? C.ClipType.ctIntersection : tipo === 'union' ? C.ClipType.ctUnion : C.ClipType.ctDifference, arbol, C.PolyFillType.pftNonZero, C.PolyFillType.pftNonZero);
  return C.JS.PolyTreeToExPolygons(arbol).map(ex => {
    let poly = deCl(ex.outer); if (areaFirmada(poly) < 0) poly.reverse();
    const int = ex.holes.map(deCl).filter(hh => Math.abs(areaFirmada(hh)) > 1).map(hh => areaFirmada(hh) < 0 ? hh : hh.slice().reverse());
    return { poly, int, area: Math.abs(areaFirmada(poly)) - int.reduce((s, hh) => s + Math.abs(areaFirmada(hh)), 0) };
  }).filter(p => p.poly.length >= 3 && p.area > 4).sort((a, b) => b.area - a.area);
}
function engordar(poly, d) {
  if (!d) return poly;
  const C = window.ClipperLib, co = new C.ClipperOffset(2, 0.05 * ESC_CL), sol = new C.Paths();
  co.AddPath(aCl(poly), C.JoinType.jtRound, C.EndType.etClosedPolygon); co.Execute(sol, d * ESC_CL);
  if (!sol.length) return poly;
  let mej = sol[0]; sol.forEach(s => { if (Math.abs(C.Clipper.Area(s)) > Math.abs(C.Clipper.Area(mej))) mej = s; });
  const r = deCl(mej); return areaFirmada(r) < 0 ? r.reverse() : r;
}
// tramos [a, b] de una forma a lo largo de un eje (0 = x, 1 = y) dentro de una franja del otro eje [c0, c1]
function tramosEnFranja(forma, eje, c0, c1) {
  const otro = 1 - eje, big = 1e6;
  const franja = eje === 1 ? [[c0, -big], [c1, -big], [c1, big], [c0, big]] : [[-big, c0], [big, c0], [big, c1], [-big, c1]];
  return booleana(forma, [franja], 'interseccion').map(p => { let a = Infinity, b = -Infinity; p.poly.forEach(q => { a = Math.min(a, q[eje]); b = Math.max(b, q[eje]); }); return [a, b]; })
    .sort((m, n) => m[0] - n[0]).reduce((acc, t) => { const u = acc[acc.length - 1]; if (u && t[0] <= u[1]) u[1] = Math.max(u[1], t[1]); else acc.push(t.slice()); return acc; }, []);
  // (otro solo documenta qué eje es la franja)
}
// el túnel, dentro del largo del mueble (y como mínimo un poco más que el grosor)
const grosorMueble = h => (h.mueble && h.mueble.grosor) || grosor();
function tramoX(h) { const L = P.largo, e = grosor(); return [clamp(Math.min(h.desde, h.hasta), -e, L + e), clamp(Math.max(h.desde, h.hasta), -e, L + e)]; }
const lamasH = () => P.tipo === 'pared' && P.relieve && P.relieve.orient === 'h';

/* ---- lo que se quita a una pieza: polígonos en sus coordenadas (u, v) o (x, v) para los largueros ---- */
function recortesDe(p, poly) {
  const e = grosor(), out = [], extra = [], suma = [];   // extra: trozos que se añaden (lamas de la puerta) · suma: lo que sale por delante
  poly = poly || p.poly;
  if (P.tipo === 'pared' && partirActivo() && !p.z) { const g = anchoJunta() / 2; juntasLama(p.i).forEach(v => out.push([[-1e5, v - g], [1e5, v - g], [1e5, v + g], [-1e5, v + g]])); }
  huecosActivos().forEach((h, ih) => {
    const muebleH = h.modo === 'mueble', hol = muebleH ? Math.max(0, h.holgura || 0) : 0;
    let forma = h.forma === 'texto' && P.tipo === 'pared' ? formasTexto(h) : formaHueco(h); if (hol) forma = engordar(forma, hol);
    if (P.tipo === 'pared') {
      // la lama ocupa una franja del frente: en vertical, X en [x - e/2, x + e/2]; en horizontal, Y
      const eje = lamasH() ? 0 : 1;               // a lo largo de la lama: Y (vertical) o X (horizontal)
      if (!forma.length) return;
      const ts = tramosEnFranja(forma, eje, p.x - e / 2, p.x + e / 2); if (!ts.length) return;
      if (h.modo === 'hundido' || h.modo === 'saliente') {
        // el canto se hunde o sale «relieve» mm dentro de la forma: la franja entre el canto y el canto desplazado
        const d = Math.max(0.5, +h.relieve || 0), fuera = h.modo === 'saliente';
        const franjas = fuera ? booleana(desplazarU(poly, d), [poly]) : booleana(poly, [desplazarU(poly, -d)]);
        ts.forEach(([a, b]) => franjas.forEach(fr => booleana(fr.poly, [[[-1e5, a], [1e5, a], [1e5, b], [-1e5, b]]], 'interseccion').forEach(q => (fuera ? suma : out).push(q.poly))));
        return;
      }
      const u0 = h.modo === 'rebaje' ? Math.max(0, h.prof) : -1e5;
      ts.forEach(([a, b]) => out.push([[u0, a], [1e5, a], [1e5, b], [u0, b]]));
      // armario con puerta de lamas: los trozos de lama de dentro del hueco van en la puerta
      if (muebleH && h.mueble.tipo === 'armario' && h.mueble.puerta === 'lamas') {
        const red = engordar(formaHueco(h), -Math.max(1, h.mueble.holguraPuerta || 3));
        const t2 = tramosEnFranja(red, eje, p.x - e / 2, p.x + e / 2);
        const uP = Math.max(0, h.mueble.fondo || 0) + grosorMueble(h);   // por delante de la puerta
        t2.forEach(([a, b]) => extra.push({ hueco: ih, poly: [[uP, a], [1e5, a], [1e5, b], [uP, b]] }));
      }
    } else if (p.z) {
      // larguero de la retícula (plano u = p.u, coordenadas x, v): el túnel lo corta entre desde y hasta
      const ts = tramosEnFranja(forma, 1, p.u - e / 2, p.u + e / 2); if (!ts.length) return;
      const [x0, x1] = tramoX(h);
      ts.forEach(([a, b]) => out.push([[x0, a], [x1, a], [x1, b], [x0, b]]));
    } else {
      // costilla: el túnel la atraviesa si su grosor cae entre desde y hasta
      const [x0, x1] = tramoX(h);
      if (p.x + e / 2 <= x0 || p.x - e / 2 >= x1) return;
      out.push(forma);
    }
  });
  return { out, extra, suma };
}
// punto de dentro de un polígono (para reconocer cada trozo al rehacerlo en fabricación)
function puntoDentro(poly, int) {
  const c = cajaDe(poly);
  for (let k = 1; k < 24; k++) {
    const y = c.y0 + c.h * ((k * 0.618) % 1);
    const xs = []; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a[1] > y) !== (b[1] > y)) xs.push(a[0] + (y - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
    xs.sort((m, n) => m - n);
    for (let t = 0; t + 1 < xs.length; t += 2) { const q = [(xs[t] + xs[t + 1]) / 2, y]; if (!(int || []).some(hh => dentro(hh, q[0], q[1]))) return q; }
  }
  return [c.x0 + c.w / 2, c.y0 + c.h / 2];
}
// trozos de una pieza tras restar los huecos (y añadir los de la puerta)
function partesDe(p, poly) {
  const { out, extra, suma } = recortesDe(p, poly);
  if (!out.length && !extra.length && !suma.length) return null;
  if (suma.length) { const u = booleana([poly, ...suma], [], 'union'); if (u.length) poly = u[0].poly; }   // las letras que salen se pegan al canto
  const partes = out.length ? booleana(poly, out) : [{ poly, int: [], area: Math.abs(areaFirmada(poly)) }];
  extra.forEach(x => booleana(poly, [x.poly], 'interseccion').forEach(q => { q.puerta = x.hueco; partes.push(q); }));
  partes.forEach(q => { q.ref = puntoDentro(q.poly, q.int); });
  return partes;
}
// para fabricar: rehace la pieza (con las ranuras al grosor de fabricación) y se queda con su trozo
function parteFab(c, poly) {
  if (!c.conHuecos) return { poly, int: [] };
  const ps = partesDe(c.padre || c, poly); if (!ps) return { poly, int: [] };
  const q = ps.find(t => dentro(t.poly, c.ref[0], c.ref[1]) && !t.int.some(hh => dentro(hh, c.ref[0], c.ref[1]))) || ps[0];
  return q;
}

/* ---- aplicar a todas las piezas (después de las ranuras) ---- */
function aplicarHuecos(res) {
  res.trozos = []; res.modulos = []; res.huecosInfo = [];
  if (!usaHuecos()) return;
  const letras = 'abcdefghijklmnopqrstuvwxyz';
  const piezas = [...res.costillas, ...(res.largueros || [])].filter(p => p.ok);
  if (P.tipo === 'pared') prepararJuntas(res.costillas.filter(c => c.ok));
  piezas.forEach(p => {
    const ps = partesDe(p, p.poly); if (!ps) return;
    if (partirActivo()) ps.sort((m, n) => (m.puerta != null) - (n.puerta != null) || cajaDe(m.poly).y0 - cajaDe(n.poly).y0);   // a: el trozo de abajo (o de la izquierda)
    p.conHuecos = true;
    if (!ps.length) { p.ok = false; p.vaciada = true; p.poly = []; return; }
    const nom = p.nombre, etq0 = p.etq || String(p.i + 1), multi = ps.length > 1;
    const asignar = (obj, q, k) => {
      obj.poly = q.poly; obj.int = q.int; obj.caja = cajaDe(q.poly); obj.area = q.area; obj.ref = q.ref;
      obj.puerta = q.puerta != null ? q.puerta : null;
      if (multi) { obj.nombre = nom + letras[k] + (obj.puerta != null ? ' (puerta)' : ''); obj.etq = etq0 + letras[k]; }
    };
    asignar(p, ps[0], 0);
    p.partes = [p];
    ps.slice(1).forEach((q, k) => {
      const t = { trozo: true, padre: p, x: p.x, z: p.z, u: p.u, i: -1, ok: true, base: p.base, ranuras: p.ranuras, agujeros: [], nVar: 0, conHuecos: true, huecos: [] };
      asignar(t, q, k + 1); p.partes.push(t); res.trozos.push(t);
    });
  });
  construirModulos(res);
}
// ---- varillas con huecos: ¿en qué trozo cae el punto y con cuánta madera? ----
function distParte(q, x, y) {
  let d = distBorde(q.poly, x, y); if (d < 0) return d;
  (q.int || []).forEach(hh => { const di = distBorde(hh, x, y); d = Math.min(d, -di); });
  return d;
}
function parteConPunto(c, x, y, need) {
  const ps = c.partes || [c];
  for (const q of ps) if (q.ok !== false && q.poly.length && distParte(q, x, y) >= need - 1e-6) return q;
  return null;
}

/* ---- muebles dentro de los huecos: tableros rectangulares ----
   Cada tablero es una caja alineada con los ejes del mueble (x a lo largo, u fondo, v alto). */
function aXUV(X, Y) { return lamasH() ? [Y, X] : [X, Y]; }       // del frente del panel a (x, v)
function construirModulos(res) {
  huecosActivos().forEach((h, ih) => {
    if (h.modo !== 'mueble') return;
    const e = grosorMueble(h);   // el mueble puede llevar su propio grosor de tablero
    const M = h.mueble, cb = cajaHueco(h), nomH = 'Hueco ' + (P.huecos.indexOf(h) + 1), tabla = [];
    const add = (nombre, x0, x1, u0, u1, v0, v1) => {
      const d = [Math.abs(x1 - x0), Math.abs(u1 - u0), Math.abs(v1 - v0)];
      if (Math.min(...d) < 0.5 || d.filter(z => z > e * 1.5).length < 2) return;
      tabla.push({ modulo: true, hueco: ih, grosorPieza: e, nombre: nomH + ' · ' + nombre, x: (x0 + x1) / 2, caja3: [Math.min(x0, x1), Math.max(x0, x1), Math.min(u0, u1), Math.max(u0, u1), Math.min(v0, v1), Math.max(v0, v1)], ok: true, agujeros: [], ranuras: [], huecos: [], int: [] });
    };
    if (P.tipo === 'pared') {
      const F = Math.max(e * 2, M.fondo || 150);
      // en el frente: X0..X1 a lo ancho y Y0..Y1 a lo alto; los tableros, pasados a (x, u, v)
      const caja = (nombre, X0, X1, Y0, Y1, u0, u1) => { const [a0, b0] = aXUV(X0, Y0), [a1, b1] = aXUV(X1, Y1); add(nombre, a0, a1, u0, u1, b0, b1); };
      const X0 = cb.x0, X1 = cb.x0 + cb.w, Y0 = cb.y0, Y1 = cb.y0 + cb.h;
      if (M.tipo === 'balda') caja('Balda', X0, X1, Y0, Y0 + e, 0, F);
      else {
        caja('Lateral izquierdo', X0, X0 + e, Y0, Y1, 0, F); caja('Lateral derecho', X1 - e, X1, Y0, Y1, 0, F);
        caja('Suelo', X0 + e, X1 - e, Y0, Y0 + e, 0, F); caja('Techo', X0 + e, X1 - e, Y1 - e, Y1, 0, F);
        if (M.trasera) caja('Trasera', X0 + e, X1 - e, Y0 + e, Y1 - e, 0, e);
        if (M.tipo === 'armario') { const hp = Math.max(1, M.holguraPuerta || 3); caja(M.puerta === 'lamas' ? 'Puerta (lleva las lamas)' : 'Puerta', X0 + hp, X1 - hp, Y0 + hp, Y1 - hp, F, F + e); }
      }
    } else {
      // túnel en costillas o retícula: forro a lo largo (de desde a hasta), dentro del hueco
      const [x0, x1] = tramoX(h), U0 = cb.x0, U1 = cb.x0 + cb.w, V0 = cb.y0, V1 = cb.y0 + cb.h;
      if (M.tipo === 'balda') add('Balda', x0, x1, U0, U1, V0, V0 + e);
      else {
        add('Suelo', x0, x1, U0, U1, V0, V0 + e); add('Techo', x0, x1, U0, U1, V1 - e, V1);
        add('Lateral delantero', x0, x1, U0, U0 + e, V0 + e, V1 - e); add('Lateral trasero', x0, x1, U1 - e, U1, V0 + e, V1 - e);
      }
    }
    tabla.forEach(t => {
      // pieza plana para fabricar: sus dos medidas mayores
      const [x0, x1, u0, u1, v0, v1] = t.caja3, d = [x1 - x0, u1 - u0, v1 - v0].sort((a, b) => b - a);
      t.poly = [[0, 0], [d[0], 0], [d[0], d[1]], [0, d[1]]]; t.caja = cajaDe(t.poly); t.area = d[0] * d[1]; t.base = t.poly;
      t.medidas = d; res.modulos.push(t);
    });
  });
}
// rastreles: tramos (en x) donde no los corta un hueco pasante o con mueble
function tramosRastrel(v, alto, xA, xB) {
  let tramos = [[xA, xB]];
  huecosActivos().forEach(h => {
    if (['rebaje', 'hundido', 'saliente'].includes(h.modo)) return;
    const forma = h.modo === 'mueble' ? engordar(formaHueco(h), h.holgura || 0) : formasDe(h);
    if (!forma.length) return;
    // la franja del rastrel en el frente: a lo largo de x, entre v - alto/2 y v + alto/2
    const ts = tramosEnFranja(forma, lamasH() ? 1 : 0, v - alto / 2, v + alto / 2);
    ts.forEach(([a, b]) => { tramos = tramos.flatMap(([c, d]) => b <= c || a >= d ? [[c, d]] : [[c, a], [b, d]].filter(([m, n]) => n - m > 20)); });
  });
  return tramos;
}

// comprobaciones de los módulos a lo ancho (o a lo alto)
function avisosModulos(res) {
  const A = res.avisos, add = (tipo, txt, cost) => A.push({ tipo, txt, cost });
  if (P.tipo === 'pared' && modulosActivos() && (res.modulosPared || []).length) {
    const ms = res.modulosPared, hor = lamasH();
    if (ms.length < 2) add('atencion', `Módulos: con ${hor ? 'esos altos' : 'esos anchos'} el panel queda en un solo módulo.`);
    else add('info', `Panel en ${ms.length} módulos ${hor ? 'a lo alto' : 'a lo ancho'}: ${ms.map((m, k) => `M${k + 1} ${fmt(m.ancho)} mm (lamas ${m.desde + 1}–${m.hasta + 1})`).join(', ')}. Los rastreles se cortan entre módulos${huecoModulos() ? `, separados ${fmt(huecoModulos())} mm más que las lamas (el panel crece ${fmt(huecoModulos() * (ms.length - 1))} mm)` : ''}.`);
    const finos = ms.filter(m => m.n < 2); if (finos.length) add('atencion', `Módulos: ${finos.map(m => 'M' + (ms.indexOf(m) + 1)).join(', ')} se queda${finos.length > 1 ? 'n' : ''} con una sola lama.`);
    if (!res.rastreles.length) add('atencion', 'Módulos: sin rastreles no hay nada que una las lamas de cada módulo (pon rastreles o un tablero trasero por módulo).');
  }
}
/* ---- comprobaciones ---- */
function avisosHuecos(res) {
  if (!usaHuecos()) return;
  const A = res.avisos, add = (tipo, txt, cost) => A.push({ tipo, txt, cost }), e = grosor();
  const vac = res.costillas.filter(c => c.vaciada).map(c => c.i);
  if (vac.length) add('info', `Huecos: ${cst(vac)} ${vac.length > 1 ? 'quedan' : 'queda'} entera${vac.length > 1 ? 's' : ''} dentro de un hueco y no se ${vac.length > 1 ? 'fabrican' : 'fabrica'}.`, vac[0]);
  const todas = [...res.costillas.filter(c => c.ok), ...res.trozos];
  // trozos muy pequeños
  const peq = todas.filter(q => q.conHuecos && (Math.min(q.caja.w, q.caja.h) < Math.max(15, e) || q.area < 30 * 30));
  if (peq.length) add('atencion', `Huecos: quedan trozos muy pequeños (${peq.slice(0, 5).map(q => q.nombre).join(', ')}${peq.length > 5 ? '…' : ''}). Mueve un poco el hueco o cámbiale el tamaño.`);
  if (P.tipo === 'pared' && partirActivo()) {
    if (!JUNTAS || !JUNTAS.bases.length) add('atencion', partirP().modo === 'auto' ? 'Partir las lamas: ya caben enteras en el tablero, no hace falta partirlas.' : 'Partir las lamas: escribe la altura de las juntas (mm desde abajo, separadas por «;»).');
    else {
      const largas = todas.filter(q => q.conHuecos && q.caja.y1 - q.caja.y0 > JUNTAS.Lmax + 0.5);
      const nT = 1 + JUNTAS.bases.length;
      add('info', `Lamas partidas en ${nT} trozos (juntas ${JUNTAS.patron === 'alineado' ? 'a ' + JUNTAS.bases.map(v => fmt(v - JUNTAS.V0)).join(', ') + ' mm' : JUNTAS.patron === 'alterno' ? 'alternas' : 'en escalera'}${partirP().junta === 'sombra' ? ', con sombra de ' + fmt(anchoJunta()) + ' mm' : ', a tope'}).`);
      if (largas.length) add('atencion', `Partir las lamas: ${largas.length} trozo${largas.length > 1 ? 's' : ''} sigue${largas.length > 1 ? 'n' : ''} siendo más larg${largas.length > 1 ? 'os' : 'o'} que ${fmt(JUNTAS.Lmax)} mm (${largas.slice(0, 4).map(q => q.nombre).join(', ')}${largas.length > 4 ? '…' : ''}): ${partirP().modo === 'auto' ? 'baja el desfase' : 'pon más juntas'}.`);
    }
  }
  if (P.tipo === 'pared') {
    const Pa = P.pared;
    // cada trozo tiene que agarrarse a un rastrel (tener la muesca dentro) o al mueble del hueco
    if (res.rastreles.length) {
      const sueltos = todas.filter(q => q.conHuecos && q.puerta == null && !res.rastreles.some(r => q.caja.y0 <= r.v - Pa.alto / 2 && q.caja.y1 >= r.v + Pa.alto / 2 && (r.tramos || [[-1e9, 1e9]]).some(([a, b]) => q.x >= a && q.x <= b)) && !tocaMueble(q));
      if (sueltos.length) add('error', `Huecos: ${sueltos.length} trozo${sueltos.length > 1 ? 's' : ''} de lama no ${sueltos.length > 1 ? 'llegan' : 'llega'} a ningún rastrel ni a un mueble (${sueltos.slice(0, 5).map(q => q.nombre).join(', ')}${sueltos.length > 5 ? '…' : ''}): quedarían sueltos. Pon un rastrel más, mueve el hueco o hazlo con mueble.`, sueltos[0].padre ? sueltos[0].padre.i : sueltos[0].i);
    }
    huecosActivos().forEach((h, k) => {
      if (h.modo === 'rebaje' && res.rastreles.length && h.prof < Pa.grueso + 8) {
        const cb = cajaHueco(h), [a, b] = lamasH() ? [cb.x0, cb.x0 + cb.w] : [cb.y0, cb.y0 + cb.h];
        if (res.rastreles.some(r => r.v + Pa.alto / 2 > a && r.v - Pa.alto / 2 < b)) add('error', `Hueco ${P.huecos.indexOf(h) + 1}: el rebaje (${fmt(h.prof)} mm) es menos profundo que el rastrel más 8 mm (${fmt(Pa.grueso + 8)} mm): la muesca se come la lama.`);
      }
      if (h.forma === 'texto') {
        const n = P.huecos.indexOf(h) + 1, sep = P.costillas.separacion || 30;
        if (!formasTexto(h).length) add('atencion', `Hueco ${n}: el texto está vacío.`);
        else if (h.alto < sep * 5) add('info', `Hueco ${n}: con lamas cada ${fmt(sep)} mm, unas letras de ${fmt(h.alto)} mm de alto apenas se leen; para que se lean bien, haz el texto de unos ${fmt(sep * 7)} mm o más, o junta las lamas.`);
      }
      if (h.modo === 'hundido') {
        const n = P.huecos.indexOf(h) + 1, d = h.relieve || 0;
        if (res.rastreles.length) {
          const cb = cajaHueco(h), [a, b] = lamasH() ? [cb.x0, cb.x0 + cb.w] : [cb.y0, cb.y0 + cb.h];
          const toca = res.rastreles.some(r => r.v + Pa.alto / 2 > a && r.v - Pa.alto / 2 < b);
          const finas = todas.filter(q => q.conHuecos && Math.min(q.caja.w, q.caja.h) - d < Pa.grueso + 8 && q.caja.y0 <= b && q.caja.y1 >= a);
          if (toca && finas.length) add('atencion', `Hueco ${n}: al hundir ${fmt(d)} mm, en ${finas.length} lama${finas.length > 1 ? 's' : ''} queda poca madera por delante de la muesca del rastrel: hunde menos o mueve el texto fuera del rastrel.`);
        }
      }
      if (h.modo === 'mueble' && h.forma !== 'rect') add('info', `Hueco ${P.huecos.indexOf(h) + 1}: el mueble es rectangular (toma el rectángulo que envuelve la forma).`);
      if (h.modo === 'mueble' && h.mueble.tipo === 'armario' && h.mueble.puerta === 'lamas') {
        const n = res.trozos.filter(t => t.puerta === k).length + res.costillas.filter(c => c.puerta === k).length;
        if (!n) add('atencion', `Hueco ${P.huecos.indexOf(h) + 1}: ninguna lama llega por delante de la puerta (fondo del armario ${fmt(h.mueble.fondo)} mm + puerta): baja el fondo del armario.`);
      }
    });
  } else {
    // costillas: los trozos sueltos necesitan varillas (o el forro del túnel)
    if (P.tipo === 'costillas') {
      const sin = res.trozos.filter(t => t.agujeros.length < 2 && !tocaMueble(t));
      if (sin.length) add('error', `Huecos: ${sin.length} trozo${sin.length > 1 ? 's' : ''} de costilla ${sin.length > 1 ? 'quedan' : 'queda'} sin dos varillas (${sin.slice(0, 5).map(q => q.nombre).join(', ')}${sin.length > 5 ? '…' : ''}): pon varillas en ${sin.length > 1 ? 'esos trozos' : 'ese trozo'} o cambia el hueco.`, sin[0].padre.i);
    }
    if (disposicion() === 'curva' && huecosActivos().some(h => h.modo === 'mueble')) add('atencion', 'Huecos: los muebles dentro de un túnel solo se dibujan bien con la planta recta.');
  }
}
// ¿el trozo toca el contorno del mueble de algún hueco? (entonces se puede atornillar a él)
function tocaMueble(q) {
  return huecosActivos().some(h => {
    if (h.modo !== 'mueble') return false;
    const cb = cajaHueco(h), hol = (h.holgura || 0) + 3;
    if (P.tipo === 'pared') {
      const [X, along0, along1] = lamasH() ? [null, q.caja.y0, q.caja.y1] : [null, q.caja.y0, q.caja.y1];
      const pos = q.x, [p0, p1] = lamasH() ? [cb.y0, cb.y0 + cb.h] : [cb.x0, cb.x0 + cb.w], [l0, l1] = lamasH() ? [cb.x0, cb.x0 + cb.w] : [cb.y0, cb.y0 + cb.h];
      if (pos < p0 - hol || pos > p1 + hol) return false;
      return Math.abs(along1 - l0) <= hol + 1 || Math.abs(along0 - l1) <= hol + 1;
    }
    return true;
  });
}

/* ===================== LEER UN DXF (y un SVG, más abajo) =====================
   Lee un DXF de texto (LibreCAD, Inkscape, QCAD, AutoCAD…) y saca sus contornos cerrados,
   para usarlos como forma libre de un hueco o como perfil clave.
   Entiende LINE, ARC, CIRCLE, ELLIPSE, LWPOLYLINE y POLYLINE (con bulge) y SPLINE (NURBS).
   Los bloques (INSERT) no se leen: hay que explotarlos antes de guardar. */

function paresDXF(texto) {
  const lineas = texto.split(/\r\n|\n|\r/), pares = [];
  for (let i = 0; i + 1 < lineas.length; i += 2) {
    const c = parseInt(lineas[i], 10);
    if (!isNaN(c)) pares.push([c, lineas[i + 1].trim()]);
  }
  return pares;
}
// muestrea un arco de circunferencia (ángulos en radianes, a1 > a0 en antihorario)
function arcoPts(cx, cy, r, a0, a1, conFin) {
  const paso = clamp(2 * Math.acos(Math.max(0, 1 - 0.1 / Math.max(r, 0.1))), 0.06, 0.3);
  const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / paso)), out = [];
  for (let i = 0; i <= (conFin ? n : n - 1); i++) { const a = a0 + (a1 - a0) * i / n; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return out;
}
// tramo con bulge (b = tan(ángulo/4)) entre p y q, sin el punto final
function bulgePts(p, q, b) {
  if (!b) return [p];
  const ang = 4 * Math.atan(b), d = Math.hypot(q[0] - p[0], q[1] - p[1]) / 2;
  if (d < 1e-9) return [p];
  const r = d / Math.sin(ang / 2), mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
  const h = r * Math.cos(ang / 2), s = b > 0 ? 1 : -1;
  const cx = mx - s * h * (q[1] - p[1]) / (2 * d), cy = my + s * h * (q[0] - p[0]) / (2 * d);
  const a0 = Math.atan2(p[1] - cy, p[0] - cx);
  return arcoPts(cx, cy, Math.abs(r), a0, a0 + ang, false);
}
// curva NURBS (de Boor): grado g, nudos U, controles C [[x,y]], pesos W
function nurbsPts(g, U, C, W) {
  if (C.length < g + 1 || U.length < C.length + g + 1) return C.slice();
  const u0 = U[g], u1 = U[U.length - 1 - g], out = [], N = Math.max(16, C.length * 8);
  for (let k = 0; k <= N; k++) {
    const u = u0 + (u1 - u0) * k / N;
    let s = g; while (s < U.length - g - 2 && u >= U[s + 1]) s++;
    const d = [];
    for (let j = 0; j <= g; j++) { const w = W[s - g + j] || 1; d.push([C[s - g + j][0] * w, C[s - g + j][1] * w, w]); }
    for (let r = 1; r <= g; r++) for (let j = g; j >= r; j--) {
      const i = s - g + j, den = U[i + g - r + 1] - U[i];
      const a = den ? (u - U[i]) / den : 0;
      d[j] = [d[j - 1][0] * (1 - a) + d[j][0] * a, d[j - 1][1] * (1 - a) + d[j][1] * a, d[j - 1][2] * (1 - a) + d[j][2] * a];
    }
    out.push([d[g][0] / d[g][2], d[g][1] / d[g][2]]);
  }
  return out;
}
/* lee el DXF y devuelve { lazos: [[x, y]…] cerrados (de mayor a menor área), abiertos, factor, aviso } */
function leerDXF(texto) {
  if (texto.slice(0, 22).includes('AutoCAD Binary')) throw new Error('Es un DXF binario: guárdalo como DXF de texto (ASCII), por ejemplo R12 o 2000.');
  const pares = paresDXF(texto);
  if (!pares.length) throw new Error('No parece un DXF de texto.');
  let factor = 1, enEnts = false, i = 0, hayInsert = 0;
  // $INSUNITS en HEADER: 1 pulgadas, 4 mm, 5 cm, 6 m (si no está, se toma mm)
  for (let j = 0; j + 1 < pares.length; j++) if (pares[j][0] === 9 && pares[j][1] === '$INSUNITS') { const v = +pares[j + 1][1]; factor = { 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000 }[v] || 1; break; }
  const trazos = [];   // cada uno: { pts, cerrado }
  while (i < pares.length) {
    const [c, v] = pares[i];
    if (c === 0 && v === 'SECTION' && pares[i + 1] && pares[i + 1][1] === 'ENTITIES') enEnts = true;
    else if (c === 0 && v === 'ENDSEC') enEnts = false;
    else if (enEnts && c === 0) {
      // recoge los códigos de la entidad (los repetidos, en orden)
      const ent = v, d = {}; let j = i + 1;
      for (; j < pares.length && pares[j][0] !== 0; j++) { const [cc, vv] = pares[j]; (d[cc] = d[cc] || []).push(parseFloat(vv) || (cc < 10 ? vv : 0)); }
      const n1 = cc => d[cc] ? +d[cc][0] : 0, rad = g => g * Math.PI / 180;
      if (ent === 'LINE') trazos.push({ pts: [[n1(10), n1(20)], [n1(11), n1(21)]], cerrado: false });
      else if (ent === 'ARC') { let a0 = rad(n1(50)), a1 = rad(n1(51)); while (a1 <= a0) a1 += 2 * Math.PI; trazos.push({ pts: arcoPts(n1(10), n1(20), n1(40), a0, a1, true), cerrado: false }); }
      else if (ent === 'CIRCLE') trazos.push({ pts: arcoPts(n1(10), n1(20), n1(40), 0, 2 * Math.PI, false), cerrado: true });
      else if (ent === 'ELLIPSE') {
        const cx = n1(10), cy = n1(20), ax = n1(11), ay = n1(21), rr = n1(40) || 1;
        let p0 = d[41] ? +d[41][0] : 0, p1 = d[42] ? +d[42][0] : 2 * Math.PI; while (p1 <= p0) p1 += 2 * Math.PI;
        const cer = Math.abs(p1 - p0 - 2 * Math.PI) < 1e-6, N = 72, pts = [];
        for (let k = 0; k <= (cer ? N - 1 : N); k++) { const t = p0 + (p1 - p0) * k / N, ct = Math.cos(t), st = Math.sin(t) * rr; pts.push([cx + ax * ct - ay * st, cy + ay * ct + ax * st]); }
        trazos.push({ pts, cerrado: cer });
      } else if (ent === 'LWPOLYLINE') {
        const xs = d[10] || [], ys = d[20] || [], bs = d[42], cer = (n1(70) & 1) === 1, pts = [];
        // el bulge solo acompaña a algunos vértices: hay que mirar el orden original
        const bPorV = new Array(xs.length).fill(0);
        if (bs) { let vi = -1, bi = 0; for (let k = i + 1; k < j; k++) { if (pares[k][0] === 10) vi++; if (pares[k][0] === 42) bPorV[vi] = +pares[k][1] || 0; } }
        for (let k = 0; k < xs.length; k++) {
          const p = [+xs[k], +ys[k]], q = k + 1 < xs.length ? [+xs[k + 1], +ys[k + 1]] : (cer ? [+xs[0], +ys[0]] : null);
          if (q) bulgePts(p, q, bPorV[k]).forEach(z => pts.push(z)); else pts.push(p);
        }
        if (pts.length > 1) trazos.push({ pts, cerrado: cer });
      } else if (ent === 'POLYLINE') {
        // vértices en entidades VERTEX hasta SEQEND
        const cer = (n1(70) & 1) === 1, vs = [];
        let k = j;
        while (k < pares.length && !(pares[k][0] === 0 && pares[k][1] === 'SEQEND')) {
          if (pares[k][0] === 0 && pares[k][1] === 'VERTEX') {
            const vd = {}; let m = k + 1;
            for (; m < pares.length && pares[m][0] !== 0; m++) vd[pares[m][0]] = +pares[m][1] || 0;
            if (!(vd[70] & 16)) vs.push({ p: [vd[10] || 0, vd[20] || 0], b: vd[42] || 0 });   // 16: vértice de control, no de la línea
            k = m; continue;
          }
          k++;
        }
        const pts = [];
        vs.forEach((v2, ki) => { const q = ki + 1 < vs.length ? vs[ki + 1].p : (cer ? vs[0].p : null); if (q) bulgePts(v2.p, q, v2.b).forEach(z => pts.push(z)); else pts.push(v2.p); });
        if (pts.length > 1) trazos.push({ pts, cerrado: cer });
        i = k; continue;
      } else if (ent === 'SPLINE') {
        const gr = n1(71) || 3, U = (d[40] || []).map(Number), C = (d[10] || []).map((x, k) => [+x, +(d[20] || [])[k] || 0]), W = (d[41] || []).map(Number);
        const cer = (n1(70) & 1) === 1;
        let pts;
        if (C.length && U.length) pts = nurbsPts(gr, U, C, W);
        else if (d[11]) pts = (d[11] || []).map((x, k) => [+x, +(d[21] || [])[k] || 0]);   // solo puntos de paso
        else pts = C;
        if (pts && pts.length > 1) { if (cer && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 1e-6) pts.pop(); trazos.push({ pts, cerrado: cer }); }
      } else if (ent === 'INSERT') hayInsert++;
      i = j; continue;
    }
    i++;
  }
  let aviso2 = '';
  if (hayInsert) aviso2 = `Tiene ${hayInsert} bloque${hayInsert > 1 ? 's' : ''} (INSERT) que no se leen: explótalos antes de guardar el DXF.`;
  return Object.assign(lazosDeTrazos(trazos, factor), { factor, aviso: aviso2 });
}
/* encadena los trazos abiertos por sus extremos (con tolerancia) y devuelve { lazos (de mayor a menor área), abiertos } */
function lazosDeTrazos(trazos, factor) {
  const lazos = trazos.filter(t => t.cerrado).map(t => t.pts);
  let abiertos = trazos.filter(t => !t.cerrado).map(t => t.pts.slice());
  for (const tol of [0.01, 0.5]) {
    let unido = true;
    while (unido) {
      unido = false;
      for (let a = 0; a < abiertos.length && !unido; a++) {
        const A = abiertos[a], fA = A[A.length - 1];
        if (Math.hypot(fA[0] - A[0][0], fA[1] - A[0][1]) <= tol && A.length > 2) { lazos.push(A); abiertos.splice(a, 1); unido = true; break; }
        for (let b2 = 0; b2 < abiertos.length && !unido; b2++) {
          if (a === b2) continue;
          const B = abiertos[b2], d00 = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
          if (d00(fA, B[0]) <= tol) { abiertos[a] = A.concat(B.slice(1)); abiertos.splice(b2, 1); unido = true; }
          else if (d00(fA, B[B.length - 1]) <= tol) { abiertos[a] = A.concat(B.slice(0, -1).reverse()); abiertos.splice(b2, 1); unido = true; }
          else if (d00(A[0], B[B.length - 1]) <= tol) { abiertos[a] = B.concat(A.slice(1)); abiertos.splice(b2, 1); unido = true; }
          else if (d00(A[0], B[0]) <= tol) { abiertos[a] = B.slice(1).reverse().concat(A); abiertos.splice(b2, 1); unido = true; }
        }
      }
    }
  }
  // un trazo casi cerrado también vale
  abiertos = abiertos.filter(A => { if (A.length > 2 && Math.hypot(A[0][0] - A[A.length - 1][0], A[0][1] - A[A.length - 1][1]) <= 1) { lazos.push(A); return false; } return true; });
  const areaL = L => Math.abs(L.reduce((s, p, k) => { const q = L[(k + 1) % L.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2);
  const limpios = lazos.map(L => L.filter((p, k) => { const q = L[(k - 1 + L.length) % L.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-6; }))
    .filter(L => L.length >= 3 && areaL(L) > 1e-4).sort((a, b) => areaL(b) - areaL(a));
  limpios.forEach(L => L.forEach(p => { p[0] *= factor; p[1] *= factor; }));
  return { lazos: limpios, abiertos: abiertos.length };
}

/* ===================== LEER UN SVG =====================
   Inkscape, Illustrator, Affinity… Lee path (con curvas y arcos), rect (también redondeados), circle, ellipse,
   polygon, polyline y line, con sus transform. Las medidas salen en mm según width/height y viewBox
   (sin unidades: 96 px por pulgada). Los textos y los <use> no se leen. Y hacia arriba, como en el DXF. */
function longitudMM(v) {
  const m = /^\s*([-+]?[\d.]+(?:e[-+]?\d+)?)\s*(mm|cm|in|pt|pc|px|q)?\s*$/i.exec(v || '');
  if (!m) return null;
  return +m[1] * ({ mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, pc: 25.4 / 6, px: 25.4 / 96, q: 0.25 }[(m[2] || 'px').toLowerCase()]);
}
const mulM = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
function matrizTransform(t) {
  let M = [1, 0, 0, 1, 0, 0];
  String(t || '').replace(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g, (_, f, a) => {
    const n = (a.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi) || []).map(Number), r = g => g * Math.PI / 180;
    let T2 = [1, 0, 0, 1, 0, 0];
    if (f === 'matrix' && n.length >= 6) T2 = n.slice(0, 6);
    else if (f === 'translate') T2 = [1, 0, 0, 1, n[0] || 0, n[1] || 0];
    else if (f === 'scale') T2 = [n[0] == null ? 1 : n[0], 0, 0, n[1] == null ? (n[0] == null ? 1 : n[0]) : n[1], 0, 0];
    else if (f === 'rotate') { const c = Math.cos(r(n[0] || 0)), s = Math.sin(r(n[0] || 0)), x = n[1] || 0, y = n[2] || 0; T2 = mulM(mulM([1, 0, 0, 1, x, y], [c, s, -s, c, 0, 0]), [1, 0, 0, 1, -x, -y]); }
    else if (f === 'skewX') T2 = [1, 0, Math.tan(r(n[0] || 0)), 1, 0, 0];
    else if (f === 'skewY') T2 = [1, Math.tan(r(n[0] || 0)), 0, 1, 0, 0];
    M = mulM(M, T2); return '';
  });
  return M;
}
// arco elíptico de SVG (de x1,y1 a x2,y2), sin el punto inicial
function arcoSVG(x1, y1, rx, ry, phi, fa, fs, x2, y2) {
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (rx < 1e-9 || ry < 1e-9 || (x1 === x2 && y1 === y2)) return [[x2, y2]];
  const c = Math.cos(phi), s = Math.sin(phi), dx = (x1 - x2) / 2, dy = (y1 - y2) / 2, xp = c * dx + s * dy, yp = -s * dx + c * dy;
  const L = xp * xp / (rx * rx) + yp * yp / (ry * ry); if (L > 1) { rx *= Math.sqrt(L); ry *= Math.sqrt(L); }
  const num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp, den = rx * rx * yp * yp + ry * ry * xp * xp;
  const co = Math.sqrt(Math.max(0, num / (den || 1))) * (fa === fs ? -1 : 1), cxp = co * rx * yp / ry, cyp = -co * ry * xp / rx;
  const cx = c * cxp - s * cyp + (x1 + x2) / 2, cy = s * cxp + c * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = ang(1, 0, (xp - cxp) / rx, (yp - cyp) / ry);
  let dt = ang((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
  if (!fs && dt > 0) dt -= 2 * Math.PI; else if (fs && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(4, Math.ceil(Math.abs(dt) / 0.08)), out = [];
  for (let k = 1; k <= n; k++) { const t = t1 + dt * k / n, ct = Math.cos(t) * rx, st = Math.sin(t) * ry; out.push([cx + ct * c - st * s, cy + ct * s + st * c]); }
  out[out.length - 1] = [x2, y2];
  return out;
}
// el atributo d de un <path>: devuelve trazos { pts, cerrado } (uno por subtrazo)
function trazosPathSVG(d) {
  const s = String(d || ''), reNum = /[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/y, trazos = [];
  let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, qx = null, qy = null, ant = '', cur = null;
  const ws = () => { while (i < s.length && /[\s,]/.test(s[i])) i++; };
  const num = () => { ws(); reNum.lastIndex = i; const m = reNum.exec(s); if (!m) throw new Error('Trayecto SVG mal formado.'); i = reNum.lastIndex; return +m[0]; };
  const bandera = () => { ws(); const c = s[i++]; if (c !== '0' && c !== '1') throw new Error('Trayecto SVG mal formado.'); return c === '1'; };
  const hayNum = () => { ws(); return i < s.length && /[-+.\d]/.test(s[i]); };
  const cerrarCur = () => { if (cur && cur.pts.length > 1) trazos.push(cur); cur = null; };
  const ir = (nx, ny) => { if (!cur) cur = { pts: [[x, y]], cerrado: false }; cur.pts.push([nx, ny]); x = nx; y = ny; };
  const curva = (P0, P1, P2, P3) => {   // Bézier cúbica
    const lg = Math.hypot(P1[0] - P0[0], P1[1] - P0[1]) + Math.hypot(P2[0] - P1[0], P2[1] - P1[1]) + Math.hypot(P3[0] - P2[0], P3[1] - P2[1]);
    const n = clamp(Math.ceil(lg / 2), 6, 64);
    for (let k = 1; k <= n; k++) { const t = k / n, u = 1 - t; ir(u * u * u * P0[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * P3[0], u * u * u * P0[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * P3[1]); }
  };
  while (true) {
    ws(); if (i >= s.length) break;
    if (/[a-zA-Z]/.test(s[i])) cmd = s[i++];
    else if (!cmd || /[zZ]/.test(cmd)) break;
    const rel = cmd !== cmd.toUpperCase(), C = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === 'M') { const nx = num() + ox, ny = num() + oy; cerrarCur(); x = sx = nx; y = sy = ny; cur = { pts: [[x, y]], cerrado: false }; cmd = rel ? 'l' : 'L'; }
    else if (C === 'L') { const nx = num() + ox, ny = num() + oy; ir(nx, ny); }
    else if (C === 'H') ir(num() + ox, y);
    else if (C === 'V') ir(x, num() + oy);
    else if (C === 'C' || C === 'S') {
      let c1;
      if (C === 'C') c1 = [num() + ox, num() + oy];
      else c1 = /[CS]/.test(ant) && qx != null ? [2 * x - qx, 2 * y - qy] : [x, y];
      const c2 = [num() + ox, num() + oy], p = [num() + ox, num() + oy];
      curva([x, y], c1, c2, p); qx = c2[0]; qy = c2[1];
    } else if (C === 'Q' || C === 'T') {
      let c1;
      if (C === 'Q') c1 = [num() + ox, num() + oy];
      else c1 = /[QT]/.test(ant) && qx != null ? [2 * x - qx, 2 * y - qy] : [x, y];
      const p = [num() + ox, num() + oy], P0 = [x, y];
      curva(P0, [P0[0] + 2 / 3 * (c1[0] - P0[0]), P0[1] + 2 / 3 * (c1[1] - P0[1])], [p[0] + 2 / 3 * (c1[0] - p[0]), p[1] + 2 / 3 * (c1[1] - p[1])], p); qx = c1[0]; qy = c1[1];
    } else if (C === 'A') {
      const rx = num(), ry = num(), rot = num() * Math.PI / 180, fa = bandera(), fs = bandera(), nx = num() + ox, ny = num() + oy;
      arcoSVG(x, y, rx, ry, rot, fa, fs, nx, ny).forEach(p => ir(p[0], p[1]));
    } else if (C === 'Z') {
      if (cur) { cur.cerrado = true; const p0 = cur.pts[0], pf = cur.pts[cur.pts.length - 1]; if (cur.pts.length > 1 && Math.hypot(p0[0] - pf[0], p0[1] - pf[1]) < 1e-9) cur.pts.pop(); }
      cerrarCur(); x = sx; y = sy;
    } else throw new Error('Orden de trayecto SVG desconocida: ' + cmd);
    ant = C;
    if (!/[CS]/.test(C) && !/[QT]/.test(C)) qx = qy = null;
    if (C !== 'Z' && !hayNum() && i < s.length && !/[a-zA-Z]/.test(s[i])) break;
  }
  cerrarCur();
  return trazos;
}
function leerSVG(texto) {
  const doc = new DOMParser().parseFromString(texto, 'image/svg+xml'), raiz = doc.documentElement;
  if (!raiz || raiz.nodeName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) throw new Error('No parece un SVG.');
  // milímetros por unidad del dibujo
  const vb = (raiz.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number), ancho = longitudMM(raiz.getAttribute('width')), alto = longitudMM(raiz.getAttribute('height'));
  let k = 25.4 / 96;
  if (vb.length === 4 && vb[2] > 0) { if (ancho) k = ancho / vb[2]; else if (alto && vb[3] > 0) k = alto / vb[3]; }
  const trazos = []; let nTexto = 0, nUse = 0;
  const n = v => parseFloat(v) || 0;
  const recorrer = (el, M) => {
    const tag = (el.localName || el.nodeName || '').toLowerCase();
    if (/^(defs|clippath|mask|symbol|marker|pattern|style|title|desc|metadata|script|lineargradient|radialgradient|filter)$/.test(tag)) return;
    if (el.getAttribute && (el.getAttribute('display') === 'none' || /display\s*:\s*none/.test(el.getAttribute('style') || ''))) return;
    const M2 = el.getAttribute && el.getAttribute('transform') ? mulM(M, matrizTransform(el.getAttribute('transform'))) : M;
    const a = q => el.getAttribute(q), pon = (ts) => ts.forEach(t => trazos.push({ pts: t.pts.map(p => [(M2[0] * p[0] + M2[2] * p[1] + M2[4]) * k, -(M2[1] * p[0] + M2[3] * p[1] + M2[5]) * k]), cerrado: t.cerrado }));
    if (tag === 'path') pon(trazosPathSVG(a('d')));
    else if (tag === 'rect') {
      const x = n(a('x')), y = n(a('y')), w = n(a('width')), h = n(a('height'));
      if (w > 0 && h > 0) {
        let rx = a('rx') != null ? n(a('rx')) : a('ry') != null ? n(a('ry')) : 0, ry = a('ry') != null ? n(a('ry')) : rx;
        rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
        pon(rx > 0 && ry > 0 ? trazosPathSVG(`M${x + rx},${y}H${x + w - rx}A${rx},${ry} 0 0 1 ${x + w},${y + ry}V${y + h - ry}A${rx},${ry} 0 0 1 ${x + w - rx},${y + h}H${x + rx}A${rx},${ry} 0 0 1 ${x},${y + h - ry}V${y + ry}A${rx},${ry} 0 0 1 ${x + rx},${y}Z`)
          : [{ pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], cerrado: true }]);
      }
    } else if (tag === 'circle' || tag === 'ellipse') {
      const cx = n(a('cx')), cy = n(a('cy')), rx = tag === 'circle' ? n(a('r')) : n(a('rx')), ry = tag === 'circle' ? rx : n(a('ry'));
      if (rx > 0 && ry > 0) { const N = 96, pts = []; for (let j = 0; j < N; j++) { const t = 2 * Math.PI * j / N; pts.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]); } pon([{ pts, cerrado: true }]); }
    } else if (tag === 'polygon' || tag === 'polyline') {
      const v = (a('points') || '').match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi) || [], pts = [];
      for (let j = 0; j + 1 < v.length; j += 2) pts.push([+v[j], +v[j + 1]]);
      if (pts.length > 1) pon([{ pts, cerrado: tag === 'polygon' }]);
    } else if (tag === 'line') pon([{ pts: [[n(a('x1')), n(a('y1'))], [n(a('x2')), n(a('y2'))]], cerrado: false }]);
    else if (tag === 'text') { nTexto++; return; }
    else if (tag === 'use') { nUse++; return; }
    [...(el.children || [])].forEach(h => recorrer(h, M2));
  };
  recorrer(raiz, [1, 0, 0, 1, 0, 0]);
  const av = [];
  if (nTexto) av.push(`Tiene ${nTexto} texto${nTexto > 1 ? 's que no se leen' : ' que no se lee'}: pásalos a trayecto (en Inkscape, Trayecto → Objeto a trayecto).`);
  if (nUse) av.push(`Tiene ${nUse} clon${nUse > 1 ? 'es (<use>) que no se leen' : ' (<use>) que no se lee'}: desenlázalos antes de guardar.`);
  return Object.assign(lazosDeTrazos(trazos, 1), { factor: k, aviso: av.join(' ') });
}
/* quita puntos de un lazo hasta dejar n, primero los que menos cambian la forma (área del triángulo) */
function simplificarLazo(poly, n) {
  const L = poly.map(p => p.slice());
  const tri = (a, b, c) => Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
  while (L.length > Math.max(3, n)) {
    let mejor = -1, min = Infinity;
    for (let i2 = 0; i2 < L.length; i2++) { const a = L[(i2 - 1 + L.length) % L.length], c = L[(i2 + 1) % L.length], t = tri(a, L[i2], c); if (t < min) { min = t; mejor = i2; } }
    L.splice(mejor, 1);
  }
  return L;
}

/* vértices del lazo con esquina viva (ángulo interior < maxAng), mirando vecinos a >= 0.8 mm */
function esquinasLazo(L, maxAng = 135) {
  const n = L.length, out = [], d2 = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  for (let i = 0; i < n; i++) {
    let a = i, b = i;
    do { a = (a - 1 + n) % n; } while (a !== i && d2(L[i], L[a]) < 0.8);
    do { b = (b + 1) % n; } while (b !== i && d2(L[i], L[b]) < 0.8);
    if (a === i || b === i) break;
    const u = [L[a][0] - L[i][0], L[a][1] - L[i][1]], v = [L[b][0] - L[i][0], L[b][1] - L[i][1]];
    const ang = Math.acos(clamp((u[0] * v[0] + u[1] * v[1]) / ((Math.hypot(u[0], u[1]) * Math.hypot(v[0], v[1])) || 1), -1, 1)) * 180 / Math.PI;
    if (ang < maxAng) out.push(i);
  }
  return out;
}

/* ---- usar un DXF en el programa ---- */
function pedirDXF(fn) {
  const f = $('#fDXF'); f.value = '';
  f.onchange = () => {
    const a = f.files[0]; if (!a) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const esSVG = /\.svg$/i.test(a.name) || /^\s*(<\?xml|<svg|<!DOCTYPE svg)/i.test(String(rd.result).slice(0, 200)), r = esSVG ? leerSVG(rd.result) : leerDXF(rd.result);
        if (!r.lazos.length) throw new Error(`No hay ningún contorno cerrado en el ${esSVG ? 'SVG' : 'DXF'}.` + (r.aviso ? ' ' + r.aviso : r.abiertos ? ` Hay ${r.abiertos} trazos abiertos: ciérralos (une sus extremos) en el ${esSVG ? 'programa de dibujo' : 'CAD'}.` : ''));
        fn(r, a.name);
      } catch (e) { aviso('⚠ ' + esc(e.message), 7000); }
    };
    rd.readAsText(a);
  };
  f.click();
}
const cajaLazo = L => cajaDe(L);
function dialogoHuecoDXF() {
  pedirDXF((r, nombre) => {
    const L0 = r.lazos[0], cb = cajaLazo(L0);
    modal('📐 Hueco desde un DXF o SVG', `
      <p class="nota"><b>${esc(nombre)}</b>: contorno de ${fmt(cb.w, 1)} × ${fmt(cb.h, 1)} mm con ${L0.length.toLocaleString('es-ES')} puntos${r.lazos.length > 1 ? ` (hay ${r.lazos.length} contornos cerrados: se usa el mayor)` : ''}.${r.aviso ? `<br>⚠ ${esc(r.aviso)}` : ''}</p>
      <label class="fila">Tamaño <select id="dxTam"><option value="real">El del dibujo (mm reales)</option><option value="ancho">Ajustar el ancho a…</option></select></label>
      <label class="fila oculto" id="filaDxAncho">Ancho (mm) <input type="number" id="dxAncho" value="${Math.min(600, Math.round(cb.w))}" min="10" step="10"></label>
      <label class="fila" title="Si el contorno tiene muchos puntos, se quitan primero los que menos cambian la forma">Dejar como mucho (puntos) <input type="number" id="dxPts" value="${Math.min(120, L0.length)}" min="4" max="2000" step="10"></label>
      <p class="nota">El hueco sale como <b>forma libre</b>, centrado, y se puede mover, escalar y girar en la vista ▦ Huecos.</p>`,
      [['✔ Crear el hueco', () => {
        let L = simplificarLazo(L0, clamp(+$('#dxPts').value || 120, 4, 2000));
        const hu = huecoNuevo('libre'), cb2 = cajaLazo(L);
        const k = $('#dxTam').value === 'ancho' ? Math.max(10, +$('#dxAncho').value || cb2.w) / cb2.w : 1;
        // centrado donde el programa pone los huecos nuevos
        const cx = hu.x + hu.ancho / 2, cy = hu.y + hu.alto / 2;
        hu.pts = L.map(p => [Math.round((cx + (p[0] - cb2.x0 - cb2.w / 2) * k) * 10) / 10, Math.round((cy + (p[1] - cb2.y0 - cb2.h / 2) * k) * 10) / 10]);
        const c3 = cajaDe(hu.pts); hu.x = c3.x0; hu.y = c3.y0; hu.ancho = c3.w; hu.alto = c3.h; hu.radio = 0;
        P.huecos.push(hu); UI.hueco = P.huecos.length - 1;
        cerrarModal(); cambio('Hueco desde ' + nombre);
        if (!UI.vistaHuecos) verHuecos(true); else encuadrarHuecos();
      }, true]]);
    $('#dxTam').onchange = () => $('#filaDxAncho').classList.toggle('oculto', $('#dxTam').value !== 'ancho');
  });
}
function dialogoPerfilDXF() {
  if (!P.claves.length) { aviso('Este mueble no tiene perfiles clave.'); return; }
  pedirDXF((r, nombre) => {
    const L0 = r.lazos[0], cb = cajaLazo(L0), M = P.claves[0].pts.length, kSel = clamp(UI.clave, 0, P.claves.length - 1);
    modal('📐 Perfil clave desde un DXF o SVG', `
      <p class="nota"><b>${esc(nombre)}</b>: contorno de ${fmt(cb.w, 1)} × ${fmt(cb.h, 1)} mm${r.lazos.length > 1 ? ` (hay ${r.lazos.length} contornos cerrados: se usa el mayor)` : ''}.${r.aviso ? `<br>⚠ ${esc(r.aviso)}` : ''}</p>
      <p class="nota">El contorno se reparte en los <b>${M} puntos</b> que tienen los perfiles de este mueble (con ✂ Simplificar o añadiendo puntos puedes cambiarlos antes). En cada esquina viva del dibujo cae un punto; si lo pones en todos los perfiles, esos puntos se marcan como esquinas.</p>
      <label class="fila">Ponerlo en <select id="dxDest"><option value="una">El perfil seleccionado (clave ${kSel + 1})</option><option value="todas">Todos los perfiles</option></select></label>
      <label class="fila">Medidas <select id="dxEsc"><option value="real">Las del dibujo (mm reales)</option><option value="alto">Escalar al alto del perfil de ahora</option></select></label>
      <label class="fila chk"><input type="checkbox" id="dxCentrar" checked> Centrarlo sobre el perfil de ahora (mismo centro y misma base)</label>`,
      [['✔ Traer el perfil', () => {
        const act = P.claves[kSel].pts, cbA = cajaDe(act);
        let L = L0.slice();
        const k = $('#dxEsc').value === 'alto' && cb.h > 0.1 ? cbA.h / cb.h : 1;
        L = L.map(p => [p[0] * k, p[1] * k]);
        const cb2 = cajaDe(L);
        if ($('#dxCentrar').checked) { const dx = (cbA.x0 + cbA.w / 2) - (cb2.x0 + cb2.w / 2), dy = cbA.y0 - cb2.y0; L = L.map(p => [p[0] + dx, p[1] + dy]); }
        // mismo sentido de giro que el perfil actual
        const areaS = Q => Q.reduce((s, p, i2) => { const q = Q[(i2 + 1) % Q.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0) / 2;
        if (areaS(L) * areaS(act) < 0) L.reverse();
        let nuevo = remuestrearLazo(L, M);
        // gira el comienzo del lazo para que cada punto caiga cerca del suyo (que no se retuerza la transición)
        let mejor = 0, min = Infinity;
        for (let o = 0; o < M; o++) { let s = 0; for (let i2 = 0; i2 < M; i2++) { const p = nuevo[(i2 + o) % M]; s += (p[0] - act[i2][0]) ** 2 + (p[1] - act[i2][1]) ** 2; } if (s < min) { min = s; mejor = o; } }
        nuevo = nuevo.map((_, i2) => { const p = nuevo[(i2 + mejor) % M]; return [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]; });
        // en cada esquina viva del dibujo, clava el punto más cercano (y márcala si va a todos los perfiles)
        const esqIdx = [];
        esquinasLazo(L).forEach(iv => {
          let mi = 0, md = Infinity;
          nuevo.forEach((p, i2) => { const dd = (p[0] - L[iv][0]) ** 2 + (p[1] - L[iv][1]) ** 2; if (dd < md) { md = dd; mi = i2; } });
          nuevo[mi] = [Math.round(L[iv][0] * 10) / 10, Math.round(L[iv][1] * 10) / 10];
          if (!esqIdx.includes(mi)) esqIdx.push(mi);
        });
        const todasC = $('#dxDest').value === 'todas';
        (todasC ? P.claves : [P.claves[kSel]]).forEach(c => c.pts = nuevo.map(p => p.slice()));
        if (todasC) P.esquinas = nuevo.map((_, i2) => esqIdx.includes(i2));
        P.editado = true; UI.punto = -1;
        cerrarModal(); cambio('Perfil desde ' + nombre); encuadrarPerfil();
      }, true]]);
  });
}

/* ===================== PIEZAS PLANAS (FLAT-PACK) =====================
   Muebles de piezas de tablero con su propia forma (sillas, taburetes, mesitas…), colocadas en tres
   direcciones. Cada pieza es un contorno en su plano, en las coordenadas del mueble (mm):
   - lado:       plano perpendicular a X (en x = c); contorno en (z, y): fondo y alto
   - frente:     plano perpendicular a Z (en z = c); contorno en (x, y): ancho y alto
   - horizontal: plano perpendicular a Y (en y = c); contorno en (x, z): ancho y fondo
   X a lo ancho (0 en el centro), Y alto (0 en el suelo), Z fondo (0 en el centro, + hacia delante).
   Las uniones salen solas donde dos piezas de distinta dirección se cruzan:
   - media madera: cada pieza con una ranura hasta la mitad del cruce (una desde arriba y otra desde abajo)
   - caja pasante: si una pieza queda entera dentro de la otra a lo largo del cruce (una espiga, un
     travesaño), la otra lleva un agujero rectangular por el que pasa. */
const PLANOS = {
  lado:       { n: 0, a: 2, b: 1, nombre: 'De lado', ejes: ['fondo (z)', 'alto (y)'], normal: 'x' },
  frente:     { n: 2, a: 0, b: 1, nombre: 'De frente', ejes: ['ancho (x)', 'alto (y)'], normal: 'z' },
  horizontal: { n: 1, a: 0, b: 2, nombre: 'Horizontal', ejes: ['ancho (x)', 'fondo (z)'], normal: 'y' },
};
const esPlano = () => P && P.tipo === 'plano';
const planoP = () => P.plano || (P.plano = { holgura: 0.3, piezas: [] });
// la pieza de la que se toma el contorno (las simétricas usan el de su pareja)
function piezaFuente(k) {
  const ps = planoP().piezas, p = ps[k];
  return p && p.igualA != null && ps[p.igualA] && ps[p.igualA].igualA == null ? ps[p.igualA] : p;
}
// ranura recta desde un borde: a lo largo de la recta h = c (eje 'v') o v = c (eje 'h')
function ranuraEje(poly, eje, c, mid, borde, alto, w) {
  if (eje === 'v') return hacerRanura(poly, { c, mid, borde, arriba: alto }, w);
  const tr = poly.map(p => [p[1], p[0]]).reverse();
  const res = hacerRanura(tr, { c, mid, borde, arriba: alto }, w);
  if (!res) return null;
  const out = res.map(p => [p[1], p[0]]).reverse();
  out.esq = res.esq.map(p => [p[1], p[0]]);
  return out;
}
const tramosEje = (poly, eje, c) => eje === 'v' ? intervalosV(poly, c) : intervalosH(poly, c);
// agujero rectangular de una caja (en sentido horario, con todas sus esquinas para el hueso de perro)
function rectCaja(cj, w, hol) {
  const a0 = cj.lo - hol / 2, a1 = cj.hi + hol / 2, b0 = cj.c - w / 2, b1 = cj.c + w / 2;
  const r = cj.eje === 'v' ? [[b0, a0], [b0, a1], [b1, a1], [b1, a0]] : [[a0, b0], [a0, b1], [a1, b1], [a1, b0]];
  r.esq = r.map(p => p);
  return r;
}
function calcularPlano() {
  const e = grosor(), Pp = planoP(), hol = clamp(+Pp.holgura || 0, 0, 3);
  const res = { n: 0, sep: 0, hueco: 0, costillas: [], varillas: [], avisos: [], largueros: [], cruces: [], discos: [], rastreles: [], ranurasMal: [], trozos: [], modulos: [], uniones: [], pisan: [], plano: true, uc: 0 };
  ucActual = 0;
  Pp.piezas.forEach((pz, k) => {
    const src = piezaFuente(k), pl = PLANOS[pz.plano] ? pz.plano : 'frente';
    let poly = src && Array.isArray(src.pts) && src.pts.length >= 3 ? curvaCerrada(src.pts, src.esq && src.esq.length === src.pts.length ? src.esq : src.pts.map(() => true)) : [];
    if (poly.length >= 3) { poly = limpiarContorno(poly); if (areaFirmada(poly) < 0) poly.reverse(); }
    const ok = poly.length >= 3 && Math.abs(areaFirmada(poly)) > 25;
    res.costillas.push({ i: k, x: +pz.c || 0, plano: pl, poly, base: poly, ok, caja: ok ? cajaDe(poly) : { x0: 0, y0: 0, x1: 0, y1: 0, w: 0, h: 0 }, area: ok ? areaFirmada(poly) : 0,
      agujeros: [], nVar: 0, ranuras: [], cajas: [], uniones: [], int: [], etq: String(k + 1), nombre: pz.nombre || 'Pieza ' + (k + 1) });
  });
  res.n = res.costillas.length;
  const ps = res.costillas, tol = 0.05;
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const A = ps[i], B = ps[j]; if (!A.ok || !B.ok) continue;
    const pa = PLANOS[A.plano], pb = PLANOS[B.plano];
    if (pa.n === pb.n) {   // paralelas: ¿ocupan el mismo sitio?
      if (Math.abs(A.x - B.x) < e - 0.01 && A.caja.x0 < B.caja.x1 && B.caja.x0 < A.caja.x1 && A.caja.y0 < B.caja.y1 && B.caja.y0 < A.caja.y1
        && (A.poly.some(p => dentro(B.poly, p[0], p[1])) || B.poly.some(p => dentro(A.poly, p[0], p[1])))) res.pisan.push([i, j]);
      continue;
    }
    // la recta donde se cortan sus planos: en A es la recta (eje de A) = posición de B, y al revés
    const ejeA = pa.a === pb.n ? 'v' : 'h', ejeB = pb.a === pa.n ? 'v' : 'h';
    const IA = tramosEje(A.poly, ejeA, B.x), IB = tramosEje(B.poly, ejeB, A.x);
    IA.forEach(I => IB.forEach(J => {
      const lo = Math.max(I[0], J[0]), hi = Math.min(I[1], J[1]);
      if (hi - lo < 0.5) return;
      const Alo = Math.abs(I[0] - lo) < tol, Ahi = Math.abs(I[1] - hi) < tol, Blo = Math.abs(J[0] - lo) < tol, Bhi = Math.abs(J[1] - hi) < tol;
      const u = { a: i, b: j, lo, hi };
      if (Blo && Bhi && !Alo && !Ahi) { u.tipo = 'caja'; u.en = i; u.pasa = j; A.cajas.push({ eje: ejeA, c: B.x, lo, hi, con: j }); }
      else if (Alo && Ahi && !Blo && !Bhi) { u.tipo = 'caja'; u.en = j; u.pasa = i; B.cajas.push({ eje: ejeB, c: A.x, lo, hi, con: i }); }
      else {
        // media madera: la pieza que termina arriba del cruce lleva la ranura desde arriba
        const aArriba = Ahi && Blo ? true : !(Alo && Bhi), mid = (lo + hi) / 2;
        u.tipo = 'media'; u.aArriba = aArriba;
        A.ranuras.push({ eje: ejeA, c: B.x, mid, borde: aArriba ? hi : lo, alto: aArriba, con: j });
        B.ranuras.push({ eje: ejeB, c: A.x, mid, borde: aArriba ? lo : hi, alto: !aArriba, con: i });
      }
      res.uniones.push(u); A.uniones.push(u); B.uniones.push(u);
    }));
  }
  // contornos con las ranuras y las cajas, con el ancho real
  const w = e + hol;
  ps.forEach(p => {
    if (!p.ok) return;
    p.generar = ww => {
      let poly = p.base; const esq = [], fallan = [];
      p.ranuras.forEach(r => { const n2 = ranuraEje(poly, r.eje, r.c, r.mid, r.borde, r.alto, ww); if (n2) { poly = n2; esq.push(...n2.esq); } else fallan.push(r); });
      const out = poly === p.base ? p.base.slice() : poly; out.esq = esq; out.fallan = fallan; return out;
    };
    p.generarInt = ww => p.cajas.map(cj => rectCaja(cj, ww, hol));
    p.poly = p.generar(w); if (p.poly.fallan.length) res.ranurasMal.push(p);
    p.int = p.generarInt(w);
    p.caja = cajaDe(p.poly); p.area = areaFirmada(p.poly) - p.int.reduce((s, h) => s + Math.abs(areaFirmada(h)), 0);
  });
  // caja del mueble (para las medidas y el largo)
  const bb = [[Infinity, -Infinity], [Infinity, -Infinity], [Infinity, -Infinity]];
  ps.forEach(p => { if (!p.ok) return; const pl = PLANOS[p.plano];
    bb[pl.a][0] = Math.min(bb[pl.a][0], p.caja.x0); bb[pl.a][1] = Math.max(bb[pl.a][1], p.caja.x1);
    bb[pl.b][0] = Math.min(bb[pl.b][0], p.caja.y0); bb[pl.b][1] = Math.max(bb[pl.b][1], p.caja.y1);
    bb[pl.n][0] = Math.min(bb[pl.n][0], p.x - e / 2); bb[pl.n][1] = Math.max(bb[pl.n][1], p.x + e / 2); });
  res.bbox = bb.map(r => isFinite(r[0]) ? r : [0, 0]);
  P.largo = Math.max(1, Math.round(res.bbox[0][1] - res.bbox[0][0]));
  avisosPlano(res);
  res.otras = []; return res;
}
const nomP = (res, i) => res.costillas[i] ? res.costillas[i].nombre : 'pieza ' + (i + 1);
function avisosPlano(res) {
  const A = res.avisos, e = grosor(), add = (tipo, txt, cost) => A.push({ tipo, txt, cost });
  if (!res.n) { add('error', 'No hay ninguna pieza: elige una plantilla o añade una pieza (＋ Pieza).'); return; }
  res.costillas.forEach(p => { if (!p.ok) add('error', `${p.nombre}: su contorno no tiene superficie (revisa los puntos).`, p.i); });
  res.pisan.forEach(([i, j]) => add('error', `${nomP(res, i)} y ${nomP(res, j)} están en el mismo sitio (paralelas a menos de ${fmt(e, 1)} mm): se pisan.`, i));
  const sueltas = res.costillas.filter(p => p.ok && !p.uniones.length);
  sueltas.forEach(p => add('atencion', `${p.nombre} no se cruza con ninguna otra pieza: quedaría suelta (o hay que atornillarla o encolarla).`, p.i));
  res.ranurasMal.forEach(p => add('error', `No se pudo hacer alguna ranura en ${p.nombre}: el borde no es recto en el cruce o la ranura sale de la pieza.`, p.i));
  res.uniones.forEach(u => {
    if (u.tipo === 'media' && u.hi - u.lo < 2 * e) add('atencion', `Media madera corta entre ${nomP(res, u.a)} y ${nomP(res, u.b)} (${fmt(u.hi - u.lo)} mm de cruce): unión floja.`, u.a);
    if (u.tipo === 'caja' && u.hi - u.lo < 1.5 * e) add('atencion', `Espiga estrecha de ${nomP(res, u.pasa)} en ${nomP(res, u.en)} (${fmt(u.hi - u.lo)} mm): se puede partir.`, u.pasa);
  });
  // cajas con poca madera alrededor
  res.costillas.forEach(p => {
    if (!p.ok) return;
    const malo = p.int.some(h => h.some(q => distBorde(p.poly, q[0], q[1]) < Math.max(4, e * 0.4) || !dentro(p.poly, q[0], q[1])));
    if (malo) add('atencion', `${p.nombre}: alguna caja (agujero de una espiga) queda muy cerca del borde y la pieza se puede partir.`, p.i);
  });
  const M = P.maqueta;
  if (M && M.activa && Math.abs(M.grosor * M.escala - e) > e * 0.2) add('info', `Maqueta 1:${M.escala}: ${fmt(M.grosor, 1)} mm equivalen a ${fmt(M.grosor * M.escala)} mm reales (el tablero real es de ${fmt(e, 1)} mm): las ranuras y las cajas de la maqueta se hacen con el grosor de la maqueta.`);
  if (!A.some(a => a.tipo === 'error' || a.tipo === 'atencion')) {
    const nM = res.uniones.filter(u => u.tipo === 'media').length, nC = res.uniones.filter(u => u.tipo === 'caja').length;
    add('ok', `Todo correcto: ${res.n} piezas con ${res.uniones.length} ${res.uniones.length === 1 ? 'unión' : 'uniones'}` + (nM || nC ? ` (${[nM ? nM + ' a media madera' : '', nC ? nC + (nC > 1 ? ' espigas en caja pasante' : ' espiga en caja pasante') : ''].filter(Boolean).join(' y ')})` : '') + '.');
  }
}
// texto de las uniones de una pieza (para la vista de la pieza, el plano y el despiece)
function textoUnionesPieza(c) {
  if (!R || !c.uniones) return '';
  const m = c.uniones.filter(u => u.tipo === 'media').length, cj = c.uniones.filter(u => u.tipo === 'caja' && u.en === c.i).length, es = c.uniones.filter(u => u.tipo === 'caja' && u.pasa === c.i).length;
  return [m ? m + ' a media madera' : '', cj ? cj + (cj > 1 ? ' cajas' : ' caja') : '', es ? es + (es > 1 ? ' espigas' : ' espiga') : ''].filter(Boolean).join(' · ') || 'sin uniones';
}
// matriz 3D de una pieza: el contorno (a, b) en su plano, el grosor centrado en la posición c
function basePieza(c) {
  const pl = PLANOS[c.plano], ex = [0, 0, 0], ey = [0, 0, 0]; ex[pl.a] = 1; ey[pl.b] = 1;
  const ez = [ex[1] * ey[2] - ex[2] * ey[1], ex[2] * ey[0] - ex[0] * ey[2], ex[0] * ey[1] - ex[1] * ey[0]], o = [0, 0, 0]; o[pl.n] = c.x;
  return { ex, ey, ez, o };
}
// punto del contorno de una pieza en el espacio (mm)
function puntoPieza(c, a, b) { const pl = PLANOS[c.plano], q = [0, 0, 0]; q[pl.a] = a; q[pl.b] = b; q[pl.n] = c.x; return q; }

/* ===================== PLANTILLAS PARAMÉTRICAS =====================
   Cada plantilla genera el largo, las esquinas y los perfiles clave a partir de sus parámetros.
   Todos los perfiles de un mueble tienen el mismo número de puntos de control. */
const PI2 = Math.PI * 2;
function clavesUniformes(K, L, f) { const out = []; for (let k = 0; k < K; k++) { const t = k / (K - 1); out.push({ x: Math.round(t * L * 10) / 10, pts: f(t) }); } return out; }
function redondeaPts(pts) { return pts.map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]); }

const PLANTILLAS = {
  banco: {
    nombre: 'Banco ondulado',
    desc: 'Banco con el asiento en onda a lo largo y un arco por debajo.',
    params: [
      { id: 'largo', nombre: 'Largo del banco', min: 500, max: 3000, paso: 10, valor: 1600 },
      { id: 'fondo', nombre: 'Fondo', min: 250, max: 800, paso: 5, valor: 420 },
      { id: 'alto', nombre: 'Altura del asiento', min: 250, max: 700, paso: 5, valor: 440 },
      { id: 'onda', nombre: 'Altura de la onda', min: 0, max: 200, paso: 1, valor: 60 },
      { id: 'ondas', nombre: 'Número de ondas', min: 0.5, max: 4, paso: 0.5, valor: 1.5 },
      { id: 'arco', nombre: 'Altura del arco inferior', min: 0, max: 450, paso: 5, valor: 200 },
      { id: 'pata', nombre: 'Ancho de cada apoyo', min: 30, max: 250, paso: 5, valor: 80 },
      { id: 'hundido', nombre: 'Hundido del asiento', min: 0, max: 60, paso: 1, valor: 18 },
      { id: 'panza', nombre: 'Panza de los lados', min: -60, max: 120, paso: 1, valor: 25 },
    ],
    generar(p) {
      const F = p.fondo, w = Math.min(p.pata, F / 2 - 20);
      const esquinas = [true, true, false, false, false, true, true, false, false, false, false, false];
      const K = clamp(Math.ceil(p.ondas * 4) + 1, 5, 17);
      const claves = clavesUniformes(K, p.largo, t => {
        const h = p.alto + p.onda * Math.sin(PI2 * p.ondas * t);
        const a = Math.max(0, Math.min(p.arco, h - 110)), m = (F / 2 - w) * 0.28;
        return redondeaPts([
          [0, 0], [w, 0], [w + m, a * 0.8], [F / 2, a], [F - w - m, a * 0.8], [F - w, 0], [F, 0],
          [F + p.panza, h * 0.5], [F - F * 0.07, h], [F * 0.5, h - p.hundido], [F * 0.07, h], [-p.panza, h * 0.5],
        ]);
      });
      return { largo: p.largo, esquinas, claves };
    },
  },
  tumbona: {
    nombre: 'Tumbona',
    desc: 'Tumbona en S: respaldo, asiento y apoyo de piernas, abombada en el centro.',
    params: [
      { id: 'largo', nombre: 'Ancho de la tumbona', min: 400, max: 1400, paso: 10, valor: 640 },
      { id: 'lt', nombre: 'Largo (de la cabeza a los pies)', min: 1000, max: 2200, paso: 10, valor: 1600 },
      { id: 'respaldo', nombre: 'Altura del respaldo', min: 400, max: 1100, paso: 5, valor: 760 },
      { id: 'asiento', nombre: 'Altura del asiento', min: 150, max: 500, paso: 5, valor: 300 },
      { id: 'pies', nombre: 'Altura en los pies', min: 150, max: 600, paso: 5, valor: 340 },
      { id: 'rodilla', nombre: 'Curva de las rodillas', min: 0, max: 200, paso: 1, valor: 70 },
      { id: 'grueso', nombre: 'Grueso bajo el asiento', min: 60, max: 300, paso: 5, valor: 130 },
      { id: 'bombeo', nombre: 'Abombado en el centro', min: -80, max: 120, paso: 1, valor: 30 },
    ],
    generar(p) {
      const L = p.lt, pf = 0.1 * L;
      const esquinas = [true, true, false, true, true, false, false, false, false, false, false, false, false];
      const claves = clavesUniformes(5, p.largo, t => {
        const b = p.bombeo * Math.sin(Math.PI * t), hs = p.asiento + b;
        return redondeaPts([
          [L * 0.12, 0], [L * 0.12 + pf, 0], [L * 0.45, Math.max(10, hs - p.grueso)], [L * 0.96 - pf, 0], [L * 0.96, 0],
          [L, (p.pies + b) * 0.55], [L * 0.97, p.pies + b], [L * 0.73, p.pies + p.rodilla + b], [L * 0.47, hs],
          [L * 0.26, hs + (p.respaldo - p.asiento) * 0.42 + b * 0.6], [L * 0.04, p.respaldo + b * 0.3], [0, p.respaldo * 0.9 + b * 0.3], [L * 0.08, p.respaldo * 0.42],
        ]);
      });
      return { largo: p.largo, esquinas, claves };
    },
  },
  pouf: {
    nombre: 'Pouf / taburete',
    desc: 'Volumen redondeado (superelipsoide) con cintura opcional.',
    params: [
      { id: 'largo', nombre: 'Largo (X)', min: 250, max: 1200, paso: 5, valor: 460 },
      { id: 'fondo', nombre: 'Fondo (Z)', min: 250, max: 1200, paso: 5, valor: 460 },
      { id: 'alto', nombre: 'Altura', min: 200, max: 900, paso: 5, valor: 430 },
      { id: 'redondez', nombre: 'Forma (2 = huevo · 5 = cubo blando)', min: 1.6, max: 6, paso: 0.1, valor: 3.2 },
      { id: 'cintura', nombre: 'Cintura', min: 0, max: 0.45, paso: 0.01, valor: 0.12 },
      { id: 'apoyo', nombre: 'Base aplanada', min: 0, max: 150, paso: 1, valor: 40 },
    ],
    generar(p) {
      const M = 16, esquinas = new Array(M).fill(false), pe = p.redondez;
      const yc = (p.alto - p.apoyo) / 2, c = (p.alto + p.apoyo) / 2, B = p.fondo / 2;
      const sg = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
      const claves = [];
      const K = 11;
      for (let k = 0; k < K; k++) {
        const t = 0.5 - 0.5 * Math.cos(Math.PI * k / (K - 1)); // más claves cerca de los extremos
        const s = Math.max(0.0004, 1 - Math.pow(Math.abs(2 * t - 1), pe)), f = Math.pow(s, 1 / pe);
        const pts = [];
        for (let i = 0; i < M; i++) {
          const th = -Math.PI / 2 + PI2 * i / M;
          const y = yc + c * f * sg(Math.sin(th), 2 / pe);
          const cin = 1 - p.cintura * Math.exp(-Math.pow((y - yc) / (0.45 * c), 2));
          pts.push([B + B * f * sg(Math.cos(th), 2 / pe) * cin, y]);
        }
        claves.push({ x: Math.round(t * p.largo * 10) / 10, pts: redondeaPts(pts) });
      }
      return { largo: p.largo, esquinas, claves };
    },
  },
  mesa: {
    nombre: 'Mesa baja «ola»',
    desc: 'Mesa de centro con el tablero plano y la parte de abajo en ola.',
    params: [
      { id: 'largo', nombre: 'Largo de la mesa', min: 500, max: 2200, paso: 10, valor: 1100 },
      { id: 'fondo', nombre: 'Fondo', min: 300, max: 1000, paso: 5, valor: 560 },
      { id: 'alto', nombre: 'Altura', min: 250, max: 800, paso: 5, valor: 400 },
      { id: 'arco', nombre: 'Altura media del arco', min: 0, max: 600, paso: 5, valor: 200 },
      { id: 'onda', nombre: 'Variación del arco', min: 0, max: 250, paso: 1, valor: 90 },
      { id: 'ondas', nombre: 'Número de ondas', min: 0.5, max: 4, paso: 0.5, valor: 1 },
      { id: 'pata', nombre: 'Ancho de cada apoyo', min: 30, max: 250, paso: 5, valor: 70 },
      { id: 'vuelo', nombre: 'Vuelo del tablero', min: 0, max: 150, paso: 1, valor: 40 },
      { id: 'cintura', nombre: 'Curva de los lados', min: -60, max: 120, paso: 1, valor: 45 },
    ],
    generar(p) {
      const F = p.fondo, w = Math.min(p.pata, F / 2 - 20), H = p.alto;
      const esquinas = [true, true, false, false, false, true, true, false, true, true, false];
      const K = clamp(Math.ceil(p.ondas * 4) + 1, 5, 17);
      const claves = clavesUniformes(K, p.largo, t => {
        const a = clamp(p.arco + p.onda * Math.sin(PI2 * p.ondas * t), 0, H - 60), m = (F / 2 - w) * 0.22;
        return redondeaPts([
          [0, 0], [w, 0], [w + m, a * 0.8], [F / 2, a], [F - w - m, a * 0.8], [F - w, 0], [F, 0],
          [F - p.cintura, H * 0.55], [F + p.vuelo, H], [-p.vuelo, H], [p.cintura, H * 0.55],
        ]);
      });
      return { largo: p.largo, esquinas, claves };
    },
  },
  estante: {
    nombre: 'Estantería «duna»',
    desc: 'Mueble alto con un hueco corrido para libros, la espalda recta y el frente ondulado.',
    params: [
      { id: 'largo', nombre: 'Largo', min: 500, max: 2400, paso: 10, valor: 1200 },
      { id: 'fondo', nombre: 'Fondo', min: 200, max: 600, paso: 5, valor: 340 },
      { id: 'alto', nombre: 'Altura', min: 400, max: 2000, paso: 5, valor: 900 },
      { id: 'onda', nombre: 'Ondulación del frente', min: 0, max: 150, paso: 1, valor: 70 },
      { id: 'ondas', nombre: 'Número de ondas', min: 0.5, max: 4, paso: 0.5, valor: 2 },
      { id: 'hueco', nombre: 'Profundidad del hueco', min: 50, max: 500, paso: 5, valor: 230 },
      { id: 'altoHueco', nombre: 'Alto del hueco', min: 100, max: 900, paso: 5, valor: 320 },
      { id: 'altoBase', nombre: 'Altura del hueco sobre el suelo', min: 60, max: 1200, paso: 5, valor: 300 },
    ],
    generar(p) {
      const F = p.fondo, H = p.alto, hy = Math.min(p.altoHueco, H - 160), y0 = clamp(p.altoBase, 60, H - hy - 100);
      const esquinas = [true, true, false, true, true, true, true, false, false, false, true];
      const K = clamp(Math.ceil(p.ondas * 4) + 1, 5, 17);
      const claves = clavesUniformes(K, p.largo, t => {
        const o = p.onda * (0.5 + 0.5 * Math.sin(PI2 * p.ondas * t)), hp = Math.min(p.hueco, F - 60);
        return redondeaPts([
          [0, 0], [F, 0], [F + o * 0.45, y0 * 0.5], [F, y0], [F - hp, y0], [F - hp, y0 + hy], [F, y0 + hy],
          [F + o * 0.45, (y0 + hy + H) / 2], [F * 0.72, H], [F * 0.15, H - 12], [0, H * 0.82],
        ]);
      });
      return { largo: p.largo, esquinas, claves };
    },
  },
  libre: {
    nombre: 'Forma libre',
    desc: 'Un bloque redondeado para empezar a dibujar tus propios perfiles.',
    params: [
      { id: 'largo', nombre: 'Largo', min: 200, max: 3000, paso: 10, valor: 900 },
      { id: 'fondo', nombre: 'Fondo', min: 150, max: 1200, paso: 5, valor: 400 },
      { id: 'alto', nombre: 'Altura', min: 150, max: 1500, paso: 5, valor: 420 },
    ],
    generar(p) {
      const F = p.fondo, H = p.alto;
      const esquinas = [true, true, false, false, false, false];
      const claves = clavesUniformes(3, p.largo, () => redondeaPts([[0, 0], [F, 0], [F + 10, H * 0.55], [F * 0.75, H], [F * 0.25, H], [-10, H * 0.55]]));
      return { largo: p.largo, esquinas, claves };
    },
  },
  vacio: {
    nombre: 'Vacío: empezar de cero',
    desc: 'Dos perfiles rectangulares de partida, para dibujarlos punto a punto o traerlos de un DXF.',
    params: [
      { id: 'largo', nombre: 'Largo', min: 200, max: 3000, paso: 10, valor: 1000 },
      { id: 'fondo', nombre: 'Fondo', min: 100, max: 1200, paso: 5, valor: 300 },
      { id: 'alto', nombre: 'Altura', min: 100, max: 1500, paso: 5, valor: 300 },
      { id: 'claves', nombre: 'Perfiles clave', min: 2, max: 12, paso: 1, valor: 2 },
    ],
    generar(p) {
      const F = p.fondo, H = p.alto;
      return { largo: p.largo, esquinas: [true, true, true, true], claves: clavesUniformes(clamp(Math.round(p.claves || 2), 2, 12), p.largo, () => redondeaPts([[0, 0], [F, 0], [F, H], [0, H]])) };
    },
  },
};

// ---------- plantillas radiales (la posición de cada perfil es un ángulo: 0 a 360°) ----------
function generarRevolucion(p) {
  const M = 7, esquinas = [true, true, ...new Array(M - 2).fill(false), true, true];
  const K = clamp(Math.round(p.lobulos) * 4, 8, 48) + 1, H = p.alto;
  const gam = Math.log(0.5) / Math.log(clamp(p.panza, 0.1, 0.9));
  const claves = [];
  for (let k = 0; k < K; k++) {
    const th = 360 * k / (K - 1), pts = [[0, 0]];
    for (let j = 0; j < M; j++) {
      const t = j / (M - 1), v = t * H, lin = lerp(p.abajo, p.arriba, t);
      const base = lin + (p.radio - lin) * Math.sin(Math.PI * Math.pow(t, gam));
      const lob = Math.round(p.lobulos) ? 1 + (p.amplitud / p.radio) * Math.cos((th - p.giro * t) * Math.PI / 180 * Math.round(p.lobulos)) : 1;
      pts.push([Math.max(1, (j === 0 || j === M - 1) ? lin : base * lob), v]);
    }
    pts.push([0, H]);
    claves.push({ x: Math.round(th * 100) / 100, pts: redondeaPts(pts) });
  }
  return { largo: 360, esquinas, claves };
}
PLANTILLAS.lampara = {
  nombre: 'Lámpara de lóbulos', grupo: 'radial',
  desc: 'Pantalla colgante en forma de bulbo, con lóbulos que pueden girar en espiral.',
  params: [
    { id: 'alto', nombre: 'Altura', min: 150, max: 1200, paso: 5, valor: 420 },
    { id: 'radio', nombre: 'Radio mayor', min: 60, max: 600, paso: 5, valor: 180 },
    { id: 'abajo', nombre: 'Radio abajo', min: 10, max: 500, paso: 5, valor: 70 },
    { id: 'arriba', nombre: 'Radio arriba', min: 10, max: 500, paso: 5, valor: 30 },
    { id: 'panza', nombre: 'Altura de la panza (0 a 1)', min: 0.15, max: 0.85, paso: 0.01, valor: 0.5 },
    { id: 'lobulos', nombre: 'Lóbulos', min: 0, max: 12, paso: 1, valor: 6 },
    { id: 'amplitud', nombre: 'Profundidad de los lóbulos', min: 0, max: 150, paso: 1, valor: 28 },
    { id: 'giro', nombre: 'Giro en espiral (°)', min: -180, max: 180, paso: 1, valor: 40 },
  ],
  generar: generarRevolucion,
};
PLANTILLAS.columna = {
  nombre: 'Columna / pie de lámpara', grupo: 'radial',
  desc: 'Pieza alta de revolución con cintura y lóbulos torsionados: pie de lámpara, columna o peana.',
  params: [
    { id: 'alto', nombre: 'Altura', min: 300, max: 2400, paso: 10, valor: 1100 },
    { id: 'radio', nombre: 'Radio mayor', min: 60, max: 500, paso: 5, valor: 150 },
    { id: 'abajo', nombre: 'Radio abajo', min: 20, max: 500, paso: 5, valor: 170 },
    { id: 'arriba', nombre: 'Radio arriba', min: 20, max: 500, paso: 5, valor: 110 },
    { id: 'panza', nombre: 'Altura de la panza (0 a 1)', min: 0.15, max: 0.85, paso: 0.01, valor: 0.3 },
    { id: 'lobulos', nombre: 'Lóbulos', min: 0, max: 12, paso: 1, valor: 4 },
    { id: 'amplitud', nombre: 'Profundidad de los lóbulos', min: 0, max: 150, paso: 1, valor: 35 },
    { id: 'giro', nombre: 'Giro en espiral (°)', min: -360, max: 360, paso: 1, valor: 180 },
  ],
  generar: generarRevolucion,
};
// ---------- plantillas de pared (u = lo que sale de la pared, v = altura) ----------
function generarPared(p, prof) {
  const M = 13, H = p.alto, esquinas = [true, true, ...new Array(M - 2).fill(false), true, true];
  const K = p.claves ? clamp(Math.round(p.claves), 2, 31) : clamp(Math.round((p.ondasX || 1) * 6) + 1, 7, 31);
  const claves = clavesUniformes(K, p.largo, t => {
    const pts = [[0, 0]];
    for (let j = 0; j < M; j++) { const v = H * j / (M - 1); pts.push([Math.max(4, prof(t, v / H)), v]); }
    pts.push([0, H]);
    return redondeaPts(pts);
  });
  return { largo: p.largo, esquinas, claves };
}
PLANTILLAS.radial_vacio = {
  nombre: 'Vacío radial: cilindro', grupo: 'radial',
  desc: 'Un cilindro liso de partida, para dibujar tu lámpara, columna o peana desde cero.',
  params: [
    { id: 'alto', nombre: 'Altura', min: 100, max: 1500, paso: 5, valor: 400 },
    { id: 'radio', nombre: 'Radio', min: 40, max: 600, paso: 5, valor: 150 },
    { id: 'claves', nombre: 'Perfiles clave', min: 3, max: 12, paso: 1, valor: 3 },
  ],
  generar(p) {
    const r = p.radio, H = p.alto;
    return { largo: 360, esquinas: [true, true, true, true], claves: clavesUniformes(clamp(Math.round(p.claves || 3), 3, 12), 360, () => redondeaPts([[0, 0], [r, 0], [r, H], [0, H]])) };
  },
};
PLANTILLAS.pared_ondas = {
  nombre: 'Panel de pared ondulado', grupo: 'pared',
  desc: 'Lamas verticales cuyo canto dibuja ondas en horizontal y en vertical (o en diagonal).',
  params: [
    { id: 'largo', nombre: 'Ancho del panel', min: 400, max: 6000, paso: 10, valor: 1800 },
    { id: 'alto', nombre: 'Alto del panel', min: 300, max: 3000, paso: 10, valor: 1200 },
    { id: 'fondo', nombre: 'Fondo mínimo', min: 10, max: 300, paso: 1, valor: 35 },
    { id: 'relieve', nombre: 'Relieve (lo que sale la onda)', min: 0, max: 400, paso: 1, valor: 90 },
    { id: 'ondasX', nombre: 'Ondas a lo ancho', min: 0.5, max: 5, paso: 0.5, valor: 1.5 },
    { id: 'ondasY', nombre: 'Ondas a lo alto', min: 0, max: 4, paso: 0.5, valor: 1 },
    { id: 'diagonal', nombre: 'Diagonal (0 = cuadrícula, 1 = diagonal)', min: 0, max: 1, paso: 0.05, valor: 0.6 },
  ],
  generar(p) {
    return generarPared(p, (t, y) => p.fondo + p.relieve * (0.5 + 0.25 * Math.sin(PI2 * p.ondasX * t) + 0.25 * Math.sin(PI2 * (p.ondasY * y + p.diagonal * p.ondasX * t))));
  },
};
PLANTILLAS.pared_libre = {
  nombre: 'Panel de pared libre', grupo: 'pared',
  desc: 'Lamas planas para dibujar a mano. También es la forma que queda al convertir un texto, un modelo 3D o una imagen en perfiles editables.',
  params: [
    { id: 'largo', nombre: 'Largo del panel (donde van las lamas)', min: 200, max: 6000, paso: 10, valor: 1200 },
    { id: 'alto', nombre: 'Largo de cada lama', min: 200, max: 3000, paso: 10, valor: 1000 },
    { id: 'claves', nombre: 'Perfiles clave', min: 2, max: 15, paso: 1, valor: 7 },
  ],
  generar(p) { return generarPared({ largo: p.largo, alto: p.alto, claves: p.claves }, () => 40); },
};
PLANTILLAS.pared_relieve = {
  nombre: 'Panel de pared con relieve', grupo: 'pared',
  desc: 'Lamas que forman uno o dos relieves redondeados (cúpula o duna) sobre la pared.',
  params: [
    { id: 'largo', nombre: 'Ancho del panel', min: 400, max: 6000, paso: 10, valor: 1600 },
    { id: 'alto', nombre: 'Alto del panel', min: 300, max: 3000, paso: 10, valor: 1100 },
    { id: 'fondo', nombre: 'Fondo mínimo', min: 10, max: 300, paso: 1, valor: 30 },
    { id: 'relieve', nombre: 'Altura del relieve', min: 0, max: 500, paso: 1, valor: 160 },
    { id: 'anchura', nombre: 'Anchura del relieve (0 a 1)', min: 0.1, max: 1, paso: 0.01, valor: 0.35 },
    { id: 'cx', nombre: 'Posición a lo ancho (0 a 1)', min: 0, max: 1, paso: 0.01, valor: 0.4 },
    { id: 'cy', nombre: 'Posición a lo alto (0 a 1)', min: 0, max: 1, paso: 0.01, valor: 0.55 },
    { id: 'dos', nombre: 'Segundo relieve (0 = no, 1 = igual)', min: 0, max: 1, paso: 0.05, valor: 0.5 },
  ],
  generar(p) {
    const g = (t, y, cx, cy) => Math.exp(-((t - cx) ** 2 + (y - cy) ** 2) / (p.anchura * p.anchura * 0.5));
    p.ondasX = 2;
    return generarPared(p, (t, y) => p.fondo + p.relieve * Math.min(1, g(t, y, p.cx, p.cy) + p.dos * g(t, y, 1 - p.cx * 0.6, 1 - p.cy)));
  },
};
PLANTILLAS.pared_estante = {
  nombre: 'Estantería de pared ondulada', grupo: 'pared',
  desc: 'Lamas contra la pared que salen formando baldas; el fondo de las baldas ondula a lo ancho.',
  params: [
    { id: 'largo', nombre: 'Ancho de la estantería', min: 400, max: 6000, paso: 10, valor: 2000 },
    { id: 'alto', nombre: 'Alto', min: 300, max: 2500, paso: 10, valor: 1000 },
    { id: 'baldas', nombre: 'Número de baldas', min: 1, max: 8, paso: 1, valor: 3 },
    { id: 'fondoMax', nombre: 'Fondo mayor de las baldas', min: 60, max: 600, paso: 5, valor: 220 },
    { id: 'fondoMin', nombre: 'Fondo menor de las baldas', min: 30, max: 600, paso: 5, valor: 110 },
    { id: 'ondas', nombre: 'Ondas a lo ancho', min: 0.5, max: 5, paso: 0.5, valor: 1.5 },
    { id: 'desfase', nombre: 'Desfase entre baldas (0 a 1)', min: 0, max: 1, paso: 0.05, valor: 0.3 },
    { id: 'gruesoBalda', nombre: 'Grueso de la balda', min: 15, max: 120, paso: 1, valor: 40 },
    { id: 'fondo', nombre: 'Fondo de la lama entre baldas', min: 20, max: 200, paso: 1, valor: 45 },
    { id: 'mensula', nombre: 'Altura de la ménsula bajo la balda', min: 0, max: 300, paso: 5, valor: 90 },
  ],
  generar(p) {
    const n = Math.round(p.baldas), H = p.alto, F = p.fondo;
    const esquinas = [true, true];
    for (let j = 0; j < n; j++) esquinas.push(true, false, true, true, true);
    esquinas.push(true, true);
    const K = clamp(Math.round(p.ondas * 6) + 1, 7, 31);
    const claves = clavesUniformes(K, p.largo, t => {
      const pts = [[0, 0], [F, 0]];
      for (let j = 0; j < n; j++) {
        const h = H * (j + 1) / (n + 0.6), g = p.gruesoBalda, m = Math.max(g * 0.5, p.mensula);
        const D = Math.max(F + 10, p.fondoMin + (p.fondoMax - p.fondoMin) * (0.5 + 0.5 * Math.sin(PI2 * (p.ondas * t + j * p.desfase))));
        pts.push([F, Math.max(1, h - g - m)], [F + (D - F) * 0.6, h - g - m * 0.25], [D, h - g], [D, h], [F, h]);
      }
      pts.push([F, H], [0, H]);
      return redondeaPts(pts);
    });
    return { largo: p.largo, esquinas, claves };
  },
};
// ---------- piezas planas (flat-pack): cada plantilla da la lista de piezas ----------
// rectángulo con las esquinas redondeadas que se pidan (radio r): [abajo-izq, abajo-dcha, arriba-dcha, arriba-izq]
function rectPlano(x0, y0, x1, y1, r = 0, cuales = [1, 1, 1, 1]) {
  const pts = [], rr = Math.max(0, Math.min(r, (x1 - x0) / 2 - 0.1, (y1 - y0) / 2 - 0.1));
  const vert = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], cen = [[x0 + rr, y0 + rr], [x1 - rr, y0 + rr], [x1 - rr, y1 - rr], [x0 + rr, y1 - rr]], ang = [Math.PI, -Math.PI / 2, 0, Math.PI / 2];
  for (let k = 0; k < 4; k++) {
    if (!cuales[k] || rr < 0.5) pts.push(vert[k]);
    else for (let j = 0; j <= 4; j++) { const a = ang[k] + Math.PI / 2 * j / 4; pts.push([cen[k][0] + rr * Math.cos(a), cen[k][1] + rr * Math.sin(a)]); }
  }
  return { pts: redondeaPts(pts), esq: pts.map(() => true) };
}
// puntos con su marca de esquina: [[x, y, esquina?]…]
const ptsPlano = L => ({ pts: redondeaPts(L.map(q => [q[0], q[1]])), esq: L.map(q => q[2] !== false) });
const piezaPlana = (nombre, plano, c, forma, extra) => Object.assign({ nombre, plano, c: Math.round(c * 10) / 10, pts: forma.pts, esq: forma.esq }, extra || {});
const igualQue = (nombre, plano, c, k) => ({ nombre, plano, c: Math.round(c * 10) / 10, igualA: k });
const CLAVE_PLANO = { largo: 100, esquinas: [true, true, true], claves: [{ x: 0, pts: [[0, 0], [100, 0], [100, 100]] }] };
PLANTILLAS.taburete_plano = {
  nombre: 'Taburete de patas cruzadas', grupo: 'plano',
  desc: 'Dos patas con arco y dos travesaños cruzados a media madera; las espigas de las patas pasan por el asiento.',
  params: [
    { id: 'ancho', nombre: 'Ancho del asiento', min: 250, max: 900, paso: 5, valor: 400 },
    { id: 'fondo', nombre: 'Fondo del asiento', min: 200, max: 700, paso: 5, valor: 320 },
    { id: 'alto', nombre: 'Altura', min: 200, max: 900, paso: 5, valor: 460 },
    { id: 'vuelo', nombre: 'Vuelo del asiento', min: 0, max: 80, paso: 1, valor: 25 },
    { id: 'arco', nombre: 'Altura del arco de las patas', min: 0, max: 500, paso: 5, valor: 170 },
    { id: 'pie', nombre: 'Ancho de cada pie', min: 30, max: 200, paso: 1, valor: 60 },
    { id: 'faldon', nombre: 'Alto de los travesaños', min: 40, max: 200, paso: 1, valor: 80 },
    { id: 'espiga', nombre: 'Ancho de las espigas', min: 20, max: 120, paso: 1, valor: 40 },
  ],
  generar(p, e) {
    const W = p.ancho - 2 * p.vuelo, H = p.alto, te = p.espiga, zl = p.fondo / 2 - p.vuelo - e / 2;
    const xt = W / 2 - 15 - te / 2, xa = W / 2 - 15 - te - 35, pie = Math.min(p.pie, W / 2 - 20);
    const arco = Math.max(0, Math.min(p.arco, H - e - p.faldon - 40)), m = (W / 2 - pie);
    const pata = ptsPlano([[-W / 2, 0], [-m, 0], [-m * 0.55, arco * 0.82, false], [0, arco, false], [m * 0.55, arco * 0.82, false], [m, 0], [W / 2, 0], [W / 2, H - e],
      [xt + te / 2, H - e], [xt + te / 2, H], [xt - te / 2, H], [xt - te / 2, H - e], [-xt + te / 2, H - e], [-xt + te / 2, H], [-xt - te / 2, H], [-xt - te / 2, H - e], [-W / 2, H - e]]);
    const Z = zl + 35, yb = H - e - p.faldon, zi = Math.max(10, zl - e / 2 - 25);
    const trav = ptsPlano([[-Z, yb], [-zi, yb], [0, yb + p.faldon * 0.4, false], [zi, yb], [Z, yb], [Z, H - e], [-Z, H - e]]);
    return Object.assign({}, CLAVE_PLANO, { piezas: [
      piezaPlana('Asiento', 'horizontal', H - e / 2, rectPlano(-p.ancho / 2, -p.fondo / 2, p.ancho / 2, p.fondo / 2, 22)),
      piezaPlana('Pata delantera', 'frente', zl, pata), igualQue('Pata trasera', 'frente', -zl, 1),
      piezaPlana('Travesaño izquierdo', 'lado', -xa, trav), igualQue('Travesaño derecho', 'lado', xa, 3),
    ] });
  },
};
PLANTILLAS.banco_lamas = {
  nombre: 'Banco de lamas', grupo: 'plano',
  desc: 'Dos laterales con el asiento curvo y lamas de canto encajadas a media madera; un travesaño pasante los une por debajo.',
  params: [
    { id: 'largo', nombre: 'Largo del banco', min: 400, max: 2400, paso: 10, valor: 1000 },
    { id: 'fondo', nombre: 'Fondo', min: 220, max: 700, paso: 5, valor: 360 },
    { id: 'alto', nombre: 'Altura del asiento', min: 250, max: 700, paso: 5, valor: 440 },
    { id: 'hundido', nombre: 'Hundido del asiento', min: 0, max: 80, paso: 1, valor: 25 },
    { id: 'lamas', nombre: 'Número de lamas', min: 3, max: 30, paso: 1, valor: 8 },
    { id: 'altoLama', nombre: 'Alto de cada lama', min: 25, max: 150, paso: 1, valor: 55 },
    { id: 'margen', nombre: 'Laterales desde el extremo', min: 20, max: 400, paso: 5, valor: 90 },
    { id: 'arco', nombre: 'Altura del arco de los laterales', min: 0, max: 400, paso: 5, valor: 160 },
    { id: 'pata', nombre: 'Ancho de cada pata', min: 30, max: 200, paso: 1, valor: 70 },
  ],
  generar(p, e) {
    const D = p.fondo, hl = p.altoLama, xs = p.largo / 2 - p.margen, pata = Math.min(p.pata, D / 2 - 20);
    const T = z => p.alto - hl * 0.25 - p.hundido * (1 - (2 * z / D) ** 2);   // canto de arriba de los laterales
    const arco = Math.max(0, Math.min(p.arco, T(0) - hl - 120)), m = D / 2 - pata;
    const lat = ptsPlano([[-D / 2, 0], [-m, 0], [-m * 0.5, arco * 0.8, false], [0, arco, false], [m * 0.5, arco * 0.8, false], [m, 0], [D / 2, 0], [D / 2, T(D / 2)],
      [D / 4, T(D / 4), false], [0, T(0), false], [-D / 4, T(-D / 4), false], [-D / 2, T(-D / 2)]]);
    const n = Math.max(2, Math.round(p.lamas)), z0 = -D / 2 + e / 2 + 6, z1 = D / 2 - e / 2 - 6, piezas = [
      piezaPlana('Lateral izquierdo', 'lado', -xs, lat), igualQue('Lateral derecho', 'lado', xs, 0)];
    for (let i = 0; i < n; i++) {
      const z = z0 + (z1 - z0) * i / (n - 1), t = T(z);
      piezas.push(piezaPlana('Lama ' + (i + 1), 'frente', z, rectPlano(-p.largo / 2, t - hl * 0.75, p.largo / 2, t + hl * 0.25, 6)));
    }
    const yt = arco + Math.max(30, (T(0) - hl - arco) * 0.35), ht = Math.min(80, Math.max(40, (T(0) - hl - arco) * 0.4)), xt = xs + e / 2 + 30;
    piezas.push(piezaPlana('Travesaño', 'frente', 0, rectPlano(-xt, yt, xt, yt + ht, 8)));
    return Object.assign({}, CLAVE_PLANO, { piezas });
  },
};
PLANTILLAS.silla_plana = {
  nombre: 'Silla de tableros', grupo: 'plano',
  desc: 'Dos laterales con espigas que pasan por el asiento, respaldo y travesaño delantero a media madera y un travesaño trasero pasante.',
  params: [
    { id: 'ancho', nombre: 'Ancho', min: 300, max: 700, paso: 5, valor: 440 },
    { id: 'fondo', nombre: 'Fondo', min: 300, max: 650, paso: 5, valor: 430 },
    { id: 'asiento', nombre: 'Altura del asiento', min: 250, max: 600, paso: 5, valor: 450 },
    { id: 'alto', nombre: 'Altura del respaldo', min: 500, max: 1200, paso: 5, valor: 820 },
    { id: 'respaldo', nombre: 'Alto del respaldo', min: 80, max: 500, paso: 5, valor: 200 },
    { id: 'pata', nombre: 'Ancho de las patas', min: 40, max: 120, paso: 1, valor: 56 },
    { id: 'faldon', nombre: 'Alto del faldón bajo el asiento', min: 40, max: 200, paso: 1, valor: 70 },
    { id: 'espiga', nombre: 'Ancho de las espigas', min: 20, max: 100, paso: 1, valor: 40 },
  ],
  generar(p, e) {
    const hs = p.asiento, H = Math.max(p.alto, hs + p.respaldo + 40), pa = Math.max(p.pata, 2 * e + 20), te = p.espiga;
    const zb = -p.fondo / 2 + pa / 2, zf = p.fondo / 2 - pa / 2, xs = p.ancho / 2 - 40, yr = hs - e - p.faldon;
    const t2 = zf - pa / 2 - te / 2 - 20, t1 = zb + pa / 2 + te / 2 + 30, zm = (zb + zf) / 2;
    const lat = ptsPlano([[zb - pa / 2, 0], [zb + pa / 2, 0], [zb + pa / 2, yr], [zm, yr + p.faldon * 0.35, false], [zf - pa / 2, yr], [zf - pa / 2, 0], [zf + pa / 2, 0], [zf + pa / 2, hs - e],
      [t2 + te / 2, hs - e], [t2 + te / 2, hs], [t2 - te / 2, hs], [t2 - te / 2, hs - e], [t1 + te / 2, hs - e], [t1 + te / 2, hs], [t1 - te / 2, hs], [t1 - te / 2, hs - e],
      [zb + pa / 2, hs - e], [zb + pa / 2, H], [zb - pa / 2, H]]);
    const xT = xs + e / 2 + 20, yT = Math.min(160, yr * 0.35);
    return Object.assign({}, CLAVE_PLANO, { piezas: [
      piezaPlana('Lateral izquierdo', 'lado', -xs, lat), igualQue('Lateral derecho', 'lado', xs, 0),
      piezaPlana('Asiento', 'horizontal', hs - e / 2, rectPlano(-p.ancho / 2, zb + pa / 2 + 1, p.ancho / 2, p.fondo / 2 + 15, 30, [0, 0, 1, 1])),
      piezaPlana('Respaldo', 'frente', zb, rectPlano(-p.ancho / 2, H - p.respaldo, p.ancho / 2, H, 40, [0, 0, 1, 1])),
      piezaPlana('Travesaño delantero', 'frente', zf, rectPlano(-xT, yr, xT, hs - e, 0)),
      piezaPlana('Travesaño trasero', 'frente', zb, rectPlano(-(xs + e / 2 + 25), yT, xs + e / 2 + 25, yT + 60, 6)),
    ] });
  },
};
PLANTILLAS.plano_vacio = {
  nombre: 'Vacío: piezas planas', grupo: 'plano',
  desc: 'Un tablero de frente y otro de lado que se cruzan, para construir el mueble pieza a pieza o traer los contornos de un DXF o SVG.',
  params: [
    { id: 'ancho', nombre: 'Ancho del tablero de frente', min: 100, max: 2400, paso: 5, valor: 500 },
    { id: 'alto', nombre: 'Alto', min: 100, max: 2400, paso: 5, valor: 400 },
    { id: 'fondo', nombre: 'Fondo del tablero de lado', min: 100, max: 1200, paso: 5, valor: 300 },
  ],
  generar(p) {
    return Object.assign({}, CLAVE_PLANO, { piezas: [
      piezaPlana('Tablero de frente', 'frente', 0, rectPlano(-p.ancho / 2, 0, p.ancho / 2, p.alto)),
      piezaPlana('Tablero de lado', 'lado', 0, rectPlano(-p.fondo / 2, 0, p.fondo / 2, p.alto * 0.8)),
    ] });
  },
};
const grupoDe = id => PLANTILLAS[id].grupo || 'lineal';
const grupoTipo = t => t === 'radial' ? 'radial' : t === 'pared' ? 'pared' : t === 'plano' ? 'plano' : 'lineal';

function paramsDefecto(id) { const o = {}; PLANTILLAS[id].params.forEach(q => o[q.id] = q.valor); return o; }
// genera la forma desde la plantilla; si solo cambia el largo y hay retoques a mano, escala las claves
function aplicarPlantilla(soloLargo) {
  const pl = PLANTILLAS[P.plantilla];
  if (soloLargo && P.editado) {
    const k = P.params.largo / P.largo;
    P.claves.forEach(c => c.x = Math.round(c.x * k * 10) / 10);
    P.largo = P.params.largo;
    return;
  }
  const g = pl.generar(P.params, grosor());
  P.largo = g.largo; P.esquinas = g.esquinas; P.claves = g.claves; P.editado = false;
  if (g.piezas) { planoP().piezas = g.piezas; UI.costilla = Math.min(UI.costilla || 0, g.piezas.length - 1); }
  UI.clave = Math.min(UI.clave, P.claves.length - 1); UI.punto = -1;
}

/* ===================== VISTAS 2D (editor de perfil y costilla) ===================== */
class Vista2D {
  constructor(canvas, dibujar) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.dibujar = dibujar;
    this.sc = 1; this.ox = 0; this.oy = 0; this.w = 0; this.h = 0; this.listo = false;
    new ResizeObserver(() => this.ajustar()).observe(canvas.parentElement);
    canvas.addEventListener('wheel', ev => {
      ev.preventDefault();
      const r = canvas.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
      const f = Math.exp(-ev.deltaY * 0.0015), [u, v] = this.aMundo(mx, my);
      this.sc = clamp(this.sc * f, 0.02, 60);
      this.ox = mx - u * this.sc; this.oy = my + v * this.sc; this.pintar();
    }, { passive: false });
  }
  ajustar() {
    const r = this.c.parentElement.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    if (r.width < 2 || r.height < 2) return;
    const cx = this.w ? (this.w / 2 - this.ox) / this.sc : 0, cy = this.h ? (this.oy - this.h / 2) / this.sc : 0;
    this.w = r.width; this.h = r.height;
    this.c.width = Math.round(r.width * d); this.c.height = Math.round(r.height * d);
    this.ctx.setTransform(d, 0, 0, d, 0, 0);
    if (this.listo) { this.ox = this.w / 2 - cx * this.sc; this.oy = this.h / 2 + cy * this.sc; }
    this.pintar();
  }
  aPantalla(u, v) { return [this.ox + u * this.sc, this.oy - v * this.sc]; }
  aMundo(x, y) { return [(x - this.ox) / this.sc, (this.oy - y) / this.sc]; }
  encuadrar(caja, margen = 46) {
    if (!this.w || !caja || !isFinite(caja.w)) return;
    const w = Math.max(caja.w, 10), h = Math.max(caja.h, 10);
    this.sc = Math.min((this.w - 2 * margen) / w, (this.h - 2 * margen - 26) / h);
    this.ox = this.w / 2 - (caja.x0 + w / 2) * this.sc;
    this.oy = this.h / 2 + 10 + (caja.y0 + h / 2) * this.sc;
    this.listo = true; this.pintar();
  }
  pintar() { if (this.w) this.dibujar(this.ctx, this); }
  camino(ctx, poly) {
    ctx.beginPath();
    poly.forEach((p, i) => { const [x, y] = this.aPantalla(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.closePath();
  }
  rejilla(ctx) {
    ctx.fillStyle = cssVar('--vista'); ctx.fillRect(0, 0, this.w, this.h);
    const pasos = [1, 5, 10, 50, 100, 500, 1000];
    let menor = pasos.find(p => p * this.sc >= 9) || 1000;
    const mayor = menor * (menor === 5 || menor === 50 || menor === 500 ? 2 : 10);
    const [u0, v1] = this.aMundo(0, 0), [u1, v0] = this.aMundo(this.w, this.h);
    const linea = (paso, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath();
      for (let u = Math.ceil(u0 / paso) * paso; u <= u1; u += paso) { const x = Math.round(this.aPantalla(u, 0)[0]) + .5; ctx.moveTo(x, 0); ctx.lineTo(x, this.h); }
      for (let v = Math.ceil(v0 / paso) * paso; v <= v1; v += paso) { const y = Math.round(this.aPantalla(0, v)[1]) + .5; ctx.moveTo(0, y); ctx.lineTo(this.w, y); }
      ctx.stroke();
    };
    linea(menor, cssVar('--rejilla')); linea(mayor, cssVar('--rejilla2'));
    // suelo y eje
    const [, ys] = this.aPantalla(0, 0), [xs] = this.aPantalla(0, 0);
    ctx.strokeStyle = cssVar('--ejes'); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, ys); ctx.lineTo(this.w, ys); ctx.stroke();
    ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(xs, 0); ctx.lineTo(xs, this.h); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = cssVar('--suave'); ctx.font = '11px system-ui'; ctx.fillText('suelo', 6, ys - 4);
    ctx.textAlign = 'right'; ctx.fillText('rejilla ' + menor + ' / ' + mayor + ' mm', this.w - 8, this.h - 8); ctx.textAlign = 'left';
  }
  cota(ctx, a, b, off, texto, vertical) { // cota sencilla entre a y b (mundo), desplazada off px
    const [x0, y0] = this.aPantalla(a[0], a[1]), [x1, y1] = this.aPantalla(b[0], b[1]);
    ctx.save(); ctx.strokeStyle = cssVar('--acento'); ctx.fillStyle = cssVar('--acento'); ctx.lineWidth = 1; ctx.font = '11.5px system-ui';
    if (!vertical) {
      const y = Math.max(y0, y1) + off;
      ctx.beginPath(); ctx.moveTo(x0, y0 + 4); ctx.lineTo(x0, y + 4); ctx.moveTo(x1, y1 + 4); ctx.lineTo(x1, y + 4); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      flecha(ctx, x0, y, 1, 0); flecha(ctx, x1, y, -1, 0);
      const tw = ctx.measureText(texto).width;
      ctx.fillStyle = cssVar('--vista'); ctx.fillRect((x0 + x1) / 2 - tw / 2 - 3, y - 15, tw + 6, 13);
      ctx.fillStyle = cssVar('--acento'); ctx.textAlign = 'center'; ctx.fillText(texto, (x0 + x1) / 2, y - 4);
    } else {
      const x = Math.max(x0, x1) + off;
      ctx.beginPath(); ctx.moveTo(x0 + 4, y0); ctx.lineTo(x + 4, y0); ctx.moveTo(x1 + 4, y1); ctx.lineTo(x + 4, y1); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
      flecha(ctx, x, y0, 0, y1 > y0 ? 1 : -1); flecha(ctx, x, y1, 0, y1 > y0 ? -1 : 1);
      ctx.translate(x - 4, (y0 + y1) / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center';
      const tw = ctx.measureText(texto).width;
      ctx.fillStyle = cssVar('--vista'); ctx.fillRect(-tw / 2 - 3, -12, tw + 6, 13);
      ctx.fillStyle = cssVar('--acento'); ctx.fillText(texto, 0, -2);
    }
    ctx.restore();
  }
}
function conAlfa(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); if (!m) return hex;
  const n = parseInt(m[1], 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
function flecha(ctx, x, y, dx, dy) {
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * 7 - dy * 3, y + dy * 7 - dx * 3); ctx.lineTo(x + dx * 7 + dy * 3, y + dy * 7 + dx * 3); ctx.closePath(); ctx.fill();
}

/* ---------- editor del perfil clave ---------- */
let VP = null, VC = null;
function claveActual() { return clavesOrdenadas()[UI.clave] || P.claves[0]; }
// lo que se edita arriba: el perfil clave (con las esquinas del mueble) o, en las piezas planas, el contorno de la pieza seleccionada
function ctrlEdit() {
  if (esPlano()) {
    const src = piezaFuente(UI.costilla); if (!src || !Array.isArray(src.pts)) return null;
    if (!Array.isArray(src.esq) || src.esq.length !== src.pts.length) src.esq = src.pts.map(() => true);
    return { pts: src.pts, esq: src.esq, pieza: src };
  }
  return { pts: claveActual().pts, esq: P.esquinas };
}
function colorCostilla(alfa) { return `rgba(168,116,63,${alfa})`; }

function dibujarPerfil(ctx, V) {
  V.rejilla(ctx);
  if (!P || !R) return;
  if (relieveActivo()) { dibujarPerfilRelieve(ctx, V); return; }
  if (esPlano()) { dibujarPerfilPlano(ctx, V); return; }
  const C = clavesOrdenadas(), k = claveActual(), acento = cssVar('--acento');
  // todas las costillas, muy suaves (la «envolvente»)
  ctx.lineWidth = 1; ctx.strokeStyle = colorCostilla(.16);
  R.costillas.forEach(c => { if (c.ok) { V.camino(ctx, c.poly); ctx.stroke(); } });
  // costilla seleccionada
  const cs = piezaSel();
  if (cs && cs.ok && !cs.z) { ctx.setLineDash([6, 4]); ctx.strokeStyle = colorCostilla(.75); ctx.lineWidth = 1.4; V.camino(ctx, cs.poly); ctx.stroke(); ctx.setLineDash([]); }
  const fig = figuraActiva();
  let cont = fig ? (cs && cs.ok && !cs.z ? cs.poly : []) : [];
  if (fig) {
    if (cs && cs.ok && !cs.z) { ctx.fillStyle = conAlfa(acento, .13); ctx.strokeStyle = acento; ctx.lineWidth = 2; V.camino(ctx, cs.poly); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = acento; ctx.font = '600 12.5px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(`Forma desde el modelo 3D «${P.figura.malla.nombre}»: se cambia en el panel izquierdo`, V.w / 2, 66); ctx.textAlign = 'left';
  }
  // otras claves
  if (!fig) {
  ctx.strokeStyle = cssVar('--ejes'); ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
  C.forEach(o => { if (o !== k) { V.camino(ctx, curvaCerrada(o.pts, P.esquinas)); ctx.stroke(); } });
  ctx.setLineDash([]);
  // clave actual: curva completa y contorno recortado
  const curva = curvaCerrada(k.pts, P.esquinas); cont = contornoDe(k.pts);
  ctx.fillStyle = conAlfa(acento, .13);
  if (cont.length >= 3) { V.camino(ctx, cont); ctx.fill(); }
  ctx.strokeStyle = acento; ctx.lineWidth = 1; ctx.globalAlpha = .45; V.camino(ctx, curva); ctx.stroke(); ctx.globalAlpha = 1;
  if (cont.length >= 3) { ctx.lineWidth = 2.2; V.camino(ctx, cont); ctx.stroke(); }
  }
  // corte superior
  if (P.costillas.tope) {
    const [, y] = V.aPantalla(0, P.costillas.topeAlt);
    ctx.strokeStyle = cssVar('--peligro'); ctx.setLineDash([8, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(V.w, y); ctx.stroke(); ctx.setLineDash([]);
  }
  // polígono de control
  if (!fig) { ctx.strokeStyle = cssVar('--suave'); ctx.lineWidth = .8; ctx.setLineDash([2, 3]);
  V.camino(ctx, k.pts); ctx.stroke(); ctx.setLineDash([]); }
  // varillas
  const r = radioAgujero(), Vv = P.varillas;
  // radial: tubo central y discos; pared: la pared y los rastreles
  if (P.tipo === 'radial') {
    const [xt] = V.aPantalla(radioTubo(), 0);
    ctx.fillStyle = 'rgba(150,156,164,.25)'; ctx.fillRect(V.aPantalla(0, 0)[0], 0, xt - V.aPantalla(0, 0)[0], V.h);
    ctx.fillStyle = '#5f6b78'; ctx.font = '11px system-ui'; ctx.fillText('tubo', xt + 4, 46);
    R.discos.forEach(d => { const [a, y] = V.aPantalla(radioTubo(), d.v), [b] = V.aPantalla(d.rD, 0); ctx.fillStyle = 'rgba(95,107,120,.35)'; ctx.fillRect(a, y - grosor() / 2 * V.sc, b - a, grosor() * V.sc); ctx.fillStyle = '#5f6b78'; ctx.fillText(d.etq, b + 4, y + 4); });
  }
  if (P.tipo === 'pared') {
    const [xp] = V.aPantalla(0, 0);
    ctx.fillStyle = 'rgba(150,156,164,.28)'; ctx.fillRect(0, 0, xp, V.h); ctx.fillStyle = '#5f6b78'; ctx.font = '11px system-ui'; ctx.fillText('pared', Math.max(4, xp - 40), 46);
    R.rastreles.forEach(rr => { const [a, y] = V.aPantalla(0, rr.v + P.pared.alto / 2), [b] = V.aPantalla(P.pared.grueso, 0); ctx.fillStyle = 'rgba(205,179,138,.6)'; ctx.fillRect(a, y, b - a, P.pared.alto * V.sc); });
  }
  // retícula: posición de los largueros
  if (P.tipo === 'reticula') {
    const vistos = new Set();
    R.largueros.forEach(z => {
      if (vistos.has(z.u)) return; vistos.add(z.u);
      const [x] = V.aPantalla(z.u, 0), sel = cs && cs.z && cs.u === z.u;
      ctx.strokeStyle = sel ? cssVar('--acento') : '#5f6b78'; ctx.lineWidth = sel ? 2 : 1; ctx.setLineDash([7, 4]);
      ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(x, V.h); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = ctx.strokeStyle; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.fillText(letra(z.j), x, 58); ctx.textAlign = 'left';
    });
  }
  if (P.tipo === 'costillas') Vv.lista.forEach((p, i) => {
    const info = R.varillas[i], mal = info && (!info.usada || info.fallan.length), [x, y] = V.aPantalla(p[0], p[1]);
    const col = mal ? cssVar('--peligro') : '#5f6b78';
    ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.arc(x, y, (r + Vv.margen) * V.sc, 0, PI2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = mal ? 'rgba(192,57,43,.35)' : 'rgba(95,107,120,.35)'; ctx.lineWidth = i === UI.varilla ? 2.5 : 1.5;
    ctx.beginPath(); ctx.arc(x, y, Math.max(3, r * V.sc), 0, PI2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'left'; ctx.fillText('V' + (i + 1), x + Math.max(5, r * V.sc) + 3, y - 4);
  });
  // puntos de control (no con una figura: la forma sale del modelo)
  if (!fig) k.pts.forEach((p, i) => {
    const [x, y] = V.aPantalla(p[0], p[1]), sel = i === UI.punto;
    ctx.fillStyle = sel ? acento : cssVar('--panel'); ctx.strokeStyle = acento; ctx.lineWidth = 1.8;
    ctx.beginPath();
    if (P.esquinas[i]) ctx.rect(x - 5, y - 5, 10, 10); else ctx.arc(x, y, 5.2, 0, PI2);
    ctx.fill(); ctx.stroke();
  });
  // cotas del perfil
  if (cont.length >= 3) {
    const b = cajaDe(cont);
    V.cota(ctx, [b.x0, b.y0], [b.x1, b.y0], 22, fmt(b.w) + ' mm', false);
    V.cota(ctx, [b.x1, b.y0], [b.x1, b.y1], 26, fmt(b.h) + ' mm', true);
  }
  if (UI.modo === 'varilla') {
    ctx.fillStyle = acento; ctx.font = '600 12.5px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('Haz clic donde quieras la varilla (Esc para cancelar)', V.w / 2, 46);
  }
  ctx.textAlign = 'left';
}

// ----- interacción -----
const ED = { arr: null };
function snap(v) { const g = +$('#kRejilla').value; return g ? Math.round(v / g) * g : Math.round(v * 10) / 10; }
function puntoCerca(mx, my) {
  if (formaCalculada()) return -1;
  const k = ctrlEdit(); if (!k) return -1; let mejor = -1, md = 10;
  k.pts.forEach((p, i) => { const [x, y] = VP.aPantalla(p[0], p[1]), d = Math.hypot(x - mx, y - my); if (d < md) { md = d; mejor = i; } });
  return mejor;
}
function varillaCerca(mx, my) {
  if (P.tipo !== 'costillas') return -1;
  let mejor = -1, md = Infinity; const r = radioAgujero();
  P.varillas.lista.forEach((p, i) => { const [x, y] = VP.aPantalla(p[0], p[1]), d = Math.hypot(x - mx, y - my); if (d < Math.max(9, r * VP.sc + 4) && d < md) { md = d; mejor = i; } });
  return mejor;
}
function tramoCerca(mx, my) {
  const k = ctrlEdit(); if (!k) return null; const m = curvaConTramos(k.pts, k.esq, 24);
  let mejor = null, md = 9;
  m.forEach(o => { const [x, y] = VP.aPantalla(o.p[0], o.p[1]), d = Math.hypot(x - mx, y - my); if (d < md) { md = d; mejor = o; } });
  return mejor;
}
function insertarPunto(j, s) {
  if (esPlano()) {
    const k = ctrlEdit(); if (!k) return;
    const q = puntoTramo(k.pts, k.esq, j, s); k.pts.splice(j + 1, 0, [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10]); k.esq.splice(j + 1, 0, false);
    UI.punto = j + 1; P.editado = true; return;
  }
  const n = P.esquinas.length;
  P.claves.forEach(c => { const q = puntoTramo(c.pts, P.esquinas, j, s); c.pts.splice(j + 1, 0, [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10]); });
  P.esquinas.splice(j + 1, 0, false);
  UI.punto = (j + 1) % (n + 1); P.editado = true;
}
function borrarPunto(i) {
  if (esPlano()) {
    const k = ctrlEdit(); if (!k) return;
    if (k.pts.length <= 3) { aviso('Una pieza necesita al menos 3 puntos.'); return; }
    k.pts.splice(i, 1); k.esq.splice(i, 1); UI.punto = -1; P.editado = true; cambio('Punto borrado'); return;
  }
  if (P.esquinas.length <= 3) { aviso('Un perfil necesita al menos 3 puntos.'); return; }
  P.claves.forEach(c => c.pts.splice(i, 1)); P.esquinas.splice(i, 1);
  UI.punto = -1; P.editado = true; cambio('Punto borrado');
}
function alternarEsquina(i) {
  if (i < 0) { aviso('Selecciona antes un punto del perfil.'); return; }
  const E = ctrlEdit().esq; E[i] = !E[i]; P.editado = true; cambio(E[i] ? 'Punto en esquina' : 'Punto en curva');
}

function iniciarEditor() {
  VP = new Vista2D($('#cPerfil'), dibujarPerfil);
  VC = new Vista2D($('#cCost'), dibujarCostilla);
  const c = $('#cPerfil');
  c.addEventListener('contextmenu', ev => ev.preventDefault());
  c.addEventListener('pointerdown', ev => {
    const r = c.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
    c.setPointerCapture(ev.pointerId);
    if (UI.modo === 'varilla' && ev.button === 0) {
      const [u, v] = VP.aMundo(mx, my);
      P.varillas.lista.push([snap(u), snap(v)]); UI.varilla = P.varillas.lista.length - 1; UI.modo = 'normal';
      cambio('Varilla añadida'); return;
    }
    if (ev.button === 2) {
      const iv = varillaCerca(mx, my); if (iv >= 0) { P.varillas.lista.splice(iv, 1); UI.varilla = -1; cambio('Varilla quitada'); return; }
      const ip = puntoCerca(mx, my); if (ip >= 0) borrarPunto(ip);
      return;
    }
    if (ev.button === 1) { ED.arr = { tipo: 'pan', x: mx, y: my, ox: VP.ox, oy: VP.oy }; return; }
    const ip = puntoCerca(mx, my);
    if (ip >= 0) {
      UI.punto = ip; UI.varilla = -1;
      const k = ctrlEdit();
      ED.arr = { tipo: 'punto', i: ip, x: mx, y: my, orig: esPlano() ? [] : P.claves.map(o => o.pts[ip].slice()), base: k.pts[ip].slice(), movido: false };
      VP.pintar(); return;
    }
    const iv = varillaCerca(mx, my);
    if (iv >= 0) { UI.varilla = iv; UI.punto = -1; ED.arr = { tipo: 'varilla', i: iv, x: mx, y: my, base: P.varillas.lista[iv].slice(), movido: false }; recalcular(); return; }
    UI.punto = -1; UI.varilla = -1;
    ED.arr = { tipo: 'pan', x: mx, y: my, ox: VP.ox, oy: VP.oy }; VP.pintar();
  });
  c.addEventListener('pointermove', ev => {
    const r = c.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
    const [u, v] = VP.aMundo(mx, my);
    $('#piePerfil').innerHTML = `<span>u ${fmt(u)} · v ${fmt(v)} mm</span>` + ayudaPerfil();
    const A = ED.arr; if (!A) { c.style.cursor = UI.modo === 'varilla' ? 'crosshair' : (puntoCerca(mx, my) >= 0 || varillaCerca(mx, my) >= 0) ? 'move' : 'grab'; return; }
    if (A.tipo === 'pan') { VP.ox = A.ox + mx - A.x; VP.oy = A.oy + my - A.y; VP.pintar(); return; }
    const du = (mx - A.x) / VP.sc, dv = -(my - A.y) / VP.sc;
    if (!A.movido && Math.hypot(mx - A.x, my - A.y) < 3) return;
    A.movido = true;
    if (A.tipo === 'punto') {
      const k = ctrlEdit(), nu = ev.shiftKey ? A.base[0] + du : snap(A.base[0] + du), nv = ev.shiftKey ? A.base[1] + dv : snap(A.base[1] + dv);
      if ($('#kTodas').checked && !esPlano()) {
        const ddu = nu - A.base[0], ddv = nv - A.base[1];
        P.claves.forEach((o, j) => { o.pts[A.i] = [Math.round((A.orig[j][0] + ddu) * 10) / 10, Math.round((A.orig[j][1] + ddv) * 10) / 10]; });
      } else k.pts[A.i] = [nu, nv];
      P.editado = true;
    } else if (A.tipo === 'varilla') {
      P.varillas.lista[A.i] = [snap(A.base[0] + du), snap(A.base[1] + dv)];
    }
    recalcularPronto();
  });
  const fin = () => {
    const A = ED.arr; ED.arr = null;
    if (A && A.movido && A.tipo !== 'pan') cambio(A.tipo === 'punto' ? 'Punto movido' : 'Varilla movida');
  };
  c.addEventListener('pointerup', fin); c.addEventListener('pointercancel', fin);
  c.addEventListener('dblclick', ev => {
    const r = c.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
    const ip = puntoCerca(mx, my); if (ip >= 0) { alternarEsquina(ip); return; }
    if (formaCalculada()) return;
    const t = tramoCerca(mx, my); if (t) { insertarPunto(t.j, t.s); cambio('Punto añadido'); }
  });
  $('#bEsquina').onclick = () => alternarEsquina(UI.punto);
  $('#bEncuadrarPerfil').onclick = () => encuadrarPerfil();
  $('#sClave').onchange = () => { UI.clave = +$('#sClave').value; UI.punto = -1; refrescarClaves(); VP.pintar(); costillaDeClave(); };
  $('#bCostAnt').onclick = () => selCostilla(UI.costilla - 1);
  $('#bCostSig').onclick = () => selCostilla(UI.costilla + 1);
  $('#piePerfil').innerHTML = ayudaPerfil();
}
// piezas planas: el contorno de la pieza seleccionada en su plano, con las piezas que la cruzan en gris
function dibujarPerfilPlano(ctx, V) {
  const c = piezaSel(), k = ctrlEdit(), acento = cssVar('--acento'), e = grosor();
  if (!c || !k) return;
  // dónde la cruzan las otras piezas (la franja del grosor de cada una, a lo largo del cruce)
  (c.uniones || []).forEach(u => {
    const otra = R.costillas[u.a === c.i ? u.b : u.a]; if (!otra) return;
    const pa = PLANOS[c.plano], pb = PLANOS[otra.plano], eje = pa.a === pb.n ? 'v' : 'h';
    const r = eje === 'v' ? [otra.x - e / 2, u.lo, otra.x + e / 2, u.hi] : [u.lo, otra.x - e / 2, u.hi, otra.x + e / 2];
    const [x0, y0] = V.aPantalla(r[0], r[1]), [x1, y1] = V.aPantalla(r[2], r[3]);
    ctx.fillStyle = 'rgba(95,107,120,.30)'; ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    ctx.fillStyle = '#5f6b78'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(otra.etq + (u.tipo === 'caja' ? (u.en === c.i ? ' (caja)' : ' (espiga)') : ''), (x0 + x1) / 2, Math.min(y0, y1) - 4);
  });
  ctx.textAlign = 'left';
  // la pieza como se corta (con ranuras y cajas)
  if (c.ok) {
    ctx.fillStyle = conAlfa(acento, .12); ctx.beginPath();
    [polyVista(c.poly), ...(c.int || []).map(polyVista)].forEach(pol => pol.forEach((p, i) => { const [x, y] = V.aPantalla(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }) || ctx.closePath());
    ctx.fill('evenodd'); ctx.strokeStyle = colorCostilla(.8); ctx.lineWidth = 1.2; ctx.stroke();
  }
  // contorno de control (curva) y polígono de control
  const curva = curvaCerrada(k.pts, k.esq);
  ctx.strokeStyle = acento; ctx.lineWidth = 2.2; V.camino(ctx, curva); ctx.stroke();
  ctx.strokeStyle = cssVar('--suave'); ctx.lineWidth = .8; ctx.setLineDash([2, 3]); V.camino(ctx, k.pts); ctx.stroke(); ctx.setLineDash([]);
  k.pts.forEach((p, i) => {
    const [x, y] = V.aPantalla(p[0], p[1]), sel = i === UI.punto;
    ctx.fillStyle = sel ? acento : cssVar('--panel'); ctx.strokeStyle = acento; ctx.lineWidth = 1.8; ctx.beginPath();
    if (k.esq[i]) ctx.rect(x - 4.5, y - 4.5, 9, 9); else ctx.arc(x, y, 5, 0, PI2);
    ctx.fill(); ctx.stroke();
  });
  const b = cajaDe(curva);
  V.cota(ctx, [b.x0, b.y0], [b.x1, b.y0], 22, fmt(b.w) + ' mm', false);
  V.cota(ctx, [b.x1, b.y0], [b.x1, b.y1], 26, fmt(b.h) + ' mm', true);
  const pl = PLANOS[c.plano];
  ctx.fillStyle = cssVar('--suave'); ctx.font = '11.5px system-ui';
  ctx.fillText(`${c.nombre} (${c.etq}) · ${pl.nombre.toLowerCase()}, en ${pl.normal} = ${fmt(c.x)} mm · horizontal: ${pl.ejes[0]} · vertical: ${pl.ejes[1]}` + (k.pieza && k.pieza !== planoP().piezas[UI.costilla] ? ` · igual que «${k.pieza.nombre}»` : ''), 8, 62);
}
// con relieve (texto o modelo) no hay perfiles clave: se ven las lamas y la seleccionada
function dibujarPerfilRelieve(ctx, V) {
  ctx.fillStyle = 'rgba(150,156,164,.28)'; const [xp] = V.aPantalla(0, 0); ctx.fillRect(0, 0, xp, V.h);
  ctx.lineWidth = 1; ctx.strokeStyle = colorCostilla(.18);
  R.costillas.forEach(c => { if (c.ok) { V.camino(ctx, c.poly); ctx.stroke(); } });
  const cs = piezaSel();
  if (cs && cs.ok && !cs.z) { ctx.fillStyle = conAlfa(cssVar('--acento'), .13); ctx.strokeStyle = cssVar('--acento'); ctx.lineWidth = 2; V.camino(ctx, cs.poly); ctx.fill(); ctx.stroke(); }
  R.rastreles.forEach(rr => { const [a, y] = V.aPantalla(0, rr.v + P.pared.alto / 2), [b] = V.aPantalla(P.pared.grueso, 0); ctx.fillStyle = 'rgba(205,179,138,.6)'; ctx.fillRect(a, y, b - a, P.pared.alto * V.sc); });
  ctx.fillStyle = cssVar('--acento'); ctx.font = '600 12.5px system-ui'; ctx.textAlign = 'center';
  ctx.fillText(`Forma desde ${{ texto: 'el texto', modelo: 'el modelo 3D', imagen: 'la imagen' }[P.relieve.fuente]}: se cambia en el panel izquierdo (lama ${cs ? cs.etq : ''})`, V.w / 2, 66);
  ctx.textAlign = 'left';
}
function ayudaPerfil() {
  if (UI.vistaHuecos) return '<span><kbd>Arrastrar</kbd> mover el hueco · asas: estirar</span><span><kbd>Doble clic</kbd> vértice nuevo (libre)</span><span><kbd>↻</kbd> girar</span><span><kbd>Clic dcho.</kbd> quitar vértice</span><span><kbd>Supr</kbd> borrar el hueco</span><span><kbd>Mayús</kbd> sin rejilla</span>';
  return '<span><kbd>Doble clic</kbd> línea: punto nuevo · punto: esquina</span><span><kbd>Clic dcho.</kbd> borrar</span><span><kbd>Mayús</kbd> sin rejilla</span>';
}
function encuadrarPerfil() {
  if (!R) return;
  if (esPlano()) { const k = ctrlEdit(), c = piezaSel(); if (!k) { VP.pintar(); return; } const b = cajaDe(curvaCerrada(k.pts, k.esq)); if (c && c.ok) { const d = c.caja; b.x0 = Math.min(b.x0, d.x0); b.y0 = Math.min(b.y0, d.y0); b.w = Math.max(b.x0 + b.w, d.x1) - b.x0; b.h = Math.max(b.y0 + b.h, d.y1) - b.y0; } VP.encuadrar(b, 50); return; }
  if (formaCalculada()) { const cs = R.costillas.filter(c => c.ok); if (cs.length) VP.encuadrar({ x0: 0, y0: 0, w: Math.max(...cs.map(c => c.caja.x1)), h: Math.max(...cs.map(c => c.caja.y1)) }, 50); return; }
  let x0 = Infinity, y0 = 0, x1 = -Infinity, y1 = -Infinity;
  P.claves.forEach(c => c.pts.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }));
  VP.encuadrar({ x0, y0, w: x1 - x0, h: y1 - y0 }, 50);
}

/* ---------- vista de la costilla seleccionada ---------- */
function dibujarCostilla(ctx, V) {
  V.rejilla(ctx);
  if (!R) return;
  const c = piezaSel(); if (!c || !c.ok) return;
  ctx.fillStyle = colorCostilla(.28); ctx.strokeStyle = colorCostilla(1); ctx.lineWidth = 2;
  // la pieza con sus huecos de dentro (si los tiene)
  ctx.beginPath(); [polyVista(c.poly), ...(c.int || [])].forEach(pol => pol.forEach((p, i) => { const [x, y] = V.aPantalla(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }) || ctx.closePath());
  ctx.fill('evenodd'); ctx.stroke();
  // los otros trozos de la misma lama o costilla, en claro
  const pad = c.padre || c; (pad.partes || []).forEach(q => { if (q === c || !q.ok) return; ctx.save(); ctx.globalAlpha = .35; ctx.setLineDash([4, 3]); V.camino(ctx, q.poly); ctx.stroke(); ctx.restore(); });
  const r = radioAgujero();
  c.agujeros.forEach(k => {
    const [x, y] = V.aPantalla(P.varillas.lista[k][0], P.varillas.lista[k][1]);
    ctx.fillStyle = cssVar('--vista'); ctx.beginPath(); ctx.arc(x, y, Math.max(2, r * V.sc), 0, PI2); ctx.fill(); ctx.stroke();
  });
  // varillas que no caben en esta costilla
  R.varillas.forEach(rv => {
    if (rv.usada && !c.z && rv.fallan.includes(c.i)) {
      const [x, y] = V.aPantalla(rv.u, rv.v); ctx.strokeStyle = cssVar('--peligro'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, Math.max(4, r * V.sc), 0, PI2); ctx.stroke(); ctx.strokeStyle = colorCostilla(1);
    }
  });
  const [lx, ly] = V.aPantalla(...puntoEtiqueta(c));
  ctx.fillStyle = colorCostilla(1); ctx.font = 'bold ' + clamp(30 * V.sc, 11, 26) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(c.etq, lx, ly); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  V.cota(ctx, [c.caja.x0, c.caja.y0], [c.caja.x1, c.caja.y0], 18, fmt(c.caja.w) + ' mm', false);
  V.cota(ctx, [c.caja.x1, c.caja.y0], [c.caja.x1, c.caja.y1], 20, fmt(c.caja.h) + ' mm', true);
}
function selCostilla(i, encuadrar) {
  if (!R) return;
  UI.costilla = clamp(i, 0, nPiezas() - 1);
  // si en esa costilla hay un perfil clave, se selecciona también (para editarlo arriba)
  const c = piezaSel();
  if (esPlano()) { const cambia = UI.piezaVista !== UI.costilla; UI.piezaVista = UI.costilla; if (cambia) { UI.punto = -1; encuadrarPerfil(); } refrescarPiezaSel(); }
  if (c && UI.costilla < R.n && !formaCalculada() && P.tipo !== 'radial' && !esPlano()) {
    const C = clavesOrdenadas(), tol = Math.max(grosor(), (R.sep || 0) / 2);
    let mej = -1, md = Infinity; C.forEach((k, j) => { const d = Math.abs(k.x - c.x); if (d < md) { md = d; mej = j; } });
    if (mej >= 0 && md <= tol && mej !== UI.clave) { UI.clave = mej; UI.punto = -1; refrescarClaves(); construirClaves3D(); }
  }
  refrescarCostilla();
  if (encuadrar !== false) encuadrarCostilla();
  VP.pintar(); resaltar3D();
  const li = $('#listaCost').children[UI.costilla]; if (li) li.scrollIntoView({ block: 'nearest' });
}
// pieza seleccionada: costilla o larguero (retícula)
const nPiezas = () => R.n + (R.otras ? R.otras.length : 0);
const piezaSel = () => R ? (UI.costilla < R.n ? R.costillas[UI.costilla] : R.otras[UI.costilla - R.n]) : null;
function encuadrarCostilla() { const c = piezaSel(); if (c && c.ok) VC.encuadrar(c.caja, 40); else VC.pintar(); }
function refrescarCostilla() {
  const c = piezaSel(); if (!c) return;
  $('#tipoPieza').textContent = esPlano() ? 'Pieza' : c.disco ? 'Disco' : c.z ? 'Larguero' : P.tipo === 'pared' ? 'Lama' : 'Costilla';
  $('#numCost').textContent = c.etq;
  $('#infoCost').textContent = esPlano() ? `${c.nombre} · ${PLANOS[c.plano].nombre.toLowerCase()} en ${PLANOS[c.plano].normal} = ${fmt(c.x)} mm · ${fmt(c.caja.w)} × ${fmt(c.caja.h)} mm · ${textoUnionesPieza(c)}` : c.disco ? `a ${fmt(c.v)} mm de altura · Ø ${fmt(2 * c.rD)} mm · ${R.n} ranuras`
    : c.z ? `z = ${fmt(c.u)} mm · ${fmt(c.caja.w)} × ${fmt(c.caja.h)} mm · ${c.ranuras.length} ranuras`
    : `de ${R.n} · ${P.tipo === 'radial' ? 'ángulo' : 'x'} = ${textoPos(c.x)} · ${fmt(c.caja.w)} × ${fmt(c.caja.h)} mm` + (c.ranuras.length ? ` · ${c.ranuras.length} ${P.tipo === 'reticula' ? 'ranuras' : 'muescas'}` : '');
  $$('#listaCost li').forEach((li, i) => li.classList.toggle('sel', i === UI.costilla));
  if (esPlano()) refrescarPiezaSel();
}

/* ===================== HUECOS: VISTA PARA DIBUJARLOS Y PANEL =====================
   La vista «▦ Huecos» ocupa el sitio del editor de perfil:
   - panel de pared: el frente del panel (lamas, rastreles, huecos y muebles);
   - costillas y retícula: el perfil, con las costillas en claro (los huecos son túneles).
   Arrastrar dentro de un hueco lo mueve; las asas lo estiran; en la forma libre se mueven los vértices
   (doble clic en un lado añade uno, clic derecho en un vértice lo quita). Mayús: sin rejilla. */
let VH = null;
const HU = { arr: null };
const NOMBRE_FORMA = { rect: 'Rectángulo', redondeado: 'Redondeado', arco: 'Arco', circulo: 'Círculo', libre: 'Forma libre', texto: 'Texto' };
const NOMBRE_MODO = { pasante: 'pasante', rebaje: 'rebaje', saliente: 'sale hacia fuera', hundido: 'hundido' };
const huecoSel = () => (P.huecos || [])[UI.hueco] || null;
const snapH = (v, ev) => ev && ev.shiftKey ? Math.round(v * 10) / 10 : Math.round(v / 10) * 10;

function dibujarHuecos(ctx, V) {
  V.rejilla(ctx);
  if (!R) return;
  const e = grosor(), acento = cssVar('--acento'), fr = P.tipo === 'pared';
  if (fr) {
    const hor = lamasH(), Pa = P.pared;
    // rastreles (detrás)
    ctx.fillStyle = 'rgba(160,120,70,.35)';
    R.rastreles.forEach(r => (r.tramos || []).forEach(([a, b]) => {
      const rc = hor ? [r.v - Pa.alto / 2, a, Pa.alto, b - a] : [a, r.v - Pa.alto / 2, b - a, Pa.alto];
      const [x0, y0] = V.aPantalla(rc[0], rc[1] + rc[3]); ctx.fillRect(x0, y0, rc[2] * V.sc, rc[3] * V.sc);
    }));
    // lamas vistas de frente (cada trozo)
    ctx.fillStyle = colorCostilla(.55); ctx.strokeStyle = colorCostilla(.9); ctx.lineWidth = 1;
    [...R.costillas.filter(c => c.ok), ...(R.trozos || []).filter(t => t.ok)].forEach(q => {
      const rc = hor ? [q.caja.y0, q.x - e / 2, q.caja.y1 - q.caja.y0, e] : [q.x - e / 2, q.caja.y0, e, q.caja.y1 - q.caja.y0];
      const [x0, y0] = V.aPantalla(rc[0], rc[1] + rc[3]); ctx.fillRect(x0, y0, Math.max(1, rc[2] * V.sc), rc[3] * V.sc);
    });
    // módulos: raya discontinua entre uno y otro
    if ((R.modulosPared || []).length > 1) {
      let v0 = Infinity, v1 = -Infinity; [...R.costillas.filter(c => c.ok), ...(R.trozos || []).filter(t => t.ok)].forEach(c => { v0 = Math.min(v0, c.caja.y0); v1 = Math.max(v1, c.caja.y1); });
      ctx.save(); ctx.strokeStyle = 'rgba(40,90,160,.85)'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]); ctx.fillStyle = 'rgba(40,90,160,.95)'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center';
      R.modulosPared.forEach((m, j) => {
        if (j < R.modulosPared.length - 1) { const c = m.corte != null ? m.corte : m.x1, [a, b] = hor ? [V.aPantalla(v0 - 40, c), V.aPantalla(v1 + 40, c)] : [V.aPantalla(c, v0 - 40), V.aPantalla(c, v1 + 40)]; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke(); }
        const [tx, ty] = hor ? V.aPantalla(v0 - 70, (m.x0 + m.x1) / 2) : V.aPantalla((m.x0 + m.x1) / 2, v0 - 70); ctx.fillText('M' + (j + 1) + ' · ' + fmt(m.ancho), tx, ty + 4);
      });
      ctx.restore();
    }
    // muebles de los huecos (su frente)
    (R.modulos || []).forEach(m => {
      const [x0, x1, , , v0, v1] = m.caja3, rc = hor ? [v0, x0, v1 - v0, x1 - x0] : [x0, v0, x1 - x0, v1 - v0];
      const [a, b] = V.aPantalla(rc[0], rc[1] + rc[3]); ctx.fillStyle = 'rgba(120,130,140,.28)'; ctx.fillRect(a, b, rc[2] * V.sc, rc[3] * V.sc);
      ctx.strokeStyle = 'rgba(80,90,100,.7)'; ctx.strokeRect(a, b, rc[2] * V.sc, rc[3] * V.sc);
    });
  } else {
    // perfil: todas las costillas en claro
    ctx.strokeStyle = cssVar('--ejes'); ctx.lineWidth = 1;
    R.costillas.forEach(c => { if (c.ok) { V.camino(ctx, c.poly); ctx.stroke(); } });
    const cs = piezaSel(); if (cs && cs.ok && !cs.z && !cs.modulo) { ctx.fillStyle = conAlfa(acento, .1); ctx.beginPath(); [cs.poly, ...(cs.int || [])].forEach(pol => { pol.forEach((p, i) => { const [x, y] = V.aPantalla(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); }); ctx.fill('evenodd'); }
  }
  // los huecos
  (P.huecos || []).forEach((h, k) => {
    const sel = k === UI.hueco, act = h.activo !== false, f = formaHueco(h);
    ctx.save();
    ctx.strokeStyle = act ? (sel ? acento : '#d0453a') : cssVar('--suave'); ctx.lineWidth = sel ? 2.4 : 1.6; if (!act) ctx.setLineDash([5, 4]);
    ctx.fillStyle = act ? (sel ? conAlfa(acento, .12) : 'rgba(208,69,58,.10)') : 'transparent';
    if (h.forma === 'texto') {
      // las letras (con sus agujeros) y la caja en discontinua
      ctx.beginPath(); formasTexto(h).forEach(L => { L.forEach((p, i) => { const [x, y] = V.aPantalla(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); });
      ctx.fill('nonzero'); ctx.lineWidth = sel ? 1.6 : 1.2; ctx.stroke();
      ctx.setLineDash([4, 4]); ctx.lineWidth = 1; V.camino(ctx, f); ctx.stroke(); ctx.restore();
      const [lx, ly] = V.aPantalla(...(giraHueco(h) ? rotarPunto([h.x, h.y + h.alto], centroHueco(h), giraHueco(h)) : [h.x, h.y + h.alto]));
      ctx.fillStyle = act ? (sel ? acento : '#d0453a') : cssVar('--suave'); ctx.font = 'bold 12px system-ui'; ctx.textBaseline = 'bottom';
      ctx.fillText('H' + (k + 1) + (h.modo === 'saliente' ? ' ↑' : h.modo === 'hundido' ? ' ↓' : ''), lx + 2, ly - 3); ctx.textBaseline = 'alphabetic';
    } else { V.camino(ctx, f); ctx.fill(); ctx.stroke(); ctx.restore(); }
    const cb = cajaDe(f), [lx, ly] = V.aPantalla(cb.x0 + cb.w / 2, cb.y0 + cb.h / 2);
    if (h.forma !== 'texto') {
    ctx.fillStyle = act ? (sel ? acento : '#d0453a') : cssVar('--suave'); ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('H' + (k + 1), lx, ly); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    }
    if (sel) {
      // asas
      asasHueco(h).forEach(a => {
        const [x, y] = V.aPantalla(a.x, a.y); ctx.fillStyle = cssVar('--vista'); ctx.strokeStyle = acento; ctx.lineWidth = 1.6;
        if (a.rot) { const [cx, cy] = V.aPantalla(...centroHueco(h)); ctx.save(); ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y); ctx.stroke(); ctx.restore(); ctx.beginPath(); ctx.arc(x, y, 7, 0, PI2); ctx.fill(); ctx.stroke(); ctx.fillStyle = acento; ctx.font = '11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('↻', x, y + 0.5); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; if (h.giro) ctx.fillText(fmt(h.giro) + '°', x + 10, y - 8); return; }
        ctx.beginPath(); a.vert ? ctx.arc(x, y, 5, 0, PI2) : ctx.rect(x - 4.5, y - 4.5, 9, 9); ctx.fill(); ctx.stroke();
      });
      if (giraHueco(h)) { ctx.fillStyle = acento; ctx.font = '600 11.5px system-ui'; ctx.textAlign = 'center'; ctx.fillText(`${fmt(h.ancho)} × ${fmt(h.alto)} mm · ${fmt(h.giro)}°`, lx, ly + 16); ctx.textAlign = 'left'; }
      else {
        V.cota(ctx, [cb.x0, cb.y0], [cb.x0 + cb.w, cb.y0], 18, fmt(cb.w) + ' mm', false);
        V.cota(ctx, [cb.x0 + cb.w, cb.y0], [cb.x0 + cb.w, cb.y0 + cb.h], 20, fmt(cb.h) + ' mm', true);
      }
    }
  });
  ctx.fillStyle = acento; ctx.font = '600 12px system-ui';
  ctx.fillText(fr ? 'Huecos · frente del panel' : 'Huecos · perfil (cada hueco es un túnel de «desde» a «hasta»)', 8, V.h - 26);
}
function asasHueco(h) {
  const g = giraHueco(h), c = centroHueco(h), R2 = p => g ? rotarPunto(p, c, g) : p;
  // asa de girar: encima del hueco (no en los huecos con mueble, que no giran)
  const rot = h.modo === 'mueble' ? [] : [(() => { const q = R2([h.x + h.ancho / 2, h.y + h.alto + Math.max(25, 22 / ((VH && VH.sc) || 1))]); return { x: q[0], y: q[1], t: 'rot', rot: true }; })()];
  if (h.forma === 'libre' && h.pts) return h.pts.map((p, i) => ({ x: p[0], y: p[1], vert: true, i })).concat(rot);
  const x0 = h.x, y0 = h.y, x1 = h.x + h.ancho, y1 = h.y + h.alto, xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
  return [[x0, y0, 'sw'], [xm, y0, 's'], [x1, y0, 'se'], [x1, ym, 'e'], [x1, y1, 'ne'], [xm, y1, 'n'], [x0, y1, 'nw'], [x0, ym, 'w']].map(([x, y, t]) => { const q = R2([x, y]); return { x: q[0], y: q[1], t }; }).concat(rot);
}
function encuadrarHuecos() {
  if (!VH || !R) return;
  let b;
  if (P.tipo === 'pared') { const [W, H] = medidasPanel(); b = { x0: 0, y0: 0, w: W, h: H }; }
  else { const cs = R.costillas.filter(c => c.ok); if (!cs.length) return; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; cs.forEach(c => { x0 = Math.min(x0, c.caja.x0); y0 = Math.min(y0, c.caja.y0); x1 = Math.max(x1, c.caja.x1); y1 = Math.max(y1, c.caja.y1); }); b = { x0, y0, w: x1 - x0, h: y1 - y0 }; }
  (P.huecos || []).forEach(h => { const c = cajaHueco(h); const x0 = Math.min(b.x0, c.x0), y0 = Math.min(b.y0, c.y0), x1 = Math.max(b.x0 + b.w, c.x0 + c.w), y1 = Math.max(b.y0 + b.h, c.y0 + c.h); b = { x0, y0, w: x1 - x0, h: y1 - y0 }; });
  VH.encuadrar(b, 50);
}
function verHuecos(si) {
  UI.vistaHuecos = !!si && ['pared', 'costillas', 'reticula'].includes(P.tipo);
  $('#cPerfil').classList.toggle('oculto', UI.vistaHuecos); $('#cHuecos').classList.toggle('oculto', !UI.vistaHuecos);
  $('#bVistaHuecos').classList.toggle('activo', UI.vistaHuecos);
  ['#sClave', '#infoClave', '#bEsquina'].forEach(s => $(s).classList.toggle('oculto2', UI.vistaHuecos));
  $('#piePerfil').innerHTML = ayudaPerfil();
  if (UI.vistaHuecos) { VH.ajustar(); encuadrarHuecos(); } else VP.ajustar();
}

function iniciarHuecos() {
  VH = new Vista2D($('#cHuecos'), dibujarHuecos);
  const enlazar = (sel, fn, ev = 'change') => $(sel).addEventListener(ev, fn);
  const c = $('#cHuecos');
  c.addEventListener('contextmenu', ev => ev.preventDefault());
  const cerca = (mx, my) => { const h = huecoSel(); if (!h) return null; return asasHueco(h).find(a => { const [x, y] = VH.aPantalla(a.x, a.y); return Math.hypot(x - mx, y - my) < 9; }) || null; };
  const dentroDe = (u, v) => { for (let k = (P.huecos || []).length - 1; k >= 0; k--) if (dentro(formaHueco(P.huecos[k]), u, v)) return k; return -1; };
  c.addEventListener('pointerdown', ev => {
    const r = c.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top, [u, v] = VH.aMundo(mx, my);
    c.setPointerCapture(ev.pointerId);
    if (ev.button === 1) { HU.arr = { tipo: 'pan', x: mx, y: my, ox: VH.ox, oy: VH.oy }; return; }
    const a = cerca(mx, my), h = huecoSel();
    if (ev.button === 2) { if (a && a.vert && h.pts.length > 3) { h.pts.splice(a.i, 1); cambio('Vértice quitado'); } return; }
    if (a) { HU.arr = { tipo: a.rot ? 'rot' : a.vert ? 'vert' : 'asa', a, x0: u, y0: v, orig: JSON.parse(JSON.stringify(h)), movido: false }; return; }
    const k = dentroDe(u, v);
    if (k >= 0) { UI.hueco = k; refrescarHuecos(); HU.arr = { tipo: 'mover', x0: u, y0: v, orig: JSON.parse(JSON.stringify(P.huecos[k])), movido: false }; VH.pintar(); return; }
    HU.arr = { tipo: 'pan', x: mx, y: my, ox: VH.ox, oy: VH.oy };
  });
  c.addEventListener('pointermove', ev => {
    const r = c.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top, [u, v] = VH.aMundo(mx, my);
    $('#piePerfil').innerHTML = `<span>${P.tipo === 'pared' ? 'X' : 'u'} ${fmt(u)} · ${P.tipo === 'pared' ? 'Y' : 'v'} ${fmt(v)} mm</span>` + ayudaPerfil();
    const A = HU.arr; if (!A) { c.style.cursor = cerca(mx, my) ? 'pointer' : 'default'; return; }
    if (A.tipo === 'pan') { VH.ox = A.ox + mx - A.x; VH.oy = A.oy + my - A.y; VH.pintar(); return; }
    const h = huecoSel(), O = A.orig, du = u - A.x0, dv = v - A.y0; if (!h) return;
    if (Math.abs(du) + Math.abs(dv) > 0.5) A.movido = true;
    if (A.tipo === 'mover') {
      h.x = snapH(O.x + du, ev); h.y = snapH(O.y + dv, ev);
      if (O.pts) { const dx = h.x - O.x, dy = h.y - O.y; h.pts = O.pts.map(p => [p[0] + dx, p[1] + dy]); }
    } else if (A.tipo === 'rot') {
      const C = centroHueco(O), ang = Math.atan2(v - C[1], u - C[0]) * 180 / Math.PI - 90;
      let g = ev.shiftKey ? Math.round(ang) : Math.round(ang / 15) * 15; g = ((g % 360) + 540) % 360 - 180;
      if (h.forma === 'libre' && O.pts) { h.pts = O.pts.map(p => rotarPunto(p, C, g - (O.giro || 0))); const cb = cajaDe(h.pts); h.x = cb.x0; h.y = cb.y0; h.ancho = cb.w; h.alto = cb.h; }
      h.giro = g;
    } else if (A.tipo === 'vert') {
      h.pts[A.a.i] = [snapH(O.pts[A.a.i][0] + du, ev), snapH(O.pts[A.a.i][1] + dv, ev)];
      const cb = cajaDe(h.pts); h.x = cb.x0; h.y = cb.y0; h.ancho = cb.w; h.alto = cb.h;
    } else {
      const t = A.a.t, g = giraHueco(O), [lu, lv] = g ? rotarPunto([du, dv], [0, 0], -g) : [du, dv];
      let x0 = O.x, y0 = O.y, x1 = O.x + O.ancho, y1 = O.y + O.alto;
      const sn = q => g ? Math.round(q * 10) / 10 : snapH(q, ev);
      if (t.includes('w')) x0 = Math.min(x1 - 10, sn(O.x + lu)); if (t.includes('e')) x1 = Math.max(x0 + 10, sn(O.x + O.ancho + lu));
      if (t.includes('s')) y0 = Math.min(y1 - 10, sn(O.y + lv)); if (t.includes('n')) y1 = Math.max(y0 + 10, sn(O.y + O.alto + lv));
      const w = x1 - x0, hh = x1 > x0 ? y1 - y0 : 10;
      if (g) { const C = centroHueco(O), cN = rotarPunto([(x0 + x1) / 2, (y0 + y1) / 2], C, g); h.x = cN[0] - w / 2; h.y = cN[1] - hh / 2; }
      else { h.x = x0; h.y = y0; }
      h.ancho = w; h.alto = hh;
      if (h.forma === 'texto') {   // las letras no se deforman: la caja guarda su proporción (sin mover su centro)
        const m = medidaTexto(h), q = m.w / m.h, c = centroHueco(h);
        if (t === 'e' || t === 'w') h.alto = Math.max(10, h.ancho / q); else h.ancho = Math.max(10, h.alto * q);
        h.x = c[0] - h.ancho / 2; h.y = c[1] - h.alto / 2;
      }
    }
    ponerCamposHueco(); VH.pintar();
  });
  const fin = () => { const A = HU.arr; HU.arr = null; if (A && A.movido && A.tipo !== 'pan') cambio(A.tipo === 'mover' ? 'Hueco movido' : 'Hueco cambiado de tamaño'); };
  c.addEventListener('pointerup', fin); c.addEventListener('pointercancel', fin);
  c.addEventListener('dblclick', ev => {
    const h = huecoSel(); if (!h || h.forma !== 'libre') return;
    const r = c.getBoundingClientRect(), [u, v] = VH.aMundo(ev.clientX - r.left, ev.clientY - r.top);
    let mej = -1, md = Infinity; h.pts.forEach((p, i) => { const q = h.pts[(i + 1) % h.pts.length], d = distSeg(u, v, p, q); if (d < md) { md = d; mej = i; } });
    if (md * VH.sc < 12) { h.pts.splice(mej + 1, 0, [snapH(u, ev), snapH(v, ev)]); cambio('Vértice añadido'); }
  });
  // panel
  $('#bVistaHuecos').onclick = () => verHuecos(!UI.vistaHuecos);
  $$('[data-hnuevo]').forEach(b => b.onclick = () => {
    if (!window.ClipperLib) { aviso('⚠ Falta assets/js/clipper.js'); return; }
    P.huecos = P.huecos || []; const h = huecoNuevo(b.dataset.hnuevo);
    if (P.tipo !== 'pared') h.modo = 'pasante';
    if (h.forma === 'texto') llenarLetras();
    P.huecos.push(h); UI.hueco = P.huecos.length - 1; cambio('Hueco ' + P.huecos.length + ': ' + NOMBRE_FORMA[h.forma].toLowerCase());
    if (!UI.vistaHuecos) verHuecos(true); else encuadrarHuecos();
  });
  $('#bHuecoQuitar').onclick = () => borrarHueco(UI.hueco);
  $('#bHuecoDXF').onclick = dialogoHuecoDXF;
  $('#bHuecoCopia').onclick = () => { const h = huecoSel(); if (!h) return; const c2 = JSON.parse(JSON.stringify(h)); c2.id = 'h' + Date.now().toString(36); c2.x += 50; c2.y += 50; if (c2.pts) c2.pts = c2.pts.map(p => [p[0] + 50, p[1] + 50]); P.huecos.push(c2); UI.hueco = P.huecos.length - 1; cambio('Hueco duplicado'); };
  const campo = (sel, fn) => enlazar(sel, () => { const h = huecoSel(); if (!h) return; fn(h, $(sel)); cambio(); });
  campo('#hcForma', (h, el) => { const v = el.value; if (v === 'libre' && !h.pts) h.pts = formaHueco(h).filter((_, i, a) => a.length <= 8 || i % Math.ceil(a.length / 8) === 0); h.forma = v; });
  [['#hcX', 'x'], ['#hcY', 'y'], ['#hcAncho', 'ancho'], ['#hcAlto', 'alto'], ['#hcRadio', 'radio'], ['#hcProf', 'prof'], ['#hcHolgura', 'holgura'], ['#hcDesde', 'desde'], ['#hcHasta', 'hasta']].forEach(([s, k]) => campo(s, (h, el) => {
    const v = +el.value || 0;
    if (h.forma === 'libre' && h.pts && ['x', 'y', 'ancho', 'alto'].includes(k)) {   // la forma libre se mueve o se escala entera
      const cb = cajaDe(h.pts), nx = k === 'x' ? v : cb.x0, ny = k === 'y' ? v : cb.y0, sw = k === 'ancho' ? Math.max(10, v) / cb.w : 1, sh = k === 'alto' ? Math.max(10, v) / cb.h : 1;
      h.pts = h.pts.map(p => [nx + (p[0] - cb.x0) * sw, ny + (p[1] - cb.y0) * sh]); const c2 = cajaDe(h.pts); h.x = c2.x0; h.y = c2.y0; h.ancho = c2.w; h.alto = c2.h; return;
    }
    if (['ancho', 'alto'].includes(k) && h.forma === 'texto') {   // el texto guarda su proporción
      const m = medidaTexto(h), q = m.w / m.h, c = centroHueco(h);
      if (k === 'ancho') { h.ancho = Math.max(10, v); h.alto = Math.max(10, h.ancho / q); } else { h.alto = Math.max(10, v); h.ancho = Math.max(10, h.alto * q); }
      h.x = c[0] - h.ancho / 2; h.y = c[1] - h.alto / 2; return;
    }
    if (['ancho', 'alto'].includes(k) && giraHueco(h)) { const c = centroHueco(h); h[k] = Math.max(10, v); h.x = c[0] - h.ancho / 2; h.y = c[1] - h.alto / 2; return; }
    h[k] = ['ancho', 'alto'].includes(k) ? Math.max(10, v) : v;
  }));
  campo('#hcModo', (h, el) => { h.modo = el.value; if (h.relieve == null) h.relieve = 20; });
  campo('#hcRelieve', (h, el) => { h.relieve = clamp(+el.value || 0, 1, 500); });
  campo('#hcTexto', (h, el) => { h.texto = el.value; ajustarCajaTexto(h); });
  campo('#hcLetra', (h, el) => { h.letra = el.value; ajustarCajaTexto(h); });
  campo('#hcNegrita', (h, el) => { h.negrita = el.checked; ajustarCajaTexto(h); });
  campo('#hcGiro', (h, el) => { const g = ((Math.round(+el.value || 0) % 360) + 540) % 360 - 180; if (h.forma === 'libre' && h.pts) { const C = centroHueco(h); h.pts = h.pts.map(p => rotarPunto(p, C, g - (h.giro || 0))); const cb = cajaDe(h.pts); h.x = cb.x0; h.y = cb.y0; h.ancho = cb.w; h.alto = cb.h; } h.giro = g; });
  campo('#hcActivo', (h, el) => { h.activo = el.checked; });
  campo('#hcMueble', (h, el) => { h.mueble.tipo = el.value; });
  campo('#hcFondo', (h, el) => { h.mueble.fondo = Math.max(0, +el.value || 0); });
  campo('#hcTrasera', (h, el) => { h.mueble.trasera = el.checked; });
  campo('#hcGrosorM', (h, el) => { h.mueble.grosor = clamp(+el.value || 0, 0, 100); });
  campo('#hcPuerta', (h, el) => { h.mueble.puerta = el.value; });
  campo('#hcHolPuerta', (h, el) => { h.mueble.holguraPuerta = Math.max(0, +el.value || 0); });
}
function ponerCamposHueco() {
  const h = huecoSel(), fr = P.tipo === 'pared';
  $('#hcCampos').classList.toggle('oculto', !h); if (!h) return;
  $('#hcTit').textContent = 'H' + (UI.hueco + 1) + ' · ' + NOMBRE_FORMA[h.forma];
  $('#hcActivo').checked = h.activo !== false; const tx = h.forma === 'texto';
  $('#filaHcForma').classList.toggle('oculto', tx); if (!tx) $('#hcForma').value = h.forma;
  $('#hcTextoCampos').classList.toggle('oculto', !tx);
  if (tx) { if (document.activeElement !== $('#hcTexto')) $('#hcTexto').value = h.texto || ''; if (![...$('#hcLetra').options].some(o => o.value === h.letra)) llenarLetras(); $('#hcLetra').value = h.letra; $('#hcNegrita').checked = !!h.negrita; }
  $('#hcX').value = Math.round(h.x * 10) / 10; $('#hcY').value = Math.round(h.y * 10) / 10; $('#hcAncho').value = Math.round(h.ancho * 10) / 10; $('#hcAlto').value = Math.round(h.alto * 10) / 10;
  $('#hcGiro').value = h.giro || 0; $('#filaHcGiro').classList.toggle('oculto', h.modo === 'mueble');
  $('#hcRadio').value = h.radio; $('#filaHcRadio').classList.toggle('oculto', h.forma !== 'redondeado');
  [...$('#hcModo').options].forEach(o => { o.hidden = (!fr && ['rebaje', 'saliente', 'hundido'].includes(o.value)) || (tx && o.value === 'mueble'); });
  if (!fr && ['rebaje', 'saliente', 'hundido'].includes(h.modo)) h.modo = 'pasante';
  if (tx && h.modo === 'mueble') h.modo = 'saliente';
  $('#hcModo').value = h.modo; $('#hcProf').value = h.prof; $('#filaHcProf').classList.toggle('oculto', h.modo !== 'rebaje');
  $('#hcRelieve').value = h.relieve != null ? h.relieve : 20; $('#filaHcRelieve').classList.toggle('oculto', !['saliente', 'hundido'].includes(h.modo));
  $('#hcHolgura').value = h.holgura; $('#filaHcHolgura').classList.toggle('oculto', h.modo !== 'mueble');
  $('#filaHcDesde').classList.toggle('oculto', fr); $('#hcDesde').value = h.desde; $('#hcHasta').value = h.hasta;
  $('#hcMuebleCampos').classList.toggle('oculto', h.modo !== 'mueble');
  [...$('#hcMueble').options].forEach(o => { o.hidden = !fr && o.value === 'armario'; });
  if (!fr && h.mueble.tipo === 'armario') h.mueble.tipo = 'caja';
  $('#hcMueble').value = h.mueble.tipo; $('#hcFondo').value = h.mueble.fondo; $('#filaHcFondo').classList.toggle('oculto', !fr);
  $('#hcGrosorM').value = h.mueble.grosor || '';
  $('#hcTrasera').checked = !!h.mueble.trasera; $('#filaHcTrasera').classList.toggle('oculto', !fr || h.mueble.tipo === 'balda');
  $('#filaHcPuerta').classList.toggle('oculto', h.mueble.tipo !== 'armario'); $('#hcPuerta').value = h.mueble.puerta; $('#hcHolPuerta').value = h.mueble.holguraPuerta;
  $('#hcXTit').textContent = fr ? 'X desde la izquierda (mm)' : 'u: fondo (mm)'; $('#hcYTit').textContent = fr ? 'Y desde abajo (mm)' : 'v: altura (mm)';
}
function borrarHueco(k) {
  if (k == null || k < 0 || !P.huecos[k]) return;
  P.huecos.splice(k, 1); UI.hueco = Math.min(k, P.huecos.length - 1); cambio('Hueco H' + (k + 1) + ' borrado');
}
function refrescarHuecos() {
  const ok = ['pared', 'costillas', 'reticula'].includes(P.tipo);
  $('#secHuecos').classList.toggle('oculto', !ok); $('#bVistaHuecos').classList.toggle('oculto', !ok); $('#bHuecoTexto').classList.toggle('oculto', P.tipo !== 'pared');
  if (!ok && UI.vistaHuecos) verHuecos(false);
  P.huecos = P.huecos || [];
  if (UI.hueco == null || UI.hueco >= P.huecos.length) UI.hueco = P.huecos.length - 1;
  $('#nHuecos').textContent = P.huecos.length;
  const ul = $('#listaHuecos'); ul.innerHTML = '';
  P.huecos.forEach((h, k) => {
    const li = document.createElement('li'); li.className = k === UI.hueco ? 'sel' : '';
    const modo = h.modo === 'mueble' ? { balda: 'con balda', caja: 'con caja', armario: 'con armario' }[h.mueble.tipo] : (NOMBRE_MODO[h.modo] || h.modo) + (['saliente', 'hundido'].includes(h.modo) ? ' ' + fmt(h.relieve || 0) + ' mm' : '');
    li.innerHTML = `<span><b>H${k + 1}</b> ${h.forma === 'texto' ? '«' + esc(String(h.texto || '').replace(/\n/g, ' ').slice(0, 18)) + '»' : NOMBRE_FORMA[h.forma]} · ${fmt(h.ancho)} × ${fmt(h.alto)}${giraHueco(h) ? ' · ' + fmt(h.giro) + '°' : ''} · ${modo}${h.activo === false ? ' <i>(apagado)</i>' : ''}</span><button class="quitarHueco" title="Borrar este hueco">🗑</button>`;
    li.onclick = () => { UI.hueco = k; refrescarHuecos(); if (VH) VH.pintar(); };
    li.querySelector('.quitarHueco').onclick = ev => { ev.stopPropagation(); borrarHueco(k); };
    ul.appendChild(li);
  });
  ponerCamposHueco();
  if (VH && UI.vistaHuecos) VH.pintar();
}

/* ===================== VISTA 3D ===================== */
const G = { renderer: null, scene: null, cam: null, ctl: null, modelo: null, fantasma: null, costillas: [], largueros: [], claves3d: [], varillas: [], separadores: [], tuercas: [], suelo: null, rejilla: null, luz: null, pend: false, cacheTex: {}, cacheMat: {} };

function textura(clave, mm) {
  const ck = clave + ':' + mm; if (G.cacheTex[ck]) return G.cacheTex[ck];
  const tx = new T.TextureLoader().load(window.TEXTURAS[clave], () => pedirRender());
  tx.colorSpace = T.SRGBColorSpace; tx.wrapS = tx.wrapT = T.RepeatWrapping;
  tx.repeat.set(1 / mm, 1 / mm); tx.anisotropy = 8;
  return G.cacheTex[ck] = tx;
}
function texturaSrc(src, ck, mm, datos) { // datos: relieve o rugosidad, sin espacio de color
  if (G.cacheTex[ck]) return G.cacheTex[ck];
  const tx = new T.TextureLoader().load(src, () => pedirRender());
  if (!datos) tx.colorSpace = T.SRGBColorSpace;
  tx.wrapS = tx.wrapT = T.RepeatWrapping; tx.repeat.set(1 / mm, 1 / mm); tx.anisotropy = 8;
  return G.cacheTex[ck] = tx;
}
function materialesTablero() {
  const id = P.costillas.material, m = MATERIALES[id] || MATERIALES.abedul;
  const ck = id + (m.color ? P.costillas.color : ''); if (G.cacheMat[ck]) return G.cacheMat[ck];
  let cara, canto;
  if (m.color) {
    cara = new T.MeshStandardMaterial({ color: P.costillas.color, roughness: .5 });
    canto = cara;
  } else {
    const B = (window.TEXTURAS_PBR || {})[m.cara];
    const mmCara = B ? B.cm * 10 : (m.mm || 800), mmCanto = m.canto === 'alma_contrachapado' ? 48 : (m.mm || 800);
    cara = B
      ? new T.MeshStandardMaterial({ map: texturaSrc(B.color, m.cara + ':c', mmCara), normalMap: texturaSrc(B.normal, m.cara + ':n', mmCara, true), roughnessMap: texturaSrc(B.rough, m.cara + ':r', mmCara, true), roughness: 1.05 })
      : new T.MeshStandardMaterial({ map: textura(m.cara, mmCara), roughness: .62 });
    canto = new T.MeshStandardMaterial({ map: textura(m.canto, mmCanto), roughness: .8 });
  }
  return G.cacheMat[ck] = [cara, canto];
}
function materialSel(base) {
  return base.map(m => { const c = m.clone(); c.userData = { propio: true }; c.emissive = new T.Color('#2f7fe0'); c.emissiveIntensity = .35; return c; });
}

function iniciar3D() {
  const cv = $('#c3d');
  const r = G.renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
  r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.0; r.outputColorSpace = T.SRGBColorSpace;
  const s = G.scene = new T.Scene();
  const pm = new T.PMREMGenerator(r);
  s.environment = pm.fromScene(new T.RoomEnvironment(), 0.04).texture;
  s.environmentIntensity = 0.55;
  G.cam = new T.PerspectiveCamera(35, 1, 5, 60000);
  G.cam.position.set(1800, 1300, 2200);
  G.ctl = new T.OrbitControls(G.cam, cv);
  G.ctl.enableDamping = false; G.ctl.screenSpacePanning = true;
  G.ctl.addEventListener('change', pedirRender);
  const hemi = G.hemi = new T.HemisphereLight(0xffffff, 0xd8cfc0, 0.6); s.add(hemi);
  const luz = G.luz = new T.DirectionalLight(0xffffff, 2.0);
  luz.castShadow = true; luz.shadow.mapSize.set(2048, 2048); luz.shadow.bias = -0.0004; luz.shadow.normalBias = 1.2; luz.shadow.radius = 4;
  s.add(luz); s.add(luz.target);
  G.suelo = new T.Mesh(new T.PlaneGeometry(1, 1), new T.ShadowMaterial({ opacity: .22 }));
  G.suelo.rotation.x = -Math.PI / 2; G.suelo.receiveShadow = true; s.add(G.suelo);
  G.modelo = new T.Group(); s.add(G.modelo);
  new ResizeObserver(() => ajustar3D()).observe(cv.parentElement);
  // selección con clic
  let abajo = null;
  cv.addEventListener('pointerdown', ev => { abajo = [ev.clientX, ev.clientY]; });
  cv.addEventListener('pointerup', ev => {
    if (!abajo || Math.hypot(ev.clientX - abajo[0], ev.clientY - abajo[1]) > 4 || ev.button !== 0) return;
    const rc = cv.getBoundingClientRect(), ray = new T.Raycaster();
    ray.setFromCamera(new T.Vector2((ev.clientX - rc.left) / rc.width * 2 - 1, -(ev.clientY - rc.top) / rc.height * 2 + 1), G.cam);
    ray.params.Line.threshold = Math.max(4, Math.max(...(G.dims || [500])) * 0.006);
    const hk = (G.claves3d || []).length ? ray.intersectObjects(G.claves3d, false)[0] : null;
    if (hk) { UI.clave = hk.object.userData.clave; UI.punto = -1; refrescarClaves(); VP.pintar(); construirClaves3D(); costillaDeClave(); $('#estado').textContent = 'Perfil clave ' + (UI.clave + 1); return; }
    const hit = ray.intersectObjects([...G.costillas, ...G.largueros].filter(Boolean), false)[0];
    if (hit) selCostilla(hit.object.userData.i);
  });
  $$('[data-cam]').forEach(b => b.onclick = () => camara(b.dataset.cam));
  colores3D();
}
function colores3D() {
  if (!G.scene) return;
  const oscuro = document.documentElement.dataset.theme === 'dark';
  G.scene.background = new T.Color(oscuro ? '#1b2027' : '#eeece8');
  if (G.rejilla) { G.scene.remove(G.rejilla); G.rejilla.geometry.dispose(); G.rejilla = null; }
  const tam = Math.ceil(Math.max(P ? P.largo : 2000, 1500) * 2.4 / 1000) * 1000;
  G.rejilla = new T.GridHelper(tam, tam / 100, oscuro ? 0x3a434e : 0xcfcac2, oscuro ? 0x2a3139 : 0xe0dcd5);
  G.rejilla.position.y = -0.5; G.scene.add(G.rejilla);
  pedirRender();
}
function ajustar3D() {
  const cv = $('#c3d'), r = cv.parentElement.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return;
  G.renderer.setSize(r.width, r.height, false);
  G.cam.aspect = r.width / r.height; G.cam.updateProjectionMatrix(); pedirRender();
}
function pedirRender() {
  if (G.pend) return; G.pend = true;
  requestAnimationFrame(() => { G.pend = false; G.renderer.render(G.scene, G.cam); });
}
function limpiar(obj) {
  const vistos = new Set();
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    [].concat(o.material || [], (o.userData && o.userData.matSel) || []).forEach(m => { if (m.userData.propio && !vistos.has(m)) { vistos.add(m); m.dispose(); } });
  });
}

// desplazamiento por la vista explosionada (en recta, curva y pared, a lo largo; en radial, hacia fuera)
function xExpl(x) { const k = P.tipo === 'reticula' || P.tipo === 'radial' ? 0 : (P.vista.explosion || 0) * 1.4; return x + (x - P.largo / 2) * k; }
function marcoExpl(x) {
  const m = marcoEn(xExpl(x));
  if (P.tipo === 'radial') { const d = (P.vista.explosion || 0) * (G.rmax || 200) * 0.8; m.O = [m.O[0] + m.Au[0] * d, 0, m.O[2] + m.Au[2] * d]; }
  return m;
}
// coloca una malla extruida (forma en u, v; grosor centrado) con el marco m
function ponerEnMarco(obj, m, dy = 0) {
  const ae = ejeGrosor(m), M4 = new T.Matrix4();
  M4.makeBasis(new T.Vector3(...m.Au), new T.Vector3(...ejeV(m)), new T.Vector3(...ae)).setPosition(m.O[0], m.O[1] + dy, m.O[2]);
  obj.matrixAutoUpdate = false; obj.matrix.copy(M4); obj.matrixWorldNeedsUpdate = true;
}
const V3 = a => new T.Vector3(a[0], a[1], a[2]);
// cilindro de a a b (puntos 3D) con radio r
function cilindroEntre(a, b, r, mat, lados = 18) {
  const va = V3(a), vb = V3(b), d = vb.clone().sub(va), L = d.length();
  const m = new T.Mesh(new T.CylinderGeometry(r, r, Math.max(0.1, L), lados), mat);
  m.position.copy(va.clone().add(vb).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); m.castShadow = true;
  return m;
}
// quita los puntos repetidos y los que están en línea con sus vecinos: el triangulador de las tapas los
// descarta y las paredes no, y quedarían aristas sin coser (la malla no cerraría en STL, OBJ o SolidCraft)
function limpiarContorno(poly) {
  // a menos de 1 µm: un punto repetido, o uno que se sale de la recta de sus vecinos (astillas que deja el recorte)
  let q = poly.slice();
  for (let cambio = true; cambio && q.length > 3;) {
    cambio = false;
    for (let i = 0; i < q.length && q.length > 3; i++) {
      const a = q[(i - 1 + q.length) % q.length], b = q[i], c = q[(i + 1) % q.length];
      const ab = Math.hypot(b[0] - a[0], b[1] - a[1]), L = Math.hypot(c[0] - a[0], c[1] - a[1]);
      const cr = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      if (ab < 1e-3 || (L > 1e-9 ? Math.abs(cr) / L < 1e-3 : true)) { q.splice(i, 1); i--; cambio = true; }
    }
  }
  return q.length >= 3 ? q : poly;
}
function extruir(poly, huecos, e, interiores) {
  poly = limpiarContorno(poly);
  const sh = new T.Shape(poly.map(p => new T.Vector2(p[0], p[1])));
  (huecos || []).forEach(h => { const pa = new T.Path(); pa.absarc(h.x, h.y, h.r, 0, PI2, true); sh.holes.push(pa); });
  (interiores || []).forEach(hh => sh.holes.push(new T.Path(limpiarContorno(hh).map(p => new T.Vector2(p[0], p[1])))));
  const g = new T.ExtrudeGeometry(sh, { depth: e, bevelEnabled: false, curveSegments: 24 });
  g.translate(0, 0, -e / 2); return g;
}

function construir3D() {
  if (!G.scene || !R) return;
  limpiar(G.modelo); G.modelo.clear(); G.modelo.position.set(0, 0, 0);
  G.costillas = []; G.largueros = []; G.varillas = []; G.claves3d = [];
  if (P.tipo === 'plano') { construir3DPlano(); return; }
  const e = grosor(), mats = materialesTablero(), rh = radioAgujero(), V = P.varillas;
  // medidas del mueble montado
  const bb = new T.Box3(), cs = R.costillas.filter(c => c.ok);
  // con los trozos (lamas partidas o con huecos)
  [...cs, ...(R.trozos || []).filter(t => t.ok && !t.z)].forEach(c => { const m = marcoEn(c.x), paso = c.poly.length > 24 ? 3 : 1; for (let k = 0; k < c.poly.length; k += paso) bb.expandByPoint(V3(puntoMarco(m, c.poly[k][0], c.poly[k][1]))); });
  if (bb.isEmpty()) bb.set(new T.Vector3(-1, 0, -1), new T.Vector3(1, 1, 1));
  const sz = bb.getSize(new T.Vector3());
  G.dims = [sz.x, sz.z, sz.y]; G.alto = sz.y; G.fondo = sz.z; G.rmax = Math.max(sz.x, sz.z) / 2;
  // costillas
  R.costillas.forEach(c => {
    if (!c.ok) { G.costillas.push(null); return; }
    const hs = c.agujeros.map(k => ({ x: V.lista[k][0], y: V.lista[k][1], r: rh }));
    const m = new T.Mesh(extruir(polyVista(c.poly), hs, e, c.int), mats); m.castShadow = m.receiveShadow = true;
    m.userData = { i: c.i, x: c.x };
    G.modelo.add(m); G.costillas.push(m);
  });
  // retícula: largueros en el plano (x, v)
  R.largueros.forEach(z => {
    if (!z.ok) return;
    const m = new T.Mesh(extruir(polyVista(z.poly), [], e), mats); m.castShadow = m.receiveShadow = true;
    m.userData = { i: z.i, u: z.u, z: true };
    G.modelo.add(m); G.largueros.push(m);
  });
  // huecos: trozos de lamas, costillas o largueros, y los tableros de los muebles
  (R.trozos || []).forEach(t => {
    if (!t.ok) return;
    const hs = t.agujeros.map(k => ({ x: V.lista[k][0], y: V.lista[k][1], r: rh }));
    const m = new T.Mesh(extruir(polyVista(t.poly), hs, e, t.int), mats); m.castShadow = m.receiveShadow = true;
    m.userData = t.z ? { i: t.i, u: t.u, z: true } : { i: t.i, trozoX: t.x };
    G.modelo.add(m); G.largueros.push(m);
  });
  (R.modulos || []).forEach(t => {
    const [x0, x1, u0, u1, v0, v1] = t.caja3, m0 = marcoEn(x0), m1 = marcoEn(x1);
    const o = puntoMarco(m0, u0, v0), px = puntoMarco(m1, u0, v0), pu = puntoMarco(m0, u1, v0), pv = puntoMarco(m0, u0, v1);
    const g = new T.BoxGeometry(1, 1, 1); g.translate(.5, .5, .5);
    const ax = new T.Vector3(px[0] - o[0], px[1] - o[1], px[2] - o[2]), au = new T.Vector3(pu[0] - o[0], pu[1] - o[1], pu[2] - o[2]), av = new T.Vector3(pv[0] - o[0], pv[1] - o[1], pv[2] - o[2]);
    g.groups.forEach(gr => { gr.materialIndex = 0; });
    const m = new T.Mesh(g, mats); m.castShadow = m.receiveShadow = true;
    // el cubo unidad es el mismo con los ejes en otro orden: así la base no queda «del revés»
    m.matrixAutoUpdate = false; m.matrix.makeBasis(ax, au, av);
    if (m.matrix.determinant() < 0) m.matrix.makeBasis(au, ax, av);
    m.matrix.setPosition(o[0], o[1], o[2]);
    m.userData = { i: t.i, modulo: true };
    G.modelo.add(m); G.largueros.push(m);
  });
  // radial: discos (horizontales) y tubo central
  R.discos.forEach(d => {
    const g = extruir(polyVista(d.poly), d.huecos, e); g.rotateX(-Math.PI / 2);
    const m = new T.Mesh(g, mats); m.castShadow = m.receiveShadow = true; m.userData = { i: d.i, disco: true, v: d.v };
    G.modelo.add(m); G.largueros.push(m);
  });
  const mMet = new T.MeshStandardMaterial({ color: '#b8bcc0', metalness: .85, roughness: .35 }); mMet.userData.propio = true;
  if (P.tipo === 'radial' && R.tuboV) {
    const t = cilindroEntre([0, R.tuboV[0] - 20, 0], [0, R.tuboV[1] + 20, 0], P.radial.tubo / 2, mMet, 28);
    t.userData.extra = 'tubo'; G.modelo.add(t); G.varillas.push(t);
  }
  // pared: rastreles y la pared
  if (P.tipo === 'pared') {
    const mR = new T.MeshStandardMaterial({ color: '#cdb38a', roughness: .8 }); mR.userData.propio = true;
    const x0 = R.costillas[0].x - e / 2 - 30, x1 = R.costillas[R.n - 1].x + e / 2 + 30, Pa = P.pared;
    R.rastreles.forEach(r => (r.tramos || [[R.costillas[0].x - e / 2 - 30, R.costillas[R.n - 1].x + e / 2 + 30]]).forEach(([xa, xb]) => {
      // de la primera a la última lama, 30 mm más por cada lado (o el tramo que dejan los huecos), a la altura del rastrel
      const m0 = marcoEn(xa), m1 = marcoEn(xb), ae = ejeGrosor(m0), av = ejeV(m0);
      const a = puntoMarco(m0, Pa.grueso / 2, r.v), b = puntoMarco(m1, Pa.grueso / 2, r.v);
      const d = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length();
      const caja = new T.Mesh(new T.BoxGeometry(L, Pa.alto, Pa.grueso), mR);
      const ex = new T.Vector3(...ae), ey = new T.Vector3(...av), ez = ex.clone().cross(ey);
      caja.matrixAutoUpdate = false; caja.matrix.makeBasis(ex, ey, ez).setPosition((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      caja.castShadow = true; caja.userData.extra = 'rastrel'; G.modelo.add(caja);
    }));

    if (Pa.verPared) {
      const mP = new T.MeshStandardMaterial({ color: '#e9e5de', roughness: .95 }); mP.userData.propio = true;
      const w = new T.Mesh(new T.PlaneGeometry(Math.max(P.largo * 1.6, ((G.dims || [0])[0] || 0) * 1.3, 2000), Math.max(G.alto * 1.5, 1500)), mP);
      w.position.set(0, Math.max(G.alto * 1.5, 1500) / 2 - 1, -0.5); w.receiveShadow = true; w.userData.extra = 'pared'; G.modelo.add(w);
    }
  }
  construirVarillas3D();
  construirClaves3D();
  colocarExplosion();
  construirFantasma();
  resaltar3D();
  // luz y suelo a la medida
  const tam = Math.max(sz.x, sz.y, sz.z, 300);
  G.suelo.scale.set(tam * 5, tam * 5, 1);
  G.tam = tam;
  luces3D();
}
// piezas planas: cada pieza en su plano, con las ranuras y las cajas (y el hueso de perro si está activo)
function construir3DPlano() {
  const e = grosor(), mats = materialesTablero(), bb = R.bbox || [[0, 1], [0, 1], [0, 1]];
  R.costillas.forEach(c => {
    if (!c.ok) { G.costillas.push(null); return; }
    const m = new T.Mesh(extruir(polyVista(c.poly), [], e, (c.int || []).map(polyVista)), mats); m.castShadow = m.receiveShadow = true;
    m.userData = { i: c.i, x: c.x, plano: c.plano };
    G.modelo.add(m); G.costillas.push(m);
  });
  const sz = bb.map(r => r[1] - r[0]);
  G.dims = [sz[0], sz[2], sz[1]]; G.alto = bb[1][1]; G.fondo = sz[2]; G.rmax = Math.max(sz[0], sz[2]) / 2;
  G.centro = bb.map(r => (r[0] + r[1]) / 2);
  const tam = Math.max(sz[0], sz[1], sz[2], 300); G.tam = tam;
  colocarExplosion(); resaltar3D();
  G.suelo.scale.set(tam * 5, tam * 5, 1); luces3D();
}
// coloca una pieza plana (con la explosión: cada pieza se aparta del centro siguiendo su normal; las horizontales, hacia arriba)
function colocarPiezaPlana(m) {
  const c = R && R.costillas[m.userData.i]; if (!c) return;
  const b = basePieza(c), ex = P.vista.explosion || 0, pl = PLANOS[c.plano], ctr = G.centro || [0, 0, 0], tam = G.tam || 600;
  const d = b.o.slice();
  if (ex) {
    d[pl.n] += (c.x - ctr[pl.n]) * ex * 1.3;   // se separan en proporción a su distancia al centro (mantienen el orden)
    // las que se montan bajando (horizontales, o con ranuras desde abajo) suben
    if (pl.n === 1 || (pl.b === 1 && c.ranuras.some(r => !r.alto && r.eje === 'v'))) d[1] += ex * tam * (pl.n === 1 ? 0.6 : 0.4);
  }
  const M4 = new T.Matrix4().makeBasis(V3(b.ex), V3(b.ey), V3(b.ez)).setPosition(d[0], d[1], d[2]);
  m.matrixAutoUpdate = false; m.matrix.copy(M4); m.matrixWorldNeedsUpdate = true;
}
// luz normal (de arriba a un lado) o rasante: muy baja, casi paralela a la superficie, y se puede girar
function luces3D() {
  if (!G.luz) return;
  const L = G.luz, tam = G.tam || 1000, ras = P.vista.rasante, a = (P.vista.rasAng || 0) * Math.PI / 180;
  const c = [0, (G.alto || 400) / 2, 0];
  if (!ras) {
    L.position.set(-tam * 0.9, tam * 1.6, tam * 1.1); L.target.position.set(0, (G.alto || 400) / 3, 0);
    L.intensity = 2.0; G.hemi.intensity = 0.6; G.scene.environmentIntensity = 0.55;
  } else {
    const d = tam * 2.2;
    // en la pared, la luz va pegada a la pared (gira en su plano); en los muebles, a ras del suelo alrededor
    if (P.tipo === 'pared') L.position.set(c[0] + d * Math.cos(a), c[1] + d * Math.sin(a), d * 0.22);
    else L.position.set(c[0] + d * Math.cos(a), c[1] + d * 0.18, c[2] + d * Math.sin(a));
    L.target.position.set(c[0], c[1], c[2]);
    L.intensity = 3.2; G.hemi.intensity = P.tipo === 'pared' ? 0.12 : 0.28; G.scene.environmentIntensity = P.tipo === 'pared' ? 0.12 : 0.22;
  }
  const sc = L.shadow.camera, r = tam * (ras ? 1.6 : 1.2); sc.left = sc.bottom = -r; sc.right = sc.top = r; sc.near = 10; sc.far = tam * 7; sc.updateProjectionMatrix();
  pedirRender();
}
// varillas, separadores y tuercas (siguen la planta, recta o curva)
function construirVarillas3D() {
  G.varillas.filter(m => !m.userData.extra).forEach(m => { G.modelo.remove(m); m.geometry.dispose(); });
  G.varillas = G.varillas.filter(m => m.userData.extra);
  if (P.tipo !== 'costillas') return;
  const e = grosor(), V = P.varillas, tv = VARILLA_TIPOS[V.tipo] || VARILLA_TIPOS.roscada;
  if (!G.matVar) {
    // rosca: textura de rayas (relieve) que se repite cada paso de rosca
    const cv = document.createElement('canvas'); cv.width = 4; cv.height = 32; const cx = cv.getContext('2d');
    const gr = cx.createLinearGradient(0, 0, 0, 32); gr.addColorStop(0, '#000'); gr.addColorStop(0.5, '#fff'); gr.addColorStop(1, '#000'); cx.fillStyle = gr; cx.fillRect(0, 0, 4, 32);
    G.texRosca = new T.CanvasTexture(cv); G.texRosca.wrapS = G.texRosca.wrapT = T.RepeatWrapping;
    G.matVar = new T.MeshStandardMaterial({ color: tv.hex });
    G.matMal = new T.MeshStandardMaterial({ color: '#d0453a', roughness: .5 });
    G.matSep = new T.MeshStandardMaterial({ color: '#9ea3a8' });
    G.matTu = new T.MeshStandardMaterial({ color: '#8d9399', metalness: .9, roughness: .3 });
    G.matHueco = new T.MeshStandardMaterial({ color: '#202326', roughness: .9 });
  }
  // los materiales se crean una vez: color, brillo y rosca según el tipo, cada vez
  const rosca = V.tipo === 'roscada', tubo = V.tipo === 'tubo';
  G.matVar.color.set(tv.hex); G.matVar.metalness = tv.metal ? (tubo ? .95 : .7) : 0; G.matVar.roughness = tubo ? .16 : rosca ? .5 : .7;
  G.matVar.bumpMap = rosca ? G.texRosca : null; G.matVar.bumpScale = rosca ? 1.5 : 0; G.matVar.needsUpdate = true;
  G.matSep.color.set(tv.metal ? '#9ea3a8' : '#c9a36d'); G.matSep.metalness = tv.metal ? .8 : 0; G.matSep.roughness = tv.metal ? .4 : .75;
  const paso = Math.max(0.8, V.diam * 0.125);   // paso de rosca métrica aproximado (M10: 1,25; M20: 2,5)
  const conRosca = m => { if (!rosca) return m; const uv = m.geometry.attributes.uv, L = m.geometry.parameters.height || 1; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * L / paso); uv.needsUpdate = true; return m; };
  const add = m => { m.userData.var = true; G.modelo.add(m); G.varillas.push(m); };
  R.varillas.forEach(rv => {
    if (!rv.usada) return;
    const pts = [];
    for (let i = rv.a; i <= rv.b; i++) pts.push(puntoMarco(marcoExpl(R.costillas[i].x), rv.u, rv.v));
    const dirIni = ejeGrosor(marcoExpl(R.costillas[rv.a].x)), dirFin = ejeGrosor(marcoExpl(R.costillas[rv.b].x));
    const sg = pts.length > 1 ? Math.sign((pts[1][0] - pts[0][0]) * dirIni[0] + (pts[1][2] - pts[0][2]) * dirIni[2]) || 1 : 1;
    const ext = e / 2 + (tubo ? 0 : V.sobra), ini = pts[0].map((v, k) => v - sg * dirIni[k] * ext), fin = pts[pts.length - 1].map((v, k) => v + sg * dirFin[k] * ext);
    const mat = rv.fallan.length ? G.matMal : G.matVar;
    if (disposicion() === 'curva' && pts.length > 2) {
      const curva = new T.CatmullRomCurve3([ini, ...pts, fin].map(V3));
      const m = new T.Mesh(new T.TubeGeometry(curva, pts.length * 6, V.diam / 2, 12), mat); m.castShadow = true; add(m);
    } else add(conRosca(cilindroEntre(ini, fin, V.diam / 2, mat, 20)));
    if (rosca) {
      const pieza = (p, d, sg2) => {
        const fuera = k => p.map((v, j) => v + sg2 * d[j] * k);
        add(cilindroEntre(fuera(0), fuera(V.diam * 0.16), V.diam * 1.05, G.matTu, 24));                      // arandela
        add(cilindroEntre(fuera(V.diam * 0.16), fuera(V.diam * 0.96), V.diam * 0.95, G.matTu, 6));          // tuerca hexagonal
      };
      pieza(pts[0].map((v, k) => v - sg * dirIni[k] * e / 2), dirIni, -sg);
      pieza(pts[pts.length - 1].map((v, k) => v + sg * dirFin[k] * e / 2), dirFin, sg);
    } else if (tubo) {
      // tapa roscada redonda y abombada (embellecedor) pegada a la costilla; el tubo no sobresale
      const tapa = (p, d, sg2) => {
        const fuera = k => p.map((v, j) => v + sg2 * d[j] * k);
        add(cilindroEntre(fuera(0), fuera(V.diam * 0.12), V.diam * 0.85, G.matVar, 32));
        const dome = new T.Mesh(new T.SphereGeometry(V.diam * 0.85, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), G.matVar);
        dome.scale.set(1, 0.35, 1); dome.position.set(...fuera(V.diam * 0.12));
        dome.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(...d.map(x => x * sg2)).normalize()); dome.castShadow = true; add(dome);
      };
      tapa(pts[0].map((v, k) => v - sg * dirIni[k] * e / 2), dirIni, -sg);
      tapa(pts[pts.length - 1].map((v, k) => v + sg * dirFin[k] * e / 2), dirFin, sg);
    }
    if (conSeparadores() && R.hueco > 0.5) for (let i = 0; i + 1 < pts.length; i++) {
      if (!rv.cabe[rv.a + i] || !rv.cabe[rv.a + i + 1]) continue;
      const a = V3(pts[i]), b = V3(pts[i + 1]), d = b.clone().sub(a), L = d.length(); if (L <= e + 0.5) continue;
      d.normalize();
      add(cilindroEntre(a.clone().addScaledVector(d, e / 2).toArray(), b.clone().addScaledVector(d, -e / 2).toArray(), V.sepD / 2, G.matSep, 20));
    }
  });
  G.varillas.forEach(m => m.visible = P.vista.varillas || !!m.userData.extra);
}
// perfiles clave en el 3D: líneas que se pueden pinchar para editarlas
function construirClaves3D() {
  (G.claves3d || []).forEach(l => { G.modelo.remove(l); l.geometry.dispose(); l.material.dispose(); });
  G.claves3d = [];
  if (!P.vista.claves || formaCalculada() || P.tipo === 'plano') return;
  const C = clavesOrdenadas(), acento = cssVar('--acento') || '#1f6fd1';
  C.forEach((k, i) => {
    if (P.tipo === 'radial' && k.x >= 359.999 && C.length > 1) return;     // la de 360° es la misma que la de 0°
    const poly = contornoDe(k.pts); if (poly.length < 3) return;
    const m = marcoExpl(k.x), sel = i === UI.clave, ae = ejeGrosor(m), off = grosor() / 2 + 0.6;
    const pts = [];
    for (const lado of sel ? [-1, 1] : [1]) poly.concat([poly[0]]).forEach(p => { const q = puntoMarco(m, p[0], p[1]); pts.push(new T.Vector3(q[0] + ae[0] * off * lado, q[1], q[2] + ae[2] * off * lado)); });
    const g = new T.BufferGeometry().setFromPoints(pts);
    const l = new T.Line(g, new T.LineBasicMaterial({ color: sel ? '#ff7a1a' : acento, transparent: true, opacity: sel ? 1 : (P.tipo === 'radial' ? .22 : .45), depthTest: false }));
    l.renderOrder = 10; l.userData = { clave: i };
    G.modelo.add(l); G.claves3d.push(l);
  });
  pedirRender();
}
function colocarExplosion() {
  const e = grosor(), ex = P.vista.explosion || 0;
  if (P.tipo === 'plano') { G.costillas.forEach(m => { if (m) colocarPiezaPlana(m); }); pedirRender(); return; }
  G.costillas.forEach(m => { if (m) ponerEnMarco(m, marcoExpl(m.userData.x)); });
  G.largueros.forEach(m => {
    if (m.userData.modulo) return;
    if (m.userData.trozoX != null) { ponerEnMarco(m, marcoExpl(m.userData.trozoX)); return; }
    if (m.userData.disco) { m.position.set(0, m.userData.v, 0); return; }
    // en la retícula, la explosión levanta los largueros (así se ve cómo encajan)
    m.position.set(-P.largo / 2, ex * (G.alto || 400) * 1.1, -(m.userData.u - (R.uc || 0)));
  });
  construirVarillas3D();
  construirClaves3D();
  pedirRender();
}
function construirFantasma() {
  if (P.tipo === 'plano') { if (G.fantasma) { G.modelo.remove(G.fantasma); G.fantasma.geometry.dispose(); G.fantasma = null; } return; }
  if (figuraActiva()) { if (G.fantasma) { G.modelo.remove(G.fantasma); G.fantasma.geometry.dispose(); G.fantasma = null; } return; }
  if (G.fantasma) { G.modelo.remove(G.fantasma); G.fantasma.geometry.dispose(); G.fantasma.material.dispose(); G.fantasma = null; }
  if (!P.vista.fantasma) return;
  const N = P.tipo === 'radial' ? 72 : 64, anillos = [], X = P.tipo === 'radial' ? 360 : P.largo;
  for (let i = 0; i <= N; i++) {
    const x = X * i / N; let c = relieveActivo() ? poligonoRelieve(x, true) : curvaCerrada(perfilEn(x), P.esquinas);
    c = c.map(p => [P.tipo === 'radial' ? Math.max(p[0], radioTubo()) : p[0], clamp(p[1], P.costillas.base ? 0 : -1e9, P.costillas.tope ? P.costillas.topeAlt : 1e9)]);
    anillos.push({ m: marcoExpl(x), c });
  }
  const M = anillos[0].c.length, pos = [], idx = [];
  anillos.forEach(a => a.c.forEach(p => pos.push(...puntoMarco(a.m, p[0], p[1]))));
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const a = i * M + j, b = i * M + (j + 1) % M, c = (i + 1) * M + j, d = (i + 1) * M + (j + 1) % M;
    idx.push(a, c, b, b, c, d);
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  G.fantasma = new T.Mesh(g, new T.MeshStandardMaterial({ color: '#4c95ee', transparent: true, opacity: .16, side: T.DoubleSide, depthWrite: false, roughness: .4 }));
  G.modelo.add(G.fantasma);
}
function resaltar3D() {
  const base = materialesTablero();
  [...G.costillas, ...G.largueros].forEach(m => {
    if (!m) return;
    const sel = P.vista.resalta && m.userData.i === UI.costilla;
    if (sel) { if (!m.userData.matSel) m.userData.matSel = materialSel(base); m.material = m.userData.matSel; }
    else m.material = base;
  });
  pedirRender();
}
function camara(tipo) {
  // encuadra la caja de todo lo que se ve (con la explosión incluida)
  const bb = new T.Box3();
  G.modelo.traverse(o => { if (o.isMesh && o.visible && o !== G.fantasma && o.userData.extra !== 'pared') { o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox.clone(); o.updateMatrixWorld(true); b.applyMatrix4(o.matrixWorld); bb.union(b); } });
  if (bb.isEmpty()) bb.set(new T.Vector3(-500, 0, -500), new T.Vector3(500, 500, 500));
  const c = bb.getCenter(new T.Vector3()), radio = bb.getSize(new T.Vector3()).length() / 2;
  const fv = G.cam.fov * Math.PI / 180, fh = 2 * Math.atan(Math.tan(fv / 2) * G.cam.aspect);
  const d = radio / Math.sin(Math.min(fv, fh) / 2) * 1.04;
  const dir = { tres4: [-0.55, 0.42, 0.72], frente: [0, 0.18, 1], lado: [-1, 0.18, 0.0001], arriba: [0, 1, 0.0001] }[tipo === 'encuadrar' ? 'tres4' : tipo];
  const n = Math.hypot(...dir);
  G.cam.position.set(c.x + dir[0] / n * d, c.y + dir[1] / n * d, c.z + dir[2] / n * d); G.ctl.target.copy(c); G.ctl.update(); pedirRender();
}
function imagenPNG() {
  const r = G.renderer, pr = r.getPixelRatio();
  r.setPixelRatio(Math.max(3, pr)); ajustar3D(); r.render(G.scene, G.cam);
  r.domElement.toBlob(b => { descargar(nombreArchivo(P.nombre) + '.png', b); r.setPixelRatio(pr); ajustar3D(); aviso('Imagen guardada'); }, 'image/png');
}

/* ===================== PANELES ===================== */
let tRecalc = 0;
// recalcula costillas y lo dibuja todo
function recalcular() {
  R = calcular();
  UI.costilla = clamp(UI.costilla, 0, nPiezas() - 1);
  if (UI.varilla >= P.varillas.lista.length) UI.varilla = -1;
  construir3D();
  refrescarListas();
  VP.pintar(); refrescarCostilla(); VC.pintar(); if (VH) VH.pintar();
}
// durante un arrastre: como mucho cada 70 ms
function recalcularPronto() {
  VP.pintar();
  if (tRecalc) return;
  tRecalc = setTimeout(() => { tRecalc = 0; recalcular(); }, 70);
}
// después de cada cambio que se pueda deshacer
function cambio(txt) {
  UI.sucio = true;
  guardarHistoria();
  recalcular();
  refrescarClaves(); refrescarHuecos();
  if (txt) $('#estado').textContent = txt;
}

function construirParams() {
  const pl = PLANTILLAS[P.plantilla], cont = $('#params');
  $('#descPlantilla').textContent = pl.desc;
  cont.innerHTML = '';
  pl.params.forEach(q => {
    const v = P.params[q.id] != null ? P.params[q.id] : q.valor;
    const d = document.createElement('div'); d.className = 'param';
    d.innerHTML = `<div class="pt"><span>${q.nombre}</span><input type="number" min="${q.min}" max="${q.max}" step="${q.paso}" value="${v}"></div>
      <input type="range" min="${q.min}" max="${q.max}" step="${q.paso}" value="${v}">`;
    const [num, ran] = d.querySelectorAll('input');
    const poner = (val, final) => {
      val = clamp(+val, q.min, q.max); if (!isFinite(val)) return;
      if (P.editado && q.id !== 'largo' && !UI.avisoRegenerar) {
        if (!confirm('Has retocado los perfiles a mano. Si cambias este parámetro, la forma se vuelve a generar desde la plantilla y se pierden esos retoques.\n\n¿Seguir?')) { num.value = ran.value = P.params[q.id]; return; }
        UI.avisoRegenerar = true;
      }
      P.params[q.id] = val; num.value = ran.value = val;
      aplicarPlantilla(q.id === 'largo');
      if (final) { cambio(q.nombre + ': ' + fmt(val, q.paso < 1 ? 2 : 0)); UI.avisoRegenerar = false; encuadrarSiHaceFalta(); }
      else recalcularPronto();
      $('#avisoEditado').classList.toggle('oculto', !P.editado);
    };
    ran.oninput = () => poner(ran.value, false);
    ran.onchange = () => poner(ran.value, true);
    num.onchange = () => poner(num.value, true);
    cont.appendChild(d);
  });
  $('#avisoEditado').classList.toggle('oculto', !P.editado);
}
function encuadrarSiHaceFalta() { encuadrarPerfil(); encuadrarCostilla(); }

function iniciarPanel() {
  $('#bPlantillaFotos').onclick = () => dialogoNuevo();
  const sp = $('#sPlantilla');
  sp.onchange = () => {
    if (P.editado && !confirm('Se perderán los retoques hechos a mano en los perfiles. ¿Cambiar de plantilla?')) { sp.value = P.plantilla; return; }
    P.plantilla = sp.value; P.params = paramsDefecto(sp.value); P.nombre = PLANTILLAS[sp.value].nombre;
    aplicarPlantilla(); UI.clave = 0;
    if (P.tipo === 'costillas') { R = calcular(); autoVarillas(P.varillas.autoN); }
    construirParams(); cambio('Plantilla: ' + PLANTILLAS[sp.value].nombre);
    encuadrarSiHaceFalta(); camara('tres4');
  };
  const sm = $('#cMaterial');
  Object.entries(MATERIALES).forEach(([id, m]) => sm.add(new Option(m.nombre, id)));
  // costillas
  const enlazar = (sel, fn, ev = 'change') => $(sel).addEventListener(ev, fn);
  enlazar('#cGrosor', () => {
    const v = $('#cGrosor').value; $('#filaGrosorOtro').classList.toggle('oculto', v !== 'otro');
    P.costillas.grosor = v === 'otro' ? +$('#cGrosorOtro').value : +v; if (esPlano() && !P.editado) aplicarPlantilla(); cambio('Grosor ' + P.costillas.grosor + ' mm');
  });
  enlazar('#cGrosorOtro', () => { P.costillas.grosor = clamp(+$('#cGrosorOtro').value || 18, 3, 80); if (esPlano() && !P.editado) aplicarPlantilla(); cambio('Grosor ' + P.costillas.grosor + ' mm'); });
  enlazar('#cModo', () => {
    P.costillas.modo = $('#cModo').value;
    // conserva el reparto actual al cambiar de modo
    if (R) { P.costillas.numero = R.n; P.costillas.separacion = Math.round(R.sep * 10) / 10; }
    ponerControles(); cambio();
  });
  enlazar('#cSep', () => { P.costillas.separacion = Math.max(1, +$('#cSep').value || 60); cambio('Separación ' + P.costillas.separacion + ' mm'); });
  enlazar('#cNum', () => { P.costillas.numero = clamp(Math.round(+$('#cNum').value || 2), 2, 400); cambio(P.costillas.numero + ' costillas'); });
  enlazar('#cBase', () => { P.costillas.base = $('#cBase').checked; cambio(); });
  enlazar('#cTope', () => { P.costillas.tope = $('#cTope').checked; $('#filaTope').classList.toggle('oculto', !P.costillas.tope); cambio(); });
  enlazar('#cTopeAlt', () => { P.costillas.topeAlt = Math.max(10, +$('#cTopeAlt').value || 400); cambio(); });
  enlazar('#cMaterial', () => { P.costillas.material = sm.value; $('#filaColor').classList.toggle('oculto', !MATERIALES[sm.value].color); cambio(MATERIALES[sm.value].nombre); });
  enlazar('#cColor', () => { P.costillas.color = $('#cColor').value; cambio(); });
  // varillas
  const V = () => P.varillas;
  enlazar('#vTipo', () => { V().tipo = $('#vTipo').value; $('#filaSepD').classList.toggle('oculto', !conSeparadores()); $('#vSep').closest('label').classList.toggle('oculto', V().tipo === 'madera'); cambio(); });
  enlazar('#vDiam', () => { V().diam = +$('#vDiam').value; if (V().sepD <= V().diam + 4) { V().sepD = V().diam + 12; $('#vSepD').value = V().sepD; } cambio('Varilla Ø ' + V().diam); });
  enlazar('#vHolgura', () => { V().holgura = clamp(+$('#vHolgura').value || 0, 0, 5); cambio(); });
  enlazar('#vMargen', () => { V().margen = clamp(+$('#vMargen').value || 0, 0, 200); cambio(); });
  enlazar('#vTramo', () => { V().tramo = $('#vTramo').value; cambio(); });
  enlazar('#vSep', () => { V().separadores = $('#vSep').checked; $('#filaSepD').classList.toggle('oculto', !conSeparadores()); cambio(); });
  enlazar('#vSepD', () => { V().sepD = clamp(+$('#vSepD').value || 20, 4, 120); cambio(); });
  enlazar('#vSobra', () => { V().sobra = clamp(+$('#vSobra').value || 0, 0, 200); cambio(); });
  enlazar('#vAutoN', () => { V().autoN = clamp(Math.round(+$('#vAutoN').value || 3), 1, 8); });
  $('#bVarAuto').onclick = () => {
    const n = autoVarillas(V().autoN);
    if (!n) { aviso('No hay sitio común para las varillas: baja «Madera al borde» o el diámetro, o usa «Solo donde caben».', 5000); return; }
    cambio(n < V().autoN ? `Solo caben ${n} varillas` : n + ' varillas colocadas');
    if (n < V().autoN) aviso(`Solo hay sitio para ${n} varilla${n > 1 ? 's' : ''} con esa separación.`);
  };
  $('#bVarMas').onclick = () => { UI.modo = UI.modo === 'varilla' ? 'normal' : 'varilla'; VP.pintar(); };
  $('#bVarQuitar').onclick = () => { if (!V().lista.length) return; V().lista = []; UI.varilla = -1; cambio('Varillas quitadas'); };
  // piezas planas
  enlazar('#plHolgura', () => { planoP().holgura = clamp(+$('#plHolgura').value || 0, 0, 3); cambio('Holgura de las uniones ' + fmt(planoP().holgura, 2) + ' mm'); });
  iniciarPiezas();
  // tipo de mueble y retícula
  enlazar('#sTipo', () => {
    const nuevo = $('#sTipo').value, gN = grupoTipo(nuevo);
    if (gN !== grupoDe(P.plantilla) && P.editado && !confirm('Este tipo de mueble usa otras plantillas: se perderán los retoques de los perfiles. ¿Seguir?')) { $('#sTipo').value = P.tipo; return; }
    P.tipo = nuevo;
    if (gN !== grupoDe(P.plantilla)) {
      const id = Object.keys(PLANTILLAS).find(k => grupoDe(k) === gN);
      P.plantilla = id; P.params = paramsDefecto(id); P.nombre = PLANTILLAS[id].nombre; aplicarPlantilla(); UI.clave = 0;
    }
    if (P.tipo === 'radial') { P.costillas.modo = 'numero'; P.costillas.numero = clamp(P.costillas.numero, 3, 48); if (P.costillas.numero > 24) P.costillas.numero = 12;
      if (grosor() > 10 && confirm('Las piezas radiales (lámparas) suelen hacerse con tablero fino. ¿Pasar a contrachapado de 6 mm?')) P.costillas.grosor = 6;
      const tMin = Math.ceil(P.costillas.numero * (grosor() + 1) / Math.PI); if (P.radial.tubo < tMin) P.radial.tubo = tMin; }
    if (P.tipo === 'pared') {
      if (grosor() > 12 && confirm('Los paneles de pared suelen hacerse con lamas de 12 mm, bastante juntas. ¿Pasar a tablero de 12 mm?')) P.costillas.grosor = 12;
      P.costillas.modo = 'separacion';
      if (P.costillas.separacion > 2.5 * grosor()) P.costillas.separacion = Math.round(2.2 * grosor());
    }
    if (P.tipo === 'reticula' && P.costillas.modo === 'separacion' && P.costillas.separacion < 3 * grosor()) P.costillas.separacion = Math.round(Math.max(100, 6 * grosor()));
    if (P.tipo !== 'radial' && P.costillas.modo === 'numero' && grupoDe(P.plantilla) !== 'radial') P.costillas.modo = 'separacion';
    R = calcular();
    if (P.tipo === 'costillas' && !P.varillas.lista.length) autoVarillas(P.varillas.autoN);
    UI.costilla = 0; ponerControles();
    if (P.tipo === 'plano' && !planoP().piezas.length) aplicarPlantilla();
    cambio({ costillas: 'Costillas con varillas', reticula: 'Retícula entrelazada', radial: 'Rebanadas radiales', pared: 'Panel de pared', plano: 'Piezas planas' }[P.tipo]);
    encuadrarSiHaceFalta(); camara('tres4');
  });
  // relieve: texto o modelo 3D
  llenarLetras();
  const Rl = () => P.relieve;
  enlazar('#sOrigen', () => {
    if (P.tipo !== 'pared') {   // costillas y retícula: plantilla o figura desde un modelo 3D
      P.figura.activa = $('#sOrigen').value === 'figura';
      if (P.figura.activa && !P.figura.malla) { P.figura.activa = false; ponerControles(); $('#sOrigen').value = 'figura'; mostrarSecciones(true); aviso('Carga un modelo 3D o elige uno de ejemplo.'); return; }
      R = calcular(); if (P.tipo === 'costillas') autoVarillas(P.varillas.autoN);
      UI.costilla = 0; ponerControles(); cambio(P.figura.activa ? 'Figura desde un modelo 3D' : 'Forma desde la plantilla'); encuadrarSiHaceFalta(); encuadrarPerfil(); camara('tres4');
      return;
    }
    Rl().fuente = $('#sOrigen').value;
    if (relieveActivo() && P.pared.rastreles && Rl().fondo < P.pared.grueso + 15) Rl().fondo = P.pared.grueso + 15;
    UI.costilla = 0; ponerControles(); cambio({ plantilla: 'Forma desde la plantilla', texto: 'Relieve de texto', modelo: 'Relieve desde un modelo 3D', imagen: 'Relieve desde una imagen' }[Rl().fuente]);
    encuadrarSiHaceFalta(); camara('tres4');
  });
  const num = (sel, k, min = 0) => enlazar(sel, () => { Rl()[k] = Math.max(min, +$(sel).value || 0); cambio(); });
  num('#rlTam', 'tamLetra', 5); num('#rlFondo', 'fondo', 2); num('#rlRelieve', 'relieve'); num('#rlSuave', 'suavizado'); num('#rlOnda', 'ondaAmp'); num('#rlOndas', 'ondas', 0.5); num('#rlInter', 'interlinea', 0.5);
  enlazar('#rlBase', () => { Rl().base = clamp(+$('#rlBase').value || 0, 0, 0.9); cambio(); });
  const medida = (sel, k) => enlazar(sel, () => { Rl()[k] = Math.max(100, +$(sel).value || 500); if (Rl().fuente === 'modelo') reproyectarModelo(); cambio(); encuadrarSiHaceFalta(); camara('tres4'); });
  medida('#rlAncho', 'ancho'); medida('#rlAlto', 'alto');
  enlazar('#rlLetra', () => { Rl().letra = $('#rlLetra').value; cambio(); });
  enlazar('#rlNegrita', () => { Rl().negrita = $('#rlNegrita').checked; cambio(); });
  enlazar('#rlInvertir', () => { Rl().invertir = $('#rlInvertir').checked; cambio(); });
  let tTexto = 0;
  $('#rlTexto').addEventListener('input', () => { clearTimeout(tTexto); tTexto = setTimeout(() => { Rl().texto = $('#rlTexto').value; cambio('Texto'); }, 450); });
  const vista = async () => {
    Rl().vista = $('#rlVista').value; Rl().giro = +$('#rlGiro').value;
    if (Rl().modelo && Rl().modelo.ejemplo) { try { await cargarRecurso('modelos'); } catch (e) { /* sin modelos */ } }
    if (reproyectarModelo()) cambio('Vista del modelo'); else aviso('Para cambiar la vista, vuelve a cargar el modelo (el proyecto guarda solo su relieve).', 5000);
  };
  enlazar('#rlVista', vista); enlazar('#rlGiro', vista);
  $('#bCargarModelo').onclick = () => {
    const f = $('#fModelo'); f.value = '';
    f.onchange = () => {
      const a = f.files[0]; if (!a) return;
      aviso('Leyendo ' + esc(a.name) + '…');
      const rd = new FileReader();
      rd.onload = () => { try { const n = cargarModelo(rd.result, a.name); ponerControles(); cambio('Modelo: ' + a.name); encuadrarSiHaceFalta(); camara('tres4'); aviso(`${esc(a.name)}: ${n.toLocaleString('es-ES')} triángulos`); } catch (e) { aviso('⚠ ' + esc(e.message), 5000); } };
      rd.readAsArrayBuffer(a);
    };
    f.click();
  };
  $('#bModeloEjemplo').onclick = () => dialogoModelos(false);
  $('#bImagenEjemplo').onclick = dialogoImagenes;
  // figura desde un modelo 3D (costillas y retícula)
  const Fg = () => P.figura;
  const reFigura = (txt) => { R = calcular(); if (P.tipo === 'costillas') autoVarillas(P.varillas.autoN); ponerControles(); cambio(txt); encuadrarSiHaceFalta(); encuadrarPerfil(); camara('tres4'); };
  enlazar('#fgAlto', () => { Fg().alto = clamp(+$('#fgAlto').value || 800, 100, 5000); reFigura('Alto de la figura'); });
  enlazar('#fgEje', () => { Fg().eje = $('#fgEje').value; reFigura(Fg().eje === 'z' ? 'Cortes de delante a atrás' : 'Cortes de lado a lado'); });
  enlazar('#fgUnir', () => { Fg().unir = $('#fgUnir').checked; CACHE_SEC.clave = ''; reFigura(Fg().unir ? 'Unir trozos sueltos' : 'Solo el trozo mayor'); });
  enlazar('#fgMin', () => { Fg().minArea = clamp(+$('#fgMin').value || 0, 0, 60); reFigura('Costillas pequeñas'); });
  enlazar('#fgGiro', () => { Fg().giro = +$('#fgGiro').value; reFigura('Giro de la figura'); });
  $('#bFigCargar').onclick = () => {
    const f = $('#fModelo'); f.value = '';
    f.onchange = () => {
      const a = f.files[0]; if (!a) return;
      aviso('Leyendo ' + esc(a.name) + '…');
      const rd = new FileReader();
      rd.onload = () => { try { const m = cargarFiguraTriangulos(leerMalla(rd.result, a.name), a.name); reFigura('Figura: ' + a.name); aviso(`${esc(a.name)}: ${m.original.toLocaleString('es-ES')} triángulos${m.nt < m.original ? ` (reducido a ${m.nt.toLocaleString('es-ES')})` : ''}`, 4000); } catch (e) { aviso('⚠ ' + esc(e.message), 5000); } };
      rd.readAsArrayBuffer(a);
    };
    f.click();
  };
  $('#bFigEjemplo').onclick = () => dialogoModelos(true);
  $('#bConvertirPerfiles').onclick = dialogoConvertir;
  $('#bSimplificar').onclick = dialogoSimplificar;
  $('#bPerfilDXF').onclick = dialogoPerfilDXF;
  $$('.bLetra').forEach(bt => bt.onclick = () => {
    const destino = bt.closest('#caCampos') ? 'capa' : 'texto', f = $('#fLetra'); f.value = '';
    f.onchange = () => {
      const a = f.files[0]; if (!a) return;
      cargarLetraArchivo(a).then(nombre => {
        if (destino === 'capa') P.relieve.capa.letra = nombre; else P.relieve.letra = nombre;
        llenarLetras(); ponerControles(); cambio('Letra: ' + nombre); aviso('Letra cargada: ' + esc(nombre) + '. Se guarda dentro del proyecto.', 4000);
      }).catch(e => aviso('⚠ ' + esc(e.message || 'No se puede leer esa letra'), 5000));
    };
    f.click();
  });
  // texto añadido encima del relieve
  const Ca = () => P.relieve.capa;
  enlazar('#caActiva', () => { Ca().activa = $('#caActiva').checked; $('#caCampos').classList.toggle('oculto', !Ca().activa); cambio(Ca().activa ? 'Texto añadido' : 'Sin texto añadido'); });
  let tCapa = 0;
  $('#caTexto').addEventListener('input', () => { clearTimeout(tCapa); tCapa = setTimeout(() => { Ca().texto = $('#caTexto').value; cambio('Texto añadido'); }, 450); });
  enlazar('#caLetra', () => { Ca().letra = $('#caLetra').value; cambio(); });
  enlazar('#caNegrita', () => { Ca().negrita = $('#caNegrita').checked; cambio(); });
  enlazar('#caModo', () => { Ca().modo = $('#caModo').value; cambio(); });
  [['#caTam', 'tamLetra', 5, 3000], ['#caRelieve', 'relieve', 0, 500], ['#caX', 'x', 0, 100], ['#caY', 'y', 0, 100]].forEach(([s, k, a, b]) => enlazar(s, () => { Ca()[k] = clamp(+$(s).value || 0, a, b); cambio(); }));
  enlazar('#rlGama', () => { Rl().gama = clamp(+$('#rlGama').value || 1, 0.2, 5); cambio(); });
  $('#bAjustarImagen').onclick = () => { if (!Rl().imagen) { aviso('Carga antes una imagen.'); return; } ajustarAltoImagen(); ponerControles(); cambio('Alto según la imagen'); encuadrarSiHaceFalta(); camara('tres4'); };
  $('#bCargarImagen').onclick = () => {
    const f = $('#fImagen'); f.value = '';
    f.onchange = () => {
      const a = f.files[0]; if (!a) return;
      cargarImagenArchivo(a, true).then(r => { ponerControles(); cambio('Imagen: ' + a.name); encuadrarSiHaceFalta(); camara('tres4'); aviso(`${esc(a.name)}: ${r.w} × ${r.h} px`); })
        .catch(e => aviso('⚠ ' + esc(e.message), 5000));
    };
    f.click();
  };
  enlazar('#paOrient', () => { Rl().orient = $('#paOrient').value; cambio(Rl().orient === 'h' ? 'Lamas horizontales' : 'Lamas verticales'); encuadrarSiHaceFalta(); camara('tres4'); });
  // planta curva
  enlazar('#plForma', () => { P.planta.forma = $('#plForma').value; mostrarSecciones(); cambio('Planta ' + $('#plForma').selectedOptions[0].text.toLowerCase()); camara('tres4'); });
  enlazar('#plRadio', () => { P.planta.radio = Math.max(150, +$('#plRadio').value || 2500); cambio(); });
  enlazar('#plSentido', () => { P.planta.sentido = +$('#plSentido').value; cambio(); });
  enlazar('#plAmp', () => { P.planta.amplitud = Math.max(0, +$('#plAmp').value || 0); cambio(); });
  enlazar('#plOndas', () => { P.planta.ondas = clamp(+$('#plOndas').value || 1, 0.5, 4); cambio(); });
  // radial
  enlazar('#raNum', () => { P.costillas.numero = clamp(Math.round(+$('#raNum').value || 12), 3, 120); cambio(P.costillas.numero + ' costillas'); });
  enlazar('#raTubo', () => { P.radial.tubo = Math.max(4, +$('#raTubo').value || 20); cambio(); });
  enlazar('#raHolTubo', () => { P.radial.holguraTubo = Math.max(0, +$('#raHolTubo').value || 0); cambio(); });
  enlazar('#raDiscos', () => { P.radial.discos = clamp(Math.round(+$('#raDiscos').value || 0), 0, 6); cambio(); });
  enlazar('#raRDisco', () => { P.radial.rDisco = Math.max(0, +$('#raRDisco').value || 0); cambio(); });
  enlazar('#raHolgura', () => { P.radial.holgura = clamp(+$('#raHolgura').value || 0, 0, 3); cambio(); });
  // pared
  enlazar('#paNum', () => { P.pared.rastreles = clamp(Math.round(+$('#paNum').value || 0), 0, 10); cambio(); });
  enlazar('#paAlto', () => { P.pared.alto = Math.max(10, +$('#paAlto').value || 45); cambio(); });
  enlazar('#paGrueso', () => { P.pared.grueso = Math.max(5, +$('#paGrueso').value || 20); cambio(); });
  enlazar('#paMargen', () => { P.pared.margen = Math.max(0, +$('#paMargen').value || 0); cambio(); });
  // partir las lamas
  const Pt = () => (P.pared.partir = Object.assign({ modo: 'no', alturas: '', largoMax: 0, junta: 'tope', sombra: 8, patron: 'alineado', desfase: 300, rastreles: true }, P.pared.partir || {}));
  enlazar('#ptModo', () => { Pt().modo = $('#ptModo').value; cambio(Pt().modo === 'no' ? 'Lamas enteras' : 'Lamas partidas'); ponerPartir(); });
  enlazar('#ptAlturas', () => { Pt().alturas = $('#ptAlturas').value; cambio(); ponerPartir(); });
  enlazar('#ptMax', () => { Pt().largoMax = Math.max(0, +$('#ptMax').value || 0); cambio(); ponerPartir(); });
  enlazar('#ptJunta', () => { Pt().junta = $('#ptJunta').value; cambio(); ponerPartir(); });
  enlazar('#ptSombra', () => { Pt().sombra = clamp(+$('#ptSombra').value || 8, 1, 200); cambio(); ponerPartir(); });
  enlazar('#ptPatron', () => { Pt().patron = $('#ptPatron').value; cambio(); ponerPartir(); });
  enlazar('#ptDesfase', () => { Pt().desfase = Math.max(0, +$('#ptDesfase').value || 0); cambio(); ponerPartir(); });
  enlazar('#ptRast', () => { Pt().rastreles = $('#ptRast').checked; cambio(); ponerPartir(); });
  // dividir en módulos a lo ancho (o a lo alto)
  const Md = () => (P.pared.modulos = Object.assign({ modo: 'no', n: 2, medidas: '', hueco: 0 }, P.pared.modulos || {}));
  enlazar('#mdModo', () => { Md().modo = $('#mdModo').value; cambio(Md().modo === 'no' ? 'Panel de una pieza' : 'Panel en módulos'); ponerPartir(); });
  enlazar('#mdN', () => { Md().n = clamp(Math.round(+$('#mdN').value || 2), 2, 20); cambio(); ponerPartir(); });
  enlazar('#mdMedidas', () => { Md().medidas = $('#mdMedidas').value; cambio(); ponerPartir(); });
  enlazar('#mdHueco', () => { Md().hueco = clamp(+$('#mdHueco').value || 0, 0, 2000); cambio(); ponerPartir(); encuadrarSiHaceFalta(); });
  enlazar('#paHolgura', () => { P.pared.holgura = clamp(+$('#paHolgura').value || 0, 0, 3); cambio(); });
  enlazar('#paVer', () => { P.pared.verPared = $('#paVer').checked; construir3D(); });
  enlazar('#cClaves3d', () => { P.vista.claves = $('#cClaves3d').checked; construirClaves3D(); });
  enlazar('#rNum', () => { P.reticula.num = clamp(Math.round(+$('#rNum').value || 1), 1, 20); cambio(P.reticula.num + ' largueros'); });
  enlazar('#rMargen', () => { P.reticula.margen = Math.max(0, +$('#rMargen').value || 0); cambio(); });
  enlazar('#rVuelo', () => { P.reticula.vuelo = Math.max(0, +$('#rVuelo').value || 0); cambio(); });
  enlazar('#rHolgura', () => { P.reticula.holgura = clamp(+$('#rHolgura').value || 0, 0, 3); cambio(); });
  enlazar('#rArriba', () => { P.reticula.xArriba = $('#rArriba').value === '1'; cambio(); });
  // maqueta
  enlazar('#mActiva', () => { P.maqueta.activa = $('#mActiva').checked; cambio(P.maqueta.activa ? 'Maqueta 1:' + P.maqueta.escala : 'Tamaño real'); });
  enlazar('#mEscala', () => { P.maqueta.escala = +$('#mEscala').value; cambio('Maqueta 1:' + P.maqueta.escala); });
  enlazar('#mGrosor', () => { P.maqueta.grosor = clamp(+$('#mGrosor').value || 3, 0.5, 20); cambio(); });
  enlazar('#mDiam', () => { P.maqueta.diam = clamp(+$('#mDiam').value || 3, 0.5, 20); cambio(); });
  enlazar('#mHolgura', () => { P.maqueta.holgura = clamp(+$('#mHolgura').value || 0, 0, 2); cambio(); });
  // claves
  $('#kPos').onchange = () => {
    const k = claveActual(); k.x = clamp(+$('#kPos').value || 0, 0, P.largo); P.editado = true;
    UI.clave = clavesOrdenadas().indexOf(k); cambio('Clave movida');
  };
  $('#bClaveMas').onclick = () => {
    const c = piezaSel(); if (!c || c.z) { aviso('Selecciona antes una costilla (no un larguero).'); return; }
    const x = Math.round(c.x * 10) / 10;
    if (P.claves.some(k => Math.abs(k.x - x) < 1)) { aviso('Ya hay un perfil clave en esa costilla.'); return; }
    const nueva = { x, pts: perfilEn(x).map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]) };
    P.claves.push(nueva); P.editado = true; UI.clave = clavesOrdenadas().indexOf(nueva); cambio('Clave añadida en la costilla ' + (c.i + 1));
  };
  $('#bClaveMenos').onclick = () => {
    if (P.claves.length <= 1) { aviso('Tiene que quedar al menos un perfil clave.'); return; }
    const k = claveActual(); P.claves.splice(P.claves.indexOf(k), 1); UI.clave = Math.max(0, UI.clave - 1); P.editado = true; cambio('Clave quitada');
  };
  $('#bClaveCopia').onclick = () => {
    const k = claveActual(); P.claves.forEach(o => { if (o !== k) o.pts = clonar(k.pts); }); P.editado = true; cambio('Perfil copiado en todas las claves');
  };
  $('#kInterp').onchange = () => { P.interp = $('#kInterp').value; cambio(); };
  // vista 3D
  $('#rExplosion').oninput = () => { P.vista.explosion = +$('#rExplosion').value; colocarExplosion(); if (P.vista.fantasma) { construirFantasma(); pedirRender(); } };
  $('#cFantasma').onchange = () => { P.vista.fantasma = $('#cFantasma').checked; construirFantasma(); pedirRender(); };
  $('#cVarillas3d').onchange = () => { P.vista.varillas = $('#cVarillas3d').checked; colocarExplosion(); };
  $('#cRasante').onchange = () => { P.vista.rasante = $('#cRasante').checked; $('#rRasante').classList.toggle('oculto', !P.vista.rasante); luces3D(); };
  $('#rRasante').oninput = () => { P.vista.rasAng = +$('#rRasante').value; luces3D(); };
  $('#cResalta').onchange = () => { P.vista.resalta = $('#cResalta').checked; resaltar3D(); };
  // distribución
  $$('[data-dist]').forEach(b => b.onclick = () => {
    $$('[data-dist]').forEach(o => o.classList.toggle('activo', o === b));
    $('#vistas').className = 'vistas ' + b.dataset.dist;
  });
  $('#bPanelIzq').onclick = () => { const a = $('#app').classList.toggle('sin-izq'); $('#bPanelIzq').textContent = a ? '▶' : '◀'; };
  $('#bPanelDer').onclick = () => { const a = $('#app').classList.toggle('sin-der'); $('#bPanelDer').textContent = a ? '◀' : '▶'; };
  // apartados plegables
  $$('.panel section > h3').forEach(h => h.addEventListener('click', ev => { if (ev.target === h || ev.target.parentElement === h) h.parentElement.classList.toggle('plegada'); }));
}

// pone los controles con los valores del proyecto
// plantillas del grupo del tipo de mueble
function llenarPlantillas() {
  const sp = $('#sPlantilla'), g = grupoTipo(P.tipo); sp.innerHTML = '';
  Object.entries(PLANTILLAS).forEach(([id, pl]) => { if ((pl.grupo || 'lineal') === g) sp.add(new Option(pl.nombre, id)); });
  sp.value = P.plantilla;
}
// enseña los apartados de cada tipo de mueble
function mostrarSecciones(forzarFigura) {
  const t = P.tipo;
  $('#secVarillas').classList.toggle('oculto', t !== 'costillas');
  $('#secReticula').classList.toggle('oculto', t !== 'reticula');
  $('#secPlanta').classList.toggle('oculto', t !== 'costillas');
  $('#secRadial').classList.toggle('oculto', t !== 'radial');
  $('#secPared').classList.toggle('oculto', t !== 'pared');
  const pl = t === 'plano';
  $('#secPlano').classList.toggle('oculto', !pl); $('#secPiezas').classList.toggle('oculto', !pl);
  ['#cVarillas3d', '#cClaves3d', '#cFantasma'].forEach(s => $(s).closest('label').classList.toggle('oculto', pl));
  $('#titCostillas').textContent = pl ? 'Tablero' : t === 'pared' ? 'Lamas' : 'Costillas';
  $('#titLista').textContent = pl ? 'Piezas' : t === 'pared' ? 'Lamas' : 'Costillas';
  ['#cBase', '#cTope'].forEach(s => $(s).closest('label').classList.toggle('oculto', pl)); $('#resCost').classList.toggle('oculto', pl);
  $$('.filaArco').forEach(f => f.classList.toggle('oculto', P.planta.forma !== 'arco'));
  $$('.filaS').forEach(f => f.classList.toggle('oculto', P.planta.forma !== 's'));
  const rad = t === 'radial';
  $('#cModo').closest('label').classList.toggle('oculto', rad || pl);
  $('#filaSep').classList.toggle('oculto', rad || pl || P.costillas.modo !== 'separacion');
  $('#filaNum').classList.toggle('oculto', rad || pl || P.costillas.modo !== 'numero');
  if (pl) $('#filaTope').classList.add('oculto');
  $('#kPosTit').textContent = rad ? 'Posición (°)' : 'Posición (mm)';
  // relieve (paneles de pared)
  const rel = relieveActivo(), fig = figuraActiva() || (!!forzarFigura && t !== 'pared' && t !== 'radial'), calc = !!(rel || fig), Rl = P.relieve;
  $('#filaOrigen').classList.toggle('oculto', t === 'radial' || pl);
  [...$('#sOrigen').options].forEach(o => { o.hidden = t === 'pared' ? o.value === 'figura' : !['plantilla', 'figura'].includes(o.value); });
  $('#filaPlantilla').classList.toggle('oculto', calc); $('#bPlantillaFotos').classList.toggle('oculto', calc); $('#params').classList.toggle('oculto', calc); $('#descPlantilla').classList.toggle('oculto', calc);
  $('#secRelieve').classList.toggle('oculto', !rel); $('#secFigura').classList.toggle('oculto', !fig); $('#bConvertirPerfiles').classList.toggle('oculto', !(rel || figuraActiva()));
  $('#relTexto').classList.toggle('oculto', Rl.fuente !== 'texto'); $('#relModelo').classList.toggle('oculto', Rl.fuente !== 'modelo'); $('#relImagen').classList.toggle('oculto', Rl.fuente !== 'imagen');
  $('#secClaves').classList.toggle('oculto', calc || pl);
  $('#sClave').classList.toggle('oculto', calc || pl); $('#bEsquina').classList.toggle('oculto', calc); $('#infoClave').classList.toggle('oculto', calc || pl);
}
// campos de «Partir las lamas» (se enseñan los que hacen falta)
function ponerPartir() {
  { const Md = Object.assign({ modo: 'no', n: 2, medidas: '' }, P.pared.modulos || {}), hor = (P.relieve || {}).orient === 'h';
    $('#mdTit').textContent = hor ? 'Dividir a lo alto (filas)' : 'Dividir a lo ancho (columnas)';
    $('#mdMedTit').textContent = hor ? 'Altos (mm, desde abajo)' : 'Anchos (mm, desde la izquierda)';
    $('#mdModo').value = Md.modo; $('#mdN').value = Md.n; if (document.activeElement !== $('#mdMedidas')) $('#mdMedidas').value = Md.medidas || '';
    $('#filaMdN').classList.toggle('oculto', Md.modo !== 'iguales'); $('#filaMdMedidas').classList.toggle('oculto', Md.modo !== 'medidas');
    $('#filaMdHueco').classList.toggle('oculto', Md.modo === 'no'); $('#mdHueco').value = Md.hueco || '';
    const ms = (R && R.modulosPared) || [];
    $('#mdInfo').textContent = Md.modo !== 'no' && ms.length > 1 ? `${ms.length} módulos: ${ms.map((m, j) => `M${j + 1} ${fmt(m.ancho)} mm (${m.n} lamas)`).join(' · ')}. Cada corte va al hueco entre dos lamas más cercano.` : '';
    $('#mdInfo').classList.toggle('oculto', !$('#mdInfo').textContent); }
  const Pp = Object.assign({ modo: 'no', alturas: '', largoMax: 0, junta: 'tope', sombra: 8, patron: 'alineado', desfase: 300, rastreles: true }, P.pared.partir || {}), hor = (P.relieve || {}).orient === 'h';
    $('#ptModo').value = Pp.modo; $('#ptCampos').classList.toggle('oculto', Pp.modo === 'no');
    if (document.activeElement !== $('#ptAlturas')) $('#ptAlturas').value = Pp.alturas || '';
    $('#ptAlturasTit').textContent = hor ? 'Juntas a (mm desde la izquierda)' : 'Juntas a (mm desde abajo)';
    $('#filaPtAlturas').classList.toggle('oculto', Pp.modo !== 'alturas'); $('#filaPtMax').classList.toggle('oculto', Pp.modo !== 'auto');
    $('#ptMax').value = Pp.largoMax || ''; $('#ptJunta').value = Pp.junta; $('#ptSombra').value = Pp.sombra; $('#filaPtSombra').classList.toggle('oculto', Pp.junta !== 'sombra');
    $('#ptPatron').value = Pp.patron; $('#ptDesfase').value = Pp.desfase; $('#filaPtDesfase').classList.toggle('oculto', Pp.patron === 'alineado');
    $('#ptRast').checked = Pp.rastreles !== false; $('#filaPtRast').classList.toggle('oculto', Pp.patron !== 'alineado');
}
function ponerControles() {
  llenarPlantillas(); llenarLetras(); refrescarHuecos();
  const C = P.costillas, V = P.varillas;
  const op = [...$('#cGrosor').options].map(o => o.value);
  if (op.includes(String(C.grosor))) { $('#cGrosor').value = String(C.grosor); $('#filaGrosorOtro').classList.add('oculto'); }
  else { $('#cGrosor').value = 'otro'; $('#cGrosorOtro').value = C.grosor; $('#filaGrosorOtro').classList.remove('oculto'); }
  $('#cModo').value = C.modo; $('#cSep').value = C.separacion; $('#cNum').value = C.numero;
  $('#filaSep').classList.toggle('oculto', C.modo !== 'separacion'); $('#filaNum').classList.toggle('oculto', C.modo !== 'numero');
  $('#cBase').checked = C.base; $('#cTope').checked = C.tope; $('#cTopeAlt').value = C.topeAlt; $('#filaTope').classList.toggle('oculto', !C.tope);
  $('#cMaterial').value = C.material; $('#cColor').value = C.color; $('#filaColor').classList.toggle('oculto', !MATERIALES[C.material].color);
  $('#vTipo').value = V.tipo; $('#vDiam').value = String(V.diam); $('#vHolgura').value = V.holgura; $('#vMargen').value = V.margen;
  $('#vTramo').value = V.tramo; $('#vSep').checked = V.separadores; $('#vSepD').value = V.sepD; $('#vSobra').value = V.sobra; $('#vAutoN').value = V.autoN;
  $('#filaSepD').classList.toggle('oculto', !conSeparadores()); $('#vSep').closest('label').classList.toggle('oculto', V.tipo === 'madera');
  $('#kInterp').value = P.interp;
  $('#sTipo').value = P.tipo; const Rt = P.reticula; $('#rNum').value = Rt.num; $('#rMargen').value = Rt.margen; $('#rVuelo').value = Rt.vuelo; $('#rHolgura').value = Rt.holgura; $('#rArriba').value = Rt.xArriba !== false ? '1' : '0';
  const Pl = P.planta; $('#plForma').value = Pl.forma; $('#plRadio').value = Pl.radio; $('#plSentido').value = String(Pl.sentido === -1 ? -1 : 1); $('#plAmp').value = Pl.amplitud; $('#plOndas').value = Pl.ondas;
  const Ra = P.radial; $('#raNum').value = P.costillas.numero; $('#raTubo').value = Ra.tubo; $('#raHolTubo').value = Ra.holguraTubo; $('#raDiscos').value = Ra.discos; $('#raRDisco').value = Ra.rDisco; $('#raHolgura').value = Ra.holgura;
  ponerPartir();
  $('#plHolgura').value = planoP().holgura; $('#pzRejilla').value = $('#kRejilla').value;
  const Pa = P.pared; $('#paNum').value = Pa.rastreles; $('#paAlto').value = Pa.alto; $('#paGrueso').value = Pa.grueso; $('#paMargen').value = Pa.margen; $('#paHolgura').value = Pa.holgura; $('#paVer').checked = Pa.verPared;
  $('#cClaves3d').checked = P.vista.claves !== false;
  const Fg = P.figura; $('#fgAlto').value = Fg.alto; $('#fgEje').value = Fg.eje; $('#fgGiro').value = String(Fg.giro || 0); $('#fgMin').value = Fg.minArea; $('#fgUnir').checked = Fg.unir !== false;
  $('#fgInfo').textContent = Fg.malla ? `Modelo: ${Fg.malla.nombre} (${Fg.malla.nt.toLocaleString('es-ES')} triángulos${Fg.malla.original > Fg.malla.nt ? ', reducido de ' + Fg.malla.original.toLocaleString('es-ES') : ''}).` + (figuraActiva() ? ` La figura mide ${fmt(mallaFigura().largo)} × ${fmt(mallaFigura().ancho)} × ${fmt(mallaFigura().alto)} mm.` : '') : 'Sin modelo. Carga un STL u OBJ: cada costilla será un corte de verdad del modelo.';
  const Rl = P.relieve; $('#sOrigen').value = P.tipo === 'pared' ? Rl.fuente : (figuraActiva() ? 'figura' : 'plantilla'); $('#paOrient').value = Rl.orient || 'v';
  $('#rlTexto').value = Rl.texto; $('#rlLetra').value = Rl.letra; $('#rlNegrita').checked = Rl.negrita; $('#rlTam').value = Rl.tamLetra; $('#rlInter').value = Rl.interlinea;
  $('#rlVista').value = Rl.vista; $('#rlGiro').value = String(Rl.giro || 0); $('#rlBase').value = Rl.base;
  $('#rlAncho').value = Rl.ancho; $('#rlAlto').value = Rl.alto; $('#rlFondo').value = Rl.fondo; $('#rlRelieve').value = Rl.relieve; $('#rlSuave').value = Rl.suavizado; $('#rlInvertir').checked = Rl.invertir; $('#rlOnda').value = Rl.ondaAmp; $('#rlOndas').value = Rl.ondas;
  $('#rlModeloInfo').textContent = Rl.modelo ? `Modelo: ${Rl.modelo.nombre}` + (Rl.modelo.triangulos ? ` (${Rl.modelo.triangulos.toLocaleString('es-ES')} triángulos)` : '') + (mallaVigente() || Rl.modelo.ejemplo ? '' : '. El proyecto guarda su relieve; para cambiar la vista, vuelve a cargarlo.') : 'Sin modelo. Carga un STL u OBJ (rostro, figura, logo en 3D…).';
  $('#rlGama').value = Rl.gama || 1;
  const Ca = Rl.capa; $('#caActiva').checked = Ca.activa; $('#caCampos').classList.toggle('oculto', !Ca.activa); $('#caTexto').value = Ca.texto; $('#caLetra').value = Ca.letra;
  $('#caNegrita').checked = Ca.negrita; $('#caTam').value = Ca.tamLetra; $('#caRelieve').value = Ca.relieve; $('#caModo').value = Ca.modo; $('#caX').value = Ca.x; $('#caY').value = Ca.y;
  $('#rlImagenInfo').textContent = Rl.imagen ? `Imagen: ${Rl.imagen.nombre} (${Rl.imagen.w} × ${Rl.imagen.h} px). Lo blanco sale más.` : 'Sin imagen. Carga una foto o un dibujo: lo blanco sale más y lo negro queda en el fondo.';
  mostrarSecciones();
  const M = P.maqueta; $('#mActiva').checked = M.activa; $('#mEscala').value = String(M.escala); $('#mGrosor').value = M.grosor; $('#mDiam').value = M.diam; $('#mHolgura').value = M.holgura;
  $('#rExplosion').value = P.vista.explosion; $('#cFantasma').checked = P.vista.fantasma; $('#cVarillas3d').checked = P.vista.varillas; $('#cResalta').checked = P.vista.resalta; $('#cRasante').checked = !!P.vista.rasante; $('#rRasante').value = P.vista.rasAng || 30; $('#rRasante').classList.toggle('oculto', !P.vista.rasante);
  construirParams();
}

function costillaDeClave() {
  if (!R || formaCalculada() || P.tipo === 'radial') return;
  const k = clavesOrdenadas()[UI.clave]; if (!k) return;
  let mej = -1, md = Infinity; R.costillas.forEach((c, j) => { if (!c.ok) return; const d = Math.abs(c.x - k.x); if (d < md) { md = d; mej = j; } });
  if (mej >= 0 && md <= Math.max(grosor(), (R.sep || 0) / 2) && mej !== UI.costilla) { UI.costilla = mej; refrescarCostilla(); encuadrarCostilla(); resaltar3D(); const li = $('#listaCost').children[mej]; if (li) li.scrollIntoView({ block: 'nearest' }); }
}
function refrescarClaves() {
  const C = clavesOrdenadas(); UI.clave = clamp(UI.clave, 0, C.length - 1);
  const s = $('#sClave'); s.innerHTML = '';
  C.forEach((k, i) => s.add(new Option(`Perfil clave ${i + 1}`, i)));
  s.value = UI.clave;
  const k = C[UI.clave];
  $('#infoClave').textContent = P.tipo === 'radial' ? `a ${fmt(k.x, 1)}°` : `en x = ${fmt(k.x)} mm (${fmt(k.x / P.largo * 100)} %)`;
  if (G.modelo) construirClaves3D();
  $('#kPos').value = k.x;
  $('#nClaves').textContent = C.length;
  const ul = $('#listaClaves'); ul.innerHTML = '';
  C.forEach((o, i) => {
    const li = document.createElement('li'); li.className = i === UI.clave ? 'sel' : '';
    li.innerHTML = `<span class="icono">◆</span><span class="nom">Perfil clave ${i + 1}</span><span class="pos">${P.tipo === 'radial' ? '' : 'x '}${textoPos(o.x)}</span>`;
    li.onclick = () => { UI.clave = i; UI.punto = -1; refrescarClaves(); VP.pintar(); costillaDeClave(); };
    ul.appendChild(li);
  });
  $('#avisoEditado').classList.toggle('oculto', !P.editado);
}

function refrescarListas() {
  // resumen del reparto
  if (esPlano()) { const nM = R.uniones.filter(u => u.tipo === 'media').length, nC = R.uniones.filter(u => u.tipo === 'caja').length;
    $('#plResumen').innerHTML = `<b>${R.n}</b> piezas · <b>${nM}</b> a media madera · <b>${nC}</b> en caja pasante · ranuras y cajas de <b>${fmt(grosor() + planoP().holgura, 2)}</b> mm`; }
  $('#resCost').innerHTML = P.tipo === 'radial' ? `<b>${R.n}</b> costillas cada <b>${fmt(R.sep, 1)}°</b> · junto al tubo quedan <b>${fmt(Math.max(0, R.hueco), 1)}</b> mm entre ellas`
    : `<b>${R.n}</b> ${P.tipo === 'pared' ? 'lamas' : 'costillas'} · separación <b>${fmt(R.sep, 1)}</b> mm · hueco <b>${fmt(Math.max(0, R.hueco), 1)}</b> mm`;
  // costillas y largueros
  const ret = P.tipo === 'reticula';
  $('#nCost').textContent = R.n + (R.otras.length ? ' + ' + R.otras.length : '');
  const malas = new Set(); R.avisos.forEach(a => { if (a.tipo === 'error') R.varillas.forEach(v => v.fallan.forEach(i => malas.add(i))); });
  if (esPlano()) { R.costillas.forEach(c => { if (!c.ok || !c.uniones.length) malas.add(c.i); }); (R.ranurasMal || []).forEach(p => malas.add(p.i)); (R.pisan || []).forEach(q => malas.add(q[0])); }
  else if (P.tipo === 'costillas') R.costillas.forEach(c => { if (!c.ok || (P.varillas.lista.length && c.nVar === 0)) malas.add(c.i); });
  else if (!ret) { R.costillas.forEach(c => { if (!c.ok) malas.add(c.i); }); (R.ranurasMal || []).forEach(p => malas.add(p.i)); (R.discosMal || []).forEach(d => malas.add(d.i)); (R.rastrelesMal || []).forEach(i => malas.add(i)); }
  else { R.costillas.forEach(c => { if (!c.ok || !c.ranuras.length) malas.add(c.i); }); (R.ranurasMal || []).forEach(p => malas.add(p.i)); }
  const ul = $('#listaCost'); ul.innerHTML = '';
  [...R.costillas, ...R.otras].forEach(c => {
    const li = document.createElement('li'); li.className = c.i === UI.costilla ? 'sel' : '';
    li.innerHTML = `<span class="icono">${malas.has(c.i) ? '<span class="mal">!</span>' : c.plano ? { lado: '◧', frente: '▭', horizontal: '▱' }[c.plano] : c.disco ? '◎' : c.z ? '▬' : '▮'}</span><span class="nom">${c.nombre}</span><span class="med">${c.ok ? fmt(c.caja.w) + ' × ' + fmt(c.caja.h) : 'vacía'}</span>`;
    li.onclick = () => selCostilla(c.i);
    ul.appendChild(li);
  });
  // avisos
  const av = $('#avisos'); av.innerHTML = '';
  R.avisos.forEach(a => {
    const li = document.createElement('li'); li.className = a.tipo; li.textContent = a.txt;
    if (a.cost != null) { li.dataset.cost = a.cost; li.title = 'Ver la pieza'; li.onclick = () => selCostilla(a.cost); }
    av.appendChild(li);
  });
  $('#nAvisos').textContent = R.avisos.filter(a => a.tipo === 'error' || a.tipo === 'atencion').length;
  // resumen (siempre a tamaño real)
  const cm = calcularCompra(), largoV = cm.varillas.reduce((a, v) => a + v.largo, 0);
  $('#resumen').innerHTML = `<table>
    <tr><td>Medidas totales</td><td>${(G.dims || [0, 0, 0]).map(v => fmt(v)).join(' × ')} mm</td></tr>
    <tr><td>${esPlano() ? 'Piezas' : P.tipo === 'pared' ? 'Lamas' : 'Costillas'}</td><td>${R.n} de ${fmt(grosor(), 1)} mm</td></tr>
    <tr><td>Superficie de tablero</td><td>${fmt(cm.area / 1e6, 2)} m²</td></tr>
    <tr><td>Tableros ${fmt(cm.tablero[0])}×${fmt(cm.tablero[1])}</td><td>${cm.nTableros}</td></tr>
    ${esPlano() ? `<tr><td>Uniones a media madera</td><td>${R.uniones.filter(u => u.tipo === 'media').length}</td></tr><tr><td>Espigas en caja pasante</td><td>${R.uniones.filter(u => u.tipo === 'caja').length}</td></tr><tr><td>Ancho de ranuras y cajas</td><td>${fmt(grosor() + planoP().holgura, 2)} mm</td></tr>`
    : P.tipo === 'radial' ? `<tr><td>Tubo central</td><td>Ø ${fmt(P.radial.tubo)} mm</td></tr><tr><td>Discos de unión</td><td>${R.discos.length}</td></tr>`
    : P.tipo === 'pared' ? `<tr><td>Rastreles ${fmt(P.pared.alto)} × ${fmt(P.pared.grueso)}</td><td>${R.rastreles.length} de ${fmt(P.largo)} mm</td></tr>`
    : ret ? `<tr><td>Largueros</td><td>${R.largueros.length} de ${fmt(grosor(), 1)} mm</td></tr>
    <tr><td>Cruces a media madera</td><td>${R.cruces.length}</td></tr>
    <tr><td>Ancho de las ranuras</td><td>${fmt(grosor() + P.reticula.holgura, 2)} mm</td></tr>` : `
    <tr><td>${esc(VARILLA_TIPOS[P.varillas.tipo].nombre)} Ø${P.varillas.diam}</td><td>${cm.varillas.length} · ${fmt(largoV)} mm</td></tr>
    ${cm.nSep ? `<tr><td>Separadores Ø${P.varillas.sepD} × ${cm.sepMax - cm.sepMin > 0.2 ? fmt(cm.sepMin) + '–' + fmt(cm.sepMax) : fmt(cm.sepMin, 1)}</td><td>${cm.nSep}</td></tr>` : ''}
    ${cm.nTuercas ? `<tr><td>Tuercas y arandelas M${P.varillas.diam}</td><td>${cm.nTuercas}</td></tr>` : ''}
    <tr><td>Broca para los agujeros</td><td>Ø ${fmt(P.varillas.diam + P.varillas.holgura, 1)} mm</td></tr>`}
  </table>`;
  mostrarSecciones();
  if (ret) { const mz = R.largueros.reduce((m, z) => Math.max(m, z.caja.w), 0); $('#resRet').innerHTML = `<b>${R.largueros.length}</b> largueros (hasta ${fmt(mz)} mm de largo) · <b>${R.cruces.length}</b> cruces · ranura de <b>${fmt(grosor() + P.reticula.holgura, 2)}</b> mm`; }
  // maqueta
  const M = P.maqueta;
  $('#secMaqueta').classList.toggle('activa', M.activa);
  $('#maqCtl').classList.toggle('oculto', !M.activa);
  $('#bFabricar').innerHTML = '<span>🪚</span><span class="txt"> Fabricar</span>' + (M.activa ? '<span class="barra-maq">1:' + M.escala + '</span>' : '');
  if (M.activa) {
    const cf = calcularCompraFab(), mayor = R.costillas.reduce((m, c) => c.ok && c.caja.w * c.caja.h > m.w * m.h ? c.caja : m, { w: 0, h: 0 }), k = 1 / M.escala;
    $('#resMaq').innerHTML = `Mueble de <b>${(G.dims || [0, 0, 0]).map(v => fmt(v * k)).join(' × ')}</b> mm · ` + (P.tipo === 'radial' ? '' : `separación <b>${fmt(cf.sep, 1)}</b> mm · hueco <b>${fmt(Math.max(0, cf.hueco), 1)}</b> mm · `) + ` costilla mayor ${fmt(mayor.w * k)} × ${fmt(mayor.h * k)} mm · <b>${cf.nTableros}</b> tablero${cf.nTableros === 1 ? '' : 's'} de ${fmt(cf.tablero[0])} × ${fmt(cf.tablero[1])}`;
  }
  $('#version').textContent = 'v' + VERSION;
  document.title = (P.nombre ? P.nombre + ' — ' : '') + 'Made-rebanadas';
}

// compra del mueble a tamaño real, aunque esté activa la maqueta
function calcularCompra() {
  const a = P.maqueta.activa; P.maqueta.activa = false;
  try { return calcularCompraFab(); } finally { P.maqueta.activa = a; }
}

// convertir texto, modelo, imagen o figura en perfiles clave, eligiendo cuántos perfiles y cuántos puntos
function dialogoConvertir() {
  const fig = figuraActiva(), que = fig ? 'la figura' : ({ texto: 'el texto', modelo: 'el modelo 3D', imagen: 'la imagen' }[P.relieve.fuente] || 'el relieve');
  const nCost = R ? R.costillas.filter(c => c.ok).length : 2, maxK = Math.max(2, Math.min(60, nCost));
  modal('✏ Convertir en perfiles editables', `
    <p>Se va a convertir ${que} en <b>perfiles clave</b>, para que puedas mover, añadir o quitar puntos y perfiles a mano.</p>
    <label class="fila" title="Uno por ${fig ? 'costilla' : 'lama'} reproduce la forma exacta; con menos, las de en medio se calculan mezclando">Perfiles clave <input type="number" id="cvK" min="2" max="${maxK}" step="1" value="${maxK}"></label>
    <p class="nota">Hay ${nCost} ${fig ? 'costillas' : 'lamas'}: con ${maxK} perfiles, uno en cada una (como mucho 60). Con menos perfiles es más fácil de editar; las piezas de en medio se calculan mezclando los de los lados.</p>
    <label class="fila" title="Menos puntos = más fácil de editar, pero la forma se suaviza">Puntos por perfil <input type="number" id="cvN" min="6" max="90" step="1" value="${fig ? 20 : 16}"></label>
    <p class="nota">Con 12 a 24 puntos suele bastar. Se quitan primero los puntos que menos cambian la forma. Después puedes simplificar más con «✂ Simplificar puntos».</p>
    <div style="margin-top:8px;padding:8px 10px;border-left:4px solid #d9822b;background:rgba(217,130,43,.12);border-radius:4px">⚠ <b>Este cambio no se puede revertir</b>: ya no podrás volver a ${que} ni cambiar sus medidas (solo con ↶ Deshacer, antes de cerrar). Si quieres conservarlo, guarda antes una copia del proyecto.</div>`,
    [['✏ Convertir', () => {
      const k = clamp(Math.round(+$('#cvK').value || maxK), 2, maxK), np = clamp(Math.round(+$('#cvN').value || 20), 6, 90);
      cerrarModal();
      const n = fig ? convertirFiguraEnPerfiles(k) : convertirRelieveEnPerfiles(k); if (!n) return;
      const pts = simplificarPerfiles(np);
      UI.clave = Math.floor(n / 2); UI.punto = -1;
      R = calcular();
      if (P.tipo === 'costillas' && R.varillas && R.varillas.some(v => v.fallan && v.fallan.length)) autoVarillas(P.varillas.autoN);   // las varillas que ya no caben se recolocan
      ponerControles(); cambio(`Convertido en ${n} perfiles de ${pts} puntos`); encuadrarSiHaceFalta(); encuadrarPerfil(); camara('tres4');
      aviso(`Convertido en ${n} perfiles clave de ${pts} puntos. Ya puedes editar los puntos en la vista del perfil.`, 5000);
    }, true]]);
}
// quitar puntos a todos los perfiles clave a la vez
function dialogoSimplificar() {
  if (formaCalculada() || !P.claves.length) return;
  const n0 = P.claves[0].pts.length, min = Math.max(3, P.esquinas.filter(Boolean).length + 2);
  modal('✂ Simplificar puntos', `
    <p>Los perfiles clave tienen ahora <b>${n0} puntos</b> cada uno. Elige con cuántos quedarse: se quitan a la vez en todos los perfiles, primero los que menos cambian la forma. Las esquinas no se quitan.</p>
    <label class="fila">Puntos por perfil <input type="number" id="smN" min="${min}" max="${n0}" step="1" value="${Math.max(min, Math.round(n0 / 2))}"></label>
    <p class="nota">Se puede deshacer con ↶.</p>`,
    [['✂ Simplificar', () => {
      const n = simplificarPerfiles(+$('#smN').value || n0); cerrarModal(); UI.punto = -1;
      R = calcular();
      if (P.tipo === 'costillas' && R.varillas && R.varillas.some(v => v.fallan && v.fallan.length)) autoVarillas(P.varillas.autoN); ponerControles(); cambio(`Perfiles de ${n} puntos`); aviso(`Perfiles simplificados: ${n} puntos cada uno.`);
    }, true]]);
}

/* ---------- piezas planas: la pieza seleccionada ---------- */
function refrescarPiezaSel() {
  if (!esPlano()) return;
  const ps = planoP().piezas, k = UI.costilla, p = ps[k]; if (!p) return;
  $('#pzNombre').value = p.nombre || ''; $('#pzPlano').value = p.plano; $('#pzPos').value = p.c;
  $('#pzPosTit').textContent = `Posición en ${PLANOS[p.plano].normal} (mm)`;
  const par = p.igualA != null && ps[p.igualA] ? ps[p.igualA] : null, hijos = ps.filter(q => q.igualA === k);
  const ig = $('#pzIgual'); ig.classList.toggle('oculto', !par && !hijos.length);
  ig.textContent = par ? `Igual que «${par.nombre}»: al mover sus puntos cambian las dos.` : hijos.length ? `«${hijos.map(q => q.nombre).join('», «')}» ${hijos.length > 1 ? 'son iguales' : 'es igual'} que esta: al mover sus puntos cambian todas.` : '';
  $('#pzSeparar').disabled = !par;
}
// pasa la pieza k a tener su propio contorno (deja de ser igual que otra)
function separarPieza(k) {
  const ps = planoP().piezas, p = ps[k]; if (!p || p.igualA == null) return;
  const src = piezaFuente(k); p.pts = clonar(src.pts); p.esq = clonar(src.esq || src.pts.map(() => true)); delete p.igualA;
}
function iniciarPiezas() {
  const pz = () => planoP().piezas[UI.costilla];
  $('#pzNombre').onchange = () => { const p = pz(); if (!p) return; p.nombre = $('#pzNombre').value.trim() || p.nombre; cambio('Nombre: ' + p.nombre); };
  $('#pzPlano').onchange = () => { const p = pz(); if (!p) return; p.plano = $('#pzPlano').value; P.editado = true; cambio('Dirección: ' + PLANOS[p.plano].nombre.toLowerCase()); };
  $('#pzPos').onchange = () => { const p = pz(); if (!p) return; const v = +$('#pzPos').value; if (!isFinite(v)) return; p.c = Math.round(v * 10) / 10; P.editado = true; cambio('Posición de ' + p.nombre + ': ' + fmt(p.c) + ' mm'); };
  $('#pzRejilla').onchange = () => { $('#kRejilla').value = $('#pzRejilla').value; };
  $('#pzNueva').onclick = () => {
    const ps = planoP().piezas, b = R && R.bbox ? R.bbox : [[-200, 200], [0, 400], [-150, 150]];
    const w = Math.max(100, Math.round((b[0][1] - b[0][0]) * 0.6)), h = Math.max(60, Math.round((b[1][1] - b[1][0]) * 0.3)), yc = Math.round((b[1][0] + b[1][1]) / 2);
    ps.push({ nombre: 'Pieza ' + (ps.length + 1), plano: 'frente', c: 0, pts: [[-w / 2, yc - h / 2], [w / 2, yc - h / 2], [w / 2, yc + h / 2], [-w / 2, yc + h / 2]], esq: [true, true, true, true] });
    P.editado = true; cambio('Pieza nueva'); selCostilla(ps.length - 1);
  };
  $('#pzCopiar').onclick = () => {
    const ps = planoP().piezas, p = pz(); if (!p) return;
    const src = piezaFuente(UI.costilla), q = { nombre: p.nombre + ' (copia)', plano: p.plano, c: Math.round((p.c + Math.max(60, 3 * grosor())) * 10) / 10, pts: clonar(src.pts), esq: clonar(src.esq || src.pts.map(() => true)) };
    ps.push(q); P.editado = true; cambio('Pieza copiada'); selCostilla(ps.length - 1);
  };
  $('#pzSimetrica').onclick = () => {
    const ps = planoP().piezas, k = UI.costilla, p = pz(); if (!p) return;
    const ctr = R && R.bbox ? (R.bbox[PLANOS[p.plano].n][0] + R.bbox[PLANOS[p.plano].n][1]) / 2 : 0, c2 = Math.round((2 * ctr - p.c) * 10) / 10;
    if (Math.abs(c2 - p.c) < grosor()) { aviso('Esta pieza está en el centro: su simétrica caería en el mismo sitio. Muévela antes (Posición).', 5000); return; }
    const base = p.igualA != null ? p.igualA : k;
    ps.push({ nombre: p.nombre + ' (simétrica)', plano: p.plano, c: c2, igualA: base });
    P.editado = true; cambio('Pieza simétrica'); selCostilla(ps.length - 1);
  };
  $('#pzSeparar').onclick = () => { const p = pz(); if (!p || p.igualA == null) return; separarPieza(UI.costilla); P.editado = true; cambio(p.nombre + ': contorno propio'); refrescarPiezaSel(); };
  $('#pzQuitar').onclick = () => {
    const ps = planoP().piezas, k = UI.costilla, p = pz(); if (!p) return;
    if (ps.length <= 1) { aviso('Tiene que quedar al menos una pieza.'); return; }
    if (!confirm(`¿Quitar «${p.nombre}»?`)) return;
    ps.forEach((q, j) => { if (q.igualA === k) separarPieza(j); });
    ps.splice(k, 1); ps.forEach(q => { if (q.igualA != null && q.igualA > k) q.igualA--; });
    UI.costilla = Math.max(0, k - 1); UI.piezaVista = -1; P.editado = true; cambio('Pieza quitada'); selCostilla(UI.costilla);
  };
  $('#pzDXF').onclick = dialogoPiezaDXF;
}
function dialogoPiezaDXF() {
  const k = UI.costilla, p = planoP().piezas[k]; if (!p) return;
  pedirDXF((r, nombre) => {
    const L0 = r.lazos[0], cb = cajaDe(L0), src = piezaFuente(k), act = cajaDe(curvaCerrada(src.pts, src.esq || src.pts.map(() => true)));
    modal('📐 Contorno de la pieza desde un DXF o SVG', `
      <p class="nota"><b>${esc(nombre)}</b>: contorno de ${fmt(cb.w, 1)} × ${fmt(cb.h, 1)} mm con ${L0.length.toLocaleString('es-ES')} puntos${r.lazos.length > 1 ? ` (hay ${r.lazos.length} contornos cerrados: se usa el mayor)` : ''}.${r.aviso ? `<br>⚠ ${esc(r.aviso)}` : ''}</p>
      <p class="nota">Pasa a ser el contorno de <b>${esc(p.nombre)}</b>${p.igualA != null || planoP().piezas.some(q => q.igualA === k) ? ' (y de las piezas iguales a ella)' : ''}. En su plano, la horizontal es ${PLANOS[p.plano].ejes[0]} y la vertical ${PLANOS[p.plano].ejes[1]}.</p>
      <label class="fila">Medidas <select id="dxEsc"><option value="real">Las del dibujo (mm reales)</option><option value="ancho">Ajustar al ancho de la pieza de ahora</option></select></label>
      <label class="fila chk"><input type="checkbox" id="dxCentrar" checked> En el sitio de la pieza de ahora (mismo centro y misma base)</label>
      <label class="fila" title="Si el contorno tiene muchos puntos, se quitan primero los que menos cambian la forma">Dejar como mucho (puntos) <input type="number" id="dxPts" value="${Math.min(150, L0.length)}" min="4" max="2000" step="10"></label>`,
      [['✔ Traer el contorno', () => {
        let L = simplificarLazo(L0, clamp(+$('#dxPts').value || 150, 4, 2000));
        const kk = $('#dxEsc').value === 'ancho' && cb.w > 0.1 ? act.w / cb.w : 1;
        L = L.map(q => [q[0] * kk, q[1] * kk]);
        if ($('#dxCentrar').checked) { const c2 = cajaDe(L), dx = (act.x0 + act.w / 2) - (c2.x0 + c2.w / 2), dy = act.y0 - c2.y0; L = L.map(q => [q[0] + dx, q[1] + dy]); }
        // los tramos curvos del dibujo ya vienen con muchos puntos: todos como esquina (tramos rectos), así no se deforma
        src.pts = L.map(q => [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10]); src.esq = L.map(() => true);
        P.editado = true; cerrarModal(); cambio('Contorno desde ' + nombre); UI.piezaVista = -1; selCostilla(k);
      }, true]]);
  });
}

/* ===================== FABRICACIÓN: TABLEROS, DXF, SVG, DESPIECE ===================== */
const TABLEROS = [
  { n: '2440 × 1220 (estándar)', a: 2440, h: 1220 },
  { n: '2500 × 1250', a: 2500, h: 1250 },
  { n: '2500 × 1220', a: 2500, h: 1220 },
  { n: '1525 × 1525 (abedul báltico)', a: 1525, h: 1525 },
  { n: '2850 × 2070 (aglomerado / MDF)', a: 2850, h: 2070 },
  { n: '1220 × 1220 (medio tablero)', a: 1220, h: 1220 },
  { n: '1220 × 610 (cuarto de tablero)', a: 1220, h: 610 },
];
const TABLEROS_MAQ = [
  { n: '600 × 400 (láser)', a: 600, h: 400 },
  { n: '900 × 600 (láser)', a: 900, h: 600 },
  { n: '1000 × 600', a: 1000, h: 600 },
  { n: '420 × 297 (A3)', a: 420, h: 297 },
  { n: '1220 × 610 (cuarto de tablero)', a: 1220, h: 610 },
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
const piezasFab = () => [...R.costillas, ...(R.otras || [])].filter(c => c.ok);
const grosorDe = c => enMaqueta() ? grosorFab() : (c.grosorPieza || grosor());   // los muebles de los huecos pueden llevar otro grosor
const vetaOn = () => P.cnc.veta === 'si';
function vetaDe(c) { const v = (P.cnc.vetaPiezas || {})[c.nombre]; return v === 'y' || v === 'libre' ? v : 'x'; }
function ponVeta(c, v) { const m = P.cnc.vetaPiezas = P.cnc.vetaPiezas || {}; if (v === 'x') delete m[c.nombre]; else m[c.nombre] = v; }
const holguraRanuraFab = () => enMaqueta() ? P.maqueta.holgura : P.tipo === 'radial' ? P.radial.holgura : P.tipo === 'plano' ? planoP().holgura : P.reticula.holgura;
function geoFab(c) {
  const k = escalaFab();
  // las ranuras se rehacen con el grosor de fabricación (el de la maqueta, si lo es)
  const wF = (grosorFab() + holguraRanuraFab()) / k;
  let base = c.poly, esq = [];
  if (c.generar) { base = c.generar(wF); esq = base.esq || []; }
  else if (c.ranuras && c.ranuras.length) { const rr = ranurar(c.base, c.ranuras, wF); base = rr.poly; esq = rr.esq; }
  // hueso de perro en las esquinas interiores de ranuras y muescas (radio de la fresa)
  let huesosMal = 0, nHuesos = 0;
  if (conHueso() && esq.length) { const h = huesoDePerro(base, esq, fresaFab() / 2 / k); base = h.poly; huesosMal = h.fallan; nHuesos = esq.length - h.fallan; }
  // huecos: la pieza puede ser solo un trozo de la lama o costilla, y tener agujeros por dentro
  let int = c.int || [];
  if (c.generarInt) { int = c.generarInt(wF); if (conHueso()) int = int.map(h => huesoDePerro(h, h, fresaFab() / 2 / k).poly); }
  if (c.conHuecos && c.ranuras && c.ranuras.length && !c.modulo) { const q = parteFab(c, base); base = q.poly; int = q.int || []; }
  else if (c.conHuecos && !c.generar) base = c.poly;
  const poly = base.map(p => [p[0] * k, p[1] * k]), interiores = int.map(hh => hh.map(p => [p[0] * k, p[1] * k]));
  return {
    c, poly, interiores, caja: cajaDe(poly), r: radioFab(), area: Math.abs(c.area) * k * k, huesosMal, nHuesos, nEsq: esq.length,
    // agujeros [x, y, radio]: los de las varillas y los propios de la pieza (el tubo en los discos)
    agujeros: c.agujeros.map(j => [P.varillas.lista[j][0] * k, P.varillas.lista[j][1] * k, radioFab()]).concat((c.huecos || []).map(h => [h.x * k, h.y * k, h.r * k])),
    etiqueta: puntoEtiqueta(c).map(v => v * k),
  };
}
function fabDefecto(maq) {
  return maq ? { ancho: 600, alto: 400, borde: 5, sep: 4, girar: true, modo: 'tableros', numeros: true }
             : { ancho: 2440, alto: 1220, borde: 10, sep: 12, girar: true, modo: 'tableros', numeros: true };
}
// largos de los trozos de rastrel (cortados por huecos o por módulos), agrupados: «3 de 620 mm y 3 de 600 mm»
function trozosRastreles(k) {
  const L = []; R.rastreles.forEach(r => (r.tramos || []).forEach(([a, b]) => L.push(Math.round((b - a) * k))));
  return L;
}
function textoRastreles(k, cm) {
  const L = trozosRastreles(k); if (!L.length || (L.length === R.rastreles.length && L.every(v => Math.abs(v - L[0]) < 1))) return `${R.rastreles.length} de ${fmt(cm.rastrel)} mm`;
  const g = new Map(); L.forEach(v => g.set(v, (g.get(v) || 0) + 1));
  const t = [...g.entries()].sort((a, b) => b[0] - a[0]).map(([v, n]) => `${n} de ${fmt(v)} mm`);
  return (t.length > 1 ? t.slice(0, -1).join(', ') + ' y ' + t[t.length - 1] : t[0]) + ` (${L.length} trozos)`;
}
function fabActual() {
  const k = enMaqueta() ? 'fabMaq' : 'fab';
  return UI[k] || (UI[k] = fabDefecto(enMaqueta()));
}

// colocación por estantes (piezas por su rectángulo envolvente)
// con veta, las piezas marcadas no giran; cada grosor de tablero va en sus propios tableros
function colocarEnTableros(f) {
  const piezas = piezasFab().map(c => {
    const g = geoFab(c);
    let w = g.caja.w, h = g.caja.h, rot = false, fija = false;
    if (vetaOn()) { const v = vetaDe(c); if (v === 'y') { fija = true; rot = true; [w, h] = [h, w]; } else if (v === 'x') fija = true; }
    if (!fija && f.girar && h > w) { rot = true; [w, h] = [h, w]; }
    const W = f.ancho - 2 * f.borde, H = f.alto - 2 * f.borde;
    if (!fija && f.girar && (w > W || h > H) && h <= W && w <= H) { rot = !rot; [w, h] = [h, w]; }
    return { c, g, w, h, rot, e: grosorDe(c), cabe: w <= W + 1e-6 && h <= H + 1e-6 };
  });
  const grandes = piezas.filter(p => !p.cabe);
  const tableros = [];
  if (f.modo === 'fila') {
    let x = 0; const t = { piezas: [], ancho: 0, alto: 0, grosor: grosorFab() };
    piezas.sort((a, b) => a.c.i - b.c.i).forEach(p => { t.piezas.push({ ...p, x, y: 0 }); x += p.w + f.sep; t.alto = Math.max(t.alto, p.h); });
    t.ancho = Math.max(0, x - f.sep); tableros.push(t);
    return { tableros, grandes: [], uso: 0, grosores: [grosorFab()] };
  }
  const e0 = grosorFab(), grosores = [...new Set(piezas.map(p => p.e))].sort((a, b) => (a === e0 ? 0 : 1) - (b === e0 ? 0 : 1) || a - b);
  for (const eG of grosores) {
    const lista = piezas.filter(p => p.cabe && p.e === eG).sort((a, b) => b.h - a.h || b.w - a.w);
    const tabs = [];
    for (const p of lista) {
      let puesto = false;
      for (const t of tabs) {
        for (const e of t.estantes) if (p.h <= e.h + 1e-6 && e.x + p.w <= f.ancho - f.borde + 1e-6) { t.piezas.push({ ...p, x: e.x, y: e.y }); e.x += p.w + f.sep; puesto = true; break; }
        if (puesto) break;
        const yN = t.yLibre;
        if (yN + p.h <= f.alto - f.borde + 1e-6) {
          const e = { y: yN, h: p.h, x: f.borde }; t.estantes.push(e); t.yLibre = yN + p.h + f.sep;
          t.piezas.push({ ...p, x: e.x, y: e.y }); e.x += p.w + f.sep; puesto = true; break;
        }
      }
      if (!puesto) {
        const t = { piezas: [], estantes: [], yLibre: f.borde, ancho: f.ancho, alto: f.alto, grosor: eG };
        const e = { y: f.borde, h: p.h, x: f.borde }; t.estantes.push(e); t.yLibre = f.borde + p.h + f.sep;
        t.piezas.push({ ...p, x: e.x, y: e.y }); e.x += p.w + f.sep; tabs.push(t);
      }
    }
    tabs.forEach(t => tableros.push(t));
  }
  const areaP = piezas.reduce((s, p) => s + p.g.area, 0);
  return { tableros, grandes, uso: tableros.length ? areaP / (tableros.length * f.ancho * f.alto) : 0, grosores };
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
  const maq = enMaqueta() ? `<div class="aviso-maq">Maqueta <b>1:${P.maqueta.escala}</b>: ${esPlano() ? 'piezas' : 'costillas'} a escala, tablero de ${fmt(P.maqueta.grosor, 1)} mm y ${P.tipo === 'costillas' ? `agujeros de Ø ${fmt(P.maqueta.diam + P.maqueta.holgura, 2)} mm` : `ranuras de ${fmt(P.maqueta.grosor + P.maqueta.holgura, 2)} mm`}. Para el mueble real, quita «Fabricar como maqueta» en el panel izquierdo.</div>` : '';
  modal('🪚 Fabricar: ' + (esPlano() ? 'piezas' : P.tipo === 'pared' ? 'lamas' : 'costillas') + ' en tableros' + (enMaqueta() ? ' · maqueta 1:' + P.maqueta.escala : ''), `${maq}
    <div class="fab">
      <div class="opc">
        <label class="fila">Colocación <select id="fModo"><option value="tableros">En tableros</option><option value="fila">En fila (sin tablero)</option></select></label>
        <label class="fila">Tablero <select id="fTab">${ops}<option value="otro">Otro…</option></select></label>
        <label class="fila">Ancho (mm) <input type="number" id="fA" value="${f.ancho}" min="50" step="1"></label>
        <label class="fila">Alto (mm) <input type="number" id="fH" value="${f.alto}" min="50" step="1"></label>
        <label class="fila" title="Margen sin piezas en todo el borde del tablero">Margen al borde (mm) <input type="number" id="fB" value="${f.borde}" min="0" step="1"></label>
        <label class="fila" title="Espacio entre piezas: al menos el diámetro de la fresa más unos milímetros (en láser, 2 a 4 mm)">Separación entre piezas (mm) <input type="number" id="fS" value="${f.sep}" min="0" step="1"></label>
        <label class="fila chk"><input type="checkbox" id="fG" ${f.girar ? 'checked' : ''}> Permitir girar 90° (cuida la veta)</label>
        <label class="fila" title="Con veta, las piezas no se giran: su dirección marcada va a lo largo del tablero. Clic en una pieza de la vista para cambiarle la veta">Veta del tablero <select id="fVeta"><option value="no">Sin veta (da igual el giro)</option><option value="si">A lo largo (las piezas la siguen)</option></select></label>
        <label class="fila chk"><input type="checkbox" id="fN" ${f.numeros ? 'checked' : ''}> Grabar el número (o la letra) en cada pieza</label>
        <h4>CNC</h4>
        <label class="fila" title="${enMaqueta() ? 'En láser, 0 (sin hueso de perro)' : 'Diámetro de la fresa de corte'}">Ø de la fresa${enMaqueta() ? ' (maqueta)' : ''} (mm) <input type="number" id="fFresa" value="${fresaFab()}" min="0" step="0.5"></label>
        <label class="fila chk" title="Círculos en las esquinas interiores de ranuras y muescas, para que la pieza que entra llegue al fondo"><input type="checkbox" id="fHueso" ${P.cnc.hueso ? 'checked' : ''}> Hueso de perro en ranuras y muescas</label>
        <label class="fila chk" title="El contorno sale en rectas y arcos (G01, G02, G03) en vez de muchos tramos rectos"><input type="checkbox" id="fArcos" ${P.cnc.arcos ? 'checked' : ''}> Contornos con arcos</label>
        <label class="fila" title="Lo que se puede separar el arco de la curva original">Tolerancia de los arcos (mm) <input type="number" id="fTol" value="${P.cnc.tolArco}" min="0.005" max="1" step="0.01"></label>
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
    P.cnc.veta = $('#fVeta').value;
    const fr = Math.max(0, +$('#fFresa').value || 0); if (enMaqueta()) P.maqueta.fresa = fr; else P.cnc.fresa = fr;
    P.cnc.hueso = $('#fHueso').checked; P.cnc.arcos = $('#fArcos').checked; P.cnc.tolArco = clamp(+$('#fTol').value || 0.05, 0.005, 1);
    UI.sucio = true;
    previsualizarFab();
  };
  $('#fModo').value = f.modo; $('#fVeta').value = vetaOn() ? 'si' : 'no';
  if (!lista.some(t => t.a === f.ancho && t.h === f.alto)) $('#fTab').value = 'otro';
  ['#fTab', '#fB', '#fS', '#fG', '#fN', '#fModo', '#fVeta', '#fFresa', '#fHueso', '#fArcos', '#fTol'].forEach(s => $(s).onchange = leer);
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
      ctx.fillStyle = opciones.texto || cssVar('--suave'); ctx.font = '11px system-ui'; ctx.fillText(`Tablero ${b + 1}: ${t.piezas.length} piezas` + ((col.grosores || []).length > 1 ? ` · ${fmt(t.grosor, 1)} mm` : ''), ox, oy - 6);
    }
    t.piezas.forEach(pz => {
      ctx.beginPath();
      pz.g.poly.forEach((p, i) => { const [x, y] = P2(...aTablero(pz, p)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath();
      (pz.g.interiores || []).forEach(hh => { hh.forEach((p, i) => { const [x, y] = P2(...aTablero(pz, p)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); });
      ctx.fillStyle = 'rgba(168,116,63,.35)'; ctx.fill('evenodd'); ctx.strokeStyle = '#7a5226'; ctx.stroke();
      pz.g.agujeros.forEach(q => { const [x, y] = P2(...aTablero(pz, q)); ctx.beginPath(); ctx.arc(x, y, Math.max(1.2, q[2] * sc), 0, PI2); ctx.strokeStyle = '#c0392b'; ctx.stroke(); });
      if (f.numeros) {
        const [x, y] = P2(...aTablero(pz, pz.g.etiqueta));
        ctx.fillStyle = '#1f4f8a'; ctx.font = 'bold 10px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(pz.c.etq, x, y);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      }
      if (opciones.veta) {
        // rayitas con la dirección de la veta de la pieza (en el tablero siempre salen a lo largo)
        const v = vetaDe(pz.c);
        if (v !== 'libre') {
          const et = pz.g.etiqueta, L2 = clamp(Math.min(pz.g.caja.w, pz.g.caja.h) * 0.3, 6, 36) / 2, [ux, uy] = v === 'y' ? [0, 1] : [1, 0];
          const [ax, ay] = P2(...aTablero(pz, [et[0] - L2 * ux, et[1] - L2 * uy])), [bx, by] = P2(...aTablero(pz, [et[0] + L2 * ux, et[1] + L2 * uy]));
          const dx = bx - ax, dy = by - ay, dL = Math.hypot(dx, dy) || 1, px = -dy / dL, py = dx / dL;
          ctx.strokeStyle = 'rgba(122, 82, 38, .5)'; ctx.lineWidth = 1;
          [-1, 0, 1].forEach(k => { const o = (f.numeros ? 9 : 0) + k * 3.5; ctx.beginPath(); ctx.moveTo(ax + px * o, ay + py * o); ctx.lineTo(bx + px * o, by + py * o); ctx.stroke(); });
        }
      }
      if (opciones.cajas) {
        const [x0, y0] = P2(pz.x, pz.y), [x1, y1] = P2(pz.x + pz.w, pz.y + pz.h);
        opciones.cajas.push({ x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1), c: pz.c });
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
  const cajas = [];
  dibujarTableros(ctx, col, f, Wc, { veta: vetaOn(), cajas });
  cv.onclick = ev => {
    if (!vetaOn()) return;
    const r = cv.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
    const hit = cajas.find(b => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1);
    if (!hit) return;
    const v = vetaDe(hit.c); ponVeta(hit.c, v === 'x' ? 'y' : v === 'y' ? 'libre' : 'x');
    UI.sucio = true; previsualizarFab();
  };
  const info = [];
  const varios = (col.grosores || []).length > 1;
  if (f.modo === 'fila') info.push(`${piezasFab().length} piezas en fila: ${fmt(col.tableros[0] ? col.tableros[0].ancho : 0)} × ${fmt(col.tableros[0] ? col.tableros[0].alto : 0)} mm.`);
  else {
    const porG = varios ? ' (' + col.grosores.map(e => `${col.tableros.filter(t => t.grosor === e).length} de ${fmt(e, 1)} mm`).join(' y ') + ')' : '';
    info.push(`<b>${col.tableros.length}</b> tablero${col.tableros.length === 1 ? '' : 's'} de ${fmt(f.ancho)} × ${fmt(f.alto)} mm${porG} · aprovechamiento <b>${fmt(col.uso * 100)} %</b>.`);
    if (col.grandes.length) info.push(`<span style="color:var(--peligro)">No caben en el tablero: ${col.grandes.map(p => p.c.nombre).join(', ')}.</span>`);
  }
  if (vetaOn()) {
    const nY = piezasFab().filter(c => vetaDe(c) === 'y').length, nL = piezasFab().filter(c => vetaDe(c) === 'libre').length;
    info.push(`Las rayitas marcan la veta de cada pieza. Clic en una pieza para cambiarla: <b>↔ a lo ancho</b> → <b>↕ a lo alto</b>${nY ? ' (' + nY + ')' : ''} → <b>libre, puede girar</b>${nL ? ' (' + nL + ')' : ''}.`);
  }
  // CNC: huesos de perro, arcos y si la fresa cabe en las ranuras
  const ps = col.tableros.flatMap(t => t.piezas), nH = ps.reduce((a, p) => a + p.g.nHuesos, 0), mH = ps.reduce((a, p) => a + p.g.huesosMal, 0), nE = ps.reduce((a, p) => a + p.g.nEsq, 0);
  const fr = fresaFab(), anchoR = grosorFab() + holguraRanuraFab();
  if (nE) {
    if (conHueso()) info.push(`Hueso de perro de Ø ${fmt(fr, 1)} mm en ${nH} esquinas` + (mH ? ` <span style="color:var(--peligro)">(${mH} no caben: ranura demasiado estrecha para la fresa)</span>` : '') + '.');
    else info.push(`<span style="color:#b26b00">${nE} esquinas interiores en ranuras y muescas sin hueso de perro: con fresa quedarán redondeadas y no encajarán del todo.</span>`);
    if (fr && (P.tipo === 'reticula' || esPlano()) && fr > anchoR - 0.2) info.push(`<span style="color:var(--peligro)">La fresa de Ø ${fmt(fr, 1)} mm no cabe en las ranuras de ${fmt(anchoR, 2)} mm.</span>`);
  }
  if (P.cnc.arcos && ps.length) { const p0 = ps[0], cc = contornoCNC(p0.g.poly); info.push(`Contornos con arcos: la ${esc(p0.c.nombre.toLowerCase())} pasa de ${p0.g.poly.length} puntos a ${cc.pts.length} tramos (${cc.b.filter(v => v).length} arcos).`); }
  info.push(P.tipo === 'reticula' || esPlano() ? `Ranuras${esPlano() ? ' y cajas' : ''} de ${fmt(grosorFab() + holguraRanuraFab(), 2)} mm · grosor del tablero ${fmt(grosorFab(), 1)} mm.` : `Agujeros: Ø ${fmt(2 * radioFab(), 2)} mm · grosor del tablero ${fmt(grosorFab(), 1)} mm.`);
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
  const poli = (capa, pts, bs) => {
    g(0, 'POLYLINE'); g(8, capa); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, 1);
    pts.forEach((p, i) => { g(0, 'VERTEX'); g(8, capa); g(10, n(p[0])); g(20, n(p[1])); g(30, 0); if (bs && bs[i]) g(42, (Math.round(bs[i] * 1e6) / 1e6).toString()); });
    g(0, 'SEQEND'); g(8, capa);
  };
  col.tableros.forEach((t, b) => {
    const ox = b * ((f.modo === 'fila' ? t.ancho : f.ancho) + 200);
    if (f.modo !== 'fila') {
      poli('TABLERO', [[ox, 0], [ox + f.ancho, 0], [ox + f.ancho, f.alto], [ox, f.alto]]);
      if ((col.grosores || []).length > 1) { g(0, 'TEXT'); g(8, 'TABLERO'); g(10, n(ox)); g(20, n(f.alto + 10)); g(30, 0); g(40, 20); g(1, 'Tablero ' + (b + 1) + ' - grosor ' + (Math.round(t.grosor * 10) / 10) + ' mm'); }
    }
    t.piezas.forEach(pz => {
      const cc = contornoCNC(pz.g.poly);
      // primero los huecos de dentro (así la pieza no se suelta antes de tiempo) y luego el contorno
      (pz.g.interiores || []).forEach(hh => { const ci = contornoCNC(hh); poli('CORTE', ci.pts.map(p => { const q = aTablero(pz, p); return [ox + q[0], q[1]]; }), ci.b); });
      poli('CORTE', cc.pts.map(p => { const q = aTablero(pz, p); return [ox + q[0], q[1]]; }), cc.b);
      pz.g.agujeros.forEach(a => { const q = aTablero(pz, a); g(0, 'CIRCLE'); g(8, 'TALADROS'); g(10, n(ox + q[0])); g(20, n(q[1])); g(30, 0); g(40, n(a[2])); });
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
    if (f.modo !== 'fila') {
      partes.push(`<rect x="${ox}" y="0" width="${tw}" height="${th}" fill="none" stroke="#999" stroke-width="0.5"/>`);
      if ((col.grosores || []).length > 1) partes.push(`<text x="${ox + 2}" y="12" font-family="Arial" font-size="10" fill="#999">grosor ${Math.round(t.grosor * 10) / 10} mm</text>`);
    }
    t.piezas.forEach(pz => {
      let d = '';
      [pz.g.poly, ...(pz.g.interiores || [])].forEach(pol => {
        const cc = contornoCNC(pol), qs = cc.pts.map(p => aTablero(pz, p));
        d += (d ? ' ' : '') + 'M' + n(ox + qs[0][0]) + ' ' + n(Y(qs[0][1]));
        qs.forEach((q, i) => {
          const r2 = qs[(i + 1) % qs.length], bu = cc.b[i];
          if (!bu) { if (i + 1 < qs.length) d += ' L' + n(ox + r2[0]) + ' ' + n(Y(r2[1])); return; }
          const cu = Math.hypot(r2[0] - q[0], r2[1] - q[1]), Rr = cu * (1 + bu * bu) / (4 * Math.abs(bu));
          d += ` A${n(Rr)} ${n(Rr)} 0 ${Math.abs(bu) > 1 ? 1 : 0} ${bu > 0 ? 0 : 1} ${n(ox + r2[0])} ${n(Y(r2[1]))}`;
        });
        d += ' Z';
      });
      partes.push(`<path d="${d}" fill="none" stroke="#000" stroke-width="0.2"/>`);
      pz.g.agujeros.forEach(a => { const q = aTablero(pz, a); partes.push(`<circle cx="${n(ox + q[0])}" cy="${n(Y(q[1]))}" r="${n(a[2])}" fill="none" stroke="#d00" stroke-width="0.2"/>`); });
      if (f.numeros) { const q = aTablero(pz, pz.g.etiqueta); partes.push(`<text x="${n(ox + q[0])}" y="${n(Y(q[1]))}" font-family="Arial" font-size="${n(altoTexto(pz.g))}" text-anchor="middle" dominant-baseline="middle" fill="#00f">${pz.c.etq}</text>`); }
    });
    W += tw + 200;
  });
  W = Math.max(1, W - 200);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">\n<!-- ${esc(P.nombre)} — Made-rebanadas (${textoEscala()}) -->\n${partes.join('\n')}\n</svg>\n`;
}
function exportarSVG() { descargar(nombreArchivo(P.nombre) + '_costillas' + sufijoFab() + '.svg', svg(), 'image/svg+xml'); aviso('SVG guardado'); }

// ---------- despiece y lista de compra ----------
function calcularCompraFab() { // material con las medidas de fabricación (maqueta o real)
  const V = P.varillas, k = escalaFab(), f = fabActual(), col = colocarEnTableros(f), eF = grosorFab();
  const usadas = P.tipo === 'costillas' ? R.varillas.filter(v => v.usada) : [];
  const sobra = enMaqueta() ? Math.max(2, V.sobra * k) : V.tipo === 'tubo' ? 0 : V.sobra, seps = [];   // el tubo va enrasado con las tapas
  const varillas = usadas.map(v => {
    if (conSeparadores()) v.dists.forEach((d, i) => { const L = d * k - eF; if (L > 0.5 && v.cabe[v.a + i] && v.cabe[v.a + i + 1]) seps.push(L); });
    return { k: v.k, largo: v.dists.reduce((a, d) => a + d, 0) * k + eF + 2 * sobra };
  });
  const sepF = (P.tipo === 'radial' ? 0 : R.sep * k);
  return {
    area: piezasFab().reduce((s, c) => s + Math.abs(c.area) * k * k, 0), sep: sepF, hueco: sepF - eF,
    varillas, nSep: seps.length, seps, sepMin: seps.length ? Math.min(...seps) : 0, sepMax: seps.length ? Math.max(...seps) : 0,
    nTuercas: V.tipo === 'madera' || enMaqueta() ? 0 : usadas.length * 2,
    tubo: P.tipo === 'radial' && R.tuboV ? (R.tuboV[1] - R.tuboV[0] + 40) * k : 0,
    rastrel: P.tipo === 'pared' && R.rastreles.length ? (R.costillas[R.n - 1].x - R.costillas[0].x + grosor() + 60) * k : 0,
    tablero: [f.ancho, f.alto], nTableros: col.tableros.length, colocacion: col,
  };
}
function listaCompra() {
  const cm = calcularCompraFab(), V = P.varillas, tv = VARILLA_TIPOS[V.tipo], L = [], maq = enMaqueta(), k = escalaFab();
  const tablero = maq ? `Tablero de maqueta (DM, contrachapado…) de ${fmt(P.maqueta.grosor, 1)} mm` : `${MATERIALES[P.costillas.material].nombre}, ${fmt(grosor(), 1)} mm`;
  const col = cm.colocacion, gs = col.grosores || [];
  if (gs.length > 1) {   // los muebles de los huecos con otro grosor llevan su tablero aparte
    gs.forEach(e => {
      const nT = col.tableros.filter(t => t.grosor === e).length, propio = Math.abs(e - grosor()) > 0.01;
      L.push([`${MATERIALES[P.costillas.material].nombre}, ${fmt(e, 1)} mm${propio ? ' (muebles de los huecos)' : ''}`,
        `${nT} tablero${nT === 1 ? '' : 's'} de ${fmt(cm.tablero[0])} × ${fmt(cm.tablero[1])} mm`]);
    });
    L.push(['Superficie de las piezas', `${fmt(cm.area / 1e6, 2)} m² en total`]);
  } else L.push([tablero, `${cm.nTableros} tablero${cm.nTableros === 1 ? '' : 's'} de ${fmt(cm.tablero[0])} × ${fmt(cm.tablero[1])} mm (${maq ? fmt(cm.area / 100, 0) + ' cm²' : fmt(cm.area / 1e6, 2) + ' m²'} de piezas)`]);
  if (esPlano()) {
    L.push(['Piezas', `${R.costillas.filter(c => c.ok).length}, con ${R.uniones.filter(u => u.tipo === 'media').length} uniones a media madera y ${R.uniones.filter(u => u.tipo === 'caja').length} espigas en caja pasante`]);
    L.push(['Ranuras y cajas', `${fmt(grosorFab() + holguraRanuraFab(), 2)} mm de ancho`]);
    L.push(['Herrajes', 'ninguno (cola en las uniones, si se quiere fijo)']);
    return L;
  }
  if (P.tipo === 'reticula') {
    L.push(['Piezas', `${R.costillas.filter(c => c.ok).length} costillas y ${R.largueros.filter(z => z.ok).length} largueros, con ${R.cruces.length} cruces`]);
    L.push(['Ranuras a media madera', `${fmt(grosorFab() + holguraRanuraFab(), 2)} mm de ancho`]);
    L.push(['Herrajes', 'ninguno (cola en los cruces, si se quiere fijo)']);
    return L;
  }
  if (P.tipo === 'radial') {
    L.push([`Tubo central Ø ${fmt(P.radial.tubo * k, 1)} mm (${maq ? 'pajita, varilla o tubo' : 'acero, aluminio, latón o madera'})`, fmt(cm.tubo) + ' mm']);
    if (R.discos.length) L.push([`Discos de unión (salen del mismo tablero)`, `${R.discos.length} de Ø ${fmt(2 * R.discos[0].rD * k)} mm`]);
    L.push(['Cola', 'para fijar los discos al tubo y las costillas a los discos']);
    if (!maq) L.push(['Si es lámpara', 'portalámparas, cable, florón y bombilla LED (que no caliente)']);
    return L;
  }
  if (P.tipo === 'pared') {
    const Pa = P.pared;
    if (R.rastreles.length) L.push([`Rastrel (listón) de ${fmt(Pa.alto * k, 1)} × ${fmt(Pa.grueso * k, 1)} mm`, textoRastreles(k, cm)]);
    else L.push(['Tablero trasero (o escuadras)', `${fmt(cm.rastrel || P.largo * k)} × ${fmt((G.alto || 0) * k)} mm`]);
    if (!maq) { L.push(['Tacos y tornillos para la pared', `${R.rastreles.length * Math.max(2, Math.ceil(cm.rastrel / 500))} (uno cada 50 cm de rastrel)`]); L.push(['Tornillos o cola para las lamas', `${R.n * Math.max(1, R.rastreles.length)} (uno en cada cruce con un rastrel)`]); }
    return L;
  }
  const curva = disposicion() === 'curva';
  cm.varillas.forEach(v => L.push([maq ? `Varilla de Ø ${fmt(P.maqueta.diam, 1)} mm${curva ? ' (que se pueda curvar: alambre)' : ' (bambú, madera o alambre)'} — varilla ${v.k + 1}` : `${tv.nombre} ${V.tipo === 'roscada' ? 'M' : 'Ø '}${V.diam}${curva ? ' (curvada)' : ''} — varilla ${v.k + 1}`, fmt(v.largo) + ' mm']));
  if (cm.nSep) {
    const txt = Math.abs(cm.sepMax - cm.sepMin) < 0.2 ? `${cm.nSep} piezas de ${fmt(cm.sepMin, 1)} mm (${fmt(cm.seps.reduce((a, b) => a + b, 0))} mm en total)` : `${cm.nSep} piezas de ${fmt(cm.sepMin, 1)} a ${fmt(cm.sepMax, 1)} mm (cada largo en el plano; ${fmt(cm.seps.reduce((a, b) => a + b, 0))} mm en total)`;
    L.push([maq ? 'Separadores (tubito, pajita o arandela de cartón)' : `${tv.sep} Ø ${V.sepD} mm (agujero interior > ${V.diam} mm)`, txt]);
  }
  if (cm.nTuercas) L.push(V.tipo === 'tubo' ? [`Tapas roscadas para tubo Ø ${V.diam} (embellecedor + tornillo)`, `${cm.nTuercas}`] : [`Tuercas M${V.diam} (mejor ciegas) y arandelas`, `${cm.nTuercas} + ${cm.nTuercas}`]);
  L.push([maq ? 'Agujeros' : 'Broca para los agujeros', `Ø ${fmt(2 * radioFab(), maq ? 2 : 1)} mm`]);
  return L;
}
function filasDespiece() {
  const mat = enMaqueta() ? `Maqueta ${fmt(P.maqueta.grosor, 1)} mm` : MATERIALES[P.costillas.material].nombre;
  return piezasFab().map(c => {
    const g = geoFab(c), rad = P.tipo === 'radial' && !c.disco;
    return { n: c.etq, nombre: c.nombre, x: (c.disco ? c.v : c.z ? c.u : c.x) * (rad ? 1 : escalaFab()), eje: c.plano ? PLANOS[c.plano].normal : c.disco ? 'altura' : c.z ? 'z' : rad ? 'ángulo' : 'x',
      ranuras: c.ranuras.length + (c.disco ? R.n : 0), w: g.caja.w, h: g.caja.h, e: grosorDe(c), area: g.area, ag: g.agujeros.length, dA: g.agujeros.length ? fmt(2 * g.agujeros[0][2], 2) : '', mat };
  });
}
function abrirDespiece() {
  if (!R) return;
  const F = filasDespiece(), L = listaCompra();
  modal('📋 Despiece y lista de compra' + (enMaqueta() ? ' · maqueta 1:' + P.maqueta.escala : ''), `
    <h4>${esPlano() ? 'Piezas' : P.tipo === 'pared' ? 'Lamas' : 'Costillas'}</h4>
    <div style="max-height:46vh;overflow:auto"><table class="tabla"><tr><th class="n">Pieza</th><th class="n">Posición</th><th class="n">Ancho</th><th class="n">Alto</th><th class="n">Grosor</th><th class="n">Superficie</th><th class="n">Agujeros / ranuras</th></tr>
    ${F.map(f => `<tr><td class="n">${esc(f.nombre)}</td><td class="n">${f.eje} = ${f.eje === 'ángulo' ? fmt(f.x, 1) + '°' : fmt(f.x) + ' mm'}</td><td class="n">${fmt(f.w, enMaqueta() ? 1 : 0)}</td><td class="n">${fmt(f.h, enMaqueta() ? 1 : 0)}</td><td class="n">${fmt(f.e, 1)}</td><td class="n">${fmt(f.area / 100)} cm²</td><td class="n">${f.ranuras ? f.ranuras + ' ranuras' : f.ag + ' × Ø' + f.dA}</td></tr>`).join('')}
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
  piezasFab().forEach(c => {
    const g = geoFab(c); let w = g.caja.w, h = g.caja.h, v = 'no';
    if (vetaOn()) { const vd = vetaDe(c); if (vd !== 'libre') v = 'si'; if (vd === 'y') [w, h] = [h, w]; }
    filas.push([c.nombre, csvN(w, 1), csvN(h, 1), 1, v, 0, 0, ''].join(';'));
  });
  descargar(nombreArchivo(P.nombre) + '_cortes' + sufijoFab() + '.csv', '﻿' + filas.join('\r\n') + '\r\n', 'text/csv');
  aviso('CSV de cortes guardado');
}

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
  let y = esPlano() ? tabla(x2, M + 18, a2, [
    { titulo: 'Datos' },
    ['Medidas (ancho × fondo × alto)', `${fmt((G.dims || [0])[0] * k)} × ${fmt(fondo * k)} × ${fmt(alto * k)} mm`],
    ['Piezas', `${R.n} de ${fmt(e, 1)} mm`],
    ['Material', maq ? `Maqueta de ${fmt(P.maqueta.grosor, 1)} mm` : MATERIALES[P.costillas.material].nombre],
    ['Uniones a media madera', String(R.uniones.filter(u => u.tipo === 'media').length)],
    ['Espigas en caja pasante', String(R.uniones.filter(u => u.tipo === 'caja').length)],
    ['Ancho de ranuras y cajas', `${fmt(grosorFab() + holguraRanuraFab(), 2)} mm`],
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
  if (f.modo !== 'fila' && col.tableros.length) {
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
  // 1) travesaños y espigas que pasan por cajas de piezas no horizontales
  const pasan = {}; R.uniones.filter(u => u.tipo === 'caja' && !horiz(u.en)).forEach(u => { (pasan[u.pasa] = pasan[u.pasa] || []).push(u.en); });
  Object.entries(pasan).forEach(([p, en]) => pasos.push(`Pasa ${nom(+p)} por ${en.length > 1 ? 'las cajas de' : 'la caja de'} ${lista2([...new Set(en)].map(nom))}.`));
  // 2) medias maderas: la pieza con la ranura desde abajo baja sobre las que la tienen desde arriba
  const baja = {}; R.uniones.filter(u => u.tipo === 'media').forEach(u => { const ar = u.aArriba ? u.a : u.b, ab = u.aArriba ? u.b : u.a; (baja[ab] = baja[ab] || []).push(ar); });
  const ord = Object.keys(baja).map(Number).sort((a, b) => (R.costillas[a].caja.y0 || 0) - (R.costillas[b].caja.y0 || 0));
  if (ord.length > 4) pasos.push(`Encaja a media madera, de abajo arriba: ${lista2(ord.map(i => `${nom(i)} sobre ${lista2([...new Set(baja[i])].map(j => R.costillas[j].etq))}`))}. Cada pieza baja con su ranura (la de abajo) sobre la ranura de arriba de la otra; si cuesta, da golpes suaves con una maza de goma y un taco.`);
  else ord.forEach(i => pasos.push(`Baja ${nom(i)} sobre ${lista2([...new Set(baja[i])].map(nom))}: sus ranuras a media madera encajan una en la otra hasta quedar enrasadas.`));
  // 3) tableros horizontales (asientos, tapas, baldas) sobre sus espigas
  const tapas = {}; R.uniones.filter(u => u.tipo === 'caja' && horiz(u.en)).forEach(u => { (tapas[u.en] = tapas[u.en] || []).push(u.pasa); });
  Object.entries(tapas).forEach(([t, de]) => pasos.push(`Pon ${nom(+t)} encima: las espigas de ${lista2([...new Set(de)].map(nom))} entran por sus cajas. Presiona por igual por todos los lados.`));
  pasos.push('Comprueba que el mueble queda a escuadra y apoya bien. Si se quiere fijo, desmonta, pon cola en las uniones y vuelve a montar (o fija las espigas con una cuña).');
  pasos.push(maq ? 'Mira la maqueta desde todos los lados antes de cortar el mueble real.' : 'Acabado: aceite, cera o barniz (mejor antes de montar, para llegar a todas las caras).');
  return pasos;
}

/* ===================== ANIDADOR DE TABLEROS (assets/anidador) =====================
   Se abre en una ventana dentro del programa. Cuando avisa «anidador-listo», recibe las costillas
   como piezas del Calcador (contorno exterior y agujeros de las varillas) y las medidas del tablero. */
const PUENTES0 = { n: 0, ancho: 5, alto: 2 };
function piezaCalcador(c) {
  // con la veta «a lo alto», la pieza se manda ya girada 90° para que su veta siga el largo del tablero
  const gira = vetaOn() && vetaDe(c) === 'y', R90 = p => [p[1], -p[0]];
  const g = geoFab(c), poly = gira ? g.poly.map(R90) : g.poly, b = gira ? cajaDe(poly) : g.caja, r3 = v => +v.toFixed(3);
  const cc = contornoCNC(poly), ext = cc.pts.map(p => ({ x: r3(p[0] - b.x0), y: r3(p[1] - b.y0) }));
  const contornos = [{ pts: ext, b: cc.b.map(v => +v.toFixed(6)), cerrado: true, tipo: 'exterior', mec: { op: 'corte', prof: null, puentes: { ...PUENTES0 } } }];
  // huecos interiores de la pieza (túneles, ventanas)
  (g.interiores || []).forEach(hh => { const ci = contornoCNC(gira ? hh.map(R90) : hh); contornos.push({ pts: ci.pts.map(p => ({ x: r3(p[0] - b.x0), y: r3(p[1] - b.y0) })), b: ci.b.map(v => +v.toFixed(6)), cerrado: true, tipo: 'interior', mec: { op: 'corte', prof: null, puentes: { ...PUENTES0 } } }); });
  // cada agujero: círculo de dos medias vueltas (bulge 1)
  g.agujeros.forEach(a0 => {
    const a = gira ? [a0[1], -a0[0], a0[2]] : a0, x = a[0] - b.x0, y = a[1] - b.y0;
    contornos.push({ pts: [{ x: r3(x + a[2]), y: r3(y) }, { x: r3(x - a[2]), y: r3(y) }], b: [1, 1], cerrado: true, tipo: 'interior', mec: { op: 'corte', prof: null, puentes: { ...PUENTES0 } } });
  });
  return { nombre: c.nombre, cantidad: 1, veta: vetaOn() && vetaDe(c) !== 'libre', calcador: { contornos } };
}
let tAnid = 0;
function abrirAnidador() {
  if (!R) return;
  const n = piezasFab().length;
  if (!n) { aviso('No hay costillas que colocar.'); return; }
  UI.anidListo = false;
  const gs = [...new Set(piezasFab().map(grosorDe))];
  $('#anidInfo').textContent = `${P.nombre}: ${n} piezas · ${textoEscala()} · tablero de ${fmt(grosorFab(), 1)} mm` +
    (gs.length > 1 ? ` · ⚠ los muebles de los huecos llevan tablero de ${gs.filter(e => Math.abs(e - grosorFab()) > 0.01).map(e => fmt(e, 1)).join(' y ')} mm: anídalos aparte` : '') +
    (vetaOn() ? ' · con veta' : '');
  const caja = $('#anidCaja'); caja.innerHTML = '';
  const fr = document.createElement('iframe'); fr.src = 'assets/anidador/anidador.html?desde=rebanadas'; fr.title = 'Anidador de tableros';
  caja.appendChild(fr); UI.anidFrame = fr;
  $('#anidAviso').classList.add('oculto'); $('#anidVentana').classList.remove('oculto');
  clearTimeout(tAnid); tAnid = setTimeout(() => { if (!UI.anidListo) $('#anidAviso').classList.remove('oculto'); }, 7000);
}
function cerrarAnidador() {
  $('#anidVentana').classList.add('oculto'); $('#anidCaja').innerHTML = ''; UI.anidFrame = null; clearTimeout(tAnid);
}
window.addEventListener('message', e => {
  const d = e.data; if (!d || d.tipo !== 'anidador-listo' || !UI.anidFrame || e.source !== UI.anidFrame.contentWindow) return;
  UI.anidListo = true; $('#anidAviso').classList.add('oculto');
  const f = fabActual();
  e.source.postMessage({
    tipo: 'rebanadas-piezas',
    nombre: P.nombre + (enMaqueta() ? ` (maqueta 1:${P.maqueta.escala})` : ''),
    piezas: piezasFab().map(piezaCalcador),
    tablero: { largo: f.ancho, ancho: f.alto, grosor: grosorFab(), margen: f.borde, modo: 'forma', veta: vetaOn() },
    maquina: fresaFab() === 0 ? 'laser' : 'fresa',   // Ø de fresa 0 (lo normal en la maqueta) = láser
  }, '*');
});

/* ===================== CNC: HUESO DE PERRO Y ARCOS =====================
   - Hueso de perro: en las esquinas interiores de ranuras y muescas, un círculo del radio de la fresa
     para que la pieza que entra llegue al fondo (la fresa redonda no deja esquinas vivas).
   - Arcos: el contorno de muchos tramos rectos se convierte en rectas y arcos (bulge), con una tolerancia. */

const fresaFab = () => enMaqueta() ? (+P.maqueta.fresa || 0) : (+P.cnc.fresa || 0);
const conHueso = () => P.cnc.hueso && fresaFab() > 0;

// el contorno de una pieza para las vistas (3D y pieza): con el hueso de perro si está activo
function polyVista(poly) {
  if (!poly || !poly.esq || !poly.esq.length || !conHueso()) return poly;
  if (poly._hueso && poly._hueso.r === fresaFab() / 2 / escalaFab()) return poly._hueso.poly;
  const r = fresaFab() / 2 / escalaFab(), h = huesoDePerro(poly, poly.esq, r).poly;
  Object.defineProperty(poly, '_hueso', { value: { r, poly: h }, configurable: true, writable: true });
  return h;
}
// Sustituye cada esquina interior marcada por un arco de radio r que pasa por ella (centro dentro del hueco).
// Si dos esquinas seguidas están tan cerca que sus círculos se pisan (ranura estrecha para la fresa),
// los dos arcos se unen en el punto donde se cortan: es lo que de verdad corta la fresa.
function huesoDePerro(poly, esq, r) {
  if (!esq || !esq.length || !(r > 0)) return { poly, fallan: 0 };
  const n = poly.length, cerca = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
  const marcas = new Set(); poly.forEach((p, i) => { if (esq.some(e => e && cerca(e, p))) marcas.add(i); });
  const H = new Array(n).fill(null); let fallan = 0;
  marcas.forEach(i => {
    const C = poly[i], A0 = poly[(i - 1 + n) % n], B0 = poly[(i + 1) % n];
    let da = [C[0] - A0[0], C[1] - A0[1]], db = [B0[0] - C[0], B0[1] - C[1]];
    const la = Math.hypot(...da), lb = Math.hypot(...db);
    if (!(la > 1e-9 && lb > 1e-9)) { fallan++; return; }
    da = [da[0] / la, da[1] / la]; db = [db[0] / lb, db[1] / lb];
    if (da[0] * db[1] - da[1] * db[0] >= 0) return;  // no es una esquina hacia dentro
    let w = [da[0] - db[0], da[1] - db[1]]; const lw = Math.hypot(...w); w = [w[0] / lw, w[1] / lw];
    const Q = [C[0] - r * w[0], C[1] - r * w[1]];
    const tA = 2 * r * (w[0] * da[0] + w[1] * da[1]), tB = -2 * r * (w[0] * db[0] + w[1] * db[1]);
    if (!(tA > 0 && tB > 0) || tA > la - 0.01 || tB > lb - 0.01) { fallan++; return; }
    H[i] = { C, Q, A: [C[0] - tA * da[0], C[1] - tA * da[1]], B: [C[0] + tB * db[0], C[1] + tB * db[1]], tA, tB, lb };
  });
  // esquinas seguidas cuyos círculos se pisan: el punto donde se cortan, del lado de la madera
  const union = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, h = H[i], g = H[j];
    if (!h || !g || h.tB + g.tA < h.lb - 1e-6) continue;
    const dx = g.Q[0] - h.Q[0], dy = g.Q[1] - h.Q[1], d = Math.hypot(dx, dy);
    if (!(d > 1e-9) || d >= 2 * r) continue;
    const m = [h.Q[0] + dx / 2, h.Q[1] + dy / 2], hh = Math.sqrt(r * r - d * d / 4), nx = -dy / d, ny = dx / d;
    const X1 = [m[0] + nx * hh, m[1] + ny * hh], X2 = [m[0] - nx * hh, m[1] - ny * hh];
    const lado = p => dx * (p[1] - h.Q[1]) - dy * (p[0] - h.Q[0]);
    union[i] = Math.sign(lado(X1)) === Math.sign(lado(h.C)) ? X1 : X2;
  }
  const norm = x => ((x % PI2) + PI2) % PI2;
  const arco = (Q, S, E, C, out) => {   // de S a E alrededor de Q, por el lado que pasa por C (sin S, con E)
    const ang = p => Math.atan2(p[1] - Q[1], p[0] - Q[0]), aS = ang(S);
    let barrido = norm(ang(E) - aS); if (norm(ang(C) - aS) > barrido) barrido -= PI2;
    const k = Math.max(3, Math.ceil(Math.abs(barrido) / (Math.PI / 16)));
    for (let m = 1; m < k; m++) { const a = aS + barrido * m / k; out.push([Q[0] + r * Math.cos(a), Q[1] + r * Math.sin(a)]); }
    out.push(E);
  };
  const out = [];
  for (let i = 0; i < n; i++) {
    const h = H[i];
    if (!h) { out.push(poly[i]); continue; }
    const prev = union[(i - 1 + n) % n], sig = union[i];
    const S = prev || h.A;
    if (!prev) out.push(h.A);
    arco(h.Q, S, sig || h.B, h.C, out);
  }
  return { poly: out, fallan };
}

/* ---------- ajuste de rectas y arcos ---------- */
function ajusteRecta(pts, tol) {
  const a = pts[0], b = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) if (distSeg(pts[i][0], pts[i][1], a, b) > tol) return false;
  return true;
}
// arco por el primer, el del medio y el último punto; devuelve el bulge o null si no se ajusta
function ajusteArco(pts, tol) {
  if (pts.length < 3) return null;
  const a = pts[0], m = pts[Math.floor(pts.length / 2)], b = pts[pts.length - 1];
  const d = 2 * (a[0] * (m[1] - b[1]) + m[0] * (b[1] - a[1]) + b[0] * (a[1] - m[1]));
  if (Math.abs(d) < 1e-9) return null;
  const a2 = a[0] * a[0] + a[1] * a[1], m2 = m[0] * m[0] + m[1] * m[1], b2 = b[0] * b[0] + b[1] * b[1];
  const cx = (a2 * (m[1] - b[1]) + m2 * (b[1] - a[1]) + b2 * (a[1] - m[1])) / d, cy = (a2 * (b[0] - m[0]) + m2 * (a[0] - b[0]) + b2 * (m[0] - a[0])) / d;
  const Rr = Math.hypot(a[0] - cx, a[1] - cy);
  if (Rr > 20000) return null;
  const ccw = (m[0] - a[0]) * (b[1] - a[1]) - (m[1] - a[1]) * (b[0] - a[0]) > 0;  // sentido antihorario
  const ang = p => Math.atan2(p[1] - cy, p[0] - cx), norm = x => ((x % PI2) + PI2) % PI2;
  const a0 = ang(a); let prev = 0;
  for (let i = 1; i < pts.length; i++) {
    if (Math.abs(Math.hypot(pts[i][0] - cx, pts[i][1] - cy) - Rr) > tol) return null;
    const s = ccw ? norm(ang(pts[i]) - a0) : norm(a0 - ang(pts[i]));
    if (s + 1e-9 < prev && i < pts.length - 1) return null;      // los puntos tienen que avanzar por el arco
    prev = s;
  }
  // el arco no puede pasar de la semirrecta de cierre ni ser casi una vuelta
  if (prev > PI2 * 0.97) return null;
  const barrido = ccw ? prev : -prev;
  // también tiene que quedar cerca de la cuerda entre puntos seguidos
  for (let i = 1; i < pts.length; i++) {
    const q = [(pts[i][0] + pts[i - 1][0]) / 2, (pts[i][1] + pts[i - 1][1]) / 2];
    if (Math.abs(Math.hypot(q[0] - cx, q[1] - cy) - Rr) > tol * 4 + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) ** 2 / (8 * Rr) + 0.01) return null;
  }
  return Math.tan(barrido / 4);
}
// polígono cerrado → { pts, b } con rectas (b = 0) y arcos (b = bulge del tramo que empieza en ese punto)
function ajustarArcos(poly, tol) {
  const n0 = poly.length;
  if (n0 < 5) return { pts: poly.slice(), b: new Array(n0).fill(0) };
  // empezar en la esquina más viva, para no partir un arco por la mitad
  let ini = 0, maxG = -1;
  for (let i = 0; i < n0; i++) {
    const a = poly[(i - 1 + n0) % n0], p = poly[i], c = poly[(i + 1) % n0];
    const u = [p[0] - a[0], p[1] - a[1]], v = [c[0] - p[0], c[1] - p[1]], lu = Math.hypot(...u), lv = Math.hypot(...v);
    if (lu < 1e-9 || lv < 1e-9) continue;
    const g = Math.acos(clamp((u[0] * v[0] + u[1] * v[1]) / lu / lv, -1, 1));
    if (g > maxG) { maxG = g; ini = i; }
  }
  const P0 = poly.slice(ini).concat(poly.slice(0, ini)), n = P0.length, en = k => P0[k % n];
  const pts = [], b = [];
  let i = 0;
  while (i < n) {
    let mejor = { j: i + 1, b: 0 }, fallos = 0;
    for (let j = i + 2; j <= n && j - i <= 160 && fallos < 4; j++) {
      const tramo = []; for (let k = i; k <= j; k++) tramo.push(en(k));
      if (ajusteRecta(tramo, tol)) { mejor = { j, b: 0 }; fallos = 0; continue; }
      const bu = ajusteArco(tramo, tol);
      if (bu !== null) { mejor = { j, b: bu }; fallos = 0; } else fallos++;
    }
    pts.push(en(i)); b.push(mejor.b); i = mejor.j;
  }
  return { pts, b };
}
// puntos de un arco con bulge (para dibujarlo o comprobarlo)
function puntosBulge(p, q, bu, cada = 4) {
  if (!bu) return [q];
  const d = Math.hypot(q[0] - p[0], q[1] - p[1]), th = 4 * Math.atan(bu), u = [(q[0] - p[0]) / d, (q[1] - p[1]) / d], nn = [-u[1], u[0]];
  const h = (d / 2) * (1 - bu * bu) / (2 * bu), c = [(p[0] + q[0]) / 2 + nn[0] * h, (p[1] + q[1]) / 2 + nn[1] * h];
  const r = Math.hypot(p[0] - c[0], p[1] - c[1]), a1 = Math.atan2(p[1] - c[1], p[0] - c[0]), k = Math.max(4, Math.ceil(Math.abs(th) * r / cada));
  const out = []; for (let i = 1; i <= k; i++) { const a = a1 + th * i / k; out.push([c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); }
  return out;
}
// contorno de fabricación: con arcos (si está activado) o como polilínea simplificada
function contornoCNC(poly) {
  if (P.cnc.arcos) return ajustarArcos(poly, Math.max(0.005, +P.cnc.tolArco || 0.05));
  const s = simplificaCerrado(poly, 0.05); return { pts: s, b: new Array(s.length).fill(0) };
}

/* ===================== GUARDAR EL MODELO 3D (STL / OBJ / GLB / SolidCraft) =====================
   Recorre las mallas del mueble montado (sin explosión) y las escribe en mm.
   - STL binario: una sola malla, para imprimir en 3D o abrir en cualquier programa.
   - OBJ + MTL: un objeto por pieza (Lama 1, Costilla 2, Larguero A…) con el color de su material.
   No se guardan la pared, el volumen de ayuda, las líneas de los perfiles ni el suelo. */
// recorre las mallas que se guardan, con su nombre, color y grupo: fn(malla, nombre, color, grupo)
function recorrerPiezas3D(opc, fn) {
  const e = P.vista.explosion;
  if (e) { P.vista.explosion = 0; colocarExplosion(); }
  G.modelo.updateMatrixWorld(true);
  const nomOtra = i => { const o = R.otras.find(z => z.i === i); return o ? o.nombre : 'Pieza ' + (i + 1); };
  const colorDe = m => { const mt = Array.isArray(m.material) ? m.material[0] : m.material; return mt && mt.color ? '#' + mt.color.getHexString() : '#cccccc'; };
  const hexTablero = () => (P.costillas.material === 'lacado' ? P.costillas.color : (MATERIALES[P.costillas.material] || MATERIALES.mdf).hex);
  let nVar = 0, nRas = 0;
  G.modelo.traverse(m => {
    if (!m.isMesh || m === G.fantasma || !m.visible) return;
    let p = m.parent, vis = true; while (p) { if (!p.visible) vis = false; p = p.parent; } if (!vis) return;
    const ud = m.userData || {}; let nombre, color, grupo;
    if (ud.extra === 'pared') return;
    if (ud.extra === 'rastrel') { if (!opc.herrajes) return; nombre = 'Rastrel ' + (++nRas); color = colorDe(m); grupo = 'rastreles'; }
    else if (ud.extra === 'tubo' || ud.var) { if (!opc.herrajes) return; nombre = ud.extra === 'tubo' ? 'Tubo central' : 'Varilla ' + (++nVar); color = colorDe(m); grupo = 'herrajes'; }
    else if (ud.z || ud.disco || ud.trozoX != null || ud.modulo) { nombre = nomOtra(ud.i); color = hexTablero(); grupo = 'tablero'; }   // también los trozos de lama y los muebles de los huecos
    else if (ud.x != null) { const c = R.costillas[ud.i]; nombre = c ? c.nombre : 'Costilla ' + (ud.i + 1); color = hexTablero(); grupo = 'tablero'; }
    else return;
    fn(m, nombre, color, grupo);
  });
  if (e) { P.vista.explosion = e; colocarExplosion(); }
}
function piezasMalla3D(opc) {
  const out = [];
  recorrerPiezas3D(opc, (m, nombre, color, grupo) => {
    const g = m.geometry, pos = g.attributes.position, idx = g.index, M = m.matrixWorld, v = new THREE.Vector3(), V = [];
    for (let k = 0; k < pos.count; k++) { v.fromBufferAttribute(pos, k).applyMatrix4(M); V.push([v.x, v.y, v.z]); }
    const F = [];
    if (idx) for (let k = 0; k + 2 < idx.count; k += 3) F.push([idx.getX(k), idx.getX(k + 1), idx.getX(k + 2)]);
    else for (let k = 0; k + 2 < pos.count; k += 3) F.push([k, k + 1, k + 2]);
    if (M.determinant() < 0) F.forEach(f => f.reverse());
    out.push({ nombre, color, grupo, V, F });
  });
  // ejes y escala: Y arriba (Three.js) → Z arriba si se pide; el mueble se apoya en z = 0
  const s = 1 / (opc.escala || 1);
  const tr = opc.zArriba ? q => [q[0] * s, -q[2] * s, q[1] * s] : q => [q[0] * s, q[1] * s, q[2] * s];
  out.forEach(o => { o.V = o.V.map(tr); });
  let mins = [Infinity, Infinity, Infinity]; out.forEach(o => o.V.forEach(q => { for (let c = 0; c < 3; c++) mins[c] = Math.min(mins[c], q[c]); }));
  const ab = opc.zArriba ? 2 : 1;
  out.forEach(o => o.V.forEach(q => { q[ab] -= mins[ab]; }));
  return out;
}
// la malla de cada pieza soldada y con las tapas reparadas, en el formato de vértices y caras de piezasMalla3D
function piezasCerradas(opc) {
  return piezasMalla3D(opc).map(p => {
    const { pos, tri } = soldarMalla(p.V, p.F), V = [], F = [];
    for (let i = 0; i < pos.length; i += 3) V.push([pos[i], pos[i + 1], pos[i + 2]]);
    for (let t = 0; t < tri.length; t += 3) F.push([tri[t], tri[t + 1], tri[t + 2]]);
    return Object.assign(p, { V, F, pos, tri });
  }).filter(p => p.F.length);
}
function exportarSTL(opc) {
  const ps = piezasCerradas(opc), nT = ps.reduce((a, o) => a + o.F.length, 0);
  const buf = new ArrayBuffer(84 + 50 * nT), dv = new DataView(buf);
  const cab = ('Made-rebanadas ' + VERSION + ' - ' + P.nombre).slice(0, 80);
  for (let k = 0; k < 80; k++) dv.setUint8(k, k < cab.length ? (cab.charCodeAt(k) & 0x7f) : 32);
  dv.setUint32(80, nT, true);
  let o = 84;
  ps.forEach(p => p.F.forEach(f => {
    const a = p.V[f[0]], b = p.V[f[1]], c = p.V[f[2]];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; const L = Math.hypot(...n) || 1; n = n.map(x => x / L);
    [n, a, b, c].forEach(q => { dv.setFloat32(o, q[0], true); dv.setFloat32(o + 4, q[1], true); dv.setFloat32(o + 8, q[2], true); o += 12; });
    dv.setUint16(o, 0, true); o += 2;
  }));
  descargar(nombreArchivo(P.nombre) + sufijo3D(opc) + '.stl', new Blob([buf], { type: 'model/stl' }));
  return { piezas: ps.length, triangulos: nT };
}
function exportarOBJ(opc) {
  const ps = piezasCerradas(opc), base = nombreArchivo(P.nombre) + sufijo3D(opc), f6 = x => +x.toFixed(3);
  const colores = [...new Set(ps.map(p => p.color))], matDe = c => 'mat_' + c.slice(1);
  let obj = `# Made-rebanadas ${VERSION} - ${P.nombre}\n# Unidades: mm${opc.escala > 1 ? ' (escala 1:' + opc.escala + ')' : ''}. ${opc.zArriba ? 'Z' : 'Y'} hacia arriba.\nmtllib ${base}.mtl\n`;
  let off = 1, nT = 0;
  ps.forEach(p => {
    obj += `o ${p.nombre.replace(/\s+/g, '_')}\ng ${p.grupo}\nusemtl ${matDe(p.color)}\n`;
    p.V.forEach(q => { obj += `v ${f6(q[0])} ${f6(q[1])} ${f6(q[2])}\n`; });
    p.F.forEach(f => { obj += `f ${f[0] + off} ${f[1] + off} ${f[2] + off}\n`; });
    off += p.V.length; nT += p.F.length;
  });
  const rgb = h => [1, 3, 5].map(k => (parseInt(h.slice(k, k + 2), 16) / 255).toFixed(4)).join(' ');
  const mtl = `# Made-rebanadas ${VERSION}\n` + colores.map(c => `newmtl ${matDe(c)}\nKd ${rgb(c)}\nKa 0 0 0\nKs 0.05 0.05 0.05\nd 1\nillum 1\n`).join('\n');
  descargar(base + '.obj', obj, 'model/obj');
  setTimeout(() => descargar(base + '.mtl', mtl, 'text/plain'), 400);
  return { piezas: ps.length, triangulos: nT };
}

/* ===================== GLB (glTF 2.0 binario) =====================
   Para Blender (Archivo → Importar → glTF 2.0) y visores: un nodo por pieza, agrupadas en Tablero / Rastreles /
   Herrajes, con los materiales de la vista 3D (color, y si se pide las texturas de madera: color, relieve y
   rugosidad). glTF va en metros y con Y hacia arriba (Blender lo pasa solo a Z arriba). */
function bytesImagen(img) {
  const src = img && (img.currentSrc || img.src) || '';
  const m = /^data:(image\/(?:jpeg|png));base64,(.*)$/s.exec(src);
  let mime, b64;
  if (m) { mime = m[1]; b64 = m[2]; }
  else {   // otro formato (webp…) o una imagen dibujada: se pasa por un lienzo
    const w = img && (img.naturalWidth || img.width), h = img && (img.naturalHeight || img.height); if (!w || !h) return null;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    try { cv.getContext('2d').drawImage(img, 0, 0); const u = cv.toDataURL('image/jpeg', 0.9); mime = 'image/jpeg'; b64 = u.slice(u.indexOf(',') + 1); } catch (e) { return null; }
  }
  const t = atob(b64), u8 = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u8[i] = t.charCodeAt(i);
  return { mime, u8 };
}
function exportarGLB(opc) {
  const s = 1 / (1000 * (opc.escala || 1)), conTex = opc.texturas !== false;
  const js = { asset: { version: '2.0', generator: 'Made-rebanadas ' + VERSION }, scene: 0, scenes: [], nodes: [], meshes: [], materials: [], accessors: [], bufferViews: [], buffers: [] };
  const trozos = []; let largo = 0;
  const vista = (u8, objetivo) => { while (largo % 4) { trozos.push(new Uint8Array(1)); largo++; } js.bufferViews.push(Object.assign({ buffer: 0, byteOffset: largo, byteLength: u8.byteLength }, objetivo ? { target: objetivo } : {})); trozos.push(u8); largo += u8.byteLength; return js.bufferViews.length - 1; };
  const accesor = (arr, tipo, nc, objetivo, mm) => {
    const bv = vista(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength), objetivo);
    const a = { bufferView: bv, componentType: arr instanceof Float32Array ? 5126 : arr instanceof Uint16Array ? 5123 : 5125, count: arr.length / nc, type: tipo };
    if (mm) { const mn = new Array(nc).fill(Infinity), mx = new Array(nc).fill(-Infinity); for (let i = 0; i < arr.length; i++) { const c = i % nc; if (arr[i] < mn[c]) mn[c] = arr[i]; if (arr[i] > mx[c]) mx[c] = arr[i]; } a.min = mn; a.max = mx; }
    js.accessors.push(a); return js.accessors.length - 1;
  };
  // texturas e imágenes (cada imagen una vez)
  const imgs = new Map(), texs = new Map();
  const textura = tx => {
    if (!conTex || !tx || !tx.image) return null;
    if (texs.has(tx.image)) return texs.get(tx.image);
    let im = imgs.get(tx.image);
    if (im == null) { const b = bytesImagen(tx.image); if (!b) { texs.set(tx.image, null); return null; } (js.images = js.images || []).push({ bufferView: vista(b.u8), mimeType: b.mime }); im = js.images.length - 1; imgs.set(tx.image, im); }
    js.samplers = js.samplers || [{ magFilter: 9729, minFilter: 9987, wrapS: 10497, wrapT: 10497 }];
    (js.textures = js.textures || []).push({ sampler: 0, source: im }); const ti = js.textures.length - 1; texs.set(tx.image, ti); return ti;
  };
  // materiales: los de la vista 3D (sin el resaltado de la pieza seleccionada)
  const mats = new Map();
  const material = (mt, colorPieza) => {
    const conMapa = conTex && mt.map && mt.map.image;
    const col = conMapa || !colorPieza || !mt.map ? mt.color : new THREE.Color(colorPieza);
    const clave = [col ? col.getHexString() : '', conMapa ? mt.map.uuid : '', conTex && mt.normalMap ? mt.normalMap.uuid : '', conTex && mt.roughnessMap ? mt.roughnessMap.uuid : '', mt.roughness, mt.metalness, mt.opacity].join('|');
    if (mats.has(clave)) return mats.get(clave);
    const pbr = { baseColorFactor: col ? [col.r, col.g, col.b, mt.transparent ? mt.opacity : 1] : [1, 1, 1, 1], metallicFactor: mt.metalness || 0, roughnessFactor: Math.min(1, mt.roughness == null ? 0.6 : mt.roughness) };
    const ma = { name: 'Material ' + (js.materials.length + 1), pbrMetallicRoughness: pbr };
    if (conMapa) { const t = textura(mt.map); if (t != null) pbr.baseColorTexture = { index: t }; }
    if (conTex && mt.roughnessMap) { const t = textura(mt.roughnessMap); if (t != null) { pbr.metallicRoughnessTexture = { index: t }; pbr.metallicFactor = 0; } }   // la rugosidad va en el canal verde; el metal (azul) se anula
    if (conTex && mt.normalMap) { const t = textura(mt.normalMap); if (t != null) ma.normalTexture = { index: t, scale: mt.normalScale ? mt.normalScale.x : 1 }; }
    if (mt.transparent && mt.opacity < 1) ma.alphaMode = 'BLEND';
    if (mt.side === THREE.DoubleSide) ma.doubleSided = true;
    js.materials.push(ma); mats.set(clave, js.materials.length - 1); return js.materials.length - 1;
  };
  const piezas = []; let minY = Infinity, nT = 0;
  recorrerPiezas3D(opc, (m, nombre, color, grupo) => {
    const g = m.geometry, pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, idx = g.index, M = m.matrixWorld;
    const Nm = new THREE.Matrix3().getNormalMatrix(M), v = new THREE.Vector3(), espejo = M.determinant() < 0;
    const lista = Array.isArray(m.material) ? m.material : [m.material];
    const total = idx ? idx.count : pos.count, grupos = g.groups && g.groups.length ? g.groups : [{ start: 0, count: total, materialIndex: 0 }];
    const prims = new Map();
    grupos.forEach(gr => {
      const mt = lista[gr.materialIndex] || lista[0]; if (!mt) return;
      const base = mt;   // el resaltado de la pieza seleccionada (emissive) no se copia
      const mi = material(base, grupo === 'tablero' ? color : null);
      let pr = prims.get(mi); if (!pr) prims.set(mi, pr = { mapa: new Map(), P: [], N: [], U: [], I: [], rep: base.map ? base.map.repeat : null, off: base.map ? base.map.offset : null });
      const fin = Math.min(total, gr.start + gr.count);
      for (let k = gr.start; k + 2 < fin + 0; k += 3) {
        const t = [0, 1, 2].map(j => idx ? idx.getX(k + j) : k + j); if (espejo) t.reverse();
        t.forEach(vi => {
          let ni = pr.mapa.get(vi);
          if (ni == null) {
            ni = pr.P.length / 3; pr.mapa.set(vi, ni);
            v.fromBufferAttribute(pos, vi).applyMatrix4(M); pr.P.push(v.x * s, v.y * s, v.z * s); if (v.y * s < minY) minY = v.y * s;
            if (nor) { v.fromBufferAttribute(nor, vi).applyMatrix3(Nm).normalize(); pr.N.push(v.x, v.y, v.z); }
            if (uv) { const rx = pr.rep ? pr.rep.x : 1, ry = pr.rep ? pr.rep.y : 1, ox = pr.off ? pr.off.x : 0, oy = pr.off ? pr.off.y : 0; pr.U.push(uv.getX(vi) * rx + ox, 1 - (uv.getY(vi) * ry + oy)); }
          }
          pr.I.push(ni);
        });
        nT++;
      }
    });
    if (prims.size) piezas.push({ nombre, grupo, prims });
  });
  if (!piezas.length) throw new Error('No hay piezas que guardar.');
  // el mueble apoyado en el suelo (y = 0); grupos de nodos
  const nombresGrupo = { tablero: 'Tablero', rastreles: 'Rastreles', herrajes: 'Herrajes' }, hijos = {}, usados = {};
  piezas.forEach(p => {
    const primitives = [];
    p.prims.forEach((pr, mi) => {
      for (let k = 1; k < pr.P.length; k += 3) pr.P[k] -= minY;
      const at = { POSITION: accesor(new Float32Array(pr.P), 'VEC3', 3, 34962, true) };
      if (pr.N.length === pr.P.length) at.NORMAL = accesor(new Float32Array(pr.N), 'VEC3', 3, 34962);
      if (pr.U.length && pr.U.length / 2 === pr.P.length / 3) at.TEXCOORD_0 = accesor(new Float32Array(pr.U), 'VEC2', 2, 34962);
      const nV = pr.P.length / 3, I = nV < 65536 ? new Uint16Array(pr.I) : new Uint32Array(pr.I);
      primitives.push({ attributes: at, indices: accesor(I, 'SCALAR', 1, 34963), material: mi, mode: 4 });
    });
    let nom = p.nombre; usados[nom] = (usados[nom] || 0) + 1; if (usados[nom] > 1) nom += ' (' + usados[nom] + ')';
    js.meshes.push({ name: nom, primitives });
    js.nodes.push({ name: nom, mesh: js.meshes.length - 1 });
    (hijos[p.grupo] = hijos[p.grupo] || []).push(js.nodes.length - 1);
  });
  const grupos = Object.keys(hijos).map(gk => { js.nodes.push({ name: nombresGrupo[gk] || gk, children: hijos[gk] }); return js.nodes.length - 1; });
  js.nodes.push({ name: P.nombre || 'Mueble', children: grupos, extras: { programa: 'Made-rebanadas ' + VERSION, escala: opc.escala > 1 ? '1:' + opc.escala : '1:1' } });
  js.scenes.push({ name: P.nombre || 'Mueble', nodes: [js.nodes.length - 1] });
  while (largo % 4) { trozos.push(new Uint8Array(1)); largo++; }
  js.buffers.push({ byteLength: largo });
  ['images', 'samplers', 'textures'].forEach(k => { if (js[k] && !js[k].length) delete js[k]; });
  // empaquetado GLB: cabecera, trozo JSON (relleno con espacios) y trozo binario
  let jt = new TextEncoder().encode(JSON.stringify(js)); const pj = (4 - jt.length % 4) % 4;
  if (pj) { const t = new Uint8Array(jt.length + pj); t.set(jt); t.fill(32, jt.length); jt = t; }
  const totalB = 12 + 8 + jt.length + 8 + largo, out = new Uint8Array(totalB), dv = new DataView(out.buffer);
  dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, totalB, true);
  dv.setUint32(12, jt.length, true); dv.setUint32(16, 0x4E4F534A, true); out.set(jt, 20);
  let o = 20 + jt.length; dv.setUint32(o, largo, true); dv.setUint32(o + 4, 0x004E4942, true); o += 8;
  trozos.forEach(t => { out.set(t, o); o += t.byteLength; });
  descargar(nombreArchivo(P.nombre) + sufijo3D(opc) + '.glb', new Blob([out], { type: 'model/gltf-binary' }));
  return { piezas: piezas.length, triangulos: nT, bytes: totalB, texturas: (js.images || []).length };
}
const sufijo3D = opc => (opc.escala > 1 ? '_1a' + opc.escala : '');

/* ===================== SOLIDCRAFT (.sc y JSON plano) =====================
   Un componente con una importación de mallas («mesh_import»): cada pieza es un cuerpo con su nombre
   (Lama 12a, Rastrel 2…) y su color. Los vértices se sueldan para que cada malla sea cerrada.
   - JSON plano: el documento de SolidCraft con las mallas escritas dentro (formato de entrada y salida
     que SolidCraft admite tal cual).
   - .sc: el mismo documento en un zip, con cada malla en un blob binario SCMESH01 (más pequeño y rápido). */
const FORMATO_SOLIDCRAFT = 'solidcraft/58';
function soldarMalla(V, F) {
  const idx = new Map(), pos = [], tri = [], q = v => Math.round(v * 1e4) / 1e4;
  const id = p => { const k = q(p[0]) + ',' + q(p[1]) + ',' + q(p[2]); let n = idx.get(k); if (n == null) { n = pos.length / 3; idx.set(k, n); pos.push(q(p[0]), q(p[1]), q(p[2])); } return n; };
  F.forEach(f => { const a = id(V[f[0]]), b = id(V[f[1]]), c = id(V[f[2]]); if (a !== b && b !== c && a !== c) tri.push(a, b, c); });
  taparAgujeros(tri);
  return { pos, tri };
}
// tapa los agujeritos que deja el triangulador en las tapas cuando el contorno se toca a sí mismo (rincones
// finos de las letras hundidas, cortes en punta): sigue cada borde suelto al revés y lo cierra en abanico,
// así la malla queda cerrada y con las caras bien orientadas
function taparAgujeros(tri) {
  const dir = new Set(); for (let t = 0; t < tri.length; t += 3) for (let k = 0; k < 3; k++) dir.add(tri[t + k] + '>' + tri[t + (k + 1) % 3]);
  const sale = new Map(); let nb = 0;   // bordes sueltos a→b, que se cierran yendo b→a (varios por vértice si dos agujeros se tocan)
  for (let t = 0; t < tri.length; t += 3) for (let k = 0; k < 3; k++) { const a = tri[t + k], b = tri[t + (k + 1) % 3]; if (!dir.has(b + '>' + a)) { if (!sale.has(b)) sale.set(b, []); sale.get(b).push(a); nb++; } }
  if (!nb || nb > 4000) return 0;
  let n = 0;
  for (const ini of [...sale.keys()]) {
    while ((sale.get(ini) || []).length) {
      const L = [ini]; let v = sale.get(ini).pop(), pasos = 0;
      while (v !== ini && pasos++ < 1000) { L.push(v); const s2 = sale.get(v); if (!s2 || !s2.length) break; v = s2.pop(); }
      if (v !== ini || L.length < 3) continue;
      for (let k = 1; k + 1 < L.length; k++) { tri.push(L[0], L[k], L[k + 1]); n++; }
    }
  }
  return n;
}
function documentoSolidcraft(ps, nombre, archivo, blobs) {
  const usados = new Set(), unico = n => { let m = n, k = 2; while (usados.has(m)) m = `${n} (${k++})`; usados.add(m); return m; };
  const rgb = h => [1, 3, 5].map(k => +(parseInt(h.slice(k, k + 2), 16) / 255).toFixed(4));
  const meshes = ps.map((p, i) => {
    const m = { name: unico(p.nombre), positions: blobs ? [] : p.pos, triangles: blobs ? [] : p.tri, color: rgb(p.color) };
    if (blobs) m.mesh_blob = blobs[i];
    return m;
  });
  return {
    components: [{ id: 1, identification_color_index: 0, name: nombre, parent: 0 }],
    features: [{ body_names: meshes.map(m => m.name), component: 1, file: archivo, id: 3, inserted: true, meshes, name: nombre, suppressed: false, type: 'mesh_import' }],
    format: FORMATO_SOLIDCRAFT, name: nombre, next_component_color_index: 1, next_id: 4,
    occurrences: [{ component: 1, grounded: true, id: 2, name: nombre + ':1', parent: 0, transform: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]] }],
    params: [], units: 'mm',
  };
}
// SHA-256 (los blobs del .sc se llaman por el hash de su contenido)
function sha256(bytes) {
  const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const n = bytes.length, total = Math.ceil((n + 9) / 64) * 64, m = new Uint8Array(total); m.set(bytes); m[n] = 0x80;
  const dv = new DataView(m.buffer); dv.setUint32(total - 8, Math.floor(n / 0x20000000)); dv.setUint32(total - 4, (n * 8) >>> 0);
  const W = new Uint32Array(64), r = (x, k) => (x >>> k) | (x << (32 - k));
  for (let o = 0; o < total; o += 64) {
    for (let t = 0; t < 16; t++) W[t] = dv.getUint32(o + t * 4);
    for (let t = 16; t < 64; t++) { const a = W[t - 15], b = W[t - 2]; W[t] = (W[t - 16] + (r(a, 7) ^ r(a, 18) ^ (a >>> 3)) + W[t - 7] + (r(b, 17) ^ r(b, 19) ^ (b >>> 10))) >>> 0; }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + W[t]) >>> 0, t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return [...H].map(v => v.toString(16).padStart(8, '0')).join('');
}
const TABLA_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = TABLA_CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
// zip sin comprimir (método «store»), nombres en UTF-8
function zipSinComprimir(entradas) {
  const enc = new TextEncoder(), partes = [], centrales = []; let off = 0;
  entradas.forEach(({ nombre, datos }) => {
    const nb = enc.encode(nombre), crc = crc32(datos), L = new DataView(new ArrayBuffer(30));
    L.setUint32(0, 0x04034b50, true); L.setUint16(4, 20, true); L.setUint16(6, 0x0800, true); L.setUint16(8, 0, true); L.setUint16(10, 0, true); L.setUint16(12, 0x21, true);
    L.setUint32(14, crc, true); L.setUint32(18, datos.length, true); L.setUint32(22, datos.length, true); L.setUint16(26, nb.length, true); L.setUint16(28, 0, true);
    const C = new DataView(new ArrayBuffer(46));
    C.setUint32(0, 0x02014b50, true); C.setUint16(4, 20, true); C.setUint16(6, 20, true); C.setUint16(8, 0x0800, true); C.setUint16(10, 0, true); C.setUint16(12, 0, true); C.setUint16(14, 0x21, true);
    C.setUint32(16, crc, true); C.setUint32(20, datos.length, true); C.setUint32(24, datos.length, true); C.setUint16(28, nb.length, true); C.setUint32(42, off, true);
    partes.push(new Uint8Array(L.buffer), nb, datos); centrales.push(new Uint8Array(C.buffer), nb);
    off += 30 + nb.length + datos.length;
  });
  const tamC = centrales.reduce((a, b) => a + b.length, 0), E = new DataView(new ArrayBuffer(22));
  E.setUint32(0, 0x06054b50, true); E.setUint16(8, entradas.length, true); E.setUint16(10, entradas.length, true); E.setUint32(12, tamC, true); E.setUint32(16, off, true);
  return new Blob([...partes, ...centrales, new Uint8Array(E.buffer)], { type: 'application/zip' });
}
// malla en el binario SCMESH01: cabecera, nº de coordenadas y de índices (u64), coordenadas f64 e índices u32
function blobSCMESH(pos, tri) {
  const buf = new ArrayBuffer(8 + 16 + pos.length * 8 + tri.length * 4), dv = new DataView(buf), u8 = new Uint8Array(buf);
  u8.set(new TextEncoder().encode('SCMESH01'), 0);
  dv.setUint32(8, pos.length, true); dv.setUint32(12, 0, true); dv.setUint32(16, tri.length, true); dv.setUint32(20, 0, true);
  let o = 24; pos.forEach(v => { dv.setFloat64(o, v, true); o += 8; }); tri.forEach(v => { dv.setUint32(o, v, true); o += 4; });
  return u8;
}
function exportarSolidcraft(opc) {
  const ps = piezasCerradas(opc);
  const base = nombreArchivo(P.nombre) + sufijo3D(opc), nombre = P.nombre || 'Made-rebanadas', nT = ps.reduce((a, p) => a + p.tri.length / 3, 0);
  if (opc.formato === 'scjson') {
    descargar(base + '.json', JSON.stringify(documentoSolidcraft(ps, nombre, base + '.json')), 'application/json');
  } else {
    const enc = new TextEncoder(), blobs = [], datos = new Map();
    ps.forEach(p => { const b = blobSCMESH(p.pos, p.tri), ruta = 'blobs/' + sha256(b) + '.mesh'; blobs.push(ruta); datos.set(ruta, b); });
    const doc = documentoSolidcraft(ps, nombre, base + '.sc', blobs);
    descargar(base + '.sc', zipSinComprimir([
      { nombre: 'container.json', datos: enc.encode(JSON.stringify({ format: 'solidcraft-container/1' })) },
      { nombre: 'document.json', datos: enc.encode(JSON.stringify(doc)) },
      ...[...datos.entries()].map(([nombre, d]) => ({ nombre, datos: d })),
    ]));
  }
  return { piezas: ps.length, triangulos: nT };
}
function dialogo3D() {
  const esc0 = enMaqueta() ? P.maqueta.escala : 1, opc0 = (() => { try { return JSON.parse(lsGet('made-rebanadas.exp3d', '{}')); } catch (e) { return {}; } })();
  modal('🧊 Guardar el modelo 3D', `
    <p class="nota">Guarda el mueble montado (sin explosión), en milímetros, para abrirlo en otro programa (SketchUp, Fusion, Blender, FreeCAD…) o imprimir una maqueta en 3D.</p>
    <label class="fila">Formato <select id="x3Formato"><option value="stl">STL</option><option value="obj">OBJ + MTL</option><option value="glb">GLB (Blender, con texturas)</option><option value="sc">SolidCraft (.sc)</option><option value="scjson">SolidCraft (JSON plano)</option></select></label>
    <label class="fila chk oculto" id="filaX3Tex" title="Las maderas de la vista 3D (color, relieve y rugosidad). Sin ellas, cada pieza con su color liso y un archivo mucho más pequeño"><input type="checkbox" id="x3Tex" ${opc0.texturas === false ? '' : 'checked'}> Incluir las texturas de madera</label>
    <label class="fila" id="filaX3Eje" title="La mayoría de programas de CAD e impresión 3D usan Z hacia arriba">Eje vertical <select id="x3Eje"><option value="z">Z arriba</option><option value="y">Y arriba</option></select></label>
    <label class="fila" title="1 = tamaño real. Para imprimir una maqueta: 10, 20…">Escala 1: <input type="number" id="x3Escala" min="1" step="1" value="${opc0.escala || esc0}"></label>
    <label class="fila chk"><input type="checkbox" id="x3Herrajes" ${opc0.herrajes === false ? '' : 'checked'}> Incluir varillas, tubos y rastreles</label>
    <ul class="nota" style="margin:4px 0 0 18px;padding:0"><li><b>STL</b>: una sola malla; para imprimir en 3D o ver la forma.</li><li><b>OBJ + MTL</b>: cada pieza aparte con su nombre (Lama 1, Larguero A…) y el color de su material.</li><li><b>GLB</b> (glTF): para <b>Blender</b> (<i>Archivo → Importar → glTF 2.0</i>) y visores 3D; cada pieza con su nombre y los materiales de la vista 3D, con las texturas de madera dentro. Va en metros y Blender lo pone con Z arriba solo.</li><li><b>SolidCraft</b>: el diseño listo para abrir, con cada pieza como un cuerpo con su nombre y color. El <b>.sc</b> es su archivo de siempre (más pequeño y rápido); el <b>JSON plano</b> es texto, se puede leer y comparar.</li><li><b>Z arriba</b> para CAD e impresión 3D; <b>Y arriba</b> para Blender o three.js.</li></ul>
    <p class="nota" id="x3Info"></p>`,
    [['💾 Guardar', () => {
      const opc = { formato: $('#x3Formato').value, zArriba: $('#x3Eje').value === 'z', escala: Math.max(1, +$('#x3Escala').value || 1), herrajes: $('#x3Herrajes').checked, texturas: $('#x3Tex').checked };
      lsSet('made-rebanadas.exp3d', JSON.stringify(opc));
      try {
        const r = opc.formato === 'glb' ? exportarGLB(opc) : opc.formato === 'obj' ? exportarOBJ(opc) : opc.formato === 'sc' || opc.formato === 'scjson' ? exportarSolidcraft(opc) : exportarSTL(opc);
        cerrarModal(); aviso(`Modelo 3D guardado: ${r.piezas} piezas, ${r.triangulos.toLocaleString('es-ES')} triángulos${opc.formato === 'obj' ? ' (.obj y .mtl)' : ''}${r.bytes ? ` · ${fmt(r.bytes / 1048576, 1)} MB${r.texturas ? ` con ${r.texturas} textura${r.texturas > 1 ? 's' : ''}` : ''}` : ''}`, 4000);
      } catch (e) { aviso('⚠ ' + esc(e.message), 5000); }
    }, true]]);
  if (opc0.formato) $('#x3Formato').value = opc0.formato;
  if (opc0.zArriba === false) $('#x3Eje').value = 'y';
  const verFormato = () => { const glb = $('#x3Formato').value === 'glb'; $('#filaX3Tex').classList.toggle('oculto', !glb); $('#filaX3Eje').classList.toggle('oculto', glb); };
  $('#x3Formato').onchange = verFormato; verFormato();
  const info = () => { const k = Math.max(1, +$('#x3Escala').value || 1), d = G.dims || [0, 0, 0]; $('#x3Info').textContent = `Medidas del modelo guardado: ${fmt(d[0] / k)} × ${fmt(d[1] / k)} × ${fmt(d[2] / k)} mm (largo × fondo × alto).`; };
  $('#x3Escala').oninput = info; info();
}

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
  if (grupoDe(id) === 'plano') { p.tipo = 'plano'; p.costillas.material = 'abedul'; }
  if (grupoDe(id) === 'radial') { p.tipo = 'radial'; p.costillas.grosor = 6; p.costillas.modo = 'numero'; p.costillas.numero = 12; p.radial.tubo = Math.max(p.radial.tubo, Math.ceil(p.costillas.numero * (p.costillas.grosor + 1) / Math.PI)); }
  if (extra) {
    if (extra.params) Object.assign(p.params, extra.params);
    if (extra.costillas) Object.assign(p.costillas, extra.costillas);
    if (extra.varillas) Object.assign(p.varillas, extra.varillas);
    if (extra.reticula) Object.assign(p.reticula, extra.reticula);
    if (extra.tipo) p.tipo = extra.tipo;
    if (extra.plano) Object.assign(p.plano, JSON.parse(JSON.stringify(extra.plano)));
    ['planta', 'radial', 'pared', 'relieve', 'figura'].forEach(k => { if (extra[k]) Object.assign(p[k], extra[k]); });
    if (Array.isArray(extra.huecos)) p.huecos = extra.huecos.map(h => {
      const b = huecoNuevo(h.forma || 'rect'), r = Object.assign(b, JSON.parse(JSON.stringify(h)), { mueble: Object.assign(b.mueble, h.mueble || {}) });
      if (r.forma === 'texto' && h.ancho == null) ajustarCajaTexto(r, true);
      return r;
    });
    if (extra.nombre) p.nombre = extra.nombre;
  }
  return p;
}
function cargarProyecto(p, autoVar) {
  P = p; UI.clave = 0; UI.punto = -1; UI.varilla = -1; UI.costilla = 0;
  if (!P.claves || !P.claves.length) aplicarPlantilla();
  // huecos de los ejemplos que van centrados en el panel (ya se conocen sus medidas)
  (P.huecos || []).forEach(h => { if (!h.centrar) return; if (P.tipo === 'pared') { const [W, H] = medidasPanel(); h.x = Math.round((W - h.ancho) / 2); h.y = Math.round((H - h.alto) / 2); } delete h.centrar; });
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
  p.pared.partir = Object.assign(proyectoBase().pared.partir, (o.pared || {}).partir || {});
  p.pared.modulos = Object.assign(proyectoBase().pared.modulos, (o.pared || {}).modulos || {});
  p.huecos = Array.isArray(o.huecos) ? o.huecos.map(h => { const b = huecoNuevo(h.forma || 'rect'); return Object.assign(b, h, { mueble: Object.assign(b.mueble, h.mueble || {}) }); }) : [];
  if (!['reticula', 'radial', 'pared', 'plano'].includes(p.tipo)) p.tipo = 'costillas';
  p.plano = Object.assign(proyectoBase().plano, o.plano || {});
  p.plano.piezas = (Array.isArray(p.plano.piezas) ? p.plano.piezas : []).filter(z => z && (z.igualA != null || (Array.isArray(z.pts) && z.pts.length >= 3)))
    .map(z => Object.assign({ nombre: 'Pieza', plano: 'frente', c: 0 }, z, { plano: PLANOS[z.plano] ? z.plano : 'frente', c: isFinite(+z.c) ? +z.c : 0 }));
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
// nombre de archivo de la miniatura de un ejemplo: «Banco en S» → assets/miniaturas/ej_banco_en_s.jpg
const slugEjemplo = n => 'ej_' + n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
function dialogoEjemplos() {
  const E = window.MADE_EJEMPLOS || [];
  const items = E.map((e, i) => `<button data-ej="${i}"><img src="assets/miniaturas/${slugEjemplo(e.nombre)}.jpg" alt="" loading="lazy" onerror="this.style.display='none'"><b>${esc(e.nombre)}</b><small>${esc(e.desc)}</small></button>`).join('');
  modal('🪑 Ejemplos', `<p class="nota">Muebles de ejemplo para ver cómo funciona. Se abren como un proyecto nuevo.</p><div class="plantillas">${items || '<p>No se encuentra assets/ejemplos/ejemplos.js</p>'}</div>`, [], true);
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

/* ===================== INICIO ===================== */
function ponerTema(t) {
  document.documentElement.dataset.theme = t; lsSet('made-rebanadas.tema', t);
  colores3D(); if (VP) { VP.pintar(); VC.pintar(); }
}
function iniciar() {
  if (!T || !T.WebGLRenderer) { document.body.innerHTML = '<p style="padding:30px">No se encuentra <b>assets/js/three-bundle.js</b>. Copia la carpeta completa del programa.</p>'; return; }
  const tema = lsGet('made-rebanadas.tema', window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = tema;
  P = proyectoDePlantilla('banco');
  iniciarEditor(); iniciarHuecos(); iniciarPanel(); iniciar3D(); arrastrarModal();
  $('#bNuevo').onclick = dialogoNuevo;
  $('#bAbrir').onclick = abrirArchivo;
  $('#bGuardar').onclick = guardarArchivo;
  $('#bEjemplo').onclick = dialogoEjemplos;
  $('#bDeshacer').onclick = () => irHistoria(-1);
  $('#bRehacer').onclick = () => irHistoria(1);
  $('#bDespiece').onclick = abrirDespiece;
  $('#bFabricar').onclick = abrirFabricar;
  $('#bImagen').onclick = imagenPNG;
  $('#b3D').onclick = dialogo3D;
  $('#bPlano').onclick = exportarPlano;
  $('#bAnidador').onclick = abrirAnidador;
  $('#anidCerrar').onclick = cerrarAnidador;
  $('#bTema').onclick = () => ponerTema(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  $('#bAyuda').onclick = () => window.open('ayuda/manual.html', '_blank');
  $('#mCerrar').onclick = cerrarModal;
  $('#modal').addEventListener('pointerdown', ev => { if (ev.target.id === 'modal') cerrarModal(); });
  document.addEventListener('keydown', ev => {
    const enCampo = /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
    if ((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && ev.key.toLowerCase() === 'z') { if (enCampo) return; ev.preventDefault(); irHistoria(-1); return; }
    if ((ev.ctrlKey || ev.metaKey) && (ev.key.toLowerCase() === 'y' || (ev.shiftKey && ev.key.toLowerCase() === 'z'))) { if (enCampo) return; ev.preventDefault(); irHistoria(1); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') { ev.preventDefault(); guardarArchivo(); return; }
    if (!$('#anidVentana').classList.contains('oculto')) return;
    if (enCampo || !$('#modal').classList.contains('oculto')) { if (ev.key === 'Escape') cerrarModal(); return; }
    if (ev.key === 'Escape') { UI.modo = 'normal'; UI.punto = -1; UI.varilla = -1; VP.pintar(); }
    else if (ev.key === 'Delete' || ev.key === 'Backspace') {
      if (UI.vistaHuecos && huecoSel()) borrarHueco(UI.hueco);
      else if (UI.varilla >= 0) { P.varillas.lista.splice(UI.varilla, 1); UI.varilla = -1; cambio('Varilla quitada'); }
      else if (UI.punto >= 0) borrarPunto(UI.punto);
    }
    else if (ev.key.toLowerCase() === 'e') alternarEsquina(UI.punto);
    else if (ev.key.toLowerCase() === 'f') { camara('tres4'); encuadrarPerfil(); encuadrarCostilla(); }
    else if (ev.key === 'ArrowLeft') selCostilla(UI.costilla - 1);
    else if (ev.key === 'ArrowRight') selCostilla(UI.costilla + 1);
    else if (ev.key === 'PageUp') { UI.clave = Math.max(0, UI.clave - 1); UI.punto = -1; refrescarClaves(); VP.pintar(); construirClaves3D(); costillaDeClave(); }
    else if (ev.key === 'PageDown') { UI.clave = Math.min(P.claves.length - 1, UI.clave + 1); UI.punto = -1; refrescarClaves(); VP.pintar(); construirClaves3D(); costillaDeClave(); }
  });
  window.addEventListener('beforeunload', ev => { if (UI.sucio) { ev.preventDefault(); ev.returnValue = ''; } });
  // espera a que las vistas tengan tamaño
  requestAnimationFrame(() => { ajustar3D(); VP.ajustar(); VC.ajustar(); cargarProyecto(P, true); });
}
// para las pruebas automáticas
window.MadeRebanadas = { get P() { return P; }, get R() { return R; }, calcular: () => { const t = performance.now(); R = calcular(); return performance.now() - t; }, autoVar: () => autoVarillas(P.varillas.autoN), construir3D: () => { const t = performance.now(); construir3D(); return performance.now() - t; }, cargar: o => cargarProyecto(validarProyecto(o)), dxf: () => dxf(), svg: () => svg(), plano: () => planoPDF(), malla3D: o => piezasMalla3D(o || {}), pieza: i => piezaCalcador([...R.costillas, ...R.otras][i]), geo: i => geoFab([...R.costillas, ...R.otras][i]), camara: t => camara(t), selCostilla: i => selCostilla(i), slugEjemplo: n => slugEjemplo(n), formasTexto: h => formasTexto(h), leerSVG: t => leerSVG(t), leerMalla: (b, n) => leerMalla(b, n), polyVista: i => { const c = [...R.costillas, ...R.otras][i]; return { poly: c.poly, vista: polyVista(c.poly), esq: c.poly.esq || [] }; }, cerradas: o => piezasCerradas(o || { zArriba: true, escala: 1, herrajes: true }),
  leerDXF: t => leerDXF(t), colocar: () => colocarEnTableros(fabActual()), compra: () => listaCompra(), despiece: () => filasDespiece(), csvCortes: () => { let out; const d0 = descargar; descargar = (n, c) => { out = c; }; try { exportarCSVCortes(); } finally { descargar = d0; } return out; }, vetaDe: c => vetaDe(c), ponVeta: (c, v) => ponVeta(c, v),
  pantallaPunto: i => { const k = claveActual().pts[i], r = $('#cPerfil').getBoundingClientRect(), q = VP.aPantalla(k[0], k[1]); return [r.left + q[0], r.top + q[1]]; },
  pantallaVarilla: i => { const k = P.varillas.lista[i], r = $('#cPerfil').getBoundingClientRect(), q = VP.aPantalla(k[0], k[1]); return [r.left + q[0], r.top + q[1]]; } };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
