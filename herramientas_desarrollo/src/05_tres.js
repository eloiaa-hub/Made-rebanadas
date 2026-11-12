
/* ===================== VISTA 3D ===================== */
const G = { renderer: null, scene: null, cam: null, ctl: null, modelo: null, fantasma: null, costillas: [], largueros: [], claves3d: [], varillas: [], separadores: [], tuercas: [], suelo: null, rejilla: null, luz: null, pend: false, cacheTex: {}, cacheMat: {} };

function textura(clave, mm) {
  const ck = clave + ':' + mm; if (G.cacheTex[ck]) return G.cacheTex[ck];
  const tx = new T.TextureLoader().load(window.TEXTURAS[clave], () => pedirRender());
  tx.colorSpace = T.SRGBColorSpace; tx.wrapS = tx.wrapT = T.RepeatWrapping;
  tx.repeat.set(1 / mm, 1 / mm); tx.anisotropy = 8;
  return G.cacheTex[ck] = tx;
}
function materialesTablero() {
  const id = P.costillas.material, m = MATERIALES[id] || MATERIALES.abedul;
  const ck = id + (m.color ? P.costillas.color : ''); if (G.cacheMat[ck]) return G.cacheMat[ck];
  let cara, canto;
  if (m.color) {
    cara = new T.MeshStandardMaterial({ color: P.costillas.color, roughness: .5 });
    canto = cara;
  } else {
    const mmCara = m.mm || 800, mmCanto = m.canto === 'alma_contrachapado' ? 48 : (m.mm || 800);
    cara = new T.MeshStandardMaterial({ map: textura(m.cara, mmCara), roughness: .62 });
    canto = new T.MeshStandardMaterial({ map: textura(m.canto, mmCanto), roughness: .8 });
  }
  return G.cacheMat[ck] = [cara, canto];
}
function materialSel(base) {
  return base.map(m => { const c = m.clone(); c.userData = { propio: true }; c.emissive = new T.Color('#2f7fe0'); c.emissiveIntensity = .35; return c; });
}

