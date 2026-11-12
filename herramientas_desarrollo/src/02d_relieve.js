
/* ===================== RELIEVE DESDE TEXTO O MODELO 3D (paneles de pared) =====================
   La forma de las lamas no sale de los perfiles clave sino de un «mapa de profundidad» del panel:
   - texto: se dibuja con una fuente del sistema, se suaviza y sus letras salen (o se hunden)
   - modelo: un STL u OBJ proyectado desde un lado; lo más cercano sale más
   - imagen: una foto o dibujo en escala de grises (mapa de alturas); lo claro sale más
   El mapa cubre el panel (ancho × alto, en mm) y vale de 0 (fondo) a 1 (lo que más sale). */
const relieveActivo = () => P.tipo === 'pared' && P.relieve && ['texto', 'modelo', 'imagen'].includes(P.relieve.fuente);
// medidas del panel: ancho (horizontal) y alto (vertical)
function medidasPanel() {
  if (relieveActivo()) return [P.relieve.ancho, P.relieve.alto];
  // con perfiles clave: la lama mide lo que el alto de los perfiles
  const H = altoPerfiles();
  return P.relieve && P.relieve.orient === 'h' ? [H, P.largo] : [P.largo, H];
}
function altoPerfiles() {
  let a = 0, b = 0; (P.claves || []).forEach(k => k.pts.forEach(q => { a = Math.min(a, q[1]); b = Math.max(b, q[1]); }));
  return b - a || (P.params && P.params.alto) || 1000;
}
// a lo ancho del perfil (lo que mide cada lama a lo largo): en lamas horizontales, el ancho del panel
const anchoPerfil = () => medidasPanel()[0];

const CACHE_MAPA = { clave: '', mapa: null };
function mapaRelieve() {
  const Rl = P.relieve, clave = JSON.stringify([Rl.fuente, Rl.ancho, Rl.alto, Rl.texto, Rl.letra, Rl.tamLetra, Rl.negrita, Rl.interlinea, Rl.suavizado, Rl.invertir, Rl.ondaAmp, Rl.ondas, Rl.modelo && Rl.modelo.id, Rl.imagen && Rl.imagen.id, Rl.gama]);
  if (CACHE_MAPA.clave === clave) return CACHE_MAPA.mapa;
  let m = Rl.fuente === 'texto' ? mapaTexto(Rl) : Rl.fuente === 'imagen' ? mapaImagen(Rl) : mapaModelo(Rl);
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
/* ---------- imagen en escala de grises ---------- */
// se guarda reducida (lado mayor ≤ 600 px) en grises de 0 a 255; lo transparente cuenta como negro (fondo)
function cargarImagenDesde(img, nombre) {
  const k = Math.min(1, 600 / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const w = Math.max(2, Math.round((img.naturalWidth || img.width) * k)), h = Math.max(2, Math.round((img.naturalHeight || img.height) * k));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data; let s = '';
  for (let i = 0; i < w * h; i++) { const a = px[i * 4 + 3] / 255; s += String.fromCharCode(Math.round((0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) * a)); }
  P.relieve.imagen = { nombre, w, h, d64: btoa(s), id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6) };
  return { w, h };
}
// carga un archivo de imagen (png, jpg, webp…) y, si se pide, ajusta el alto del panel a sus proporciones
function cargarImagenArchivo(file, ajustarAlto) {
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { try { const r = cargarImagenDesde(img, file.name); if (ajustarAlto) ajustarAltoImagen(); ok(r); } catch (e) { mal(e); } finally { URL.revokeObjectURL(url); } };
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('No se puede leer la imagen «' + file.name + '»')); };
    img.src = url;
  });
}
function ajustarAltoImagen() {
  const I = P.relieve.imagen; if (!I) return;
  P.relieve.alto = Math.max(100, Math.round(P.relieve.ancho * I.h / I.w / 10) * 10);
}
function mapaImagen(Rl) {
  const I = Rl.imagen; if (!I || !I.d64) return null;
  const bin = atob(I.d64), d = new Float32Array(bin.length), g = Rl.gama > 0 ? Rl.gama : 1;
  for (let i = 0; i < bin.length; i++) d[i] = Math.pow(bin.charCodeAt(i) / 255, g);
  return { w: I.w, h: I.h, mm: Rl.ancho / I.w, d, mmY: Rl.alto / I.h };
}
// imágenes de ejemplo (assets/imagenes/imagenes.js): ya en grises (d64), con su png para verla
const imagenesEjemplo = () => window.MADE_IMAGENES || [];
function cargarImagenEjemplo(id, conMedidas) {
  const E = imagenesEjemplo().find(e => e.id === id); if (!E) throw new Error('No se encuentra la imagen de ejemplo «' + id + '» (assets/imagenes/imagenes.js)');
  const Rl = P.relieve; Rl.fuente = 'imagen';
  Rl.imagen = { nombre: E.nombre, w: E.w, h: E.h, d64: E.d64, id: E.id + '-' + Date.now().toString(36) };
  if (conMedidas && E.ancho) { Rl.ancho = E.ancho; Rl.alto = E.alto; }
  return E;
}

/* ---------- convertir el relieve en perfiles clave (no se puede deshacer, salvo con ↶) ----------
   Una clave en cada lama (como mucho 60) y en cada una el mismo número de puntos, repartidos a lo largo de la lama. */
