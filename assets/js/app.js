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
const VERSION = '1.0';
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
  costilla: 0,         // costilla seleccionada
  modo: 'normal',      // 'normal' | 'varilla' (colocar varilla con un clic)
  sucio: false,        // cambios sin guardar
};

function proyectoBase() {
  return {
    app: 'Made-rebanadas', version: 1, versionPrograma: VERSION,
    nombre: 'Mueble', plantilla: 'banco', params: {}, editado: false,
    largo: 1600,
    esquinas: [],                // por punto de control: true = esquina, false = curva
    claves: [],                  // [{ x: mm a lo largo, pts: [[u, v], …] }]
    interp: 'curva',
    costillas: { grosor: 18, modo: 'separacion', separacion: 60, numero: 25, base: true, tope: false, topeAlt: 400, material: 'abedul', color: '#f2efe8' },
    varillas: { tipo: 'roscada', diam: 10, holgura: 0.5, margen: 20, tramo: 'todas', separadores: true, sepD: 22, sobra: 12, autoN: 3, lista: [] },
    vista: { explosion: 0, fantasma: false, varillas: true, resalta: true },
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
  if (poly.length >= 3 && areaFirmada(poly) < 0) poly.reverse();
  return poly;
}

/* ===================== COSTILLAS Y VARILLAS ===================== */
function grosor() { return P.costillas.grosor; }
function reparto() {
  const e = grosor(), L = P.largo, c = P.costillas;
  let n;
  if (c.modo === 'numero') n = Math.max(2, Math.round(c.numero));
  else n = Math.max(2, Math.round((L - e) / Math.max(1, c.separacion)) + 1);
  n = Math.min(n, 600);
  const s = (L - e) / (n - 1);
  return { n, s, hueco: s - e };
}
function radioAgujero() { return (P.varillas.diam + P.varillas.holgura) / 2; }

function calcular() {
  const e = grosor(), rep = reparto(), V = P.varillas;
  const res = { n: rep.n, sep: rep.s, hueco: rep.hueco, costillas: [], varillas: [], avisos: [] };
  for (let i = 0; i < rep.n; i++) {
    const x = e / 2 + i * rep.s, ctrl = perfilEn(x), poly = contornoDe(ctrl);
    const ok = poly.length >= 3 && Math.abs(areaFirmada(poly)) > 25;
    const caja = ok ? cajaDe(poly) : { x0: 0, y0: 0, x1: 0, y1: 0, w: 0, h: 0 };
    res.costillas.push({ i, x, poly: ok ? poly : [], ok, caja, area: ok ? areaFirmada(poly) : 0, agujeros: [], nVar: 0 });
  }
  // varillas: ¿caben en cada costilla?
  const need = radioAgujero() + V.margen;
  V.lista.forEach((p, k) => {
    const cabe = res.costillas.map(c => c.ok && distBorde(c.poly, p[0], p[1]) >= need - 1e-6);
    let a = 0, b = rep.n - 1, usada = true;
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
    for (let i = a; i <= b && usada; i++) { if (cabe[i]) { res.costillas[i].agujeros.push(k); res.costillas[i].nVar++; } else fallan.push(i); }
    res.varillas.push({ k, u: p[0], v: p[1], cabe, a, b, usada, fallan,
      largo: usada ? (b - a) * rep.s + e + 2 * V.sobra : 0 });
  });
  avisosDe(res, need);
  return res;
}

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
  if (vacias.length) add('error', `Sin forma tras los recortes: ${cst(vacias)}.`, vacias[0]);
  if (!V.lista.length) add('atencion', 'No hay varillas: pulsa ✨ Auto o ＋ Varilla para unir las costillas.');
  res.varillas.forEach(r => {
    const nom = 'Varilla ' + (r.k + 1);
    if (!r.usada) { add('error', `${nom}: no cabe en ninguna costilla (necesita ${fmt(2 * need, 0)} mm de madera alrededor).`); return; }
    if (r.fallan.length) add('error', `${nom}: no cabe con ${fmt(V.margen, 0)} mm de madera al borde en ${cstLa(r.fallan)}.`, r.fallan[0]);
  });
  // varillas demasiado juntas
  for (let i = 0; i < V.lista.length; i++) for (let j = i + 1; j < V.lista.length; j++) {
    const d = Math.hypot(V.lista[i][0] - V.lista[j][0], V.lista[i][1] - V.lista[j][1]);
    if (d < 2 * radioAgujero() + V.margen) add('error', `Las varillas ${i + 1} y ${j + 1} están demasiado juntas (${fmt(d, 0)} mm entre centros).`);
  }
  if (V.lista.length) {
    const sueltas = res.costillas.filter(c => c.ok && c.nVar === 0).map(c => c.i);
    if (sueltas.length) add('error', `Sueltas, sin ninguna varilla: ${cst(sueltas)}.`, sueltas[0]);
    const una = res.costillas.filter(c => c.ok && c.nVar === 1).map(c => c.i);
    if (una.length) add('atencion', `Con una sola varilla (pueden girar; hacen falta 2): ${cst(una)}.`, una[0]);
    if (V.separadores && res.hueco > 0.5 && V.sepD <= V.diam + 1) add('error', `El separador (Ø ${V.sepD}) tiene que ser más ancho que la varilla (Ø ${V.diam}).`);
    if (V.separadores && res.hueco > 0.5) {
      const r2 = V.sepD / 2, malos = [];
      res.costillas.forEach(c => { if (!c.ok) return; for (const k of c.agujeros) if (distBorde(c.poly, V.lista[k][0], V.lista[k][1]) < r2 - 0.01) { malos.push(c.i); break; } });
      if (malos.length) add('atencion', `El separador asoma por el borde en ${cstLa(malos)}.`, malos[0]);
    }
  }
  const alto = res.costillas.filter(c => c.ok && c.caja.y0 > 1).map(c => c.i);
  if (P.costillas.base && alto.length && alto.length < res.n) add('info', `No llegan al suelo (cuelgan de las varillas): ${cst(alto)}.`, alto[0]);
  if (!A.some(a => a.tipo === 'error' || a.tipo === 'atencion')) add('ok', 'Todo correcto: las varillas caben y todas las costillas están sujetas.');
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
function puntoEtiqueta(c) {
  if (!c.ok) return [0, 0];
  const b = c.caja, paso = Math.max(2, Math.min(b.w, b.h) / 30), r = radioAgujero();
  let mejor = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2], md = -Infinity;
  for (let y = b.y0 + paso / 2; y < b.y1; y += paso) for (let x = b.x0 + paso / 2; x < b.x1; x += paso) {
    let d = distBorde(c.poly, x, y); if (d <= 0) continue;
    for (const k of c.agujeros) d = Math.min(d, Math.hypot(x - P.varillas.lista[k][0], y - P.varillas.lista[k][1]) - r);
    if (d > md) { md = d; mejor = [x, y]; }
  }
  return mejor;
}

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
};

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
  const g = pl.generar(P.params);
  P.largo = g.largo; P.esquinas = g.esquinas; P.claves = g.claves; P.editado = false;
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
function colorCostilla(alfa) { return `rgba(168,116,63,${alfa})`; }

