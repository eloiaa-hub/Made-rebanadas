
/* ===================== GUARDAR EL MODELO 3D (STL / OBJ) =====================
   Recorre las mallas del mueble montado (sin explosión) y las escribe en mm.
   - STL binario: una sola malla, para imprimir en 3D o abrir en cualquier programa.
   - OBJ + MTL: un objeto por pieza (Lama 1, Costilla 2, Larguero A…) con el color de su material.
   No se guardan la pared, el volumen de ayuda, las líneas de los perfiles ni el suelo. */
function piezasMalla3D(opc) {
  const out = [], e = P.vista.explosion;
  if (e) { P.vista.explosion = 0; colocarExplosion(); }
  G.modelo.updateMatrixWorld(true);
  const nomOtra = i => { const o = R.otras.find(z => z.i === i); return o ? o.nombre : 'Pieza ' + (i + 1); };
  const colorDe = m => { const mt = Array.isArray(m.material) ? m.material[0] : m.material; return mt && mt.color ? '#' + mt.color.getHexString() : '#cccccc'; };
  const hexTablero = () => (P.costillas.material === 'lacado' ? P.costillas.color : (MATERIALES[P.costillas.material] || MATERIALES.mdf).hex);
  let nVar = 0, nRas = 0;
  G.modelo.traverse(m => {
    if (!m.isMesh || m === G.fantasma || !m.visible) return;
    let p = m.parent, vis = true; while (p) { if (!p.visible) vis = false; p = p.parent; } if (!vis) return;
    const ud = m.userData || {}; let nombre, color, grupo;
    if (ud.extra === 'pared') return;
    if (ud.extra === 'rastrel') { if (!opc.herrajes) return; nombre = 'Rastrel ' + (++nRas); color = colorDe(m); grupo = 'rastreles'; }
    else if (ud.extra === 'tubo' || ud.var) { if (!opc.herrajes) return; nombre = ud.extra === 'tubo' ? 'Tubo central' : 'Varilla ' + (++nVar); color = colorDe(m); grupo = 'herrajes'; }
    else if (ud.z || ud.disco || ud.trozoX != null || ud.modulo) { nombre = nomOtra(ud.i); color = hexTablero(); grupo = 'tablero'; }   // también los trozos de lama y los muebles de los huecos
    else if (ud.x != null) { const c = R.costillas[ud.i]; nombre = c ? c.nombre : 'Costilla ' + (ud.i + 1); color = hexTablero(); grupo = 'tablero'; }
    else return;
    const g = m.geometry, pos = g.attributes.position, idx = g.index, M = m.matrixWorld, v = new THREE.Vector3(), V = [];
    for (let k = 0; k < pos.count; k++) { v.fromBufferAttribute(pos, k).applyMatrix4(M); V.push([v.x, v.y, v.z]); }
    const F = [];
    if (idx) for (let k = 0; k + 2 < idx.count; k += 3) F.push([idx.getX(k), idx.getX(k + 1), idx.getX(k + 2)]);
    else for (let k = 0; k + 2 < pos.count; k += 3) F.push([k, k + 1, k + 2]);
    if (M.determinant() < 0) F.forEach(f => f.reverse());
    out.push({ nombre, color, grupo, V, F });
  });
  if (e) { P.vista.explosion = e; colocarExplosion(); }
  // ejes y escala: Y arriba (Three.js) → Z arriba si se pide; el mueble se apoya en z = 0
  const s = 1 / (opc.escala || 1);
  const tr = opc.zArriba ? q => [q[0] * s, -q[2] * s, q[1] * s] : q => [q[0] * s, q[1] * s, q[2] * s];
  out.forEach(o => { o.V = o.V.map(tr); });
  let mins = [Infinity, Infinity, Infinity]; out.forEach(o => o.V.forEach(q => { for (let c = 0; c < 3; c++) mins[c] = Math.min(mins[c], q[c]); }));
  const ab = opc.zArriba ? 2 : 1;
  out.forEach(o => o.V.forEach(q => { q[ab] -= mins[ab]; }));
  return out;
}
// la malla de cada pieza soldada y con las tapas reparadas, en el formato de vértices y caras de piezasMalla3D
function piezasCerradas(opc) {
  return piezasMalla3D(opc).map(p => {
    const { pos, tri } = soldarMalla(p.V, p.F), V = [], F = [];
    for (let i = 0; i < pos.length; i += 3) V.push([pos[i], pos[i + 1], pos[i + 2]]);
    for (let t = 0; t < tri.length; t += 3) F.push([tri[t], tri[t + 1], tri[t + 2]]);
    return Object.assign(p, { V, F, pos, tri });
  }).filter(p => p.F.length);
}
function exportarSTL(opc) {
  const ps = piezasCerradas(opc), nT = ps.reduce((a, o) => a + o.F.length, 0);
  const buf = new ArrayBuffer(84 + 50 * nT), dv = new DataView(buf);
  const cab = ('Made-rebanadas ' + VERSION + ' - ' + P.nombre).slice(0, 80);
  for (let k = 0; k < 80; k++) dv.setUint8(k, k < cab.length ? (cab.charCodeAt(k) & 0x7f) : 32);
  dv.setUint32(80, nT, true);
  let o = 84;
  ps.forEach(p => p.F.forEach(f => {
    const a = p.V[f[0]], b = p.V[f[1]], c = p.V[f[2]];
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    let n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]; const L = Math.hypot(...n) || 1; n = n.map(x => x / L);
    [n, a, b, c].forEach(q => { dv.setFloat32(o, q[0], true); dv.setFloat32(o + 4, q[1], true); dv.setFloat32(o + 8, q[2], true); o += 12; });
    dv.setUint16(o, 0, true); o += 2;
  }));
  descargar(nombreArchivo(P.nombre) + sufijo3D(opc) + '.stl', new Blob([buf], { type: 'model/stl' }));
  return { piezas: ps.length, triangulos: nT };
}
function exportarOBJ(opc) {
  const ps = piezasCerradas(opc), base = nombreArchivo(P.nombre) + sufijo3D(opc), f6 = x => +x.toFixed(3);
  const colores = [...new Set(ps.map(p => p.color))], matDe = c => 'mat_' + c.slice(1);
  let obj = `# Made-rebanadas ${VERSION} - ${P.nombre}\n# Unidades: mm${opc.escala > 1 ? ' (escala 1:' + opc.escala + ')' : ''}. ${opc.zArriba ? 'Z' : 'Y'} hacia arriba.\nmtllib ${base}.mtl\n`;
  let off = 1, nT = 0;
  ps.forEach(p => {
    obj += `o ${p.nombre.replace(/\s+/g, '_')}\ng ${p.grupo}\nusemtl ${matDe(p.color)}\n`;
    p.V.forEach(q => { obj += `v ${f6(q[0])} ${f6(q[1])} ${f6(q[2])}\n`; });
    p.F.forEach(f => { obj += `f ${f[0] + off} ${f[1] + off} ${f[2] + off}\n`; });
    off += p.V.length; nT += p.F.length;
  });
  const rgb = h => [1, 3, 5].map(k => (parseInt(h.slice(k, k + 2), 16) / 255).toFixed(4)).join(' ');
  const mtl = `# Made-rebanadas ${VERSION}\n` + colores.map(c => `newmtl ${matDe(c)}\nKd ${rgb(c)}\nKa 0 0 0\nKs 0.05 0.05 0.05\nd 1\nillum 1\n`).join('\n');
  descargar(base + '.obj', obj, 'model/obj');
  setTimeout(() => descargar(base + '.mtl', mtl, 'text/plain'), 400);
  return { piezas: ps.length, triangulos: nT };
}
const sufijo3D = opc => (opc.escala > 1 ? '_1a' + opc.escala : '');