function convertirRelieveEnPerfiles() {
  if (!relieveActivo()) return 0;
  const Rl = P.relieve, [W, H] = medidasPanel(), hor = Rl.orient === 'h', largo = hor ? H : W, largoV = hor ? W : H;
  const xs = (R && R.costillas && R.costillas.length ? R.costillas.map(c => c.x) : []).filter(x => x >= 0 && x <= largo);
  let pos = xs.length >= 2 ? xs : Array.from({ length: 13 }, (_, i) => largo * i / 12);
  if (pos.length > 60) pos = Array.from({ length: 60 }, (_, i) => pos[Math.round(i * (pos.length - 1) / 59)]);
  if (pos[0] > 0.5) pos.unshift(0); if (pos[pos.length - 1] < largo - 0.5) pos.push(largo);
  const M = clamp(Math.round(largoV / 12), 24, 90);
  const claves = pos.map(x => {
    const pts = [[0, 0]];
    for (let j = 0; j < M; j++) { const v = largoV * j / (M - 1); pts.push([Math.round((hor ? profundidadEn(v, x) : profundidadEn(x, v)) * 10) / 10, Math.round(v * 10) / 10]); }
    pts.push([0, largoV]);
    return { x: Math.round(x * 10) / 10, pts };
  });
  P.claves = claves; P.esquinas = [true, true, ...new Array(M - 2).fill(false), true, true];
  P.largo = largo; P.plantilla = 'pared_libre'; P.params = { largo, alto: largoV }; P.editado = true;
  Rl.fuente = 'plantilla'; Rl.modelo = null; Rl.imagen = null;
  return claves.length;
}

function cargarModelo(buf, nombre) { return cargarTriangulos(leerMalla(buf, nombre), nombre); }
function cargarTriangulos(tri, nombre, ejemplo) {
  if (!tri.length) throw new Error('No se han encontrado triángulos en «' + nombre + '»');
  const Rl = P.relieve, mmPx = Math.max(1, Math.max(Rl.ancho, Rl.alto) / 500);
  const m = mapaDesdeMalla(tri, Rl.vista, Rl.giro, Rl.ancho, Rl.alto, mmPx);
  let s = ''; for (let i = 0; i < m.d8.length; i++) s += String.fromCharCode(m.d8[i]);
  const mallaId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  Rl.modelo = { nombre, w: m.w, h: m.h, d64: btoa(s), id: mallaId, mallaId, triangulos: tri.length };
  if (ejemplo) Rl.modelo.ejemplo = ejemplo;
  UI.malla = { tri, nombre, id: mallaId };     // para volver a proyectar si cambia la vista (no se guarda)
  return tri.length;
}
// ---- modelos 3D de ejemplo (assets/modelos/modelos.js): vértices int16 en décimas de mm + caras uint32 ----
const modelosEjemplo = () => window.MADE_MODELOS || [];
function triangulosEjemplo(id) {
  const M = modelosEjemplo().find(m => m.id === id); if (!M) return null;
  const bin = b => { const s = atob(b), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u.buffer; };
  const v = new Int16Array(bin(M.v)), f = new Uint32Array(bin(M.f)), V = i => [v[3 * i] / 10, v[3 * i + 1] / 10, v[3 * i + 2] / 10], tri = [];
  for (let k = 0; k < f.length; k += 3) tri.push([V(f[k]), V(f[k + 1]), V(f[k + 2])]);
  return { M, tri };
}
// carga un modelo de ejemplo con su vista y medidas propuestas (las medidas solo si se pide)
function cargarModeloEjemplo(id, conMedidas) {
  const r = triangulosEjemplo(id); if (!r) throw new Error('No se encuentra el modelo de ejemplo «' + id + '» (assets/modelos/modelos.js)');
  const Rl = P.relieve; Rl.fuente = 'modelo'; Rl.vista = r.M.vista || 'frente'; Rl.giro = r.M.giro || 0;
  if (conMedidas && r.M.ancho) { Rl.ancho = r.M.ancho; Rl.alto = r.M.alto; }
  return cargarTriangulos(r.tri, r.M.nombre, id);
}
// la malla en memoria solo vale para el modelo del proyecto actual (al abrir otro o deshacer, cambia)
function mallaVigente() {
  const mo = P.relieve && P.relieve.modelo;
  if (UI.malla && !(mo && mo.mallaId === UI.malla.id)) UI.malla = null;
  if (!UI.malla && mo && mo.ejemplo) { const r = triangulosEjemplo(mo.ejemplo); if (r) UI.malla = { tri: r.tri, nombre: r.M.nombre, id: mo.mallaId }; }
  return UI.malla;
}
function reproyectarModelo() {
  mallaVigente();
  if (!UI.malla) return false;
  const Rl = P.relieve, mmPx = Math.max(1, Math.max(Rl.ancho, Rl.alto) / 500);
  const m = mapaDesdeMalla(UI.malla.tri, Rl.vista, Rl.giro, Rl.ancho, Rl.alto, mmPx);
  let s = ''; for (let i = 0; i < m.d8.length; i++) s += String.fromCharCode(m.d8[i]);
  Rl.modelo = { ...Rl.modelo, w: m.w, h: m.h, d64: btoa(s), id: Date.now().toString(36) };
  return true;
}
