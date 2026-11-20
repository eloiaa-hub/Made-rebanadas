
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
     travesaño), la otra lleva un agujero rectangular por el que pasa.
   - solape: dos piezas paralelas que se tocan cara con cara (a un grosor de distancia) y se pisan en su
     plano; se unen con tacos de madera (taladros ciegos en las dos) o con tornillos. */
const PLANOS = {
  lado:       { n: 0, a: 2, b: 1, nombre: 'De lado', ejes: ['fondo (z)', 'alto (y)'], normal: 'x' },
  frente:     { n: 2, a: 0, b: 1, nombre: 'De frente', ejes: ['ancho (x)', 'alto (y)'], normal: 'z' },
  horizontal: { n: 1, a: 0, b: 2, nombre: 'Horizontal', ejes: ['ancho (x)', 'fondo (z)'], normal: 'y' },
};
const esPlano = () => P && P.tipo === 'plano';
const planoP = () => P.plano || (P.plano = { holgura: 0.3, piezas: [], solape: { tipo: 'tacos', diam: 8, n: 0 }, cunas: false });
const solapeP = () => { const Pp = planoP(); return Pp.solape || (Pp.solape = { tipo: 'tacos', diam: 8, n: 0 }); };
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
    const giro = clamp(+pz.giro || 0, -60, 60), bs = poly.length ? poly.map(q => q[1]) : [0], bmin = Math.min(...bs), bmax = Math.max(...bs);
    const piv = pz.pivote != null && isFinite(+pz.pivote) ? +pz.pivote : pz.eje === 'arriba' ? bmax : pz.eje === 'centro' ? (bmin + bmax) / 2 : bmin;
    const F = marcoPieza(pl, +pz.c || 0, giro, piv);
    // inclinada y apoyada en el suelo: el pie se alarga hasta el suelo (si al girar se ha levantado)
    if (giro && pl !== 'horizontal' && poly.length && Math.abs(bmin) < 0.5 && Math.abs(F.ey[1]) > 0.5) {
      const bf = -F.o[1] / F.ey[1];
      if (bf < bmin - 0.05) poly = poly.map(q => Math.abs(q[1] - bmin) < 0.01 ? [q[0], bf] : q);
    }
    res.costillas.push({ i: k, x: +pz.c || 0, plano: pl, giro, F, poly, base: poly, ok, caja: ok ? cajaDe(poly) : { x0: 0, y0: 0, x1: 0, y1: 0, w: 0, h: 0 }, area: ok ? areaFirmada(poly) : 0,
      agujeros: [], nVar: 0, ranuras: [], cajas: [], cajasT: [], dientes: [], uniones: [], int: [], taladros: [], etq: String(k + 1), nombre: pz.nombre || 'Pieza ' + (k + 1) });
  });
  res.n = res.costillas.length;
  const ps = res.costillas, tol = 0.05, solapes = [];
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const A = ps[i], B = ps[j]; if (!A.ok || !B.ok) continue;
    const pa = PLANOS[A.plano], pb = PLANOS[B.plano];
    if (A.giro || B.giro) { cruceGeneral(res, A, B, e, 1.5); continue; }
    if (pa.n === pb.n) {   // paralelas: ¿se tocan cara con cara (solape) u ocupan el mismo sitio?
      if (Math.abs(Math.abs(A.x - B.x) - e) < 0.05 && A.caja.x0 < B.caja.x1 && B.caja.x0 < A.caja.x1 && A.caja.y0 < B.caja.y1 && B.caja.y0 < A.caja.y1) { solapes.push([i, j]); continue; }
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
      const u = { a: i, b: j, lo, hi, geo: { [i]: geoRecta(ejeA, B.x, lo, hi), [j]: geoRecta(ejeB, A.x, lo, hi) } };
      // ¿termina alguna de las dos dentro del grosor de la otra? (esquina o canto contra una cara)
      const fA = window.ClipperLib ? finCanto(A.base, ejeA, B.x, lo, hi, e) : 0, fB = window.ClipperLib ? finCanto(B.base, ejeB, A.x, lo, hi, e) : 0;
      if ((fA && fB) || ((fA || fB) && hi - lo >= 100)) {
        const n = Math.max(3, Math.round((hi - lo) / Math.max(2 * e, 30)) | 1), t = Array.from({ length: n + 1 }, (_, k) => lo + (hi - lo) * k / n);
        u.tipo = 'dentada'; u.dientes = n;
        if (fA && fB) { u.esquina = true; A.dientes.push({ eje: ejeA, c: B.x, s: fA, t, quita: 1 }); B.dientes.push({ eje: ejeB, c: A.x, s: fB, t, quita: 0 }); }
        else {   // en T: la que termina lleva espigas (los dientes de dentro) y la otra, sus cajas
          const [Pt, Pc, ej, ejC, sT] = fA ? [A, B, ejeA, ejeB, fA] : [B, A, ejeB, ejeA, fB];
          u.en = Pc.i; u.pasa = Pt.i;
          Pt.dientes.push({ eje: ej, c: Pc.x, s: sT, t, quita: 0 });
          for (let k = 1; k < n; k += 2) Pc.cajasT.push({ eje: ejC, c: Pt.x, lo: t[k], hi: t[k + 1], con: Pt.i });
        }
        res.uniones.push(u); A.uniones.push(u); B.uniones.push(u); return;
      }
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
  // dientes: se recortan del contorno base los huecos donde entran los dientes de la otra pieza
  ps.forEach(p => { if (p.dientes.length) aplicarDientes(p, e + hol, hol); });
  // cuñas: las espigas pasantes (no en asientos ni tapas) asoman lo bastante para un agujero con su cuña
  const nReal = ps.length;
  if (Pp.cunas && window.ClipperLib) res.uniones.filter(u => u.tipo === 'caja').forEach(u => {
    const A = ps[u.en], B = ps[u.pasa], pa = PLANOS[A.plano], pb = PLANOS[B.plano];
    if (pa.n === 1 || !B.ok || A.giro || B.giro) return;
    const k = pb.a === pa.n ? 0 : 1, P2 = (tk, tl) => k === 0 ? [tk, tl] : [tl, tk];
    const franja = [P2(-1e5, u.lo), P2(1e5, u.lo), P2(1e5, u.hi), P2(-1e5, u.hi)];
    const tr = booleana(B.base, [franja], 'interseccion'); if (!tr.length) return;
    let mn = Infinity, mx = -Infinity; tr.forEach(t => t.poly.forEach(q => { mn = Math.min(mn, q[k]); mx = Math.max(mx, q[k]); }));
    const fM = A.x + e / 2, fm = A.x - e / 2, extM = mx - fM, extm = fm - mn;
    const s = extM <= extm ? 1 : -1, cara = s > 0 ? fM : fm, sale = s > 0 ? extM : extm, hace = e + hol - 1.5 + 12;
    const ww = clamp((u.hi - u.lo) - 2 * Math.max(8, e * 0.5), 8, 40); if (u.hi - u.lo - ww < 14) return;
    if (sale < hace) {   // alarga la espiga
      const ext = [P2(cara - s, u.lo), P2(cara + s * hace, u.lo), P2(cara + s * hace, u.hi), P2(cara - s, u.hi)];
      const un = booleana(B.base, [areaFirmada(ext) < 0 ? ext.reverse() : ext], 'union'); if (un.length) B.base = un[0].poly;
    }
    const cl = (u.lo + u.hi) / 2, t0 = cara - s * 1.5, t1 = t0 + s * (e + hol);
    let ag = [P2(Math.min(t0, t1), cl - (ww + hol) / 2), P2(Math.max(t0, t1), cl - (ww + hol) / 2), P2(Math.max(t0, t1), cl + (ww + hol) / 2), P2(Math.min(t0, t1), cl + (ww + hol) / 2)];
    if (areaFirmada(ag) > 0) ag.reverse(); ag.esq = ag.map(p => p);
    (B.cunasInt = B.cunasInt || []).push(ag);
    // la cuña: del mismo tablero, pegada a la cara de A, atraviesa la espiga; un poco más ancha por un lado
    const ejeA = A.cajas.find(cj => cj.con === B.i) ? A.cajas.find(cj => cj.con === B.i).eje : 'v', iL = ejeA === 'v' ? 1 : 0, Q = (tn, tl) => iL === 1 ? [tn, tl] : [tl, tn];
    const n0 = B.x - e / 2 - 22, n1 = B.x + e / 2 + 22;
    let cu = [Q(n0, cl - ww / 2 - 4), Q(n1, cl - ww / 2 + 4), Q(n1, cl + ww / 2 - 4), Q(n0, cl + ww / 2 + 4)];
    if (areaFirmada(cu) < 0) cu.reverse();
    const kc = ps.length - nReal + 1;
    ps.push({ i: ps.length, x: cara + s * e / 2, plano: A.plano, poly: cu, base: cu, ok: true, caja: cajaDe(cu), area: areaFirmada(cu), agujeros: [], nVar: 0, ranuras: [], cajas: [], cajasT: [], dientes: [], uniones: [], int: [], taladros: [],
      etq: 'C' + kc, nombre: `Cuña ${kc} (${B.nombre.toLowerCase()})`, cuna: true, de: B.i, en: A.i });
    u.cuna = ps.length - 1;
  });
  res.n = ps.length;
  // contornos con las ranuras y las cajas, con el ancho real
  const w = e + hol;
  ps.forEach(p => {
    if (!p.ok) return;
    p.generar = ww => {
      let poly = p.base; const esq = (p.esqDientes || []).slice(), fallan = [];
      p.ranuras.forEach(r => { const n2 = r.rot ? ranuraGirada(poly, r, ww) : ranuraEje(poly, r.eje, r.c, r.mid, r.borde, r.alto, ww); if (n2) { poly = n2; esq.push(...n2.esq); } else fallan.push(r); });
      const out = poly === p.base ? p.base.slice() : poly; out.esq = esq; out.fallan = fallan; return out;
    };
    p.generarInt = ww => p.cajas.concat(p.cajasT || []).map(cj => cj.girada ? rectGirada(cj, ww, hol) : rectCaja(cj, ww, hol)).concat(p.cunasInt || []);
    p.poly = p.generar(w); if (p.poly.fallan.length) res.ranurasMal.push(p);
    p.int = p.generarInt(w);
    p.caja = cajaDe(p.poly); p.area = areaFirmada(p.poly) - p.int.reduce((s, h) => s + Math.abs(areaFirmada(h)), 0);
  });
  // solapes: la zona común de las dos piezas (ya con sus ranuras) y los tacos o tornillos repartidos en ella
  const So = solapeP(), dT = clamp(+So.diam || 8, 2, 30);
  solapes.forEach(([i, j]) => {
    const A = ps[i], B = ps[j]; if (!window.ClipperLib) return;
    const zonas = booleana(A.poly, [B.poly], 'interseccion').filter(z => z.area > 150); if (!zonas.length) return;
    // la de fuera (más lejos del centro del mueble) lleva la cabeza del tornillo
    const pl = PLANOS[A.plano], ctr = (Math.min(...ps.filter(p => p.ok).map(p => PLANOS[p.plano].n === pl.n ? p.x : Infinity)) + Math.max(...ps.filter(p => p.ok).map(p => PLANOS[p.plano].n === pl.n ? p.x : -Infinity))) / 2;
    const fuera = Math.abs(A.x - ctr) >= Math.abs(B.x - ctr) ? i : j;
    const u = { tipo: 'solape', a: i, b: j, zonas, puntos: [], fuera, area: zonas.reduce((s, z) => s + z.area, 0) };
    zonas.forEach(z => u.puntos.push(...puntosFijacion(z, dT, So.n)));
    const rT = dT / 2;
    u.puntos.forEach(q => {
      if (So.tipo === 'tornillos') { ps[fuera].taladros.push([q[0], q[1], rT, 'pasante']); ps[fuera === i ? j : i].taladros.push([q[0], q[1], Math.max(1, rT * 0.6), 'guia']); }
      else { A.taladros.push([q[0], q[1], rT, 'ciego']); B.taladros.push([q[0], q[1], rT, 'ciego']); }
    });
    res.uniones.push(u); A.uniones.push(u); B.uniones.push(u);
  });
  // caja del mueble (para las medidas y el largo)
  const bb = [[Infinity, -Infinity], [Infinity, -Infinity], [Infinity, -Infinity]];
  ps.forEach(p => { if (!p.ok) return;
    if (!p.giro) { const pl = PLANOS[p.plano];
      bb[pl.a][0] = Math.min(bb[pl.a][0], p.caja.x0); bb[pl.a][1] = Math.max(bb[pl.a][1], p.caja.x1);
      bb[pl.b][0] = Math.min(bb[pl.b][0], p.caja.y0); bb[pl.b][1] = Math.max(bb[pl.b][1], p.caja.y1);
      bb[pl.n][0] = Math.min(bb[pl.n][0], p.x - e / 2); bb[pl.n][1] = Math.max(bb[pl.n][1], p.x + e / 2); return; }
    p.poly.forEach(q => [-e / 2, e / 2].forEach(t => { const w = puntoPieza(p, q[0], q[1]); for (let k = 0; k < 3; k++) { const v = w[k] + p.F.ez[k] * t; bb[k][0] = Math.min(bb[k][0], v); bb[k][1] = Math.max(bb[k][1], v); } })); });
  res.bbox = bb.map(r => isFinite(r[0]) ? r : [0, 0]);
  P.largo = Math.max(1, Math.round(res.bbox[0][1] - res.bbox[0][0]));
  avisosPlano(res);
  res.otras = []; return res;
}
// si la pieza termina dentro del grosor de la otra (en la recta de cruce, en la franja [lo, hi]): +1 o -1 (lado donde termina), 0 si no
function finCanto(base, eje, c, lo, hi, e) {
  const ia = eje === 'v' ? 0 : 1, Pt = (x, l) => ia === 0 ? [x, l] : [l, x];
  const tr = booleana(base, [[Pt(-1e5, lo + 0.2), Pt(1e5, lo + 0.2), Pt(1e5, hi - 0.2), Pt(-1e5, hi - 0.2)]].map(r => areaFirmada(r) < 0 ? r.reverse() : r), 'interseccion');
  if (!tr.length) return 0;
  let mn = Infinity, mx = -Infinity; tr.forEach(t => t.poly.forEach(q => { mn = Math.min(mn, q[ia]); mx = Math.max(mx, q[ia]); }));
  if (mx - c <= e / 2 + 0.6 && c - mn > e) return 1;
  if (c - mn <= e / 2 + 0.6 && mx - c > e) return -1;
  return 0;
}
// recorta los dientes: en los tramos k con k % 2 === quita, el canto se retira hasta la cara de dentro de la otra pieza
function aplicarDientes(p, w, hol) {
  const big = 1e5, cortes = [], esqObj = [];
  p.dientes.forEach(d => {
    const ia = d.eje === 'v' ? 0 : 1, Pt = (x, l) => ia === 0 ? [x, l] : [l, x], n = d.t.length - 1, borde = d.c - d.s * w / 2;
    for (let k = 0; k < n; k++) {
      if (k % 2 !== d.quita) continue;
      const l0 = k === 0 ? -big : d.t[k] - hol / 2, l1 = k === n - 1 ? big : d.t[k + 1] + hol / 2;
      let r = [Pt(borde, l0), Pt(borde + d.s * big, l0), Pt(borde + d.s * big, l1), Pt(borde, l1)]; if (areaFirmada(r) < 0) r.reverse();
      cortes.push(r);
      if (k > 0) esqObj.push(Pt(borde, l0)); if (k < n - 1) esqObj.push(Pt(borde, l1));
    }
  });
  if (!cortes.length) return;
  const r = booleana(p.base, cortes, 'diferencia'); if (!r.length) return;
  p.base = r[0].poly;
  // esquinas de dentro de los huecos (para el hueso de perro): los puntos del nuevo contorno que caen en ellas
  p.esqDientes = [];
  esqObj.forEach(q => { let mej = null, md = 0.05; p.base.forEach(v => { const d = Math.hypot(v[0] - q[0], v[1] - q[1]); if (d < md) { md = d; mej = v; } }); if (mej) p.esqDientes.push(mej); });
}
// reparte n tacos o tornillos en una zona (0 = según su tamaño): lejos del borde y lo más separados posible
function puntosFijacion(z, d, nPedido) {
  const poly = z.poly, b = cajaDe(poly), margen = Math.max(1.5 * d, 10);
  const val = (x, y) => { if (!dentro(poly, x, y)) return -1; let m = distBorde(poly, x, y); (z.int || []).forEach(h => { m = Math.min(m, dentro(h, x, y) ? -1 : distBorde(h, x, y)); }); return m; };
  const paso = Math.max(1, Math.min(b.w, b.h) / 24, Math.sqrt(b.w * b.h / 900)), cand = [];
  for (let y = b.y0 + paso / 2; y < b.y1; y += paso) for (let x = b.x0 + paso / 2; x < b.x1; x += paso) { const v = val(x, y); if (v > 0) cand.push([x, y, v]); }
  if (!cand.length) return [];
  let buenos = cand.filter(c => c[2] >= margen);
  if (!buenos.length) { const mx = Math.max(...cand.map(c => c[2])); if (mx < d * 0.9) return []; buenos = cand.filter(c => c[2] >= mx * 0.95); }
  const n = nPedido > 0 ? Math.round(nPedido) : clamp(Math.round(Math.sqrt(z.area) / 40), 2, 8), sep = 2.5 * d;
  const cx = buenos.reduce((s, c) => s + c[0], 0) / buenos.length, cy = buenos.reduce((s, c) => s + c[1], 0) / buenos.length;
  const elegidos = [];
  let pri = buenos[0], md = -1; buenos.forEach(c => { const dd = Math.hypot(c[0] - cx, c[1] - cy); if (dd > md) { md = dd; pri = c; } });
  elegidos.push(pri);
  while (elegidos.length < n) {
    let mej = null, mm = -1;
    buenos.forEach(c => { let dmin = Infinity; elegidos.forEach(e2 => { dmin = Math.min(dmin, Math.hypot(c[0] - e2[0], c[1] - e2[1])); }); if (dmin >= sep && dmin > mm) { mm = dmin; mej = c; } });
    if (!mej) break; elegidos.push(mej);
  }
  return elegidos.map(c => [Math.round(c[0] * 10) / 10, Math.round(c[1] * 10) / 10]);
}
const largoTaco = e => { const p = clamp(Math.round(e - 4), 6, 25); return { prof: p, largo: 2 * p - 2 }; };
const nomP = (res, i) => res.costillas[i] ? res.costillas[i].nombre : 'pieza ' + (i + 1);
function avisosPlano(res) {
  const A = res.avisos, e = grosor(), add = (tipo, txt, cost) => A.push({ tipo, txt, cost });
  if (!res.n) { add('error', 'No hay ninguna pieza: elige una plantilla o añade una pieza (＋ Pieza).'); return; }
  res.costillas.forEach(p => { if (!p.ok) add('error', `${p.nombre}: su contorno no tiene superficie (revisa los puntos).`, p.i); });
  res.pisan.forEach(([i, j]) => add('error', `${nomP(res, i)} y ${nomP(res, j)} están en el mismo sitio (paralelas a menos de ${fmt(e, 1)} mm): se pisan.`, i));
  const sueltas = res.costillas.filter(p => p.ok && !p.uniones.length && !p.cuna);
  sueltas.forEach(p => add('atencion', `${p.nombre} no se cruza con ninguna otra pieza: quedaría suelta (o hay que atornillarla o encolarla).`, p.i));
  res.ranurasMal.forEach(p => add('error', `No se pudo hacer alguna ranura en ${p.nombre}: el borde no es recto en el cruce o la ranura sale de la pieza.`, p.i));
  res.uniones.forEach(u => {
    if (u.tipo === 'solape' && !u.puntos.length) add('atencion', `${nomP(res, u.a)} y ${nomP(res, u.b)} se solapan, pero la zona común es demasiado estrecha para un ${solapeP().tipo === 'tornillos' ? 'tornillo' : 'taco'} de Ø ${fmt(solapeP().diam, 1)} mm: agranda el solape o encólalas.`, u.a);
    else if (u.tipo === 'solape' && u.puntos.length < 2) add('atencion', `Solape de ${nomP(res, u.a)} y ${nomP(res, u.b)} con una sola fijación: puede girar. Agranda la zona común.`, u.a);
    if (u.tipo === 'media' && u.hi - u.lo < 2 * e) add('atencion', `Media madera corta entre ${nomP(res, u.a)} y ${nomP(res, u.b)} (${fmt(u.hi - u.lo)} mm de cruce): unión floja.`, u.a);
    if (u.tipo === 'caja' && u.hi - u.lo < 1.5 * e) add('atencion', `Espiga estrecha de ${nomP(res, u.pasa)} en ${nomP(res, u.en)} (${fmt(u.hi - u.lo)} mm): se puede partir.`, u.pasa);
  });
  // cajas con poca madera alrededor
  res.costillas.forEach(p => {
    if (!p.ok) return;
    const malo = p.int.some(h => h.some(q => distBorde(p.poly, q[0], q[1]) < Math.max(4, e * 0.4) || !dentro(p.poly, q[0], q[1])));
    if (malo) add('atencion', `${p.nombre}: alguna caja (agujero de una espiga) queda muy cerca del borde y la pieza se puede partir.`, p.i);
  });
  avisosAsiento(res, add);
  const M = P.maqueta;
  if (M && M.activa && Math.abs(M.grosor * M.escala - e) > e * 0.2) add('info', `Maqueta 1:${M.escala}: ${fmt(M.grosor, 1)} mm equivalen a ${fmt(M.grosor * M.escala)} mm reales (el tablero real es de ${fmt(e, 1)} mm): las ranuras y las cajas de la maqueta se hacen con el grosor de la maqueta.`);
  if (!A.some(a => a.tipo === 'error' || a.tipo === 'atencion')) {
    const nM = res.uniones.filter(u => u.tipo === 'media').length, nC = res.uniones.filter(u => u.tipo === 'caja').length, nS = res.uniones.filter(u => u.tipo === 'solape').length;
    const nE = res.uniones.filter(u => u.tipo === 'dentada' && u.esquina).length, nT = res.uniones.filter(u => u.tipo === 'dentada' && !u.esquina).length;
    const partes = [nE ? nE + (nE > 1 ? ' esquinas dentadas' : ' esquina dentada') : '', nT ? nT + (nT > 1 ? ' cantos con espigas en T' : ' canto con espigas en T') : '', nM ? nM + ' a media madera' : '', nC ? nC + (nC > 1 ? ' espigas en caja pasante' : ' espiga en caja pasante') : '', nS ? nS + (nS > 1 ? ' solapes' : ' solape') + ` con ${solapeP().tipo}` : ''].filter(Boolean);
    add('ok', `Todo correcto: ${res.n} piezas con ${res.uniones.length} ${res.uniones.length === 1 ? 'unión' : 'uniones'}` + (partes.length ? ` (${partes.length > 1 ? partes.slice(0, -1).join(', ') + ' y ' + partes[partes.length - 1] : partes[0]})` : '') + '.');
  }
}
/* Asientos: medidas orientativas para un adulto y una prueba sencilla de vuelco (no es un ensayo normalizado).
   Se busca el tablero horizontal que hace de asiento, el respaldo (piezas que suben por detrás) y las patas que tocan el suelo. */