function dibujarPerfil(ctx, V) {
  V.rejilla(ctx);
  if (!P || !R) return;
  const C = clavesOrdenadas(), k = claveActual(), acento = cssVar('--acento');
  // todas las costillas, muy suaves (la «envolvente»)
  ctx.lineWidth = 1; ctx.strokeStyle = colorCostilla(.16);
  R.costillas.forEach(c => { if (c.ok) { V.camino(ctx, c.poly); ctx.stroke(); } });
  // costilla seleccionada
  const cs = R.costillas[UI.costilla];
  if (cs && cs.ok) { ctx.setLineDash([6, 4]); ctx.strokeStyle = colorCostilla(.75); ctx.lineWidth = 1.4; V.camino(ctx, cs.poly); ctx.stroke(); ctx.setLineDash([]); }
  // otras claves
  ctx.strokeStyle = cssVar('--ejes'); ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
  C.forEach(o => { if (o !== k) { V.camino(ctx, curvaCerrada(o.pts, P.esquinas)); ctx.stroke(); } });
  ctx.setLineDash([]);
  // clave actual: curva completa y contorno recortado
  const curva = curvaCerrada(k.pts, P.esquinas), cont = contornoDe(k.pts);
  ctx.fillStyle = conAlfa(acento, .13);
  if (cont.length >= 3) { V.camino(ctx, cont); ctx.fill(); }
  ctx.strokeStyle = acento; ctx.lineWidth = 1; ctx.globalAlpha = .45; V.camino(ctx, curva); ctx.stroke(); ctx.globalAlpha = 1;
  if (cont.length >= 3) { ctx.lineWidth = 2.2; V.camino(ctx, cont); ctx.stroke(); }
  // corte superior
  if (P.costillas.tope) {
    const [, y] = V.aPantalla(0, P.costillas.topeAlt);
    ctx.strokeStyle = cssVar('--peligro'); ctx.setLineDash([8, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(V.w, y); ctx.stroke(); ctx.setLineDash([]);
  }
  // polígono de control
  ctx.strokeStyle = cssVar('--suave'); ctx.lineWidth = .8; ctx.setLineDash([2, 3]);
  V.camino(ctx, k.pts); ctx.stroke(); ctx.setLineDash([]);
  // varillas
  const r = radioAgujero(), Vv = P.varillas;
  Vv.lista.forEach((p, i) => {
    const info = R.varillas[i], mal = info && (!info.usada || info.fallan.length), [x, y] = V.aPantalla(p[0], p[1]);
    const col = mal ? cssVar('--peligro') : '#5f6b78';
    ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.arc(x, y, (r + Vv.margen) * V.sc, 0, PI2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = mal ? 'rgba(192,57,43,.35)' : 'rgba(95,107,120,.35)'; ctx.lineWidth = i === UI.varilla ? 2.5 : 1.5;
    ctx.beginPath(); ctx.arc(x, y, Math.max(3, r * V.sc), 0, PI2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'left'; ctx.fillText('V' + (i + 1), x + Math.max(5, r * V.sc) + 3, y - 4);
  });
  // puntos de control
  k.pts.forEach((p, i) => {
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
  const k = claveActual(); let mejor = -1, md = 10;
  k.pts.forEach((p, i) => { const [x, y] = VP.aPantalla(p[0], p[1]), d = Math.hypot(x - mx, y - my); if (d < md) { md = d; mejor = i; } });
  return mejor;
}
function varillaCerca(mx, my) {
  let mejor = -1, md = Infinity; const r = radioAgujero();
  P.varillas.lista.forEach((p, i) => { const [x, y] = VP.aPantalla(p[0], p[1]), d = Math.hypot(x - mx, y - my); if (d < Math.max(9, r * VP.sc + 4) && d < md) { md = d; mejor = i; } });
  return mejor;
}
function tramoCerca(mx, my) {
  const k = claveActual(), m = curvaConTramos(k.pts, P.esquinas, 24);
  let mejor = null, md = 9;
  m.forEach(o => { const [x, y] = VP.aPantalla(o.p[0], o.p[1]), d = Math.hypot(x - mx, y - my); if (d < md) { md = d; mejor = o; } });
  return mejor;
}
function insertarPunto(j, s) {
  const n = P.esquinas.length;
  P.claves.forEach(c => { const q = puntoTramo(c.pts, P.esquinas, j, s); c.pts.splice(j + 1, 0, [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10]); });
  P.esquinas.splice(j + 1, 0, false);
  UI.punto = (j + 1) % (n + 1); P.editado = true;
}
function borrarPunto(i) {
  if (P.esquinas.length <= 3) { aviso('Un perfil necesita al menos 3 puntos.'); return; }
  P.claves.forEach(c => c.pts.splice(i, 1)); P.esquinas.splice(i, 1);
  UI.punto = -1; P.editado = true; cambio('Punto borrado');
}
function alternarEsquina(i) {
  if (i < 0) { aviso('Selecciona antes un punto del perfil.'); return; }
  P.esquinas[i] = !P.esquinas[i]; P.editado = true; cambio(P.esquinas[i] ? 'Punto en esquina' : 'Punto en curva');
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
      const k = claveActual();
      ED.arr = { tipo: 'punto', i: ip, x: mx, y: my, orig: P.claves.map(o => o.pts[ip].slice()), base: k.pts[ip].slice(), movido: false };
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
      const k = claveActual(), nu = ev.shiftKey ? A.base[0] + du : snap(A.base[0] + du), nv = ev.shiftKey ? A.base[1] + dv : snap(A.base[1] + dv);
      if ($('#kTodas').checked) {
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
    const t = tramoCerca(mx, my); if (t) { insertarPunto(t.j, t.s); cambio('Punto añadido'); }
  });
  $('#bEsquina').onclick = () => alternarEsquina(UI.punto);
  $('#bEncuadrarPerfil').onclick = () => encuadrarPerfil();
  $('#sClave').onchange = () => { UI.clave = +$('#sClave').value; UI.punto = -1; refrescarClaves(); VP.pintar(); };
  $('#bCostAnt').onclick = () => selCostilla(UI.costilla - 1);
  $('#bCostSig').onclick = () => selCostilla(UI.costilla + 1);
  $('#piePerfil').innerHTML = ayudaPerfil();
}
function ayudaPerfil() {
  return '<span><kbd>Doble clic</kbd> línea: punto nuevo · punto: esquina</span><span><kbd>Clic dcho.</kbd> borrar</span><span><kbd>Mayús</kbd> sin rejilla</span>';
}
function encuadrarPerfil() {
  if (!R) return;
  let x0 = Infinity, y0 = 0, x1 = -Infinity, y1 = -Infinity;
  P.claves.forEach(c => c.pts.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }));
  VP.encuadrar({ x0, y0, w: x1 - x0, h: y1 - y0 }, 50);
}

/* ---------- vista de la costilla seleccionada ---------- */
function dibujarCostilla(ctx, V) {
  V.rejilla(ctx);
  if (!R) return;
  const c = R.costillas[UI.costilla]; if (!c || !c.ok) return;
  ctx.fillStyle = colorCostilla(.28); ctx.strokeStyle = colorCostilla(1); ctx.lineWidth = 2;
  V.camino(ctx, c.poly); ctx.fill(); ctx.stroke();
  const r = radioAgujero();
  c.agujeros.forEach(k => {
    const [x, y] = V.aPantalla(P.varillas.lista[k][0], P.varillas.lista[k][1]);
    ctx.fillStyle = cssVar('--vista'); ctx.beginPath(); ctx.arc(x, y, Math.max(2, r * V.sc), 0, PI2); ctx.fill(); ctx.stroke();
  });
  // varillas que no caben en esta costilla
  R.varillas.forEach(rv => {
    if (rv.usada && rv.fallan.includes(c.i)) {
      const [x, y] = V.aPantalla(rv.u, rv.v); ctx.strokeStyle = cssVar('--peligro'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, Math.max(4, r * V.sc), 0, PI2); ctx.stroke(); ctx.strokeStyle = colorCostilla(1);
    }
  });
  const [lx, ly] = V.aPantalla(...puntoEtiqueta(c));
  ctx.fillStyle = colorCostilla(1); ctx.font = 'bold ' + clamp(30 * V.sc, 11, 26) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(c.i + 1), lx, ly); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  V.cota(ctx, [c.caja.x0, c.caja.y0], [c.caja.x1, c.caja.y0], 18, fmt(c.caja.w) + ' mm', false);
  V.cota(ctx, [c.caja.x1, c.caja.y0], [c.caja.x1, c.caja.y1], 20, fmt(c.caja.h) + ' mm', true);
}
function selCostilla(i, encuadrar) {
  if (!R) return;
  UI.costilla = clamp(i, 0, R.n - 1);
  refrescarCostilla();
  if (encuadrar !== false) encuadrarCostilla();
  VP.pintar(); resaltar3D();
  const li = $('#listaCost').children[UI.costilla]; if (li) li.scrollIntoView({ block: 'nearest' });
}
function encuadrarCostilla() { const c = R.costillas[UI.costilla]; if (c && c.ok) VC.encuadrar(c.caja, 40); else VC.pintar(); }
function refrescarCostilla() {
  const c = R.costillas[UI.costilla]; if (!c) return;
  $('#numCost').textContent = c.i + 1;
  $('#infoCost').textContent = `de ${R.n} · x = ${fmt(c.x)} mm · ${fmt(c.caja.w)} × ${fmt(c.caja.h)} mm`;
  $$('#listaCost li').forEach((li, i) => li.classList.toggle('sel', i === UI.costilla));
}

/* ===================== VISTA 3D ===================== */
const G = { renderer: null, scene: null, cam: null, ctl: null, modelo: null, fantasma: null, costillas: [], varillas: [], separadores: [], tuercas: [], suelo: null, rejilla: null, luz: null, pend: false, cacheTex: {}, cacheMat: {} };

function textura(clave, mm) {
  const ck = clave + ':' + mm; if (G.cacheTex[ck]) return G.cacheTex[ck];
  const tx = new T.TextureLoader().load(window.TEXTURAS[clave], () => pedirRender());
  tx.colorSpace = T.SRGBColorSpace; tx.wrapS = tx.wrapT = T.RepeatWrapping;
  tx.repeat.set(1 / mm, 1 / mm); tx.anisotropy = 8;
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
    const mmCara = m.mm || 800, mmCanto = m.canto === 'alma_contrachapado' ? 48 : (m.mm || 800);
    cara = new T.MeshStandardMaterial({ map: textura(m.cara, mmCara), roughness: .62 });
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
  const hemi = new T.HemisphereLight(0xffffff, 0xd8cfc0, 0.6); s.add(hemi);
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
    const hit = ray.intersectObjects(G.costillas.filter(Boolean), false)[0];
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

// desplazamiento por la vista explosionada
function xExpl(x) { const k = (P.vista.explosion || 0) * 1.4; return x + (x - P.largo / 2) * k; }

function construir3D() {
  if (!G.scene || !R) return;
  limpiar(G.modelo); G.modelo.clear();
  G.costillas = []; G.varillas = []; G.separadores = []; G.tuercas = [];
  const e = grosor(), mats = materialesTablero(), rh = radioAgujero(), V = P.varillas;
  // centro del mueble en el fondo (u)
  let u0 = Infinity, u1 = -Infinity, alto = 0;
  R.costillas.forEach(c => { if (c.ok) { u0 = Math.min(u0, c.caja.x0); u1 = Math.max(u1, c.caja.x1); alto = Math.max(alto, c.caja.y1); } });
  if (!isFinite(u0)) { u0 = 0; u1 = 1; }
  G.uc = (u0 + u1) / 2; G.fondo = u1 - u0; G.alto = alto;
  G.modelo.position.set(-P.largo / 2, 0, G.uc);
  // costillas
  R.costillas.forEach(c => {
    if (!c.ok) { G.costillas.push(null); return; }
    const sh = new T.Shape(c.poly.map(p => new T.Vector2(p[0], p[1])));
    c.agujeros.forEach(k => { const h = new T.Path(); h.absarc(V.lista[k][0], V.lista[k][1], rh, 0, PI2, true); sh.holes.push(h); });
    const geo = new T.ExtrudeGeometry(sh, { depth: e, bevelEnabled: false, curveSegments: 24 });
    const m = new T.Mesh(geo, mats);
    m.rotation.y = Math.PI / 2; m.castShadow = m.receiveShadow = true;
    m.userData = { i: c.i, x: c.x };
    G.modelo.add(m); G.costillas.push(m);
  });
  // varillas, separadores y tuercas
  const tv = VARILLA_TIPOS[V.tipo] || VARILLA_TIPOS.roscada;
  const mVar = new T.MeshStandardMaterial({ color: tv.hex, metalness: tv.metal ? .85 : 0, roughness: tv.metal ? .35 : .7 });
  const mMal = new T.MeshStandardMaterial({ color: '#d0453a', roughness: .5 });
  const mSep = new T.MeshStandardMaterial({ color: tv.metal ? '#9ea3a8' : '#c9a36d', metalness: tv.metal ? .8 : 0, roughness: .4 });
  const mTu = new T.MeshStandardMaterial({ color: '#8d9399', metalness: .9, roughness: .3 });
  [mVar, mMal, mSep, mTu].forEach(m => m.userData.propio = true);
  R.varillas.forEach(rv => {
    if (!rv.usada) return;
    const xa = R.costillas[rv.a].x - e / 2 - V.sobra, xb = R.costillas[rv.b].x + e / 2 + V.sobra;
    const geo = new T.CylinderGeometry(V.diam / 2, V.diam / 2, xb - xa, 20);
    const m = new T.Mesh(geo, rv.fallan.length ? mMal : mVar); m.userData.propio = false;
    m.rotation.z = Math.PI / 2; m.castShadow = true;
    m.userData = { xa, xb, v: rv.v, u: rv.u };
    G.modelo.add(m); G.varillas.push(m);
    if (V.tipo !== 'madera') for (const [x, lado] of [[R.costillas[rv.a].x - e / 2, -1], [R.costillas[rv.b].x + e / 2, 1]]) {
      const t = new T.Mesh(new T.CylinderGeometry(V.diam * 0.95, V.diam * 0.95, V.diam * 0.8, 6), mTu);
      t.rotation.z = Math.PI / 2; t.castShadow = true; t.userData = { x: x + lado * (V.diam * 0.4 + 1.5), v: rv.v, u: rv.u, lado };
      G.modelo.add(t); G.tuercas.push(t);
    }
    if (V.separadores && R.hueco > 0.5) for (let i = rv.a; i < rv.b; i++) {
      if (!rv.cabe[i] || !rv.cabe[i + 1]) continue;
      const s = new T.Mesh(new T.CylinderGeometry(V.sepD / 2, V.sepD / 2, R.hueco, 20), mSep);
      s.rotation.z = Math.PI / 2; s.castShadow = true; s.userData = { x: (R.costillas[i].x + R.costillas[i + 1].x) / 2, v: rv.v, u: rv.u };
      G.modelo.add(s); G.separadores.push(s);
    }
  });
  colocarExplosion();
  construirFantasma();
  resaltar3D();
  // luz y suelo a la medida
  const tam = Math.max(P.largo, G.fondo, G.alto);
  G.suelo.scale.set(tam * 4, tam * 4, 1);
  const L = G.luz; L.position.set(-tam * 0.9, tam * 1.6, tam * 1.1); L.target.position.set(0, G.alto / 3, 0);
  const sc = L.shadow.camera; sc.left = sc.bottom = -tam * 0.95; sc.right = sc.top = tam * 0.95; sc.near = 10; sc.far = tam * 5; sc.updateProjectionMatrix();
  pedirRender();
}
function colocarExplosion() {
  const e = grosor(), k = (P.vista.explosion || 0) * 1.4;
  G.costillas.forEach(m => { if (m) m.position.set(xExpl(m.userData.x) - e / 2, 0, 0); });
  G.varillas.forEach(m => {
    const d = m.userData, xa = xExpl(d.xa + P.varillas.sobra) - P.varillas.sobra, xb = xExpl(d.xb - P.varillas.sobra) + P.varillas.sobra;
    m.scale.y = (xb - xa) / (d.xb - d.xa); m.position.set((xa + xb) / 2, d.v, -d.u);
  });
  G.tuercas.forEach(m => { const d = m.userData; m.position.set(xExpl(d.x - d.lado * (P.varillas.diam * 0.4 + 1.5)) + d.lado * (P.varillas.diam * 0.4 + 1.5), d.v, -d.u); });
  G.separadores.forEach(m => { const d = m.userData; m.position.set(xExpl(d.x), d.v, -d.u); });
  const ver = P.vista.varillas;
  [...G.varillas, ...G.tuercas, ...G.separadores].forEach(m => m.visible = ver);
  pedirRender();
}
function construirFantasma() {
  if (G.fantasma) { G.modelo.remove(G.fantasma); G.fantasma.geometry.dispose(); G.fantasma.material.dispose(); G.fantasma = null; }
  if (!P.vista.fantasma) return;
  const N = 64, anillos = [];
  for (let i = 0; i <= N; i++) {
    const x = P.largo * i / N; let c = curvaCerrada(perfilEn(x), P.esquinas);
    c = c.map(p => [p[0], clamp(p[1], P.costillas.base ? 0 : -1e9, P.costillas.tope ? P.costillas.topeAlt : 1e9)]);
    anillos.push({ x, c });
  }
  const M = anillos[0].c.length, pos = [], idx = [];
  anillos.forEach(a => a.c.forEach(p => pos.push(xExpl(a.x), p[1], -p[0])));
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
  G.costillas.forEach(m => {
    if (!m) return;
    const sel = P.vista.resalta && m.userData.i === UI.costilla;
    if (sel) { if (!m.userData.matSel) m.userData.matSel = materialSel(base); m.material = m.userData.matSel; }
    else m.material = base;
  });
  pedirRender();
}
function camara(tipo) {
  // distancia para que quepa la esfera que envuelve el mueble, con el campo de visión más estrecho
  const L = P.largo * (1 + 1.4 * (P.vista.explosion || 0)), F = G.fondo || 500, H = G.alto || 500, y = H * 0.45;
  const radio = 0.5 * Math.sqrt(L * L + F * F + H * H);
  const fv = G.cam.fov * Math.PI / 180, fh = 2 * Math.atan(Math.tan(fv / 2) * G.cam.aspect);
  const d = radio / Math.sin(Math.min(fv, fh) / 2) * 1.04;
  const dir = { tres4: [-0.55, 0.42, 0.72], frente: [0, 0.18, 1], lado: [-1, 0.18, 0.0001], arriba: [0, 1, 0.0001] }[tipo === 'encuadrar' ? 'tres4' : tipo];
  const n = Math.hypot(...dir);
  G.cam.position.set(dir[0] / n * d, y + dir[1] / n * d, dir[2] / n * d); G.ctl.target.set(0, y, 0); G.ctl.update(); pedirRender();
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
  UI.costilla = clamp(UI.costilla, 0, R.n - 1);
  if (UI.varilla >= P.varillas.lista.length) UI.varilla = -1;
  construir3D();
  refrescarListas();
  VP.pintar(); refrescarCostilla(); VC.pintar();
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
  refrescarClaves();
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
  const sp = $('#sPlantilla');
  Object.entries(PLANTILLAS).forEach(([id, pl]) => sp.add(new Option(pl.nombre, id)));
  sp.onchange = () => {
    if (P.editado && !confirm('Se perderán los retoques hechos a mano en los perfiles. ¿Cambiar de plantilla?')) { sp.value = P.plantilla; return; }
    P.plantilla = sp.value; P.params = paramsDefecto(sp.value); P.nombre = PLANTILLAS[sp.value].nombre;
    aplicarPlantilla(); UI.clave = 0;
    autoVarillas(P.varillas.autoN);
    construirParams(); cambio('Plantilla: ' + PLANTILLAS[sp.value].nombre);
    encuadrarSiHaceFalta(); camara('tres4');
  };
  const sm = $('#cMaterial');
  Object.entries(MATERIALES).forEach(([id, m]) => sm.add(new Option(m.nombre, id)));
  // costillas
  const enlazar = (sel, fn, ev = 'change') => $(sel).addEventListener(ev, fn);
  enlazar('#cGrosor', () => {
    const v = $('#cGrosor').value; $('#filaGrosorOtro').classList.toggle('oculto', v !== 'otro');
    P.costillas.grosor = v === 'otro' ? +$('#cGrosorOtro').value : +v; cambio('Grosor ' + P.costillas.grosor + ' mm');
  });
  enlazar('#cGrosorOtro', () => { P.costillas.grosor = clamp(+$('#cGrosorOtro').value || 18, 3, 80); cambio('Grosor ' + P.costillas.grosor + ' mm'); });
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
  enlazar('#vTipo', () => { V().tipo = $('#vTipo').value; cambio(); });
  enlazar('#vDiam', () => { V().diam = +$('#vDiam').value; if (V().sepD <= V().diam + 4) { V().sepD = V().diam + 12; $('#vSepD').value = V().sepD; } cambio('Varilla Ø ' + V().diam); });
  enlazar('#vHolgura', () => { V().holgura = clamp(+$('#vHolgura').value || 0, 0, 5); cambio(); });
  enlazar('#vMargen', () => { V().margen = clamp(+$('#vMargen').value || 0, 0, 200); cambio(); });
  enlazar('#vTramo', () => { V().tramo = $('#vTramo').value; cambio(); });
  enlazar('#vSep', () => { V().separadores = $('#vSep').checked; $('#filaSepD').classList.toggle('oculto', !V().separadores); cambio(); });
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
  // claves
  $('#kPos').onchange = () => {
    const k = claveActual(); k.x = clamp(+$('#kPos').value || 0, 0, P.largo); P.editado = true;
    UI.clave = clavesOrdenadas().indexOf(k); cambio('Clave movida');
  };
  $('#bClaveMas').onclick = () => {
    const c = R.costillas[UI.costilla], x = Math.round(c.x * 10) / 10;
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
function ponerControles() {
  $('#sPlantilla').value = P.plantilla;
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
  $('#filaSepD').classList.toggle('oculto', !V.separadores);
  $('#kInterp').value = P.interp;
  $('#rExplosion').value = P.vista.explosion; $('#cFantasma').checked = P.vista.fantasma; $('#cVarillas3d').checked = P.vista.varillas; $('#cResalta').checked = P.vista.resalta;
  construirParams();
}

function refrescarClaves() {
  const C = clavesOrdenadas(); UI.clave = clamp(UI.clave, 0, C.length - 1);
  const s = $('#sClave'); s.innerHTML = '';
  C.forEach((k, i) => s.add(new Option(`Perfil clave ${i + 1}`, i)));
  s.value = UI.clave;
  const k = C[UI.clave];
  $('#infoClave').textContent = `en x = ${fmt(k.x)} mm (${fmt(k.x / P.largo * 100)} %)`;
  $('#kPos').value = k.x;
  $('#nClaves').textContent = C.length;
  const ul = $('#listaClaves'); ul.innerHTML = '';
  C.forEach((o, i) => {
    const li = document.createElement('li'); li.className = i === UI.clave ? 'sel' : '';
    li.innerHTML = `<span class="icono">◆</span><span class="nom">Perfil clave ${i + 1}</span><span class="pos">x ${fmt(o.x)} mm</span>`;
    li.onclick = () => { UI.clave = i; UI.punto = -1; refrescarClaves(); VP.pintar(); };
    ul.appendChild(li);
  });
  $('#avisoEditado').classList.toggle('oculto', !P.editado);
}

function refrescarListas() {
  // resumen del reparto
  $('#resCost').innerHTML = `<b>${R.n}</b> costillas · separación <b>${fmt(R.sep, 1)}</b> mm · hueco <b>${fmt(Math.max(0, R.hueco), 1)}</b> mm`;
  // costillas
  $('#nCost').textContent = R.n;
  const malas = new Set(); R.avisos.forEach(a => { if (a.tipo === 'error') R.varillas.forEach(v => v.fallan.forEach(i => malas.add(i))); });
  R.costillas.forEach(c => { if (!c.ok || (P.varillas.lista.length && c.nVar === 0)) malas.add(c.i); });
  const ul = $('#listaCost'); ul.innerHTML = '';
  R.costillas.forEach(c => {
    const li = document.createElement('li'); li.className = c.i === UI.costilla ? 'sel' : '';
    li.innerHTML = `<span class="icono">${malas.has(c.i) ? '<span class="mal">!</span>' : '▮'}</span><span class="nom">Costilla ${c.i + 1}</span><span class="med">${c.ok ? fmt(c.caja.w) + ' × ' + fmt(c.caja.h) : 'vacía'}</span>`;
    li.onclick = () => selCostilla(c.i);
    ul.appendChild(li);
  });
  // avisos
  const av = $('#avisos'); av.innerHTML = '';
  R.avisos.forEach(a => {
    const li = document.createElement('li'); li.className = a.tipo; li.textContent = a.txt;
    if (a.cost != null) { li.dataset.cost = a.cost; li.title = 'Ver la costilla ' + (a.cost + 1); li.onclick = () => selCostilla(a.cost); }
    av.appendChild(li);
  });
  $('#nAvisos').textContent = R.avisos.filter(a => a.tipo === 'error' || a.tipo === 'atencion').length;
  // resumen
  const cm = calcularCompra();
  $('#resumen').innerHTML = `<table>
    <tr><td>Medidas totales</td><td>${fmt(P.largo)} × ${fmt(G.fondo || 0)} × ${fmt(G.alto || 0)} mm</td></tr>
    <tr><td>Costillas</td><td>${R.n} de ${fmt(grosor(), 1)} mm</td></tr>
    <tr><td>Superficie de tablero</td><td>${fmt(cm.area / 1e6, 2)} m²</td></tr>
    <tr><td>Tableros ${fmt(cm.tablero[0])}×${fmt(cm.tablero[1])}</td><td>${cm.nTableros}</td></tr>
    <tr><td>${esc(VARILLA_TIPOS[P.varillas.tipo].nombre)} Ø${P.varillas.diam}</td><td>${P.varillas.lista.length} · ${fmt(cm.largoVarillas)} mm</td></tr>
    ${cm.nSep ? `<tr><td>Separadores Ø${P.varillas.sepD} × ${fmt(R.hueco, 1)}</td><td>${cm.nSep}</td></tr>` : ''}
    ${cm.nTuercas ? `<tr><td>Tuercas y arandelas M${P.varillas.diam}</td><td>${cm.nTuercas}</td></tr>` : ''}
    <tr><td>Broca para los agujeros</td><td>Ø ${fmt(P.varillas.diam + P.varillas.holgura, 1)} mm</td></tr>
  </table>`;
  $('#version').textContent = 'v' + VERSION;
  document.title = (P.nombre ? P.nombre + ' — ' : '') + 'Made-rebanadas';
}

function calcularCompra() {
  const V = P.varillas, area = R.costillas.reduce((s, c) => s + (c.ok ? c.area : 0), 0);
  const usadas = R.varillas.filter(v => v.usada);
  let nSep = 0;
  if (V.separadores && R.hueco > 0.5) usadas.forEach(v => { for (let i = v.a; i < v.b; i++) if (v.cabe[i] && v.cabe[i + 1]) nSep++; });
  const fab = UI.fab || fabDefecto();
  const col = colocarEnTableros(fab);
  return {
    area, nSep, largoVarillas: usadas.reduce((s, v) => s + v.largo, 0),
    nTuercas: V.tipo === 'madera' ? 0 : usadas.length * 2,
    tablero: [fab.ancho, fab.alto], nTableros: col.tableros.length, colocacion: col,
  };
}

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
  iniciarEditor(); iniciarPanel(); iniciar3D(); arrastrarModal();
  $('#bNuevo').onclick = dialogoNuevo;
  $('#bAbrir').onclick = abrirArchivo;
  $('#bGuardar').onclick = guardarArchivo;
  $('#bEjemplo').onclick = dialogoEjemplos;
  $('#bDeshacer').onclick = () => irHistoria(-1);
  $('#bRehacer').onclick = () => irHistoria(1);
  $('#bDespiece').onclick = abrirDespiece;
  $('#bFabricar').onclick = abrirFabricar;
  $('#bImagen').onclick = imagenPNG;
  $('#bTema').onclick = () => ponerTema(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  $('#bAyuda').onclick = () => window.open('ayuda/manual.html', '_blank');
  $('#mCerrar').onclick = cerrarModal;
  $('#modal').addEventListener('pointerdown', ev => { if (ev.target.id === 'modal') cerrarModal(); });
  document.addEventListener('keydown', ev => {
    const enCampo = /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
    if ((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && ev.key.toLowerCase() === 'z') { if (enCampo) return; ev.preventDefault(); irHistoria(-1); return; }
    if ((ev.ctrlKey || ev.metaKey) && (ev.key.toLowerCase() === 'y' || (ev.shiftKey && ev.key.toLowerCase() === 'z'))) { if (enCampo) return; ev.preventDefault(); irHistoria(1); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') { ev.preventDefault(); guardarArchivo(); return; }
    if (enCampo || !$('#modal').classList.contains('oculto')) { if (ev.key === 'Escape') cerrarModal(); return; }
    if (ev.key === 'Escape') { UI.modo = 'normal'; UI.punto = -1; UI.varilla = -1; VP.pintar(); }
    else if (ev.key === 'Delete' || ev.key === 'Backspace') {
      if (UI.varilla >= 0) { P.varillas.lista.splice(UI.varilla, 1); UI.varilla = -1; cambio('Varilla quitada'); }
      else if (UI.punto >= 0) borrarPunto(UI.punto);
    }
    else if (ev.key.toLowerCase() === 'e') alternarEsquina(UI.punto);
    else if (ev.key.toLowerCase() === 'f') { camara('tres4'); encuadrarPerfil(); encuadrarCostilla(); }
    else if (ev.key === 'ArrowLeft') selCostilla(UI.costilla - 1);
    else if (ev.key === 'ArrowRight') selCostilla(UI.costilla + 1);
    else if (ev.key === 'PageUp') { UI.clave = Math.max(0, UI.clave - 1); UI.punto = -1; refrescarClaves(); VP.pintar(); }
    else if (ev.key === 'PageDown') { UI.clave = Math.min(P.claves.length - 1, UI.clave + 1); UI.punto = -1; refrescarClaves(); VP.pintar(); }
  });
  window.addEventListener('beforeunload', ev => { if (UI.sucio) { ev.preventDefault(); ev.returnValue = ''; } });
  // espera a que las vistas tengan tamaño
  requestAnimationFrame(() => { ajustar3D(); VP.ajustar(); VC.ajustar(); cargarProyecto(P, true); });
}
// para las pruebas automáticas
window.MadeRebanadas = { get P() { return P; }, get R() { return R; }, cargar: o => cargarProyecto(validarProyecto(o)), dxf: () => dxf(), svg: () => svg(), camara: t => camara(t), selCostilla: i => selCostilla(i),
  pantallaPunto: i => { const k = claveActual().pts[i], r = $('#cPerfil').getBoundingClientRect(), q = VP.aPantalla(k[0], k[1]); return [r.left + q[0], r.top + q[1]]; },
  pantallaVarilla: i => { const k = P.varillas.lista[i], r = $('#cPerfil').getBoundingClientRect(), q = VP.aPantalla(k[0], k[1]); return [r.left + q[0], r.top + q[1]]; } };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