/* ===================== SOLIDCRAFT (.sc y JSON plano) =====================
   Un componente con una importación de mallas («mesh_import»): cada pieza es un cuerpo con su nombre
   (Lama 12a, Rastrel 2…) y su color. Los vértices se sueldan para que cada malla sea cerrada.
   - JSON plano: el documento de SolidCraft con las mallas escritas dentro (formato de entrada y salida
     que SolidCraft admite tal cual).
   - .sc: el mismo documento en un zip, con cada malla en un blob binario SCMESH01 (más pequeño y rápido). */
const FORMATO_SOLIDCRAFT = 'solidcraft/58';
function soldarMalla(V, F) {
  const idx = new Map(), pos = [], tri = [], q = v => Math.round(v * 1e4) / 1e4;
  const id = p => { const k = q(p[0]) + ',' + q(p[1]) + ',' + q(p[2]); let n = idx.get(k); if (n == null) { n = pos.length / 3; idx.set(k, n); pos.push(q(p[0]), q(p[1]), q(p[2])); } return n; };
  F.forEach(f => { const a = id(V[f[0]]), b = id(V[f[1]]), c = id(V[f[2]]); if (a !== b && b !== c && a !== c) tri.push(a, b, c); });
  taparAgujeros(tri);
  return { pos, tri };
}
// tapa los agujeritos que deja el triangulador en las tapas cuando el contorno se toca a sí mismo (rincones
// finos de las letras hundidas, cortes en punta): sigue cada borde suelto al revés y lo cierra en abanico,
// así la malla queda cerrada y con las caras bien orientadas
function taparAgujeros(tri) {
  const dir = new Set(); for (let t = 0; t < tri.length; t += 3) for (let k = 0; k < 3; k++) dir.add(tri[t + k] + '>' + tri[t + (k + 1) % 3]);
  const sale = new Map(); let nb = 0;   // bordes sueltos a→b, que se cierran yendo b→a (varios por vértice si dos agujeros se tocan)
  for (let t = 0; t < tri.length; t += 3) for (let k = 0; k < 3; k++) { const a = tri[t + k], b = tri[t + (k + 1) % 3]; if (!dir.has(b + '>' + a)) { if (!sale.has(b)) sale.set(b, []); sale.get(b).push(a); nb++; } }
  if (!nb || nb > 4000) return 0;
  let n = 0;
  for (const ini of [...sale.keys()]) {
    while ((sale.get(ini) || []).length) {
      const L = [ini]; let v = sale.get(ini).pop(), pasos = 0;
      while (v !== ini && pasos++ < 1000) { L.push(v); const s2 = sale.get(v); if (!s2 || !s2.length) break; v = s2.pop(); }
      if (v !== ini || L.length < 3) continue;
      for (let k = 1; k + 1 < L.length; k++) { tri.push(L[0], L[k], L[k + 1]); n++; }
    }
  }
  return n;
}
function documentoSolidcraft(ps, nombre, archivo, blobs) {
  const usados = new Set(), unico = n => { let m = n, k = 2; while (usados.has(m)) m = `${n} (${k++})`; usados.add(m); return m; };
  const rgb = h => [1, 3, 5].map(k => +(parseInt(h.slice(k, k + 2), 16) / 255).toFixed(4));
  const meshes = ps.map((p, i) => {
    const m = { name: unico(p.nombre), positions: blobs ? [] : p.pos, triangles: blobs ? [] : p.tri, color: rgb(p.color) };
    if (blobs) m.mesh_blob = blobs[i];
    return m;
  });
  return {
    components: [{ id: 1, identification_color_index: 0, name: nombre, parent: 0 }],
    features: [{ body_names: meshes.map(m => m.name), component: 1, file: archivo, id: 3, inserted: true, meshes, name: nombre, suppressed: false, type: 'mesh_import' }],
    format: FORMATO_SOLIDCRAFT, name: nombre, next_component_color_index: 1, next_id: 4,
    occurrences: [{ component: 1, grounded: true, id: 2, name: nombre + ':1', parent: 0, transform: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]] }],
    params: [], units: 'mm',
  };
}
// SHA-256 (los blobs del .sc se llaman por el hash de su contenido)
function sha256(bytes) {
  const K = new Uint32Array([0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const n = bytes.length, total = Math.ceil((n + 9) / 64) * 64, m = new Uint8Array(total); m.set(bytes); m[n] = 0x80;
  const dv = new DataView(m.buffer); dv.setUint32(total - 8, Math.floor(n / 0x20000000)); dv.setUint32(total - 4, (n * 8) >>> 0);
  const W = new Uint32Array(64), r = (x, k) => (x >>> k) | (x << (32 - k));
  for (let o = 0; o < total; o += 64) {
    for (let t = 0; t < 16; t++) W[t] = dv.getUint32(o + t * 4);
    for (let t = 16; t < 64; t++) { const a = W[t - 15], b = W[t - 2]; W[t] = (W[t - 16] + (r(a, 7) ^ r(a, 18) ^ (a >>> 3)) + W[t - 7] + (r(b, 17) ^ r(b, 19) ^ (b >>> 10))) >>> 0; }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + W[t]) >>> 0, t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  return [...H].map(v => v.toString(16).padStart(8, '0')).join('');
}
const TABLA_CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = TABLA_CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
// zip sin comprimir (método «store»), nombres en UTF-8
function zipSinComprimir(entradas) {
  const enc = new TextEncoder(), partes = [], centrales = []; let off = 0;
  entradas.forEach(({ nombre, datos }) => {
    const nb = enc.encode(nombre), crc = crc32(datos), L = new DataView(new ArrayBuffer(30));
    L.setUint32(0, 0x04034b50, true); L.setUint16(4, 20, true); L.setUint16(6, 0x0800, true); L.setUint16(8, 0, true); L.setUint16(10, 0, true); L.setUint16(12, 0x21, true);
    L.setUint32(14, crc, true); L.setUint32(18, datos.length, true); L.setUint32(22, datos.length, true); L.setUint16(26, nb.length, true); L.setUint16(28, 0, true);
    const C = new DataView(new ArrayBuffer(46));
    C.setUint32(0, 0x02014b50, true); C.setUint16(4, 20, true); C.setUint16(6, 20, true); C.setUint16(8, 0x0800, true); C.setUint16(10, 0, true); C.setUint16(12, 0, true); C.setUint16(14, 0x21, true);
    C.setUint32(16, crc, true); C.setUint32(20, datos.length, true); C.setUint32(24, datos.length, true); C.setUint16(28, nb.length, true); C.setUint32(42, off, true);
    partes.push(new Uint8Array(L.buffer), nb, datos); centrales.push(new Uint8Array(C.buffer), nb);
    off += 30 + nb.length + datos.length;
  });
  const tamC = centrales.reduce((a, b) => a + b.length, 0), E = new DataView(new ArrayBuffer(22));
  E.setUint32(0, 0x06054b50, true); E.setUint16(8, entradas.length, true); E.setUint16(10, entradas.length, true); E.setUint32(12, tamC, true); E.setUint32(16, off, true);
  return new Blob([...partes, ...centrales, new Uint8Array(E.buffer)], { type: 'application/zip' });
}
// malla en el binario SCMESH01: cabecera, nº de coordenadas y de índices (u64), coordenadas f64 e índices u32
function blobSCMESH(pos, tri) {
  const buf = new ArrayBuffer(8 + 16 + pos.length * 8 + tri.length * 4), dv = new DataView(buf), u8 = new Uint8Array(buf);
  u8.set(new TextEncoder().encode('SCMESH01'), 0);
  dv.setUint32(8, pos.length, true); dv.setUint32(12, 0, true); dv.setUint32(16, tri.length, true); dv.setUint32(20, 0, true);
  let o = 24; pos.forEach(v => { dv.setFloat64(o, v, true); o += 8; }); tri.forEach(v => { dv.setUint32(o, v, true); o += 4; });
  return u8;
}
function exportarSolidcraft(opc) {
  const ps = piezasCerradas(opc);
  const base = nombreArchivo(P.nombre) + sufijo3D(opc), nombre = P.nombre || 'Made-rebanadas', nT = ps.reduce((a, p) => a + p.tri.length / 3, 0);
  if (opc.formato === 'scjson') {
    descargar(base + '.json', JSON.stringify(documentoSolidcraft(ps, nombre, base + '.json')), 'application/json');
  } else {
    const enc = new TextEncoder(), blobs = [], datos = new Map();
    ps.forEach(p => { const b = blobSCMESH(p.pos, p.tri), ruta = 'blobs/' + sha256(b) + '.mesh'; blobs.push(ruta); datos.set(ruta, b); });
    const doc = documentoSolidcraft(ps, nombre, base + '.sc', blobs);
    descargar(base + '.sc', zipSinComprimir([
      { nombre: 'container.json', datos: enc.encode(JSON.stringify({ format: 'solidcraft-container/1' })) },
      { nombre: 'document.json', datos: enc.encode(JSON.stringify(doc)) },
      ...[...datos.entries()].map(([nombre, d]) => ({ nombre, datos: d })),
    ]));
  }
  return { piezas: ps.length, triangulos: nT };
}
function dialogo3D() {
  const esc0 = enMaqueta() ? P.maqueta.escala : 1, opc0 = (() => { try { return JSON.parse(lsGet('made-rebanadas.exp3d', '{}')); } catch (e) { return {}; } })();
  modal('🧊 Guardar el modelo 3D', `
    <p class="nota">Guarda el mueble montado (sin explosión), en milímetros, para abrirlo en otro programa (SketchUp, Fusion, Blender, FreeCAD…) o imprimir una maqueta en 3D.</p>
    <label class="fila">Formato <select id="x3Formato"><option value="stl">STL</option><option value="obj">OBJ + MTL</option><option value="sc">SolidCraft (.sc)</option><option value="scjson">SolidCraft (JSON plano)</option></select></label>
    <label class="fila" title="La mayoría de programas de CAD e impresión 3D usan Z hacia arriba">Eje vertical <select id="x3Eje"><option value="z">Z arriba</option><option value="y">Y arriba</option></select></label>
    <label class="fila" title="1 = tamaño real. Para imprimir una maqueta: 10, 20…">Escala 1: <input type="number" id="x3Escala" min="1" step="1" value="${opc0.escala || esc0}"></label>
    <label class="fila chk"><input type="checkbox" id="x3Herrajes" ${opc0.herrajes === false ? '' : 'checked'}> Incluir varillas, tubos y rastreles</label>
    <ul class="nota" style="margin:4px 0 0 18px;padding:0"><li><b>STL</b>: una sola malla; para imprimir en 3D o ver la forma.</li><li><b>OBJ + MTL</b>: cada pieza aparte con su nombre (Lama 1, Larguero A…) y el color de su material.</li><li><b>SolidCraft</b>: el diseño listo para abrir, con cada pieza como un cuerpo con su nombre y color. El <b>.sc</b> es su archivo de siempre (más pequeño y rápido); el <b>JSON plano</b> es texto, se puede leer y comparar.</li><li><b>Z arriba</b> para CAD e impresión 3D; <b>Y arriba</b> para Blender o three.js.</li></ul>
    <p class="nota" id="x3Info"></p>`,
    [['💾 Guardar', () => {
      const opc = { formato: $('#x3Formato').value, zArriba: $('#x3Eje').value === 'z', escala: Math.max(1, +$('#x3Escala').value || 1), herrajes: $('#x3Herrajes').checked };
      lsSet('made-rebanadas.exp3d', JSON.stringify(opc));
      try {
        const r = opc.formato === 'obj' ? exportarOBJ(opc) : opc.formato === 'sc' || opc.formato === 'scjson' ? exportarSolidcraft(opc) : exportarSTL(opc);
        cerrarModal(); aviso(`Modelo 3D guardado: ${r.piezas} piezas, ${r.triangulos.toLocaleString('es-ES')} triángulos${opc.formato === 'obj' ? ' (.obj y .mtl)' : ''}`, 4000);
      } catch (e) { aviso('⚠ ' + esc(e.message), 5000); }
    }, true]]);
  if (opc0.formato) $('#x3Formato').value = opc0.formato;
  if (opc0.zArriba === false) $('#x3Eje').value = 'y';
  const info = () => { const k = Math.max(1, +$('#x3Escala').value || 1), d = G.dims || [0, 0, 0]; $('#x3Info').textContent = `Medidas del modelo guardado: ${fmt(d[0] / k)} × ${fmt(d[1] / k)} × ${fmt(d[2] / k)} mm (largo × fondo × alto).`; };
  $('#x3Escala').oninput = info; info();
}