function analisisAsiento(res) {
  const e = grosor(), ps = res.costillas.filter(c => c.ok && !c.cuna);
  const asientos = ps.filter(c => c.plano === 'horizontal' && c.x + e / 2 > 250 && c.x + e / 2 < 800 && c.caja.w >= 250 && c.caja.h >= 200);
  let S, yS, zA, zD, xA, xB;
  if (asientos.length) { S = asientos.sort((a, b) => Math.abs(b.area) - Math.abs(a.area))[0]; yS = S.x + e / 2; zA = S.caja.y0; zD = S.caja.y1; xA = S.caja.x0; xB = S.caja.x1; }
  else {   // asiento de lamas (de frente, bajas y a una altura de asiento)
    const L = ps.filter(c => c.plano === 'frente' && c.caja.h < 150 && c.caja.y1 > 250 && c.caja.y1 < 800 && c.caja.w >= 250);
    if (L.length < 3) return null;
    S = L[0]; yS = Math.max(...L.map(c => c.caja.y1)); zA = Math.min(...L.map(c => c.x)) - e / 2; zD = Math.max(...L.map(c => c.x)) + e / 2;
    xA = Math.min(...L.map(c => c.caja.x0)); xB = Math.max(...L.map(c => c.caja.x1));
  }
  const zc = (zA + zD) / 2;
  // respaldo: lo que sube más de 150 mm sobre el asiento por la mitad de atrás
  let yR = -Infinity;
  ps.forEach(c => { if (c.plano === 'horizontal' || c.caja.h < 150) return;
    c.poly.forEach(q => { const w = puntoPieza(c, q[0], q[1]); if (w[1] > yS + 150 && w[2] < zc) yR = Math.max(yR, w[1]); }); });
  // apoyos en el suelo (con el grosor de cada pieza)
  const ap = [];
  ps.forEach(c => { if (c.plano === 'horizontal') return; const nz = c.F ? c.F.ez : [0, 0, 0];
    c.poly.forEach(q => { const w = puntoPieza(c, q[0], q[1]); if (w[1] < 1) { const d = nz.map(v => v * e / 2); ap.push([w[0] - d[0], w[2] - d[2]], [w[0] + d[0], w[2] + d[2]]); } }); });
  if (!ap.length) return { S, yS, zA, zD, xA, xB, yR: isFinite(yR) ? yR : null, sinApoyo: true };
  const zMin = Math.min(...ap.map(q => q[1])), zMax = Math.max(...ap.map(q => q[1])), xMin = Math.min(...ap.map(q => q[0])), xMax = Math.max(...ap.map(q => q[0]));
  // peso del mueble (tablero de unos 600 kg/m³) y su centro
  let m = 0, cz = 0, cx = 0;
  ps.forEach(c => { const a = Math.abs(c.area) * e * 6e-7, b = c.caja, w = puntoPieza(c, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2); m += a; cz += a * w[2]; cx += a * w[0]; });
  cz = m ? cz / m : zc; cx = m ? cx / m : (xA + xB) / 2; const Pm = m * 9.81;
  const W = 600;   // persona sentada (N)
  const out = { S, yS, zA, zD, xA, xB, yR: isFinite(yR) ? yR : null, zMin, zMax, xMin, xMax, peso: m };
  // hacia atrás: sentado y empujando el respaldo arriba (80 N); con la carga a 175 mm de la parte de atrás del asiento
  if (out.yR) { const zW = zA + 175, hF = out.yR; const sost = W * (zW - zMin) + Pm * (cz - zMin), vuelca = 80 * hF; out.atras = vuelca > 0 ? sost / vuelca : Infinity; }
  // hacia delante y de lado: una persona sentada en el borde (a 60 mm del canto) contra el peso del mueble
  const vuelco = (sale, brazo) => sale <= 0 ? Infinity : Pm * Math.max(0, brazo) / (W * sale);
  out.saleDelante = (zD - 60) - zMax; out.delante = vuelco(out.saleDelante, zMax - cz);
  const sD = (xB - 60) - xMax, sI = xMin - (xA + 60);
  out.saleLado = Math.max(sD, sI); out.lado = Math.min(vuelco(sD, xMax - cx), vuelco(sI, cx - xMin));
  return out;
}
function avisosAsiento(res, add) {
  if (planoP().asiento === false) return;
  const a = analisisAsiento(res); if (!a) return;
  const silla = a.yR != null, fondo = a.zD - a.zA, ancho = a.xB - a.xA, alto = a.yS;
  const medidas = `${silla ? 'Silla' : 'Asiento'}: a ${fmt(alto)} mm del suelo, ${fmt(fondo)} mm de fondo y ${fmt(ancho)} mm de ancho` + (silla ? `, respaldo hasta ${fmt(a.yR)} mm` : '') + '.';
  const fuera = [];
  if (alto < 380) fuera.push(`el asiento está bajo para un adulto (lo cómodo son 420 a 470 mm; para niños de 6 a 10 años, unos 300 a 350)`);
  else if (alto > 500 && alto < 600) fuera.push('el asiento está alto para una silla de mesa (420 a 470 mm); va bien para un taburete de barra bajo');
  if (silla && fondo < 330) fuera.push('el asiento tiene poco fondo (lo normal en una silla, de 380 a 460 mm)');
  else if (silla && fondo > 500) fuera.push('el asiento tiene mucho fondo: las rodillas no llegan al borde (380 a 460 mm)');
  if (silla && ancho < 360) fuera.push('el asiento es estrecho (al menos 400 mm)');
  if (silla && a.yR - alto < 220) fuera.push('el respaldo es bajo: no llega a la zona lumbar (que suba al menos 250 a 300 mm sobre el asiento)');
  add('info', medidas + (fuera.length ? ' Ojo: ' + fuera.join('; ') + '.' : ' Medidas habituales.'), a.S.i);
  if (a.sinApoyo) { add('atencion', 'No hay ninguna pieza que toque el suelo (y = 0): el mueble no se apoya.'); return; }
  if (a.atras != null) {
    const t = `Vuelco hacia atrás (prueba orientativa: 600 N sentado y 80 N empujando el respaldo arriba): ${a.atras < 1 ? 'VUELCA' : 'aguanta'} (margen ×${fmt(a.atras, 1)}).`;
    if (a.atras < 1) add('error', t + ' Lleva las patas traseras más atrás o baja el respaldo.', a.S.i);
    else if (a.atras < 1.5) add('atencion', t + ' Poco margen: lleva las patas traseras un poco más atrás.', a.S.i);
    else add('info', t, a.S.i);
  }
  if (a.delante < 1.5) add(a.delante < 1 ? 'error' : 'atencion', `Sentado en el borde de delante, ${a.delante < 1 ? 'vuelca hacia delante' : 'tiene poco margen hacia delante'}: el asiento sale ${fmt(a.saleDelante)} mm por delante de las patas (margen ×${fmt(a.delante, 1)}).`, a.S.i);
  if (a.lado < 1.5) add(a.lado < 1 ? 'error' : 'atencion', `Sentado en un extremo, ${a.lado < 1 ? 'vuelca de costado' : 'tiene poco margen de costado'}: el asiento sale ${fmt(a.saleLado)} mm por fuera de las patas (margen ×${fmt(a.lado, 1)}).`, a.S.i);
}
// texto de las uniones de una pieza (para la vista de la pieza, el plano y el despiece)
function textoUnionesPieza(c) {
  if (!R || !c.uniones) return '';
  const de = c.uniones.filter(u => u.tipo === 'dentada').length, so = c.uniones.filter(u => u.tipo === 'solape').length, nt = (c.taladros || []).length, m = c.uniones.filter(u => u.tipo === 'media').length, cj = c.uniones.filter(u => u.tipo === 'caja' && u.en === c.i).length, es = c.uniones.filter(u => u.tipo === 'caja' && u.pasa === c.i).length;
  return [de ? `${de} ${de > 1 ? 'dentadas' : 'dentada'}` : '', so ? `${so} ${so > 1 ? 'solapes' : 'solape'} (${nt} ${solapeP().tipo === 'tornillos' ? 'taladros' : 'tacos'})` : '', m ? m + ' a media madera' : '', cj ? cj + (cj > 1 ? ' cajas' : ' caja') : '', es ? es + (es > 1 ? ' espigas' : ' espiga') : ''].filter(Boolean).join(' · ') || 'sin uniones';
}
/* ---------- piezas inclinadas ----------
   Una pieza puede girar «giro» grados alrededor de su eje horizontal (a) por la línea b = pivote (por defecto, su borde de
   abajo): un respaldo inclinado, un asiento que baja por detrás, unas patas abiertas. Su marco: origen o, ejes ex, ey en el
   plano y ez (normal). Si alguna de las dos piezas de un cruce está inclinada, la recta de cruce ya no es vertical ni
   horizontal en su plano: se gira el contorno para ponerla vertical, se hace la ranura o la caja y se vuelve a girar. */
