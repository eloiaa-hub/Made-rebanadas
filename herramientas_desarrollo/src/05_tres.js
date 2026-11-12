
/* ===================== VISTA 3D ===================== */
const G = { renderer: null, scene: null, cam: null, ctl: null, modelo: null, fantasma: null, costillas: [], largueros: [], varillas: [], separadores: [], tuercas: [], suelo: null, rejilla: null, luz: null, pend: false, cacheTex: {}, cacheMat: {} };

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
  const hemi = new T.HemisphereLight(0xffffff, 0xd8cfc0, 0.6); s.add(hemi);
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

// desplazamiento por la vista explosionada
function xExpl(x) { const k = P.tipo === 'reticula' ? 0 : (P.vista.explosion || 0) * 1.4; return x + (x - P.largo / 2) * k; }

function construir3D() {
  if (!G.scene || !R) return;
  limpiar(G.modelo); G.modelo.clear();
  G.costillas = []; G.largueros = []; G.varillas = []; G.separadores = []; G.tuercas = [];
  const e = grosor(), mats = materialesTablero(), rh = radioAgujero(), V = P.varillas;
  // centro del mueble en el fondo (u)
  let u0 = Infinity, u1 = -Infinity, alto = 0;
  R.costillas.forEach(c => { if (c.ok) { u0 = Math.min(u0, c.caja.x0); u1 = Math.max(u1, c.caja.x1); alto = Math.max(alto, c.caja.y1); } });
  if (!isFinite(u0)) { u0 = 0; u1 = 1; }
  G.uc = (u0 + u1) / 2; G.fondo = u1 - u0; G.alto = alto;
  G.modelo.position.set(-P.largo / 2, 0, G.uc);
  // costillas
  R.costillas.forEach(c => {
    if (!c.ok) { G.costillas.push(null); return; }
    const sh = new T.Shape(c.poly.map(p => new T.Vector2(p[0], p[1])));
    c.agujeros.forEach(k => { const h = new T.Path(); h.absarc(V.lista[k][0], V.lista[k][1], rh, 0, PI2, true); sh.holes.push(h); });
    const geo = new T.ExtrudeGeometry(sh, { depth: e, bevelEnabled: false, curveSegments: 24 });
    const m = new T.Mesh(geo, mats);
    m.rotation.y = Math.PI / 2; m.castShadow = m.receiveShadow = true;
    m.userData = { i: c.i, x: c.x };
    G.modelo.add(m); G.costillas.push(m);
  });
  // retícula: largueros en el plano (x, v), con su grosor hacia el fondo
  (R.largueros || []).forEach(z => {
    if (!z.ok) return;
    const geo = new T.ExtrudeGeometry(new T.Shape(z.poly.map(p => new T.Vector2(p[0], p[1]))), { depth: e, bevelEnabled: false, curveSegments: 24 });
    const m = new T.Mesh(geo, mats); m.castShadow = m.receiveShadow = true;
    m.userData = { i: z.i, u: z.u, z: true };
    G.modelo.add(m); G.largueros.push(m);
  });
  // varillas, separadores y tuercas
  const tv = VARILLA_TIPOS[V.tipo] || VARILLA_TIPOS.roscada;
  const mVar = new T.MeshStandardMaterial({ color: tv.hex, metalness: tv.metal ? .85 : 0, roughness: tv.metal ? .35 : .7 });
  const mMal = new T.MeshStandardMaterial({ color: '#d0453a', roughness: .5 });
  const mSep = new T.MeshStandardMaterial({ color: tv.metal ? '#9ea3a8' : '#c9a36d', metalness: tv.metal ? .8 : 0, roughness: .4 });
  const mTu = new T.MeshStandardMaterial({ color: '#8d9399', metalness: .9, roughness: .3 });
  [mVar, mMal, mSep, mTu].forEach(m => m.userData.propio = true);
  R.varillas.forEach(rv => {
    if (!rv.usada) return;
    const xa = R.costillas[rv.a].x - e / 2 - V.sobra, xb = R.costillas[rv.b].x + e / 2 + V.sobra;
    const geo = new T.CylinderGeometry(V.diam / 2, V.diam / 2, xb - xa, 20);
    const m = new T.Mesh(geo, rv.fallan.length ? mMal : mVar); m.userData.propio = false;
    m.rotation.z = Math.PI / 2; m.castShadow = true;
    m.userData = { xa, xb, v: rv.v, u: rv.u };
    G.modelo.add(m); G.varillas.push(m);
    if (V.tipo !== 'madera') for (const [x, lado] of [[R.costillas[rv.a].x - e / 2, -1], [R.costillas[rv.b].x + e / 2, 1]]) {
      const t = new T.Mesh(new T.CylinderGeometry(V.diam * 0.95, V.diam * 0.95, V.diam * 0.8, 6), mTu);
      t.rotation.z = Math.PI / 2; t.castShadow = true; t.userData = { x: x + lado * (V.diam * 0.4 + 1.5), v: rv.v, u: rv.u, lado };
      G.modelo.add(t); G.tuercas.push(t);
    }
    if (V.separadores && R.hueco > 0.5) for (let i = rv.a; i < rv.b; i++) {
      if (!rv.cabe[i] || !rv.cabe[i + 1]) continue;
      const s = new T.Mesh(new T.CylinderGeometry(V.sepD / 2, V.sepD / 2, R.hueco, 20), mSep);
      s.rotation.z = Math.PI / 2; s.castShadow = true; s.userData = { x: (R.costillas[i].x + R.costillas[i + 1].x) / 2, v: rv.v, u: rv.u };
      G.modelo.add(s); G.separadores.push(s);
    }
  });
  colocarExplosion();
  construirFantasma();
  resaltar3D();
  // luz y suelo a la medida
  const tam = Math.max(P.largo, G.fondo, G.alto);
  G.suelo.scale.set(tam * 4, tam * 4, 1);
  const L = G.luz; L.position.set(-tam * 0.9, tam * 1.6, tam * 1.1); L.target.position.set(0, G.alto / 3, 0);
  const sc = L.shadow.camera; sc.left = sc.bottom = -tam * 0.95; sc.right = sc.top = tam * 0.95; sc.near = 10; sc.far = tam * 5; sc.updateProjectionMatrix();
  pedirRender();
}
function colocarExplosion() {
  const e = grosor(), k = (P.vista.explosion || 0) * 1.4;
  G.costillas.forEach(m => { if (m) m.position.set(P.tipo === 'reticula' ? m.userData.x - e / 2 : xExpl(m.userData.x) - e / 2, 0, 0); });
  // en la retícula, la explosión levanta los largueros (así se ve cómo encajan)
  G.largueros.forEach(m => m.position.set(0, (P.vista.explosion || 0) * (G.alto || 400) * 1.1, -(m.userData.u + e / 2)));
  G.varillas.forEach(m => {
    const d = m.userData, xa = xExpl(d.xa + P.varillas.sobra) - P.varillas.sobra, xb = xExpl(d.xb - P.varillas.sobra) + P.varillas.sobra;
    m.scale.y = (xb - xa) / (d.xb - d.xa); m.position.set((xa + xb) / 2, d.v, -d.u);
  });
  G.tuercas.forEach(m => { const d = m.userData; m.position.set(xExpl(d.x - d.lado * (P.varillas.diam * 0.4 + 1.5)) + d.lado * (P.varillas.diam * 0.4 + 1.5), d.v, -d.u); });
  G.separadores.forEach(m => { const d = m.userData; m.position.set(xExpl(d.x), d.v, -d.u); });
  const ver = P.vista.varillas;
  [...G.varillas, ...G.tuercas, ...G.separadores].forEach(m => m.visible = ver);
  pedirRender();
}
function construirFantasma() {
  if (G.fantasma) { G.modelo.remove(G.fantasma); G.fantasma.geometry.dispose(); G.fantasma.material.dispose(); G.fantasma = null; }
  if (!P.vista.fantasma) return;
  const N = 64, anillos = [];
  for (let i = 0; i <= N; i++) {
    const x = P.largo * i / N; let c = curvaCerrada(perfilEn(x), P.esquinas);
    c = c.map(p => [p[0], clamp(p[1], P.costillas.base ? 0 : -1e9, P.costillas.tope ? P.costillas.topeAlt : 1e9)]);
    anillos.push({ x, c });
  }
  const M = anillos[0].c.length, pos = [], idx = [];
  anillos.forEach(a => a.c.forEach(p => pos.push(xExpl(a.x), p[1], -p[0])));
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
  // distancia para que quepa la esfera que envuelve el mueble, con el campo de visión más estrecho
  const ex = P.vista.explosion || 0, ret = P.tipo === 'reticula';
  const L = P.largo * (ret ? 1 : 1 + 1.4 * ex), F = G.fondo || 500, H = (G.alto || 500) * (ret ? 1 + 1.1 * ex : 1), y = H * 0.45;
  const radio = 0.5 * Math.sqrt(L * L + F * F + H * H);
  const fv = G.cam.fov * Math.PI / 180, fh = 2 * Math.atan(Math.tan(fv / 2) * G.cam.aspect);
  const d = radio / Math.sin(Math.min(fv, fh) / 2) * 1.04;
  const dir = { tres4: [-0.55, 0.42, 0.72], frente: [0, 0.18, 1], lado: [-1, 0.18, 0.0001], arriba: [0, 1, 0.0001] }[tipo === 'encuadrar' ? 'tres4' : tipo];
  const n = Math.hypot(...dir);
  G.cam.position.set(dir[0] / n * d, y + dir[1] / n * d, dir[2] / n * d); G.ctl.target.set(0, y, 0); G.ctl.update(); pedirRender();
}
function imagenPNG() {
  const r = G.renderer, pr = r.getPixelRatio();
  r.setPixelRatio(Math.max(3, pr)); ajustar3D(); r.render(G.scene, G.cam);
  r.domElement.toBlob(b => { descargar(nombreArchivo(P.nombre) + '.png', b); r.setPixelRatio(pr); ajustar3D(); aviso('Imagen guardada'); }, 'image/png');
}
