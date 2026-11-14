
/* ===================== LEER UN DXF =====================
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
  // encadena los trazos abiertos por sus extremos (con tolerancia)
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
  let aviso2 = '';
  if (hayInsert) aviso2 = `Tiene ${hayInsert} bloque${hayInsert > 1 ? 's' : ''} (INSERT) que no se leen: explótalos antes de guardar el DXF.`;
  return { lazos: limpios, abiertos: abiertos.length, factor, aviso: aviso2 };
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
        const r = leerDXF(rd.result);
        if (!r.lazos.length) throw new Error('No hay ningún contorno cerrado en el DXF.' + (r.aviso ? ' ' + r.aviso : r.abiertos ? ` Hay ${r.abiertos} trazos abiertos: ciérralos (une sus extremos) en el CAD.` : ''));
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
    modal('📐 Hueco desde un DXF', `
      <p class="nota"><b>${esc(nombre)}</b>: contorno de ${fmt(cb.w, 1)} × ${fmt(cb.h, 1)} mm con ${L0.length.toLocaleString('es-ES')} puntos${r.lazos.length > 1 ? ` (hay ${r.lazos.length} contornos cerrados: se usa el mayor)` : ''}.${r.aviso ? `<br>⚠ ${esc(r.aviso)}` : ''}</p>
      <label class="fila">Tamaño <select id="dxTam"><option value="real">El del DXF (mm reales)</option><option value="ancho">Ajustar el ancho a…</option></select></label>
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
    modal('📐 Perfil clave desde un DXF', `
      <p class="nota"><b>${esc(nombre)}</b>: contorno de ${fmt(cb.w, 1)} × ${fmt(cb.h, 1)} mm${r.lazos.length > 1 ? ` (hay ${r.lazos.length} contornos cerrados: se usa el mayor)` : ''}.${r.aviso ? `<br>⚠ ${esc(r.aviso)}` : ''}</p>
      <p class="nota">El contorno se reparte en los <b>${M} puntos</b> que tienen los perfiles de este mueble (con ✂ Simplificar o añadiendo puntos puedes cambiarlos antes). En cada esquina viva del dibujo cae un punto; si lo pones en todos los perfiles, esos puntos se marcan como esquinas.</p>
      <label class="fila">Ponerlo en <select id="dxDest"><option value="una">El perfil seleccionado (clave ${kSel + 1})</option><option value="todas">Todos los perfiles</option></select></label>
      <label class="fila">Medidas <select id="dxEsc"><option value="real">Las del DXF (mm reales)</option><option value="alto">Escalar al alto del perfil de ahora</option></select></label>
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
        // en cada esquina viva del DXF, clava el punto más cercano (y márcala si va a todos los perfiles)
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