function iniciar3D() {
  const cv = $('#c3d');
  const r = G.renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  r.shadowMap.enabled = true; r.shadowMap.type = T.PCFSoftShadowMap;
  r.toneMapping = T.ACESFilmicToneMapping; r.toneMappingExposure = 1.0; r.outputColorSpace = T.SRGBColorSpace;
  const s = G.scene = new T.Scene();
  const pm = new T.PMREMGenerator(r);
  s.environment = pm.fromScene(new T.RoomEnvironment(), 0.04).texture;
  s.environmentIntensity = 0.55;
  G.cam = new T.PerspectiveCamera(35, 1, 5, 60000);
  G.cam.position.set(1800, 1300, 2200);
  G.ctl = new T.OrbitControls(G.cam, cv);
  G.ctl.enableDamping = false; G.ctl.screenSpacePanning = true;
  G.ctl.addEventListener('change', pedirRender);
  const hemi = G.hemi = new T.HemisphereLight(0xffffff, 0xd8cfc0, 0.6); s.add(hemi);
  const luz = G.luz = new T.DirectionalLight(0xffffff, 2.0);
  luz.castShadow = true; luz.shadow.mapSize.set(2048, 2048); luz.shadow.bias = -0.0004; luz.shadow.normalBias = 1.2; luz.shadow.radius = 4;
  s.add(luz); s.add(luz.target);
  G.suelo = new T.Mesh(new T.PlaneGeometry(1, 1), new T.ShadowMaterial({ opacity: .22 }));
  G.suelo.rotation.x = -Math.PI / 2; G.suelo.receiveShadow = true; s.add(G.suelo);
  G.modelo = new T.Group(); s.add(G.modelo);
  new ResizeObserver(() => ajustar3D()).observe(cv.parentElement);
  // selección con clic
  let abajo = null;
  cv.addEventListener('pointerdown', ev => { abajo = [ev.clientX, ev.clientY]; });
  cv.addEventListener('pointerup', ev => {
    if (!abajo || Math.hypot(ev.clientX - abajo[0], ev.clientY - abajo[1]) > 4 || ev.button !== 0) return;
    const rc = cv.getBoundingClientRect(), ray = new T.Raycaster();
    ray.setFromCamera(new T.Vector2((ev.clientX - rc.left) / rc.width * 2 - 1, -(ev.clientY - rc.top) / rc.height * 2 + 1), G.cam);
    ray.params.Line.threshold = Math.max(4, Math.max(...(G.dims || [500])) * 0.006);
    const hk = (G.claves3d || []).length ? ray.intersectObjects(G.claves3d, false)[0] : null;
    if (hk) { UI.clave = hk.object.userData.clave; UI.punto = -1; refrescarClaves(); VP.pintar(); construirClaves3D(); $('#estado').textContent = 'Perfil clave ' + (UI.clave + 1); return; }
    const hit = ray.intersectObjects([...G.costillas, ...G.largueros].filter(Boolean), false)[0];
    if (hit) selCostilla(hit.object.userData.i);
  });
  $$('[data-cam]').forEach(b => b.onclick = () => camara(b.dataset.cam));
  colores3D();
}
function colores3D() {
  if (!G.scene) return;
  const oscuro = document.documentElement.dataset.theme === 'dark';
  G.scene.background = new T.Color(oscuro ? '#1b2027' : '#eeece8');
  if (G.rejilla) { G.scene.remove(G.rejilla); G.rejilla.geometry.dispose(); G.rejilla = null; }
  const tam = Math.ceil(Math.max(P ? P.largo : 2000, 1500) * 2.4 / 1000) * 1000;
  G.rejilla = new T.GridHelper(tam, tam / 100, oscuro ? 0x3a434e : 0xcfcac2, oscuro ? 0x2a3139 : 0xe0dcd5);
  G.rejilla.position.y = -0.5; G.scene.add(G.rejilla);
  pedirRender();
}
function ajustar3D() {
  const cv = $('#c3d'), r = cv.parentElement.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return;
  G.renderer.setSize(r.width, r.height, false);
  G.cam.aspect = r.width / r.height; G.cam.updateProjectionMatrix(); pedirRender();
}
function pedirRender() {
  if (G.pend) return; G.pend = true;
  requestAnimationFrame(() => { G.pend = false; G.renderer.render(G.scene, G.cam); });
}
function limpiar(obj) {
  const vistos = new Set();
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    [].concat(o.material || [], (o.userData && o.userData.matSel) || []).forEach(m => { if (m.userData.propio && !vistos.has(m)) { vistos.add(m); m.dispose(); } });
  });
}

// desplazamiento por la vista explosionada (en recta, curva y pared, a lo largo; en radial, hacia fuera)
function xExpl(x) { const k = P.tipo === 'reticula' || P.tipo === 'radial' ? 0 : (P.vista.explosion || 0) * 1.4; return x + (x - P.largo / 2) * k; }
function marcoExpl(x) {
  const m = marcoEn(xExpl(x));
  if (P.tipo === 'radial') { const d = (P.vista.explosion || 0) * (G.rmax || 200) * 0.8; m.O = [m.O[0] + m.Au[0] * d, 0, m.O[2] + m.Au[2] * d]; }
  return m;
}
// coloca una malla extruida (forma en u, v; grosor centrado) con el marco m
function ponerEnMarco(obj, m, dy = 0) {
  const ae = ejeGrosor(m), M4 = new T.Matrix4();
  M4.makeBasis(new T.Vector3(...m.Au), new T.Vector3(...ejeV(m)), new T.Vector3(...ae)).setPosition(m.O[0], m.O[1] + dy, m.O[2]);
  obj.matrixAutoUpdate = false; obj.matrix.copy(M4); obj.matrixWorldNeedsUpdate = true;
}
const V3 = a => new T.Vector3(a[0], a[1], a[2]);
// cilindro de a a b (puntos 3D) con radio r
function cilindroEntre(a, b, r, mat, lados = 18) {
  const va = V3(a), vb = V3(b), d = vb.clone().sub(va), L = d.length();
  const m = new T.Mesh(new T.CylinderGeometry(r, r, Math.max(0.1, L), lados), mat);
  m.position.copy(va.clone().add(vb).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); m.castShadow = true;
  return m;
}
function extruir(poly, huecos, e) {
  const sh = new T.Shape(poly.map(p => new T.Vector2(p[0], p[1])));
  (huecos || []).forEach(h => { const pa = new T.Path(); pa.absarc(h.x, h.y, h.r, 0, PI2, true); sh.holes.push(pa); });
  const g = new T.ExtrudeGeometry(sh, { depth: e, bevelEnabled: false, curveSegments: 24 });
  g.translate(0, 0, -e / 2); return g;
}

