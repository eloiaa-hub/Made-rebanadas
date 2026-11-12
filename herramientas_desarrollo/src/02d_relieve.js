
/* ===================== RELIEVE DESDE TEXTO O MODELO 3D (paneles de pared) =====================
   La forma de las lamas no sale de los perfiles clave sino de un «mapa de profundidad» del panel:
   - texto: se dibuja con una fuente del sistema, se suaviza y sus letras salen (o se hunden)
   - modelo: un STL u OBJ proyectado desde un lado; lo más cercano sale más
   El mapa cubre el panel (ancho × alto, en mm) y vale de 0 (fondo) a 1 (lo que más sale). */
const relieveActivo = () => P.tipo === 'pared' && P.relieve && (P.relieve.fuente === 'texto' || P.relieve.fuente === 'modelo');
// medidas del panel: ancho (horizontal) y alto (vertical)
function medidasPanel() {
  if (relieveActivo()) return [P.relieve.ancho, P.relieve.alto];
  return [P.largo, (P.params && P.params.alto) || 1000];
}
// a lo ancho del perfil (lo que mide cada lama a lo largo): en lamas horizontales, el ancho del panel
const anchoPerfil = () => medidasPanel()[0];

const CACHE_MAPA = { clave: '', mapa: null };
function mapaRelieve() {
  const Rl = P.relieve, clave = JSON.stringify([Rl.fuente, Rl.ancho, Rl.alto, Rl.texto, Rl.letra, Rl.tamLetra, Rl.negrita, Rl.interlinea, Rl.suavizado, Rl.invertir, Rl.ondaAmp, Rl.ondas, Rl.modelo && Rl.modelo.id]);
  if (CACHE_MAPA.clave === clave) return CACHE_MAPA.mapa;
  let m = Rl.fuente === 'texto' ? mapaTexto(Rl) : mapaModelo(Rl);
  if (m && Rl.suavizado > 0) m = suavizarMapa(m, Rl.suavizado / m.mm);
  if (m && Rl.invertir) for (let i = 0; i < m.d.length; i++) m.d[i] = 1 - m.d[i];
  CACHE_MAPA.clave = clave; CACHE_MAPA.mapa = m;
  return m;
}
// profundidad (mm) en el punto (X horizontal, Y vertical) del panel
function profundidadEn(X, Y) {
  const Rl = P.relieve, m = mapaRelieve();
  let h = 0;
  if (m) {
    const fx = clamp(X / m.mm, 0, m.w - 1), fy = clamp((Rl.alto - Y) / (m.mmY || m.mm), 0, m.h - 1);
    const x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(m.w - 1, x0 + 1), y1 = Math.min(m.h - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
    const g = (x, y) => m.d[y * m.w + x];
    h = (g(x0, y0) * (1 - tx) + g(x1, y0) * tx) * (1 - ty) + (g(x0, y1) * (1 - tx) + g(x1, y1) * tx) * ty;
  }
  const onda = Rl.ondaAmp ? Rl.ondaAmp * (0.5 + 0.5 * Math.sin(PI2 * (Rl.ondas || 1) * X / Rl.ancho)) : 0;
  return Math.max(2, Rl.fondo + Rl.relieve * h + onda);
}
// contorno de la lama en la posición x (horizontal en lamas verticales, altura en las horizontales)
function poligonoRelieve(x, denso) {
  const [W, H] = medidasPanel(), hor = P.relieve.orient === 'h', largoV = hor ? W : H;
  const paso = Math.max(1.5, largoV / 260), out = [[0, 0]];
  for (let v = 0; v <= largoV + 1e-6; v += paso) out.push([hor ? profundidadEn(v, x) : profundidadEn(x, v), Math.min(v, largoV)]);
  if (out[out.length - 1][1] < largoV) out.push([hor ? profundidadEn(largoV, x) : profundidadEn(x, largoV), largoV]);
  out.push([0, largoV]);
  return denso ? out : simplificaCerrado(out, 0.02);
}
// contorno de la costilla en la posición x, venga de los perfiles clave o del relieve
function contornoEnX(x) { return relieveActivo() ? poligonoRelieve(x) : contornoDe(perfilEn(x)); }

/* ---------- texto ---------- */
const LETRAS_SISTEMA = ['Arial Black', 'Arial', 'Impact', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Georgia', 'Times New Roman', 'Courier New', 'Comic Sans MS', 'serif', 'sans-serif', 'monospace'];
function mapaTexto(Rl) {
  const mm = Math.max(1, Math.max(Rl.ancho, Rl.alto) / 700), w = Math.max(8, Math.round(Rl.ancho / mm)), h = Math.max(8, Math.round(Rl.alto / mm));
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  const lineas = String(Rl.texto || '').split('\n'), pt = Rl.tamLetra / mm;
  ctx.font = `${Rl.negrita ? 'bold ' : ''}${pt}px "${Rl.letra}", sans-serif`;
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const alto = pt * (Rl.interlinea || 1.1);
  lineas.forEach((l, i) => ctx.fillText(l, w / 2, h / 2 + (i - (lineas.length - 1) / 2) * alto));
  const px = ctx.getImageData(0, 0, w, h).data, d = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = px[i * 4] / 255;
  return { w, h, mm, d };
}
// desenfoque por cajas (tres pasadas ≈ gaussiano): letras y bordes redondeados
function suavizarMapa(m, rad) {
  const r = Math.max(1, Math.round(rad / 2)), w = m.w, h = m.h; let a = Float32Array.from(m.d), b = new Float32Array(w * h);
  for (let pas = 0; pas < 3; pas++) {
    for (let y = 0; y < h; y++) { let s = 0; for (let x = -r; x <= r; x++) s += a[y * w + clamp(x, 0, w - 1)]; for (let x = 0; x < w; x++) { b[y * w + x] = s / (2 * r + 1); s += a[y * w + clamp(x + r + 1, 0, w - 1)] - a[y * w + clamp(x - r, 0, w - 1)]; } }
    for (let x = 0; x < w; x++) { let s = 0; for (let y = -r; y <= r; y++) s += b[clamp(y, 0, h - 1) * w + x]; for (let y = 0; y < h; y++) { a[y * w + x] = s / (2 * r + 1); s += b[clamp(y + r + 1, 0, h - 1) * w + x] - b[clamp(y - r, 0, h - 1) * w + x]; } }
  }
  return { ...m, d: a };
}

/* ---------- modelo 3D ---------- */
// lee un STL (binario o de texto) o un OBJ y devuelve los triángulos [[x,y,z]×3]
function leerMalla(buf, nombre) {
  const u8 = new Uint8Array(buf), tri = [];
  const txt = () => new TextDecoder().decode(u8);
  if (/\.obj$/i.test(nombre)) {
    const vs = [];
    txt().split(/\r?\n/).forEach(l => {
      const t = l.trim().split(/\s+/);
      if (t[0] === 'v') vs.push([+t[1], +t[2], +t[3]]);
      else if (t[0] === 'f') { const ix = t.slice(1).map(s => { const k = parseInt(s, 10); return k < 0 ? vs.length + k : k - 1; }); for (let i = 1; i + 1 < ix.length; i++) tri.push([vs[ix[0]], vs[ix[i]], vs[ix[i + 1]]]); }
    });
  } else {
    const dv = new DataView(buf), n = u8.length >= 84 ? dv.getUint32(80, true) : 0;
    if (u8.length >= 84 && 84 + n * 50 === u8.length) {
      for (let i = 0; i < n; i++) { const o = 84 + i * 50 + 12, p = k => [dv.getFloat32(o + k * 12, true), dv.getFloat32(o + k * 12 + 4, true), dv.getFloat32(o + k * 12 + 8, true)]; tri.push([p(0), p(1), p(2)]); }
    } else {
      const v = []; txt().replace(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g, (_, a, b, c) => { v.push([+a, +b, +c]); return ''; });
      for (let i = 0; i + 2 < v.length; i += 3) tri.push([v[i], v[i + 1], v[i + 2]]);
    }
  }
  return tri.filter(t => t.every(p => p && p.every(isFinite)));
}
// proyecta los triángulos desde una vista: devuelve [x imagen, y imagen, profundidad (más = más cerca)]
const VISTAS = {
  frente: p => [p[0], p[1], p[2]], atras: p => [-p[0], p[1], -p[2]],
  izquierda: p => [-p[2], p[1], -p[0]], derecha: p => [p[2], p[1], p[0]],
  arriba: p => [p[0], -p[2], p[1]], abajo: p => [p[0], p[2], -p[1]],
};
// de malla a mapa de profundidad, ajustado al panel (rasterizado con z-buffer)
function mapaDesdeMalla(tri, vista, giro, ancho, alto, mmPx) {
  const pr = VISTAS[vista] || VISTAS.frente, g = ((giro || 0) % 360 + 360) % 360;
  const rot = p => g === 90 ? [-p[1], p[0], p[2]] : g === 180 ? [-p[0], -p[1], p[2]] : g === 270 ? [p[1], -p[0], p[2]] : p;
  const T3 = tri.map(t => t.map(p => rot(pr(p))));
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  T3.forEach(t => t.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }));
  const w = Math.max(8, Math.round(ancho / mmPx)), h = Math.max(8, Math.round(alto / mmPx));
  const s = 0.94 * Math.min(w / (x1 - x0 || 1), h / (y1 - y0 || 1)), ox = (w - (x1 - x0) * s) / 2, oy = (h - (y1 - y0) * s) / 2;
  const z = new Float32Array(w * h).fill(-Infinity);
  T3.forEach(t => {
    const q = t.map(p => [ox + (p[0] - x0) * s, h - (oy + (p[1] - y0) * s), p[2]]);
    const minX = Math.max(0, Math.floor(Math.min(q[0][0], q[1][0], q[2][0]))), maxX = Math.min(w - 1, Math.ceil(Math.max(q[0][0], q[1][0], q[2][0])));
    const minY = Math.max(0, Math.floor(Math.min(q[0][1], q[1][1], q[2][1]))), maxY = Math.min(h - 1, Math.ceil(Math.max(q[0][1], q[1][1], q[2][1])));
    const den = (q[1][1] - q[2][1]) * (q[0][0] - q[2][0]) + (q[2][0] - q[1][0]) * (q[0][1] - q[2][1]);
    if (Math.abs(den) < 1e-12) return;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5, py = y + 0.5;
      const a = ((q[1][1] - q[2][1]) * (px - q[2][0]) + (q[2][0] - q[1][0]) * (py - q[2][1])) / den;
      const b = ((q[2][1] - q[0][1]) * (px - q[2][0]) + (q[0][0] - q[2][0]) * (py - q[2][1])) / den, c = 1 - a - b;
      if (a < -1e-6 || b < -1e-6 || c < -1e-6) continue;
      const zz = a * q[0][2] + b * q[1][2] + c * q[2][2], k = y * w + x;
      if (zz > z[k]) z[k] = zz;
    }
  });
  let zmin = Infinity, zmax = -Infinity;
  for (let i = 0; i < z.length; i++) if (z[i] > -Infinity) { zmin = Math.min(zmin, z[i]); zmax = Math.max(zmax, z[i]); }
  const d = new Uint8Array(w * h);
  for (let i = 0; i < z.length; i++) d[i] = z[i] > -Infinity ? 1 + Math.round(254 * (z[i] - zmin) / ((zmax - zmin) || 1)) : 0;
  return { w, h, mm: mmPx, d8: d };
}
function mapaModelo(Rl) {
  const M = Rl.modelo; if (!M || !M.d64) return null;
  const bin = atob(M.d64), d = new Float32Array(bin.length);
  // 0 = fondo; 1…255 = profundidad del modelo; el fondo del modelo queda en «base»
  for (let i = 0; i < bin.length; i++) { const v = bin.charCodeAt(i); d[i] = v ? (Rl.base || 0) + (1 - (Rl.base || 0)) * (v - 1) / 254 : 0; }
  // el mapa guardado puede tener otro tamaño que el panel: se estira al panel
  return { w: M.w, h: M.h, mm: Rl.ancho / M.w, d, mmY: Rl.alto / M.h };
}
function cargarModelo(buf, nombre) {
  const tri = leerMalla(buf, nombre);
  if (!tri.length) throw new Error('No se han encontrado triángulos en «' + nombre + '»');
  const Rl = P.relieve, mmPx = Math.max(1, Math.max(Rl.ancho, Rl.alto) / 500);
  const m = mapaDesdeMalla(tri, Rl.vista, Rl.giro, Rl.ancho, Rl.alto, mmPx);
  let s = ''; for (let i = 0; i < m.d8.length; i++) s += String.fromCharCode(m.d8[i]);
  Rl.modelo = { nombre, w: m.w, h: m.h, d64: btoa(s), id: Date.now().toString(36), triangulos: tri.length };
  UI.malla = { tri, nombre };     // para volver a proyectar si cambia la vista (no se guarda)
  return tri.length;
}
function reproyectarModelo() {
  if (!UI.malla) return false;
  const Rl = P.relieve, mmPx = Math.max(1, Math.max(Rl.ancho, Rl.alto) / 500);
  const m = mapaDesdeMalla(UI.malla.tri, Rl.vista, Rl.giro, Rl.ancho, Rl.alto, mmPx);
  let s = ''; for (let i = 0; i < m.d8.length; i++) s += String.fromCharCode(m.d8[i]);
  Rl.modelo = { ...Rl.modelo, w: m.w, h: m.h, d64: btoa(s), id: Date.now().toString(36) };
  return true;
}
