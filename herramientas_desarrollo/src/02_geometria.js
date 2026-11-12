
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
  const fin = () => { res.otras = [...res.largueros, ...res.discos]; res.otras.forEach((o, k) => o.i = res.n + k); return res; };
  if (P.tipo === 'reticula') { reticula(res); avisosReticula(res); return fin(); }
  if (P.tipo === 'radial') { radialExtras(res); aplicarRanuras(res, e + P.radial.holgura); avisosRadial(res); return fin(); }
  if (P.tipo === 'pared') { paredExtras(res); aplicarRanuras(res, e); avisosPared(res); return fin(); }
  // varillas: ¿caben en cada costilla?
  const need = radioAgujero() + V.margen;
  V.lista.forEach((p, k) => {
    const cabe = res.costillas.map(c => c.ok && distBorde(c.poly, p[0], p[1]) >= need - 1e-6);
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
    for (let i = a; i <= b && usada; i++) { if (cabe[i]) { res.costillas[i].agujeros.push(k); res.costillas[i].nVar++; } else fallan.push(i); }
    res.varillas.push({ k, u: p[0], v: p[1], cabe, a, b, usada, fallan,
      largo: usada ? (b - a) * rep.s + e + 2 * V.sobra : 0, dists: usada ? new Array(b - a).fill(rep.s) : [] });
  });
  if (disposicion() === 'curva') varillasCurvas(res);
  avisosDe(res, need);
  return fin();
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
  if (vacias.length && figuraActiva()) add('info', `Figura: ${cst(vacias)} ${vacias.length > 1 ? 'quedan' : 'queda'} fuera del modelo o ${vacias.length > 1 ? 'son' : 'es'} más pequeña${vacias.length > 1 ? 's' : ''} que el ${P.figura.minArea} % de la mayor: no se ${vacias.length > 1 ? 'fabrican' : 'fabrica'}.`, vacias[0]);
  else if (vacias.length) add('error', `Sin forma tras los recortes: ${cst(vacias)}.`, vacias[0]);
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
    if (V.separadores && res.hueco > 0.5 && V.sepD <= V.diam + 1) add('error', `El separador (Ø ${V.sepD}) tiene que ser más ancho que la varilla (Ø ${V.diam}).`);
    if (V.separadores && res.hueco > 0.5) {
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
