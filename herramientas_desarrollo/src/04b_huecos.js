
/* ===================== HUECOS: VISTA PARA DIBUJARLOS Y PANEL =====================
   La vista «▦ Huecos» ocupa el sitio del editor de perfil:
   - panel de pared: el frente del panel (lamas, rastreles, huecos y muebles);
   - costillas y retícula: el perfil, con las costillas en claro (los huecos son túneles).
   Arrastrar dentro de un hueco lo mueve; las asas lo estiran; en la forma libre se mueven los vértices
   (doble clic en un lado añade uno, clic derecho en un vértice lo quita). Mayús: sin rejilla. */
let VH = null;
const HU = { arr: null };
const NOMBRE_FORMA = { rect: 'Rectángulo', redondeado: 'Redondeado', arco: 'Arco', circulo: 'Círculo', libre: 'Forma libre' };
const huecoSel = () => (P.huecos || [])[UI.hueco] || null;
const snapH = (v, ev) => ev && ev.shiftKey ? Math.round(v * 10) / 10 : Math.round(v / 10) * 10;

function dibujarHuecos(ctx, V) {
  V.rejilla(ctx);
  if (!R) return;
  const e = grosor(), acento = cssVar('--acento'), fr = P.tipo === 'pared';
  if (fr) {
    const hor = lamasH(), Pa = P.pared;
    // rastreles (detrás)
    ctx.fillStyle = 'rgba(160,120,70,.35)';
    R.rastreles.forEach(r => (r.tramos || []).forEach(([a, b]) => {
      const rc = hor ? [r.v - Pa.alto / 2, a, Pa.alto, b - a] : [a, r.v - Pa.alto / 2, b - a, Pa.alto];
      const [x0, y0] = V.aPantalla(rc[0], rc[1] + rc[3]); ctx.fillRect(x0, y0, rc[2] * V.sc, rc[3] * V.sc);
    }));
    // lamas vistas de frente (cada trozo)
    ctx.fillStyle = colorCostilla(.55); ctx.strokeStyle = colorCostilla(.9); ctx.lineWidth = 1;
    [...R.costillas.filter(c => c.ok), ...(R.trozos || []).filter(t => t.ok)].forEach(q => {
      const rc = hor ? [q.caja.y0, q.x - e / 2, q.caja.y1 - q.caja.y0, e] : [q.x - e / 2, q.caja.y0, e, q.caja.y1 - q.caja.y0];
      const [x0, y0] = V.aPantalla(rc[0], rc[1] + rc[3]); ctx.fillRect(x0, y0, Math.max(1, rc[2] * V.sc), rc[3] * V.sc);
    });
    // muebles de los huecos (su frente)
    (R.modulos || []).forEach(m => {
      const [x0, x1, , , v0, v1] = m.caja3, rc = hor ? [v0, x0, v1 - v0, x1 - x0] : [x0, v0, x1 - x0, v1 - v0];
      const [a, b] = V.aPantalla(rc[0], rc[1] + rc[3]); ctx.fillStyle = 'rgba(120,130,140,.28)'; ctx.fillRect(a, b, rc[2] * V.sc, rc[3] * V.sc);
      ctx.strokeStyle = 'rgba(80,90,100,.7)'; ctx.strokeRect(a, b, rc[2] * V.sc, rc[3] * V.sc);
    });
  } else {
    // perfil: todas las costillas en claro
    ctx.strokeStyle = cssVar('--ejes'); ctx.lineWidth = 1;
    R.costillas.forEach(c => { if (c.ok) { V.camino(ctx, c.poly); ctx.stroke(); } });
    const cs = piezaSel(); if (cs && cs.ok && !cs.z && !cs.modulo) { ctx.fillStyle = conAlfa(acento, .1); ctx.beginPath(); [cs.poly, ...(cs.int || [])].forEach(pol => { pol.forEach((p, i) => { const [x, y] = V.aPantalla(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath(); }); ctx.fill('evenodd'); }
  }
  // los huecos
  (P.huecos || []).forEach((h, k) => {
    const sel = k === UI.hueco, act = h.activo !== false, f = formaHueco(h);
    ctx.save();
    ctx.strokeStyle = act ? (sel ? acento : '#d0453a') : cssVar('--suave'); ctx.lineWidth = sel ? 2.4 : 1.6; if (!act) ctx.setLineDash([5, 4]);
    ctx.fillStyle = act ? (sel ? conAlfa(acento, .12) : 'rgba(208,69,58,.10)') : 'transparent';
    V.camino(ctx, f); ctx.fill(); ctx.stroke(); ctx.restore();
    const cb = cajaDe(f), [lx, ly] = V.aPantalla(cb.x0 + cb.w / 2, cb.y0 + cb.h / 2);
    ctx.fillStyle = act ? (sel ? acento : '#d0453a') : cssVar('--suave'); ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('H' + (k + 1), lx, ly); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    if (sel) {
      // asas
      asasHueco(h).forEach(a => { const [x, y] = V.aPantalla(a.x, a.y); ctx.fillStyle = cssVar('--vista'); ctx.strokeStyle = acento; ctx.lineWidth = 1.6; ctx.beginPath(); a.vert ? ctx.arc(x, y, 5, 0, PI2) : ctx.rect(x - 4.5, y - 4.5, 9, 9); ctx.fill(); ctx.stroke(); });
      V.cota(ctx, [cb.x0, cb.y0], [cb.x0 + cb.w, cb.y0], 18, fmt(cb.w) + ' mm', false);
      V.cota(ctx, [cb.x0 + cb.w, cb.y0], [cb.x0 + cb.w, cb.y0 + cb.h], 20, fmt(cb.h) + ' mm', true);
    }
  });
  ctx.fillStyle = acento; ctx.font = '600 12px system-ui';
  ctx.fillText(fr ? 'Huecos · frente del panel' : 'Huecos · perfil (cada hueco es un túnel de «desde» a «hasta»)', 8, V.h - 26);
}
function asasHueco(h) {
  if (h.forma === 'libre' && h.pts) return h.pts.map((p, i) => ({ x: p[0], y: p[1], vert: true, i }));
  const x0 = h.x, y0 = h.y, x1 = h.x + h.ancho, y1 = h.y + h.alto, xm = (x0 + x1) / 2, ym = (y0 + y1) / 2;
  return [[x0, y0, 'sw'], [xm, y0, 's'], [x1, y0, 'se'], [x1, ym, 'e'], [x1, y1, 'ne'], [xm, y1, 'n'], [x0, y1, 'nw'], [x0, ym, 'w']].map(([x, y, t]) => ({ x, y, t }));
}
function encuadrarHuecos() {
  if (!VH || !R) return;
  let b;
  if (P.tipo === 'pared') { const [W, H] = medidasPanel(); b = { x0: 0, y0: 0, w: W, h: H }; }
  else { const cs = R.costillas.filter(c => c.ok); if (!cs.length) return; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; cs.forEach(c => { x0 = Math.min(x0, c.caja.x0); y0 = Math.min(y0, c.caja.y0); x1 = Math.max(x1, c.caja.x1); y1 = Math.max(y1, c.caja.y1); }); b = { x0, y0, w: x1 - x0, h: y1 - y0 }; }
  (P.huecos || []).forEach(h => { const c = cajaHueco(h); const x0 = Math.min(b.x0, c.x0), y0 = Math.min(b.y0, c.y0), x1 = Math.max(b.x0 + b.w, c.x0 + c.w), y1 = Math.max(b.y0 + b.h, c.y0 + c.h); b = { x0, y0, w: x1 - x0, h: y1 - y0 }; });
  VH.encuadrar(b, 50);
}
function verHuecos(si) {
  UI.vistaHuecos = !!si && ['pared', 'costillas', 'reticula'].includes(P.tipo);
  $('#cPerfil').classList.toggle('oculto', UI.vistaHuecos); $('#cHuecos').classList.toggle('oculto', !UI.vistaHuecos);
  $('#bVistaHuecos').classList.toggle('activo', UI.vistaHuecos);
  ['#sClave', '#infoClave', '#bEsquina'].forEach(s => $(s).classList.toggle('oculto2', UI.vistaHuecos));
  $('#piePerfil').innerHTML = ayudaPerfil();
  if (UI.vistaHuecos) { VH.ajustar(); encuadrarHuecos(); } else VP.ajustar();
}

function iniciarHuecos() {
  VH = new Vista2D($('#cHuecos'), dibujarHuecos);
  const enlazar = (sel, fn, ev = 'change') => $(sel).addEventListener(ev, fn);
  const c = $('#cHuecos');
  c.addEventListener('contextmenu', ev => ev.preventDefault());
  const cerca = (mx, my) => { const h = huecoSel(); if (!h) return null; return asasHueco(h).find(a => { const [x, y] = VH.aPantalla(a.x, a.y); return Math.hypot(x - mx, y - my) < 9; }) || null; };
  const dentroDe = (u, v) => { for (let k = (P.huecos || []).length - 1; k >= 0; k--) if (dentro(formaHueco(P.huecos[k]), u, v)) return k; return -1; };
  c.addEventListener('pointerdown', ev => {
    const r = c.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top, [u, v] = VH.aMundo(mx, my);
    c.setPointerCapture(ev.pointerId);
    if (ev.button === 1) { HU.arr = { tipo: 'pan', x: mx, y: my, ox: VH.ox, oy: VH.oy }; return; }
    const a = cerca(mx, my), h = huecoSel();
    if (ev.button === 2) { if (a && a.vert && h.pts.length > 3) { h.pts.splice(a.i, 1); cambio('Vértice quitado'); } return; }
    if (a) { HU.arr = { tipo: a.vert ? 'vert' : 'asa', a, x0: u, y0: v, orig: JSON.parse(JSON.stringify(h)), movido: false }; return; }
    const k = dentroDe(u, v);
    if (k >= 0) { UI.hueco = k; refrescarHuecos(); HU.arr = { tipo: 'mover', x0: u, y0: v, orig: JSON.parse(JSON.stringify(P.huecos[k])), movido: false }; VH.pintar(); return; }
    HU.arr = { tipo: 'pan', x: mx, y: my, ox: VH.ox, oy: VH.oy };
  });
  c.addEventListener('pointermove', ev => {
    const r = c.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top, [u, v] = VH.aMundo(mx, my);
    $('#piePerfil').innerHTML = `<span>${P.tipo === 'pared' ? 'X' : 'u'} ${fmt(u)} · ${P.tipo === 'pared' ? 'Y' : 'v'} ${fmt(v)} mm</span>` + ayudaPerfil();
    const A = HU.arr; if (!A) { c.style.cursor = cerca(mx, my) ? 'pointer' : 'default'; return; }
    if (A.tipo === 'pan') { VH.ox = A.ox + mx - A.x; VH.oy = A.oy + my - A.y; VH.pintar(); return; }
    const h = huecoSel(), O = A.orig, du = u - A.x0, dv = v - A.y0; if (!h) return;
    if (Math.abs(du) + Math.abs(dv) > 0.5) A.movido = true;
    if (A.tipo === 'mover') {
      h.x = snapH(O.x + du, ev); h.y = snapH(O.y + dv, ev);
      if (O.pts) { const dx = h.x - O.x, dy = h.y - O.y; h.pts = O.pts.map(p => [p[0] + dx, p[1] + dy]); }
    } else if (A.tipo === 'vert') {
      h.pts[A.a.i] = [snapH(O.pts[A.a.i][0] + du, ev), snapH(O.pts[A.a.i][1] + dv, ev)];
      const cb = cajaDe(h.pts); h.x = cb.x0; h.y = cb.y0; h.ancho = cb.w; h.alto = cb.h;
    } else {
      const t = A.a.t; let x0 = O.x, y0 = O.y, x1 = O.x + O.ancho, y1 = O.y + O.alto;
      if (t.includes('w')) x0 = Math.min(x1 - 10, snapH(O.x + du, ev)); if (t.includes('e')) x1 = Math.max(x0 + 10, snapH(O.x + O.ancho + du, ev));
      if (t.includes('s')) y0 = Math.min(y1 - 10, snapH(O.y + dv, ev)); if (t.includes('n')) y1 = Math.max(y0 + 10, snapH(O.y + O.alto + dv, ev));
      h.x = x0; h.y = y0; h.ancho = x1 - x0; h.alto = y1 - y0;
    }
    ponerCamposHueco(); VH.pintar();
  });
  const fin = () => { const A = HU.arr; HU.arr = null; if (A && A.movido && A.tipo !== 'pan') cambio(A.tipo === 'mover' ? 'Hueco movido' : 'Hueco cambiado de tamaño'); };
  c.addEventListener('pointerup', fin); c.addEventListener('pointercancel', fin);
  c.addEventListener('dblclick', ev => {
    const h = huecoSel(); if (!h || h.forma !== 'libre') return;
    const r = c.getBoundingClientRect(), [u, v] = VH.aMundo(ev.clientX - r.left, ev.clientY - r.top);
    let mej = -1, md = Infinity; h.pts.forEach((p, i) => { const q = h.pts[(i + 1) % h.pts.length], d = distSeg(u, v, p, q); if (d < md) { md = d; mej = i; } });
    if (md * VH.sc < 12) { h.pts.splice(mej + 1, 0, [snapH(u, ev), snapH(v, ev)]); cambio('Vértice añadido'); }
  });
  // panel
  $('#bVistaHuecos').onclick = () => verHuecos(!UI.vistaHuecos);
  $$('[data-hnuevo]').forEach(b => b.onclick = () => {
    if (!window.ClipperLib) { aviso('⚠ Falta assets/js/clipper.js'); return; }
    P.huecos = P.huecos || []; const h = huecoNuevo(b.dataset.hnuevo);
    if (P.tipo !== 'pared') h.modo = 'pasante';
    P.huecos.push(h); UI.hueco = P.huecos.length - 1; cambio('Hueco ' + P.huecos.length + ': ' + NOMBRE_FORMA[h.forma].toLowerCase());
    if (!UI.vistaHuecos) verHuecos(true); else encuadrarHuecos();
  });
  $('#bHuecoQuitar').onclick = () => { if (!huecoSel()) return; P.huecos.splice(UI.hueco, 1); UI.hueco = Math.min(UI.hueco, P.huecos.length - 1); cambio('Hueco quitado'); };
  $('#bHuecoCopia').onclick = () => { const h = huecoSel(); if (!h) return; const c2 = JSON.parse(JSON.stringify(h)); c2.id = 'h' + Date.now().toString(36); c2.x += 50; c2.y += 50; if (c2.pts) c2.pts = c2.pts.map(p => [p[0] + 50, p[1] + 50]); P.huecos.push(c2); UI.hueco = P.huecos.length - 1; cambio('Hueco duplicado'); };
  const campo = (sel, fn) => enlazar(sel, () => { const h = huecoSel(); if (!h) return; fn(h, $(sel)); cambio(); });
  campo('#hcForma', (h, el) => { const v = el.value; if (v === 'libre' && !h.pts) h.pts = formaHueco(h).filter((_, i, a) => a.length <= 8 || i % Math.ceil(a.length / 8) === 0); h.forma = v; });
  [['#hcX', 'x'], ['#hcY', 'y'], ['#hcAncho', 'ancho'], ['#hcAlto', 'alto'], ['#hcRadio', 'radio'], ['#hcProf', 'prof'], ['#hcHolgura', 'holgura'], ['#hcDesde', 'desde'], ['#hcHasta', 'hasta']].forEach(([s, k]) => campo(s, (h, el) => {
    const v = +el.value || 0;
    if (h.forma === 'libre' && h.pts && ['x', 'y', 'ancho', 'alto'].includes(k)) {   // la forma libre se mueve o se escala entera
      const cb = cajaDe(h.pts), nx = k === 'x' ? v : cb.x0, ny = k === 'y' ? v : cb.y0, sw = k === 'ancho' ? Math.max(10, v) / cb.w : 1, sh = k === 'alto' ? Math.max(10, v) / cb.h : 1;
      h.pts = h.pts.map(p => [nx + (p[0] - cb.x0) * sw, ny + (p[1] - cb.y0) * sh]); const c2 = cajaDe(h.pts); h.x = c2.x0; h.y = c2.y0; h.ancho = c2.w; h.alto = c2.h; return;
    }
    h[k] = ['ancho', 'alto'].includes(k) ? Math.max(10, v) : v;
  }));
  campo('#hcModo', (h, el) => { h.modo = el.value; });
  campo('#hcActivo', (h, el) => { h.activo = el.checked; });
  campo('#hcMueble', (h, el) => { h.mueble.tipo = el.value; });
  campo('#hcFondo', (h, el) => { h.mueble.fondo = Math.max(0, +el.value || 0); });
  campo('#hcTrasera', (h, el) => { h.mueble.trasera = el.checked; });
  campo('#hcPuerta', (h, el) => { h.mueble.puerta = el.value; });
  campo('#hcHolPuerta', (h, el) => { h.mueble.holguraPuerta = Math.max(0, +el.value || 0); });
}
function ponerCamposHueco() {
  const h = huecoSel(), fr = P.tipo === 'pared';
  $('#hcCampos').classList.toggle('oculto', !h); if (!h) return;
  $('#hcTit').textContent = 'H' + (UI.hueco + 1) + ' · ' + NOMBRE_FORMA[h.forma];
  $('#hcActivo').checked = h.activo !== false; $('#hcForma').value = h.forma;
  $('#hcX').value = Math.round(h.x * 10) / 10; $('#hcY').value = Math.round(h.y * 10) / 10; $('#hcAncho').value = Math.round(h.ancho * 10) / 10; $('#hcAlto').value = Math.round(h.alto * 10) / 10;
  $('#hcRadio').value = h.radio; $('#filaHcRadio').classList.toggle('oculto', h.forma !== 'redondeado');
  [...$('#hcModo').options].forEach(o => { o.hidden = !fr && o.value === 'rebaje'; });
  if (!fr && h.modo === 'rebaje') h.modo = 'pasante';
  $('#hcModo').value = h.modo; $('#hcProf').value = h.prof; $('#filaHcProf').classList.toggle('oculto', h.modo !== 'rebaje');
  $('#hcHolgura').value = h.holgura; $('#filaHcHolgura').classList.toggle('oculto', h.modo !== 'mueble');
  $('#filaHcDesde').classList.toggle('oculto', fr); $('#hcDesde').value = h.desde; $('#hcHasta').value = h.hasta;
  $('#hcMuebleCampos').classList.toggle('oculto', h.modo !== 'mueble');
  [...$('#hcMueble').options].forEach(o => { o.hidden = !fr && o.value === 'armario'; });
  if (!fr && h.mueble.tipo === 'armario') h.mueble.tipo = 'caja';
  $('#hcMueble').value = h.mueble.tipo; $('#hcFondo').value = h.mueble.fondo; $('#filaHcFondo').classList.toggle('oculto', !fr);
  $('#hcTrasera').checked = !!h.mueble.trasera; $('#filaHcTrasera').classList.toggle('oculto', !fr || h.mueble.tipo === 'balda');
  $('#filaHcPuerta').classList.toggle('oculto', h.mueble.tipo !== 'armario'); $('#hcPuerta').value = h.mueble.puerta; $('#hcHolPuerta').value = h.mueble.holguraPuerta;
  $('#hcXTit').textContent = fr ? 'X desde la izquierda (mm)' : 'u: fondo (mm)'; $('#hcYTit').textContent = fr ? 'Y desde abajo (mm)' : 'v: altura (mm)';
}
function refrescarHuecos() {
  const ok = ['pared', 'costillas', 'reticula'].includes(P.tipo);
  $('#secHuecos').classList.toggle('oculto', !ok); $('#bVistaHuecos').classList.toggle('oculto', !ok);
  if (!ok && UI.vistaHuecos) verHuecos(false);
  P.huecos = P.huecos || [];
  if (UI.hueco == null || UI.hueco >= P.huecos.length) UI.hueco = P.huecos.length - 1;
  $('#nHuecos').textContent = P.huecos.length;
  const ul = $('#listaHuecos'); ul.innerHTML = '';
  P.huecos.forEach((h, k) => {
    const li = document.createElement('li'); li.className = k === UI.hueco ? 'sel' : '';
    const modo = h.modo === 'mueble' ? { balda: 'con balda', caja: 'con caja', armario: 'con armario' }[h.mueble.tipo] : h.modo;
    li.innerHTML = `<b>H${k + 1}</b> ${NOMBRE_FORMA[h.forma]} · ${fmt(h.ancho)} × ${fmt(h.alto)} · ${modo}${h.activo === false ? ' <i>(apagado)</i>' : ''}`;
    li.onclick = () => { UI.hueco = k; refrescarHuecos(); if (VH) VH.pintar(); };
    ul.appendChild(li);
  });
  ponerCamposHueco();
  if (VH && UI.vistaHuecos) VH.pintar();
}
