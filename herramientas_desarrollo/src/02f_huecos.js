
/* ===================== HUECOS: RECORTES Y MUEBLES INSERTADOS =====================
   Un hueco es una forma (rectángulo, redondeado, arco, círculo o libre) que se resta de las piezas:
   - Panel de pared: se dibuja en la vista de frente (X a lo ancho, Y a lo alto, desde abajo a la izquierda).
       pasante: quita las lamas (se ve la pared) · rebaje: recorta las lamas a una profundidad
       mueble: quita las lamas y pone una balda, una caja (hornacina) o un armario con puerta.
   - Costillas y retícula: se dibuja en el perfil (u, v) y atraviesa las piezas entre «desde» y «hasta»
       (un túnel); también puede llevar balda o caja por dentro.
   Las restas se hacen con Clipper (assets/js/clipper.js). Una lama o costilla puede quedar en varias
   piezas (Lama 12a, 12b…) y con agujeros por dentro. */
const ESC_CL = 1000;
const usaHuecos = () => ['pared', 'costillas', 'reticula'].includes(P.tipo) && (P.huecos || []).some(h => h.activo !== false) && !!window.ClipperLib;
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

// ---- Clipper ----
const aCl = poly => poly.map(p => ({ X: Math.round(p[0] * ESC_CL), Y: Math.round(p[1] * ESC_CL) }));
const deCl = path => path.map(q => [q.X / ESC_CL, q.Y / ESC_CL]);
function booleana(sujeto, recortes, tipo) {
  const C = window.ClipperLib, c = new C.Clipper();
  c.AddPath(aCl(sujeto), C.PolyType.ptSubject, true);
  recortes.forEach(r => { if (r.length >= 3) c.AddPath(aCl(r), C.PolyType.ptClip, true); });
  const arbol = new C.PolyTree();
  c.Execute(tipo === 'interseccion' ? C.ClipType.ctIntersection : C.ClipType.ctDifference, arbol, C.PolyFillType.pftNonZero, C.PolyFillType.pftNonZero);
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
function recortesDe(p) {
  const e = grosor(), out = [], extra = [];   // extra: trozos que se añaden (lamas de la puerta)
  huecosActivos().forEach((h, ih) => {
    const muebleH = h.modo === 'mueble', hol = muebleH ? Math.max(0, h.holgura || 0) : 0;
    let forma = formaHueco(h); if (hol) forma = engordar(forma, hol);
    if (P.tipo === 'pared') {
      // la lama ocupa una franja del frente: en vertical, X en [x - e/2, x + e/2]; en horizontal, Y
      const eje = lamasH() ? 0 : 1;               // a lo largo de la lama: Y (vertical) o X (horizontal)
      const ts = tramosEnFranja(forma, eje, p.x - e / 2, p.x + e / 2); if (!ts.length) return;
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
  return { out, extra };
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
  const { out, extra } = recortesDe(p);
  if (!out.length && !extra.length) return null;
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
  piezas.forEach(p => {
    const ps = partesDe(p, p.poly); if (!ps) return;
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
    if (h.modo === 'rebaje') return;
    const forma = h.modo === 'mueble' ? engordar(formaHueco(h), h.holgura || 0) : formaHueco(h);
    // la franja del rastrel en el frente: a lo largo de x, entre v - alto/2 y v + alto/2
    const ts = tramosEnFranja(forma, lamasH() ? 1 : 0, v - alto / 2, v + alto / 2);
    ts.forEach(([a, b]) => { tramos = tramos.flatMap(([c, d]) => b <= c || a >= d ? [[c, d]] : [[c, a], [b, d]].filter(([m, n]) => n - m > 20)); });
  });
  return tramos;
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