const cruz = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const pesc = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function marcoPieza(plano, c, giro, piv) {
  const pl = PLANOS[plano], ex = [0, 0, 0], ey0 = [0, 0, 0], O = [0, 0, 0]; ex[pl.a] = 1; ey0[pl.b] = 1; O[pl.n] = c;
  const ez0 = cruz(ex, ey0), g = (giro || 0) * Math.PI / 180, cg = Math.cos(g), sg = Math.sin(g);
  const ey = ey0.map((v, k) => cg * v + sg * ez0[k]), ez = ez0.map((v, k) => -sg * ey0[k] + cg * v);
  const o = O.map((v, k) => v + (piv || 0) * (ey0[k] - ey[k]));
  return { ex, ey, ez, o };
}
// matriz 3D de una pieza: el contorno (a, b) en su plano, el grosor centrado en la posición c
function basePieza(c) {
  if (c.F) return { ex: c.F.ex, ey: c.F.ey, ez: c.F.ez, o: c.F.o.slice() };
  const pl = PLANOS[c.plano], ex = [0, 0, 0], ey = [0, 0, 0]; ex[pl.a] = 1; ey[pl.b] = 1;
  const ez = [ex[1] * ey[2] - ex[2] * ey[1], ex[2] * ey[0] - ex[0] * ey[2], ex[0] * ey[1] - ex[1] * ey[0]], o = [0, 0, 0]; o[pl.n] = c.x;
  return { ex, ey, ez, o };
}
// punto del contorno de una pieza en el espacio (mm)
function puntoPieza(c, a, b) {
  if (c.F && c.giro) { const F = c.F; return [0, 1, 2].map(k => F.o[k] + a * F.ex[k] + b * F.ey[k]); }
  const pl = PLANOS[c.plano], q = [0, 0, 0]; q[pl.a] = a; q[pl.b] = b; q[pl.n] = c.x; return q;
}
// giro que pone vertical una dirección (dx, dy) del plano: rot(p) = [x·cs − y·sn, x·sn + y·cs]
const girarP = (p, cs, sn) => [p[0] * cs - p[1] * sn, p[0] * sn + p[1] * cs];
const desgirarP = (p, cs, sn) => [p[0] * cs + p[1] * sn, -p[0] * sn + p[1] * cs];
// geometría de un cruce en una pieza recta, en la misma forma que las giradas (para dibujarlo)
const geoRecta = (eje, c, lo, hi) => eje === 'v' ? { rot: [1, 0], c, lo, hi, wf: 1 } : { rot: [0, 1], c: -c, lo, hi, wf: 1 };
function ranuraGirada(poly, r, ww) {
  const [cs, sn] = r.rot, pr = poly.map(q => girarP(q, cs, sn));
  const res = hacerRanura(pr, { c: r.c, mid: r.mid, borde: r.borde, arriba: r.alto }, ww * r.wf);
  if (!res) return null;
  const out = res.map(q => desgirarP(q, cs, sn)); out.esq = res.esq.map(q => desgirarP(q, cs, sn));
  return out;
}
function rectGirada(cj, w, hol) {
  const [cs, sn] = cj.rot, a0 = cj.lo - hol / 2, a1 = cj.hi + hol / 2, b0 = cj.c - w * cj.wf / 2, b1 = cj.c + w * cj.wf / 2;
  const r = [[b0, a0], [b0, a1], [b1, a1], [b1, a0]].map(q => desgirarP(q, cs, sn));
  r.esq = r.map(p => p); return r;
}
function cruceGeneral(res, A, B, e, tol) {
  const nA = A.F.ez, nB = B.F.ez, cr = cruz(nA, nB), s = Math.hypot(...cr);
  if (s < 0.1) return;   // casi paralelas: no se unen (ni se comprueban)
  let d = cr.map(v => v / s);
  if (d[1] < -1e-9 || (Math.abs(d[1]) < 1e-9 && (d[0] < -1e-9 || (Math.abs(d[0]) < 1e-9 && d[2] < 0)))) d = d.map(v => -v);
  // un punto de la recta: en los dos planos y con d·p = 0 (Cramer)
  const M = [nA, nB, d], rhs = [pesc(nA, A.F.o), pesc(nB, B.F.o), 0];
  const det3 = m => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det3(M); if (Math.abs(D) < 1e-12) return;
  const p0 = [0, 1, 2].map(k => det3(M.map((f, r) => f.map((v, c) => c === k ? rhs[r] : v))) / D);
  const enPieza = P2 => {
    const F = P2.F; let dx = pesc(d, F.ex), dy = pesc(d, F.ey); const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const cs = dy, sn = dx, loc = [pesc(p0.map((v, k) => v - F.o[k]), F.ex), pesc(p0.map((v, k) => v - F.o[k]), F.ey)];
    return { rot: [cs, sn], c: girarP(loc, cs, sn)[0], off: pesc(F.o, d), pr: P2.base.map(q => girarP(q, cs, sn)) };
  };
  const gA = enPieza(A), gB = enPieza(B), wf = 1 / s;
  const IA = intervalosV(gA.pr, gA.c).map(I => [I[0] + gA.off, I[1] + gA.off]), IB = intervalosV(gB.pr, gB.c).map(I => [I[0] + gB.off, I[1] + gB.off]);
  IA.forEach(I => IB.forEach(J => {
    const lo = Math.max(I[0], J[0]), hi = Math.min(I[1], J[1]);
    if (hi - lo < 0.5) return;
    const Alo = Math.abs(I[0] - lo) < tol, Ahi = Math.abs(I[1] - hi) < tol, Blo = Math.abs(J[0] - lo) < tol, Bhi = Math.abs(J[1] - hi) < tol;
    const geo = g => ({ rot: g.rot, c: g.c, lo: lo - g.off, hi: hi - g.off, wf });
    const u = { a: A.i, b: B.i, lo, hi, geo: { [A.i]: geo(gA), [B.i]: geo(gB) }, inclinada: true };
    if (Blo && Bhi && !Alo && !Ahi) { u.tipo = 'caja'; u.en = A.i; u.pasa = B.i; A.cajas.push(Object.assign(geo(gA), { con: B.i, girada: true })); }
    else if (Alo && Ahi && !Blo && !Bhi) { u.tipo = 'caja'; u.en = B.i; u.pasa = A.i; B.cajas.push(Object.assign(geo(gB), { con: A.i, girada: true })); }
    else {
      const aArriba = Ahi && Blo ? true : !(Alo && Bhi), mid = (lo + hi) / 2;
      u.tipo = 'media'; u.aArriba = aArriba;
      A.ranuras.push({ rot: gA.rot, c: gA.c, mid: mid - gA.off, borde: (aArriba ? hi : lo) - gA.off, alto: aArriba, wf, con: B.i });
      B.ranuras.push({ rot: gB.rot, c: gB.c, mid: mid - gB.off, borde: (aArriba ? lo : hi) - gB.off, alto: !aArriba, wf, con: A.i });
    }
    res.uniones.push(u); A.uniones.push(u); B.uniones.push(u);
  }));
}
