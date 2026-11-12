
/* ===================== CNC: HUESO DE PERRO, ARCOS Y CALCADOR =====================
   - Hueso de perro: en las esquinas interiores de ranuras y muescas, un círculo del radio de la fresa
     para que la pieza que entra llegue al fondo (la fresa redonda no deja esquinas vivas).
   - Arcos: el contorno de muchos tramos rectos se convierte en rectas y arcos (bulge), con una tolerancia.
   - Calcador: cada pieza se puede abrir en el Calcador de la Suite CNC o guardar como su proyecto (.json). */

const fresaFab = () => enMaqueta() ? (+P.maqueta.fresa || 0) : (+P.cnc.fresa || 0);
const conHueso = () => P.cnc.hueso && fresaFab() > 0;

// Sustituye cada esquina interior marcada por un arco de radio r que pasa por ella (centro dentro del hueco)
function huesoDePerro(poly, esq, r) {
  if (!esq || !esq.length || !(r > 0)) return { poly, fallan: 0 };
  const n = poly.length, cerca = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6;
  const marcas = new Set(); poly.forEach((p, i) => { if (esq.some(e => e && cerca(e, p))) marcas.add(i); });
  const out = []; let fallan = 0;
  for (let i = 0; i < n; i++) {
    const C = poly[i];
    if (!marcas.has(i)) { out.push(C); continue; }
    const A0 = poly[(i - 1 + n) % n], B0 = poly[(i + 1) % n];
    let da = [C[0] - A0[0], C[1] - A0[1]], db = [B0[0] - C[0], B0[1] - C[1]];
    const la = Math.hypot(...da), lb = Math.hypot(...db);
    da = [da[0] / la, da[1] / la]; db = [db[0] / lb, db[1] / lb];
    if (da[0] * db[1] - da[1] * db[0] >= 0) { out.push(C); continue; }  // no es una esquina hacia dentro
    let w = [da[0] - db[0], da[1] - db[1]]; const lw = Math.hypot(...w); w = [w[0] / lw, w[1] / lw];
    const Q = [C[0] - r * w[0], C[1] - r * w[1]];
    const tA = 2 * r * (w[0] * da[0] + w[1] * da[1]), tB = -2 * r * (w[0] * db[0] + w[1] * db[1]);
    if (!(tA > 0 && tB > 0) || tA > la - 0.01 || tB > lb - 0.01) { out.push(C); fallan++; continue; }
    const A = [C[0] - tA * da[0], C[1] - tA * da[1]], B = [C[0] + tB * db[0], C[1] + tB * db[1]];
    // arco de A a B alrededor de Q pasando por C
    const ang = p => Math.atan2(p[1] - Q[1], p[0] - Q[0]), aA = ang(A), aB = ang(B), aC = ang(C);
    const norm = x => ((x % PI2) + PI2) % PI2;
    let barrido = norm(aB - aA); if (norm(aC - aA) > barrido) barrido -= PI2;   // el sentido que pasa por C
    out.push(A);
    const k = Math.max(6, Math.ceil(Math.abs(barrido) / (Math.PI / 16)));
    for (let m = 1; m < k; m++) { const a = aA + barrido * m / k; out.push([Q[0] + r * Math.cos(a), Q[1] + r * Math.sin(a)]); }
    out.push(B);
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

/* ---------- Calcador de la Suite CNC ---------- */
const CALCADOR_DEF = 'https://eloiaa-hub.github.io/Suite-CNC/calcador.html';
const urlCalcador = () => lsGet('made-rebanadas.calcador', CALCADOR_DEF);
function proyectoCalcador(c) {
  const pz = piezaCalcador(c), e = grosorFab(), f = fresaFab();
  return {
    version: 7, nombre: `${P.nombre} - ${c.nombre}`,
    calcador: {
      version: 4, escala: 10, origen: { x: 0, y: 0 }, contornos: pz.calcador.contornos.map((k, i) => ({ ...k, uid: 'mr' + i + '_' + Math.random().toString(36).slice(2, 6) })),
      cotasAjuste: {}, cotasManuales: [], cfgCotas: { ver: true, cero: true, entrada: true, sentido: true }, aux: [],
      cfgHoja: { titulo: `${P.nombre} - ${c.nombre}`, material: `${enMaqueta() ? 'Maqueta' : MATERIALES[P.costillas.material].nombre} ${fmt(e, 1)} mm`, herramienta: f ? `Fresa Ø${fmt(f, 1)}` : '' },
      cfgMec: { prof: +(e + 0.5).toFixed(2) },
    },
  };
}
function guardarJSONCalcador(c) {
  const d = proyectoCalcador(c);
  descargar(nombreArchivo(P.nombre + '_' + c.nombre) + sufijoFab() + '.json', JSON.stringify(d, null, 1), 'application/json');
}
function guardarTodasCalcador() {
  const ps = piezasFab(); if (!ps.length) return;
  aviso(`Guardando ${ps.length} archivos .json del Calcador…`, 4000);
  ps.forEach((c, i) => setTimeout(() => guardarJSONCalcador(c), i * 350));
}
let paraCalcador = null, ventanaCalcador = null;
function abrirEnCalcador(c) {
  if (!c || !c.ok) { aviso('Selecciona antes una pieza.'); return; }
  const json = JSON.stringify(proyectoCalcador(c));
  try { localStorage.setItem('suiteCNC:paraCalcador', JSON.stringify({ t: Date.now(), json })); } catch (e) { /* irá por mensaje */ }
  paraCalcador = json;
  ventanaCalcador = window.open(urlCalcador() + '#desdeGenerador', '_blank');
  if (!ventanaCalcador) aviso('El navegador ha bloqueado la pestaña nueva: permite las ventanas emergentes, o usa «⬇ .json del Calcador» y ábrelo allí.', 6000);
  else aviso(`Abriendo ${esc(c.nombre)} en el Calcador…`);
}
window.addEventListener('message', e => {
  const d = e.data; if (!d || typeof d !== 'object' || d.tipo !== 'calcador-listo' || !paraCalcador || !e.source) return;
  e.source.postMessage({ tipo: 'proyecto-generador', json: paraCalcador }, '*'); paraCalcador = null;
});
function dialogoCalcador() {
  const c = piezaSel();
  modal('➜ Calcador de la Suite CNC', `
    <p class="nota">Abre la pieza seleccionada (<b>${c ? esc(c.nombre) : '—'}</b>) en el Calcador, con su contorno${P.cnc.arcos ? ' en rectas y arcos' : ''}, los agujeros y las ranuras, para programar su G-code. El cero pieza es la esquina de abajo a la izquierda de la pieza.</p>
    <label class="fila">Dirección del Calcador <input type="text" id="calUrl" value="${esc(urlCalcador())}" style="width:62%"></label>
    <p class="nota">Puede ser la Suite en internet o tu copia local (por ejemplo <code>file:///C:/Suite-CNC/calcador.html</code>). Si el Calcador no recibe la pieza, guárdala como <b>.json</b> y ábrela allí con 📂 Abrir.</p>`,
    [['↺ Por defecto', () => { $('#calUrl').value = CALCADOR_DEF; }], ['⬇ .json de todas', () => guardarTodasCalcador()], ['⬇ .json de esta pieza', () => c && guardarJSONCalcador(c)],
     ['➜ Abrir en el Calcador', () => { lsSet('made-rebanadas.calcador', $('#calUrl').value.trim() || CALCADOR_DEF); cerrarModal(); abrirEnCalcador(c); }, true]]);
}
