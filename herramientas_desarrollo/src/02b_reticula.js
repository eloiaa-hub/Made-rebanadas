
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
