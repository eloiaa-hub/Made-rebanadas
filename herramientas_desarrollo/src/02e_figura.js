
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
function poligonoFigura(x) {
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
