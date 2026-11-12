
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
    else if (ud.z || ud.disco) { nombre = nomOtra(ud.i); color = hexTablero(); grupo = 'tablero'; }
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
function exportarSTL(opc) {
  const ps = piezasMalla3D(opc), nT = ps.reduce((a, o) => a + o.F.length, 0);
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
  const ps = piezasMalla3D(opc), base = nombreArchivo(P.nombre) + sufijo3D(opc), f6 = x => +x.toFixed(3);
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
function dialogo3D() {
  const esc0 = enMaqueta() ? P.maqueta.escala : 1, opc0 = (() => { try { return JSON.parse(lsGet('made-rebanadas.exp3d', '{}')); } catch (e) { return {}; } })();
  modal('🧊 Guardar el modelo 3D', `
    <p class="nota">Guarda el mueble montado (sin explosión), en milímetros, para abrirlo en otro programa (SketchUp, Fusion, Blender, FreeCAD…) o imprimir una maqueta en 3D.</p>
    <label class="fila">Formato <select id="x3Formato"><option value="stl">STL</option><option value="obj">OBJ + MTL</option></select></label>
    <label class="fila" title="La mayoría de programas de CAD e impresión 3D usan Z hacia arriba">Eje vertical <select id="x3Eje"><option value="z">Z arriba</option><option value="y">Y arriba</option></select></label>
    <label class="fila" title="1 = tamaño real. Para imprimir una maqueta: 10, 20…">Escala 1: <input type="number" id="x3Escala" min="1" step="1" value="${opc0.escala || esc0}"></label>
    <label class="fila chk"><input type="checkbox" id="x3Herrajes" ${opc0.herrajes === false ? '' : 'checked'}> Incluir varillas, tubos y rastreles</label>
    <ul class="nota" style="margin:4px 0 0 18px;padding:0"><li><b>STL</b>: una sola malla; para imprimir en 3D o ver la forma.</li><li><b>OBJ + MTL</b>: cada pieza aparte con su nombre (Lama 1, Larguero A…) y el color de su material.</li><li><b>Z arriba</b> para CAD e impresión 3D; <b>Y arriba</b> para Blender o three.js.</li></ul>
    <p class="nota" id="x3Info"></p>`,
    [['💾 Guardar', () => {
      const opc = { formato: $('#x3Formato').value, zArriba: $('#x3Eje').value === 'z', escala: Math.max(1, +$('#x3Escala').value || 1), herrajes: $('#x3Herrajes').checked };
      lsSet('made-rebanadas.exp3d', JSON.stringify(opc));
      try {
        const r = opc.formato === 'obj' ? exportarOBJ(opc) : exportarSTL(opc);
        cerrarModal(); aviso(`Modelo 3D guardado: ${r.piezas} piezas, ${r.triangulos.toLocaleString('es-ES')} triángulos${opc.formato === 'obj' ? ' (.obj y .mtl)' : ''}`, 4000);
      } catch (e) { aviso('⚠ ' + esc(e.message), 5000); }
    }, true]]);
  if (opc0.formato) $('#x3Formato').value = opc0.formato;
  if (opc0.zArriba === false) $('#x3Eje').value = 'y';
  const info = () => { const k = Math.max(1, +$('#x3Escala').value || 1), d = G.dims || [0, 0, 0]; $('#x3Info').textContent = `Medidas del modelo guardado: ${fmt(d[0] / k)} × ${fmt(d[1] / k)} × ${fmt(d[2] / k)} mm (largo × fondo × alto).`; };
  $('#x3Escala').oninput = info; info();
}
