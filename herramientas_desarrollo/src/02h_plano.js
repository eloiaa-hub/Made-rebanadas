
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
const planoP = () => P.plano || (P.plano = { holgura: 0.3, piezas: [], solape: { tipo: 'tacos', diam: 8, n: 0 } });
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
    res.costillas.push({ i: k, x: +pz.c || 0, plano: pl, poly, base: poly, ok, caja: ok ? cajaDe(poly) : { x0: 0, y0: 0, x1: 0, y1: 0, w: 0, h: 0 }, area: ok ? areaFirmada(poly) : 0,
      agujeros: [], nVar: 0, ranuras: [], cajas: [], uniones: [], int: [], taladros: [], etq: String(k + 1), nombre: pz.nombre || 'Pieza ' + (k + 1) });
  });
  res.n = res.costillas.length;
  const ps = res.costillas, tol = 0.05, solapes = [];
  for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const A = ps[i], B = ps[j]; if (!A.ok || !B.ok) continue;
    const pa = PLANOS[A.plano], pb = PLANOS[B.plano];
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
  ps.forEach(p => { if (!p.ok) return; const pl = PLANOS[p.plano];
    bb[pl.a][0] = Math.min(bb[pl.a][0], p.caja.x0); bb[pl.a][1] = Math.max(bb[pl.a][1], p.caja.x1);
    bb[pl.b][0] = Math.min(bb[pl.b][0], p.caja.y0); bb[pl.b][1] = Math.max(bb[pl.b][1], p.caja.y1);
    bb[pl.n][0] = Math.min(bb[pl.n][0], p.x - e / 2); bb[pl.n][1] = Math.max(bb[pl.n][1], p.x + e / 2); });
  res.bbox = bb.map(r => isFinite(r[0]) ? r : [0, 0]);
  P.largo = Math.max(1, Math.round(res.bbox[0][1] - res.bbox[0][0]));
  avisosPlano(res);
  res.otras = []; return res;
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
  const sueltas = res.costillas.filter(p => p.ok && !p.uniones.length);
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
  const M = P.maqueta;
  if (M && M.activa && Math.abs(M.grosor * M.escala - e) > e * 0.2) add('info', `Maqueta 1:${M.escala}: ${fmt(M.grosor, 1)} mm equivalen a ${fmt(M.grosor * M.escala)} mm reales (el tablero real es de ${fmt(e, 1)} mm): las ranuras y las cajas de la maqueta se hacen con el grosor de la maqueta.`);
  if (!A.some(a => a.tipo === 'error' || a.tipo === 'atencion')) {
    const nM = res.uniones.filter(u => u.tipo === 'media').length, nC = res.uniones.filter(u => u.tipo === 'caja').length, nS = res.uniones.filter(u => u.tipo === 'solape').length;
    const partes = [nM ? nM + ' a media madera' : '', nC ? nC + (nC > 1 ? ' espigas en caja pasante' : ' espiga en caja pasante') : '', nS ? nS + (nS > 1 ? ' solapes' : ' solape') + ` con ${solapeP().tipo}` : ''].filter(Boolean);
    add('ok', `Todo correcto: ${res.n} piezas con ${res.uniones.length} ${res.uniones.length === 1 ? 'unión' : 'uniones'}` + (partes.length ? ` (${partes.length > 1 ? partes.slice(0, -1).join(', ') + ' y ' + partes[partes.length - 1] : partes[0]})` : '') + '.');
  }
}
// texto de las uniones de una pieza (para la vista de la pieza, el plano y el despiece)
function textoUnionesPieza(c) {
  if (!R || !c.uniones) return '';
  const so = c.uniones.filter(u => u.tipo === 'solape').length, nt = (c.taladros || []).length, m = c.uniones.filter(u => u.tipo === 'media').length, cj = c.uniones.filter(u => u.tipo === 'caja' && u.en === c.i).length, es = c.uniones.filter(u => u.tipo === 'caja' && u.pasa === c.i).length;
  return [so ? `${so} ${so > 1 ? 'solapes' : 'solape'} (${nt} ${solapeP().tipo === 'tornillos' ? 'taladros' : 'tacos'})` : '', m ? m + ' a media madera' : '', cj ? cj + (cj > 1 ? ' cajas' : ' caja') : '', es ? es + (es > 1 ? ' espigas' : ' espiga') : ''].filter(Boolean).join(' · ') || 'sin uniones';
}
// matriz 3D de una pieza: el contorno (a, b) en su plano, el grosor centrado en la posición c
function basePieza(c) {
  const pl = PLANOS[c.plano], ex = [0, 0, 0], ey = [0, 0, 0]; ex[pl.a] = 1; ey[pl.b] = 1;
  const ez = [ex[1] * ey[2] - ex[2] * ey[1], ex[2] * ey[0] - ex[0] * ey[2], ex[0] * ey[1] - ex[1] * ey[0]], o = [0, 0, 0]; o[pl.n] = c.x;
  return { ex, ey, ez, o };
}
// punto del contorno de una pieza en el espacio (mm)
function puntoPieza(c, a, b) { const pl = PLANOS[c.plano], q = [0, 0, 0]; q[pl.a] = a; q[pl.b] = b; q[pl.n] = c.x; return q; }