function construir3D() {
  if (!G.scene || !R) return;
  limpiar(G.modelo); G.modelo.clear(); G.modelo.position.set(0, 0, 0);
  G.costillas = []; G.largueros = []; G.varillas = []; G.claves3d = [];
  const e = grosor(), mats = materialesTablero(), rh = radioAgujero(), V = P.varillas;
  // medidas del mueble montado
  const bb = new T.Box3(), cs = R.costillas.filter(c => c.ok);
  cs.forEach(c => { const m = marcoEn(c.x); for (let k = 0; k < c.poly.length; k += 3) bb.expandByPoint(V3(puntoMarco(m, c.poly[k][0], c.poly[k][1]))); });
  if (bb.isEmpty()) bb.set(new T.Vector3(-1, 0, -1), new T.Vector3(1, 1, 1));
  const sz = bb.getSize(new T.Vector3());
  G.dims = [sz.x, sz.z, sz.y]; G.alto = sz.y; G.fondo = sz.z; G.rmax = Math.max(sz.x, sz.z) / 2;
  // costillas
  R.costillas.forEach(c => {
    if (!c.ok) { G.costillas.push(null); return; }
    const hs = c.agujeros.map(k => ({ x: V.lista[k][0], y: V.lista[k][1], r: rh }));
    const m = new T.Mesh(extruir(c.poly, hs, e), mats); m.castShadow = m.receiveShadow = true;
    m.userData = { i: c.i, x: c.x };
    G.modelo.add(m); G.costillas.push(m);
  });
  // retícula: largueros en el plano (x, v)
  R.largueros.forEach(z => {
    if (!z.ok) return;
    const m = new T.Mesh(extruir(z.poly, [], e), mats); m.castShadow = m.receiveShadow = true;
    m.userData = { i: z.i, u: z.u, z: true };
    G.modelo.add(m); G.largueros.push(m);
  });
  // radial: discos (horizontales) y tubo central
  R.discos.forEach(d => {
    const g = extruir(d.poly, d.huecos, e); g.rotateX(-Math.PI / 2);
    const m = new T.Mesh(g, mats); m.castShadow = m.receiveShadow = true; m.userData = { i: d.i, disco: true, v: d.v };
    G.modelo.add(m); G.largueros.push(m);
  });
  const mMet = new T.MeshStandardMaterial({ color: '#b8bcc0', metalness: .85, roughness: .35 }); mMet.userData.propio = true;
  if (P.tipo === 'radial' && R.tuboV) {
    const t = cilindroEntre([0, R.tuboV[0] - 20, 0], [0, R.tuboV[1] + 20, 0], P.radial.tubo / 2, mMet, 28);
    t.userData.extra = 'tubo'; G.modelo.add(t); G.varillas.push(t);
  }
  // pared: rastreles y la pared
  if (P.tipo === 'pared') {
    const mR = new T.MeshStandardMaterial({ color: '#cdb38a', roughness: .8 }); mR.userData.propio = true;
    const x0 = R.costillas[0].x - e / 2 - 30, x1 = R.costillas[R.n - 1].x + e / 2 + 30, Pa = P.pared;
    R.rastreles.forEach(r => {
      // de la primera a la última lama, 30 mm más por cada lado, a la altura del rastrel
      const m0 = marcoEn(R.costillas[0].x), m1 = marcoEn(R.costillas[R.n - 1].x), ae = ejeGrosor(m0), av = ejeV(m0);
      const a = puntoMarco(m0, Pa.grueso / 2, r.v), b = puntoMarco(m1, Pa.grueso / 2, r.v);
      const d = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length() + e + 60;
      const caja = new T.Mesh(new T.BoxGeometry(L, Pa.alto, Pa.grueso), mR);
      const ex = new T.Vector3(...ae), ey = new T.Vector3(...av), ez = ex.clone().cross(ey);
      caja.matrixAutoUpdate = false; caja.matrix.makeBasis(ex, ey, ez).setPosition((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      caja.castShadow = true; caja.userData.extra = 'rastrel'; G.modelo.add(caja);
    });

    if (Pa.verPared) {
      const mP = new T.MeshStandardMaterial({ color: '#e9e5de', roughness: .95 }); mP.userData.propio = true;
      const w = new T.Mesh(new T.PlaneGeometry(Math.max(P.largo * 1.6, 2000), Math.max(G.alto * 1.5, 1500)), mP);
      w.position.set(0, Math.max(G.alto * 1.5, 1500) / 2 - 1, -0.5); w.receiveShadow = true; w.userData.extra = 'pared'; G.modelo.add(w);
    }
  }
  construirVarillas3D();
  construirClaves3D();
  colocarExplosion();
  construirFantasma();
  resaltar3D();
  // luz y suelo a la medida
  const tam = Math.max(sz.x, sz.y, sz.z, 300);
  G.suelo.scale.set(tam * 5, tam * 5, 1);
  G.tam = tam;
  luces3D();
}
// luz normal (de arriba a un lado) o rasante: muy baja, casi paralela a la superficie, y se puede girar
function luces3D() {
  if (!G.luz) return;
  const L = G.luz, tam = G.tam || 1000, ras = P.vista.rasante, a = (P.vista.rasAng || 0) * Math.PI / 180;
  const c = [0, (G.alto || 400) / 2, 0];
  if (!ras) {
    L.position.set(-tam * 0.9, tam * 1.6, tam * 1.1); L.target.position.set(0, (G.alto || 400) / 3, 0);
    L.intensity = 2.0; G.hemi.intensity = 0.6; G.scene.environmentIntensity = 0.55;
  } else {
    const d = tam * 2.2;
    // en la pared, la luz va pegada a la pared (gira en su plano); en los muebles, a ras del suelo alrededor
    if (P.tipo === 'pared') L.position.set(c[0] + d * Math.cos(a), c[1] + d * Math.sin(a), d * 0.22);
    else L.position.set(c[0] + d * Math.cos(a), c[1] + d * 0.18, c[2] + d * Math.sin(a));
    L.target.position.set(c[0], c[1], c[2]);
    L.intensity = 3.2; G.hemi.intensity = P.tipo === 'pared' ? 0.12 : 0.28; G.scene.environmentIntensity = P.tipo === 'pared' ? 0.12 : 0.22;
  }
  const sc = L.shadow.camera, r = tam * (ras ? 1.6 : 1.2); sc.left = sc.bottom = -r; sc.right = sc.top = r; sc.near = 10; sc.far = tam * 7; sc.updateProjectionMatrix();
  pedirRender();
}
// varillas, separadores y tuercas (siguen la planta, recta o curva)
function construirVarillas3D() {
  G.varillas.filter(m => !m.userData.extra).forEach(m => { G.modelo.remove(m); m.geometry.dispose(); });
  G.varillas = G.varillas.filter(m => m.userData.extra);
  if (P.tipo !== 'costillas') return;
  const e = grosor(), V = P.varillas, tv = VARILLA_TIPOS[V.tipo] || VARILLA_TIPOS.roscada;
  if (!G.matVar) {
    G.matVar = new T.MeshStandardMaterial({ color: tv.hex, metalness: tv.metal ? .85 : 0, roughness: tv.metal ? .35 : .7 });
    G.matMal = new T.MeshStandardMaterial({ color: '#d0453a', roughness: .5 });
    G.matSep = new T.MeshStandardMaterial({ color: tv.metal ? '#9ea3a8' : '#c9a36d', metalness: tv.metal ? .8 : 0, roughness: .4 });
    G.matTu = new T.MeshStandardMaterial({ color: '#8d9399', metalness: .9, roughness: .3 });
  }
  G.matVar.color.set(tv.hex); G.matVar.metalness = tv.metal ? .85 : 0;
  const add = m => { m.userData.var = true; G.modelo.add(m); G.varillas.push(m); };
  R.varillas.forEach(rv => {
    if (!rv.usada) return;
    const pts = [];
    for (let i = rv.a; i <= rv.b; i++) pts.push(puntoMarco(marcoExpl(R.costillas[i].x), rv.u, rv.v));
    const dirIni = ejeGrosor(marcoExpl(R.costillas[rv.a].x)), dirFin = ejeGrosor(marcoExpl(R.costillas[rv.b].x));
    const sg = pts.length > 1 ? Math.sign((pts[1][0] - pts[0][0]) * dirIni[0] + (pts[1][2] - pts[0][2]) * dirIni[2]) || 1 : 1;
    const ext = e / 2 + V.sobra, ini = pts[0].map((v, k) => v - sg * dirIni[k] * ext), fin = pts[pts.length - 1].map((v, k) => v + sg * dirFin[k] * ext);
    const mat = rv.fallan.length ? G.matMal : G.matVar;
    if (disposicion() === 'curva' && pts.length > 2) {
      const curva = new T.CatmullRomCurve3([ini, ...pts, fin].map(V3));
      const m = new T.Mesh(new T.TubeGeometry(curva, pts.length * 6, V.diam / 2, 12), mat); m.castShadow = true; add(m);
    } else add(cilindroEntre(ini, fin, V.diam / 2, mat, 20));
    if (V.tipo !== 'madera') {
      const tu = (p, d) => add(cilindroEntre(p.map((v, k) => v - d[k] * (V.diam * 0.4)), p.map((v, k) => v + d[k] * (V.diam * 0.4)), V.diam * 0.95, G.matTu, 6));
      tu(pts[0].map((v, k) => v - sg * dirIni[k] * (e / 2 + V.diam * 0.45)), dirIni);
      tu(pts[pts.length - 1].map((v, k) => v + sg * dirFin[k] * (e / 2 + V.diam * 0.45)), dirFin);
    }
    if (V.separadores && R.hueco > 0.5) for (let i = 0; i + 1 < pts.length; i++) {
      if (!rv.cabe[rv.a + i] || !rv.cabe[rv.a + i + 1]) continue;
      const a = V3(pts[i]), b = V3(pts[i + 1]), d = b.clone().sub(a), L = d.length(); if (L <= e + 0.5) continue;
      d.normalize();
      add(cilindroEntre(a.clone().addScaledVector(d, e / 2).toArray(), b.clone().addScaledVector(d, -e / 2).toArray(), V.sepD / 2, G.matSep, 20));
    }
  });
  G.varillas.forEach(m => m.visible = P.vista.varillas || !!m.userData.extra);
}
// perfiles clave en el 3D: líneas que se pueden pinchar para editarlas
function construirClaves3D() {
  (G.claves3d || []).forEach(l => { G.modelo.remove(l); l.geometry.dispose(); l.material.dispose(); });
  G.claves3d = [];
  if (!P.vista.claves || formaCalculada()) return;
  const C = clavesOrdenadas(), acento = cssVar('--acento') || '#1f6fd1';
  C.forEach((k, i) => {
    if (P.tipo === 'radial' && k.x >= 359.999 && C.length > 1) return;     // la de 360° es la misma que la de 0°
    const poly = contornoDe(k.pts); if (poly.length < 3) return;
    const m = marcoExpl(k.x), sel = i === UI.clave, ae = ejeGrosor(m), off = grosor() / 2 + 0.6;
    const pts = [];
    for (const lado of sel ? [-1, 1] : [1]) poly.concat([poly[0]]).forEach(p => { const q = puntoMarco(m, p[0], p[1]); pts.push(new T.Vector3(q[0] + ae[0] * off * lado, q[1], q[2] + ae[2] * off * lado)); });
    const g = new T.BufferGeometry().setFromPoints(pts);
    const l = new T.Line(g, new T.LineBasicMaterial({ color: sel ? '#ff7a1a' : acento, transparent: true, opacity: sel ? 1 : (P.tipo === 'radial' ? .22 : .45), depthTest: false }));
    l.renderOrder = 10; l.userData = { clave: i };
    G.modelo.add(l); G.claves3d.push(l);
  });
  pedirRender();
}
function colocarExplosion() {
  const e = grosor(), ex = P.vista.explosion || 0;
  G.costillas.forEach(m => { if (m) ponerEnMarco(m, marcoExpl(m.userData.x)); });
  G.largueros.forEach(m => {
    if (m.userData.disco) { m.position.set(0, m.userData.v, 0); return; }
    // en la retícula, la explosión levanta los largueros (así se ve cómo encajan)
    m.position.set(-P.largo / 2, ex * (G.alto || 400) * 1.1, -(m.userData.u - (R.uc || 0)));
  });
  construirVarillas3D();
  construirClaves3D();
  pedirRender();
}
function construirFantasma() {
  if (figuraActiva()) { if (G.fantasma) { G.modelo.remove(G.fantasma); G.fantasma.geometry.dispose(); G.fantasma = null; } return; }
  if (G.fantasma) { G.modelo.remove(G.fantasma); G.fantasma.geometry.dispose(); G.fantasma.material.dispose(); G.fantasma = null; }
  if (!P.vista.fantasma) return;
  const N = P.tipo === 'radial' ? 72 : 64, anillos = [], X = P.tipo === 'radial' ? 360 : P.largo;
  for (let i = 0; i <= N; i++) {
    const x = X * i / N; let c = relieveActivo() ? poligonoRelieve(x, true) : curvaCerrada(perfilEn(x), P.esquinas);
    c = c.map(p => [P.tipo === 'radial' ? Math.max(p[0], radioTubo()) : p[0], clamp(p[1], P.costillas.base ? 0 : -1e9, P.costillas.tope ? P.costillas.topeAlt : 1e9)]);
    anillos.push({ m: marcoExpl(x), c });
  }
  const M = anillos[0].c.length, pos = [], idx = [];
  anillos.forEach(a => a.c.forEach(p => pos.push(...puntoMarco(a.m, p[0], p[1]))));
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const a = i * M + j, b = i * M + (j + 1) % M, c = (i + 1) * M + j, d = (i + 1) * M + (j + 1) % M;
    idx.push(a, c, b, b, c, d);
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  G.fantasma = new T.Mesh(g, new T.MeshStandardMaterial({ color: '#4c95ee', transparent: true, opacity: .16, side: T.DoubleSide, depthWrite: false, roughness: .4 }));
  G.modelo.add(G.fantasma);
}
function resaltar3D() {
  const base = materialesTablero();
  [...G.costillas, ...G.largueros].forEach(m => {
    if (!m) return;
    const sel = P.vista.resalta && m.userData.i === UI.costilla;
    if (sel) { if (!m.userData.matSel) m.userData.matSel = materialSel(base); m.material = m.userData.matSel; }
    else m.material = base;
  });
  pedirRender();
}
function camara(tipo) {
  // encuadra la caja de todo lo que se ve (con la explosión incluida)
  const bb = new T.Box3();
  G.modelo.traverse(o => { if (o.isMesh && o.visible && o !== G.fantasma && o.userData.extra !== 'pared') { o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox.clone(); o.updateMatrixWorld(true); b.applyMatrix4(o.matrixWorld); bb.union(b); } });
  if (bb.isEmpty()) bb.set(new T.Vector3(-500, 0, -500), new T.Vector3(500, 500, 500));
  const c = bb.getCenter(new T.Vector3()), radio = bb.getSize(new T.Vector3()).length() / 2;
  const fv = G.cam.fov * Math.PI / 180, fh = 2 * Math.atan(Math.tan(fv / 2) * G.cam.aspect);
  const d = radio / Math.sin(Math.min(fv, fh) / 2) * 1.04;
  const dir = { tres4: [-0.55, 0.42, 0.72], frente: [0, 0.18, 1], lado: [-1, 0.18, 0.0001], arriba: [0, 1, 0.0001] }[tipo === 'encuadrar' ? 'tres4' : tipo];
  const n = Math.hypot(...dir);
  G.cam.position.set(c.x + dir[0] / n * d, c.y + dir[1] / n * d, c.z + dir[2] / n * d); G.ctl.target.copy(c); G.ctl.update(); pedirRender();
}
function imagenPNG() {
  const r = G.renderer, pr = r.getPixelRatio();
  r.setPixelRatio(Math.max(3, pr)); ajustar3D(); r.render(G.scene, G.cam);
  r.domElement.toBlob(b => { descargar(nombreArchivo(P.nombre) + '.png', b); r.setPixelRatio(pr); ajustar3D(); aviso('Imagen guardada'); }, 'image/png');
}
