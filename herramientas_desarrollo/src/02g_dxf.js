
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
