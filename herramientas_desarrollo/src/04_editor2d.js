
/* ===================== VISTAS 2D (editor de perfil y costilla) ===================== */
class Vista2D {
  constructor(canvas, dibujar) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.dibujar = dibujar;
    this.sc = 1; this.ox = 0; this.oy = 0; this.w = 0; this.h = 0; this.listo = false;
    new ResizeObserver(() => this.ajustar()).observe(canvas.parentElement);
    canvas.addEventListener('wheel', ev => {
      ev.preventDefault();
      const r = canvas.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
      const f = Math.exp(-ev.deltaY * 0.0015), [u, v] = this.aMundo(mx, my);
      this.sc = clamp(this.sc * f, 0.02, 60);
      this.ox = mx - u * this.sc; this.oy = my + v * this.sc; this.pintar();
    }, { passive: false });
  }
  ajustar() {
    const r = this.c.parentElement.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    if (r.width < 2 || r.height < 2) return;
    const cx = this.w ? (this.w / 2 - this.ox) / this.sc : 0, cy = this.h ? (this.oy - this.h / 2) / this.sc : 0;
    this.w = r.width; this.h = r.height;
    this.c.width = Math.round(r.width * d); this.c.height = Math.round(r.height * d);
    this.ctx.setTransform(d, 0, 0, d, 0, 0);
    if (this.listo) { this.ox = this.w / 2 - cx * this.sc; this.oy = this.h / 2 + cy * this.sc; }
    this.pintar();
  }
  aPantalla(u, v) { return [this.ox + u * this.sc, this.oy - v * this.sc]; }
  aMundo(x, y) { return [(x - this.ox) / this.sc, (this.oy - y) / this.sc]; }
  encuadrar(caja, margen = 46) {
    if (!this.w || !caja || !isFinite(caja.w)) return;
    const w = Math.max(caja.w, 10), h = Math.max(caja.h, 10);
    this.sc = Math.min((this.w - 2 * margen) / w, (this.h - 2 * margen - 26) / h);
    this.ox = this.w / 2 - (caja.x0 + w / 2) * this.sc;
    this.oy = this.h / 2 + 10 + (caja.y0 + h / 2) * this.sc;
    this.listo = true; this.pintar();
  }
  pintar() { if (this.w) this.dibujar(this.ctx, this); }
  camino(ctx, poly) {
    ctx.beginPath();
    poly.forEach((p, i) => { const [x, y] = this.aPantalla(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.closePath();
  }
  rejilla(ctx) {
    ctx.fillStyle = cssVar('--vista'); ctx.fillRect(0, 0, this.w, this.h);
    const pasos = [1, 5, 10, 50, 100, 500, 1000];
    let menor = pasos.find(p => p * this.sc >= 9) || 1000;
    const mayor = menor * (menor === 5 || menor === 50 || menor === 500 ? 2 : 10);
    const [u0, v1] = this.aMundo(0, 0), [u1, v0] = this.aMundo(this.w, this.h);
    const linea = (paso, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath();
      for (let u = Math.ceil(u0 / paso) * paso; u <= u1; u += paso) { const x = Math.round(this.aPantalla(u, 0)[0]) + .5; ctx.moveTo(x, 0); ctx.lineTo(x, this.h); }
      for (let v = Math.ceil(v0 / paso) * paso; v <= v1; v += paso) { const y = Math.round(this.aPantalla(0, v)[1]) + .5; ctx.moveTo(0, y); ctx.lineTo(this.w, y); }
      ctx.stroke();
    };
    linea(menor, cssVar('--rejilla')); linea(mayor, cssVar('--rejilla2'));
    // suelo y eje
    const [, ys] = this.aPantalla(0, 0), [xs] = this.aPantalla(0, 0);
    ctx.strokeStyle = cssVar('--ejes'); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(0, ys); ctx.lineTo(this.w, ys); ctx.stroke();
    ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(xs, 0); ctx.lineTo(xs, this.h); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = cssVar('--suave'); ctx.font = '11px system-ui'; ctx.fillText('suelo', 6, ys - 4);
    ctx.textAlign = 'right'; ctx.fillText('rejilla ' + menor + ' / ' + mayor + ' mm', this.w - 8, this.h - 8); ctx.textAlign = 'left';
  }
  cota(ctx, a, b, off, texto, vertical) { // cota sencilla entre a y b (mundo), desplazada off px
    const [x0, y0] = this.aPantalla(a[0], a[1]), [x1, y1] = this.aPantalla(b[0], b[1]);
    ctx.save(); ctx.strokeStyle = cssVar('--acento'); ctx.fillStyle = cssVar('--acento'); ctx.lineWidth = 1; ctx.font = '11.5px system-ui';
    if (!vertical) {
      const y = Math.max(y0, y1) + off;
      ctx.beginPath(); ctx.moveTo(x0, y0 + 4); ctx.lineTo(x0, y + 4); ctx.moveTo(x1, y1 + 4); ctx.lineTo(x1, y + 4); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      flecha(ctx, x0, y, 1, 0); flecha(ctx, x1, y, -1, 0);
      const tw = ctx.measureText(texto).width;
      ctx.fillStyle = cssVar('--vista'); ctx.fillRect((x0 + x1) / 2 - tw / 2 - 3, y - 15, tw + 6, 13);
      ctx.fillStyle = cssVar('--acento'); ctx.textAlign = 'center'; ctx.fillText(texto, (x0 + x1) / 2, y - 4);
    } else {
      const x = Math.max(x0, x1) + off;
      ctx.beginPath(); ctx.moveTo(x0 + 4, y0); ctx.lineTo(x + 4, y0); ctx.moveTo(x1 + 4, y1); ctx.lineTo(x + 4, y1); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke();
      flecha(ctx, x, y0, 0, y1 > y0 ? 1 : -1); flecha(ctx, x, y1, 0, y1 > y0 ? -1 : 1);
      ctx.translate(x - 4, (y0 + y1) / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center';
      const tw = ctx.measureText(texto).width;
      ctx.fillStyle = cssVar('--vista'); ctx.fillRect(-tw / 2 - 3, -12, tw + 6, 13);
      ctx.fillStyle = cssVar('--acento'); ctx.fillText(texto, 0, -2);
    }
    ctx.restore();
  }
}
function conAlfa(hex, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim()); if (!m) return hex;
  const n = parseInt(m[1], 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
function flecha(ctx, x, y, dx, dy) {
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx * 7 - dy * 3, y + dy * 7 - dx * 3); ctx.lineTo(x + dx * 7 + dy * 3, y + dy * 7 + dx * 3); ctx.closePath(); ctx.fill();
}

/* ---------- editor del perfil clave ---------- */
let VP = null, VC = null;
function claveActual() { return clavesOrdenadas()[UI.clave] || P.claves[0]; }
// lo que se edita arriba: el perfil clave (con las esquinas del mueble) o, en las piezas planas, el contorno de la pieza seleccionada
function ctrlEdit() {
  if (esPlano()) {
    const src = piezaFuente(UI.costilla); if (!src || !Array.isArray(src.pts)) return null;
    if (!Array.isArray(src.esq) || src.esq.length !== src.pts.length) src.esq = src.pts.map(() => true);
    return { pts: src.pts, esq: src.esq, pieza: src };
  }
  const k = P && P.claves && P.claves.length ? claveActual() : null; return k ? { pts: k.pts, esq: P.esquinas } : null;
}
function colorCostilla(alfa) { return `rgba(168,116,63,${alfa})`; }

function dibujarPerfil(ctx, V) {
  V.rejilla(ctx);
  if (!P || !R) return;
  if (relieveActivo()) { dibujarPerfilRelieve(ctx, V); return; }
  if (esPlano()) { dibujarPerfilPlano(ctx, V); return; }
  const C = clavesOrdenadas(), k = claveActual(), acento = cssVar('--acento');
  // todas las costillas, muy suaves (la «envolvente»)
  ctx.lineWidth = 1; ctx.strokeStyle = colorCostilla(.16);
  R.costillas.forEach(c => { if (c.ok) { V.camino(ctx, c.poly); ctx.stroke(); } });
  // costilla seleccionada
  const cs = piezaSel();
  if (cs && cs.ok && !cs.z) { ctx.setLineDash([6, 4]); ctx.strokeStyle = colorCostilla(.75); ctx.lineWidth = 1.4; V.camino(ctx, cs.poly); ctx.stroke(); ctx.setLineDash([]); }
  const fig = figuraActiva();
  let cont = fig ? (cs && cs.ok && !cs.z ? cs.poly : []) : [];
  if (fig) {
    if (cs && cs.ok && !cs.z) { ctx.fillStyle = conAlfa(acento, .13); ctx.strokeStyle = acento; ctx.lineWidth = 2; V.camino(ctx, cs.poly); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = acento; ctx.font = '600 12.5px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(`Forma desde el modelo 3D «${P.figura.malla.nombre}»: se cambia en el panel izquierdo`, V.w / 2, 66); ctx.textAlign = 'left';
  }
  // otras claves
  if (!fig) {
  ctx.strokeStyle = cssVar('--ejes'); ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
  C.forEach(o => { if (o !== k) { V.camino(ctx, curvaCerrada(o.pts, P.esquinas)); ctx.stroke(); } });
  ctx.setLineDash([]);
  // clave actual: curva completa y contorno recortado
  const curva = curvaCerrada(k.pts, P.esquinas); cont = contornoDe(k.pts);
  ctx.fillStyle = conAlfa(acento, .13);
  if (cont.length >= 3) { V.camino(ctx, cont); ctx.fill(); }
  ctx.strokeStyle = acento; ctx.lineWidth = 1; ctx.globalAlpha = .45; V.camino(ctx, curva); ctx.stroke(); ctx.globalAlpha = 1;
  if (cont.length >= 3) { ctx.lineWidth = 2.2; V.camino(ctx, cont); ctx.stroke(); }
  }
  // corte superior
  if (P.costillas.tope) {
    const [, y] = V.aPantalla(0, P.costillas.topeAlt);
    ctx.strokeStyle = cssVar('--peligro'); ctx.setLineDash([8, 4]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(V.w, y); ctx.stroke(); ctx.setLineDash([]);
  }
  // polígono de control
  if (!fig) { ctx.strokeStyle = cssVar('--suave'); ctx.lineWidth = .8; ctx.setLineDash([2, 3]);
  V.camino(ctx, k.pts); ctx.stroke(); ctx.setLineDash([]); }
  // varillas
  const r = radioAgujero(), Vv = P.varillas;
  // radial: tubo central y discos; pared: la pared y los rastreles
  if (P.tipo === 'radial') {
    const [xt] = V.aPantalla(radioTubo(), 0);
    ctx.fillStyle = 'rgba(150,156,164,.25)'; ctx.fillRect(V.aPantalla(0, 0)[0], 0, xt - V.aPantalla(0, 0)[0], V.h);
    ctx.fillStyle = '#5f6b78'; ctx.font = '11px system-ui'; ctx.fillText('tubo', xt + 4, 46);
    R.discos.forEach(d => { const [a, y] = V.aPantalla(radioTubo(), d.v), [b] = V.aPantalla(d.rD, 0); ctx.fillStyle = 'rgba(95,107,120,.35)'; ctx.fillRect(a, y - grosor() / 2 * V.sc, b - a, grosor() * V.sc); ctx.fillStyle = '#5f6b78'; ctx.fillText(d.etq, b + 4, y + 4); });
  }
  if (P.tipo === 'pared') {
    const [xp] = V.aPantalla(0, 0);
    ctx.fillStyle = 'rgba(150,156,164,.28)'; ctx.fillRect(0, 0, xp, V.h); ctx.fillStyle = '#5f6b78'; ctx.font = '11px system-ui'; ctx.fillText('pared', Math.max(4, xp - 40), 46);
    R.rastreles.forEach(rr => { const [a, y] = V.aPantalla(0, rr.v + P.pared.alto / 2), [b] = V.aPantalla(P.pared.grueso, 0); ctx.fillStyle = 'rgba(205,179,138,.6)'; ctx.fillRect(a, y, b - a, P.pared.alto * V.sc); });
  }
  // retícula: posición de los largueros
  if (P.tipo === 'reticula') {
    const vistos = new Set();
    R.largueros.forEach(z => {
      if (vistos.has(z.u)) return; vistos.add(z.u);
      const [x] = V.aPantalla(z.u, 0), sel = cs && cs.z && cs.u === z.u;
      ctx.strokeStyle = sel ? cssVar('--acento') : '#5f6b78'; ctx.lineWidth = sel ? 2 : 1; ctx.setLineDash([7, 4]);
      ctx.beginPath(); ctx.moveTo(x, 30); ctx.lineTo(x, V.h); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = ctx.strokeStyle; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.fillText(letra(z.j), x, 58); ctx.textAlign = 'left';
    });
  }
  if (P.tipo === 'costillas') Vv.lista.forEach((p, i) => {
    const info = R.varillas[i], mal = info && (!info.usada || info.fallan.length), [x, y] = V.aPantalla(p[0], p[1]);
    const col = mal ? cssVar('--peligro') : '#5f6b78';
    ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.arc(x, y, (r + Vv.margen) * V.sc, 0, PI2); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = mal ? 'rgba(192,57,43,.35)' : 'rgba(95,107,120,.35)'; ctx.lineWidth = i === UI.varilla ? 2.5 : 1.5;
    ctx.beginPath(); ctx.arc(x, y, Math.max(3, r * V.sc), 0, PI2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'left'; ctx.fillText('V' + (i + 1), x + Math.max(5, r * V.sc) + 3, y - 4);
  });
  // puntos de control (no con una figura: la forma sale del modelo)
  if (!fig) k.pts.forEach((p, i) => {
    const [x, y] = V.aPantalla(p[0], p[1]), sel = i === UI.punto;
    ctx.fillStyle = sel ? acento : cssVar('--panel'); ctx.strokeStyle = acento; ctx.lineWidth = 1.8;
    ctx.beginPath();
    if (P.esquinas[i]) ctx.rect(x - 5, y - 5, 10, 10); else ctx.arc(x, y, 5.2, 0, PI2);
    ctx.fill(); ctx.stroke();
  });
  // cotas del perfil
  if (cont.length >= 3) {
    const b = cajaDe(cont);
    V.cota(ctx, [b.x0, b.y0], [b.x1, b.y0], 22, fmt(b.w) + ' mm', false);
    V.cota(ctx, [b.x1, b.y0], [b.x1, b.y1], 26, fmt(b.h) + ' mm', true);
  }
  if (UI.modo === 'varilla') {
    ctx.fillStyle = acento; ctx.font = '600 12.5px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('Haz clic donde quieras la varilla (Esc para cancelar)', V.w / 2, 46);
  }
  ctx.textAlign = 'left';
}

// ----- interacción -----
const ED = { arr: null };
function snap(v) { const g = +$('#kRejilla').value; return g ? Math.round(v / g) * g : Math.round(v * 10) / 10; }
function puntoCerca(mx, my) {
  if (formaCalculada()) return -1;
  const k = ctrlEdit(); if (!k) return -1; let mejor = -1, md = 10;
  k.pts.forEach((p, i) => { const [x, y] = VP.aPantalla(p[0], p[1]), d = Math.hypot(x - mx, y - my); if (d < md) { md = d; mejor = i; } });
  return mejor;
}
function varillaCerca(mx, my) {
  if (P.tipo !== 'costillas') return -1;
  let mejor = -1, md = Infinity; const r = radioAgujero();
  P.varillas.lista.forEach((p, i) => { const [x, y] = VP.aPantalla(p[0], p[1]), d = Math.hypot(x - mx, y - my); if (d < Math.max(9, r * VP.sc + 4) && d < md) { md = d; mejor = i; } });
  return mejor;
}
function tramoCerca(mx, my) {
  const k = ctrlEdit(); if (!k) return null; const m = curvaConTramos(k.pts, k.esq, 24);
  let mejor = null, md = 9;
  m.forEach(o => { const [x, y] = VP.aPantalla(o.p[0], o.p[1]), d = Math.hypot(x - mx, y - my); if (d < md) { md = d; mejor = o; } });
  return mejor;
}
function insertarPunto(j, s) {
  if (esPlano()) {
    const k = ctrlEdit(); if (!k) return;
    const q = puntoTramo(k.pts, k.esq, j, s); k.pts.splice(j + 1, 0, [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10]); k.esq.splice(j + 1, 0, false);
    UI.punto = j + 1; P.editado = true; return;
  }
  const n = P.esquinas.length;
  P.claves.forEach(c => { const q = puntoTramo(c.pts, P.esquinas, j, s); c.pts.splice(j + 1, 0, [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10]); });
  P.esquinas.splice(j + 1, 0, false);
  UI.punto = (j + 1) % (n + 1); P.editado = true;
}
function borrarPunto(i) {
  if (esPlano()) {
    const k = ctrlEdit(); if (!k) return;
    if (k.pts.length <= 3) { aviso('Una pieza necesita al menos 3 puntos.'); return; }
    k.pts.splice(i, 1); k.esq.splice(i, 1); UI.punto = -1; P.editado = true; cambio('Punto borrado'); return;
  }
  if (P.esquinas.length <= 3) { aviso('Un perfil necesita al menos 3 puntos.'); return; }
  P.claves.forEach(c => c.pts.splice(i, 1)); P.esquinas.splice(i, 1);
  UI.punto = -1; P.editado = true; cambio('Punto borrado');
}
function alternarEsquina(i) {
  if (i < 0) { aviso('Selecciona antes un punto del perfil.'); return; }
  const E = ctrlEdit().esq; E[i] = !E[i]; P.editado = true; cambio(E[i] ? 'Punto en esquina' : 'Punto en curva');
}

function iniciarEditor() {
  VP = new Vista2D($('#cPerfil'), (ctx, V) => { dibujarPerfil(ctx, V); refrescarPuntoCoord(); });
  VC = new Vista2D($('#cCost'), dibujarCostilla);
  const c = $('#cPerfil');
  c.addEventListener('contextmenu', ev => ev.preventDefault());
  c.addEventListener('pointerdown', ev => {
    const r = c.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
    c.setPointerCapture(ev.pointerId);
    if (UI.modo === 'varilla' && ev.button === 0) {
      const [u, v] = VP.aMundo(mx, my);
      P.varillas.lista.push([snap(u), snap(v)]); UI.varilla = P.varillas.lista.length - 1; UI.modo = 'normal';
      cambio('Varilla añadida'); return;
    }
    if (ev.button === 2) {
      const iv = varillaCerca(mx, my); if (iv >= 0) { P.varillas.lista.splice(iv, 1); UI.varilla = -1; cambio('Varilla quitada'); return; }
      const ip = puntoCerca(mx, my); if (ip >= 0) borrarPunto(ip);
      return;
    }
    if (ev.button === 1) { ED.arr = { tipo: 'pan', x: mx, y: my, ox: VP.ox, oy: VP.oy }; return; }
    const ip = puntoCerca(mx, my);
    if (ip >= 0) {
      UI.punto = ip; UI.varilla = -1;
      const k = ctrlEdit();
      ED.arr = { tipo: 'punto', i: ip, x: mx, y: my, orig: esPlano() ? [] : P.claves.map(o => o.pts[ip].slice()), base: k.pts[ip].slice(), movido: false };
      VP.pintar(); return;
    }
    const iv = varillaCerca(mx, my);
    if (iv >= 0) { UI.varilla = iv; UI.punto = -1; ED.arr = { tipo: 'varilla', i: iv, x: mx, y: my, base: P.varillas.lista[iv].slice(), movido: false }; recalcular(); return; }
    UI.punto = -1; UI.varilla = -1;
    ED.arr = { tipo: 'pan', x: mx, y: my, ox: VP.ox, oy: VP.oy }; VP.pintar();
  });
  c.addEventListener('pointermove', ev => {
    const r = c.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
    const [u, v] = VP.aMundo(mx, my);
    $('#piePerfil').innerHTML = `<span>u ${fmt(u)} · v ${fmt(v)} mm</span>` + ayudaPerfil();
    const A = ED.arr; if (!A) { c.style.cursor = UI.modo === 'varilla' ? 'crosshair' : (puntoCerca(mx, my) >= 0 || varillaCerca(mx, my) >= 0) ? 'move' : 'grab'; return; }
    if (A.tipo === 'pan') { VP.ox = A.ox + mx - A.x; VP.oy = A.oy + my - A.y; VP.pintar(); return; }
    const du = (mx - A.x) / VP.sc, dv = -(my - A.y) / VP.sc;
    if (!A.movido && Math.hypot(mx - A.x, my - A.y) < 3) return;
    A.movido = true;
    if (A.tipo === 'punto') {
      const k = ctrlEdit(), nu = ev.shiftKey ? A.base[0] + du : snap(A.base[0] + du), nv = ev.shiftKey ? A.base[1] + dv : snap(A.base[1] + dv);
      if ($('#kTodas').checked && !esPlano()) {
        const ddu = nu - A.base[0], ddv = nv - A.base[1];
        P.claves.forEach((o, j) => { o.pts[A.i] = [Math.round((A.orig[j][0] + ddu) * 10) / 10, Math.round((A.orig[j][1] + ddv) * 10) / 10]; });
      } else k.pts[A.i] = [nu, nv];
      P.editado = true;
    } else if (A.tipo === 'varilla') {
      P.varillas.lista[A.i] = [snap(A.base[0] + du), snap(A.base[1] + dv)];
    }
    recalcularPronto();
  });
  const fin = () => {
    const A = ED.arr; ED.arr = null;
    if (A && A.movido && A.tipo !== 'pan') cambio(A.tipo === 'punto' ? 'Punto movido' : 'Varilla movida');
  };
  c.addEventListener('pointerup', fin); c.addEventListener('pointercancel', fin);
  c.addEventListener('dblclick', ev => {
    const r = c.getBoundingClientRect(), mx = ev.clientX - r.left, my = ev.clientY - r.top;
    const ip = puntoCerca(mx, my); if (ip >= 0) { alternarEsquina(ip); return; }
    if (formaCalculada()) return;
    const t = tramoCerca(mx, my); if (t) { insertarPunto(t.j, t.s); cambio('Punto añadido'); }
  });
  $('#bEsquina').onclick = () => alternarEsquina(UI.punto);
  const ponCoord = () => {
    const k = ctrlEdit(); if (!k || UI.punto < 0 || !k.pts[UI.punto]) return;
    const nu = +$('#ptU').value, nv = +$('#ptV').value; if (!isFinite(nu) || !isFinite(nv)) return;
    const q = k.pts[UI.punto], du = nu - q[0], dv = nv - q[1]; if (!du && !dv) return;
    if ($('#kTodas').checked && !esPlano()) P.claves.forEach(o => { const p = o.pts[UI.punto]; o.pts[UI.punto] = [Math.round((p[0] + du) * 10) / 10, Math.round((p[1] + dv) * 10) / 10]; });
    else k.pts[UI.punto] = [Math.round(nu * 10) / 10, Math.round(nv * 10) / 10];
    P.editado = true; cambio('Punto en ' + fmt(nu, 1) + ', ' + fmt(nv, 1));
  };
  $('#ptU').onchange = ponCoord; $('#ptV').onchange = ponCoord;
  $('#bEncuadrarPerfil').onclick = () => encuadrarPerfil();
  $('#sClave').onchange = () => { UI.clave = +$('#sClave').value; UI.punto = -1; refrescarClaves(); VP.pintar(); costillaDeClave(); };
  $('#bCostAnt').onclick = () => selCostilla(UI.costilla - 1);
  $('#bCostSig').onclick = () => selCostilla(UI.costilla + 1);
  $('#piePerfil').innerHTML = ayudaPerfil();
}
// piezas planas: el contorno de la pieza seleccionada en su plano, con las piezas que la cruzan en gris
function dibujarPerfilPlano(ctx, V) {
  const c = piezaSel(), k = ctrlEdit(), acento = cssVar('--acento'), e = grosor();
  if (!c || !k) return;
  // dónde la cruzan las otras piezas (la franja del grosor de cada una, a lo largo del cruce)
  (c.uniones || []).forEach(u => {
    const otra = R.costillas[u.a === c.i ? u.b : u.a], g = u.geo && u.geo[c.i]; if (!otra || !g) return;
    const [cs, sn] = g.rot, w = e * (g.wf || 1);
    const r = [[g.c - w / 2, g.lo], [g.c + w / 2, g.lo], [g.c + w / 2, g.hi], [g.c - w / 2, g.hi]].map(q => desgirarP(q, cs, sn));
    ctx.fillStyle = 'rgba(95,107,120,.30)'; V.camino(ctx, r); ctx.fill();
    const top = r.reduce((m, q) => q[1] > m[1] ? q : m, r[0]), [tx, ty] = V.aPantalla(top[0], top[1]);
    ctx.fillStyle = '#5f6b78'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(otra.etq + (u.tipo === 'caja' ? (u.en === c.i ? ' (caja)' : ' (espiga)') : u.tipo === 'dentada' ? ' (dientes)' : ''), tx, ty - 4);
  });
  ctx.textAlign = 'left';
  // piezas paralelas pegadas cara con cara: la zona común y los tacos o tornillos
  (c.uniones || []).filter(u => u.tipo === 'solape').forEach(u => {
    const otra = R.costillas[u.a === c.i ? u.b : u.a];
    ctx.fillStyle = 'rgba(95,107,120,.22)'; ctx.strokeStyle = '#5f6b78'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
    u.zonas.forEach(z => { V.camino(ctx, z.poly); ctx.fill(); ctx.stroke(); });
    ctx.setLineDash([]);
    const b = cajaDe(u.zonas[0].poly), [lx, ly] = V.aPantalla(b.x0 + b.w / 2, b.y1);
    ctx.fillStyle = '#5f6b78'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText(`${otra.etq} (solape)`, lx, ly - 4); ctx.textAlign = 'left';
  });
  (c.taladros || []).forEach(t => { const [x, y] = V.aPantalla(t[0], t[1]), ci = t[3] === 'ciego'; ctx.strokeStyle = '#5f6b78'; ctx.fillStyle = ci ? 'rgba(95,107,120,.18)' : 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.4; ctx.setLineDash(ci ? [3, 2] : []); ctx.beginPath(); ctx.arc(x, y, Math.max(3, t[2] * V.sc), 0, PI2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); });
  (c.cantos || []).forEach(m => { const a = V.aPantalla(m.a[0], m.a[1]), b = V.aPantalla(m.b[0], m.b[1]); ctx.strokeStyle = '#b5532f'; ctx.lineWidth = Math.max(1.5, 2 * m.r * V.sc); ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.globalAlpha = 1; });
  // la pieza como se corta (con ranuras y cajas)
  if (c.ok) {
    ctx.fillStyle = conAlfa(acento, .12); ctx.beginPath();
    [polyVista(c.poly), ...(c.int || []).map(polyVista)].forEach(pol => pol.forEach((p, i) => { const [x, y] = V.aPantalla(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }) || ctx.closePath());
    ctx.fill('evenodd'); ctx.strokeStyle = colorCostilla(.8); ctx.lineWidth = 1.2; ctx.stroke();
  }
  // contorno de control (curva) y polígono de control
  const curva = curvaCerrada(k.pts, k.esq);
  ctx.strokeStyle = acento; ctx.lineWidth = 2.2; V.camino(ctx, curva); ctx.stroke();
  ctx.strokeStyle = cssVar('--suave'); ctx.lineWidth = .8; ctx.setLineDash([2, 3]); V.camino(ctx, k.pts); ctx.stroke(); ctx.setLineDash([]);
  k.pts.forEach((p, i) => {
    const [x, y] = V.aPantalla(p[0], p[1]), sel = i === UI.punto;
    ctx.fillStyle = sel ? acento : cssVar('--panel'); ctx.strokeStyle = acento; ctx.lineWidth = 1.8; ctx.beginPath();
    if (k.esq[i]) ctx.rect(x - 4.5, y - 4.5, 9, 9); else ctx.arc(x, y, 5, 0, PI2);
    ctx.fill(); ctx.stroke();
  });
  const b = cajaDe(curva);
  V.cota(ctx, [b.x0, b.y0], [b.x1, b.y0], 22, fmt(b.w) + ' mm', false);
  V.cota(ctx, [b.x1, b.y0], [b.x1, b.y1], 26, fmt(b.h) + ' mm', true);
  const pl = PLANOS[c.plano];
  ctx.fillStyle = cssVar('--suave'); ctx.font = '11.5px system-ui';
  ctx.fillText(`${c.nombre} (${c.etq}) · ${pl.nombre.toLowerCase()}, en ${pl.normal} = ${fmt(c.x)} mm${c.giro ? `, inclinada ${fmt(c.giro, 1)}°` : ''} · horizontal: ${pl.ejes[0]} · vertical: ${pl.ejes[1]}` + (k.pieza && k.pieza !== planoP().piezas[UI.costilla] ? ` · igual que «${k.pieza.nombre}»` : ''), 8, 72);
}
// casillas con la posición del punto seleccionado (se pueden escribir)
function refrescarPuntoCoord() {
  const caja = $('#ptCoord'); if (!caja) return;
  const k = P && R && !formaCalculada() && !UI.vistaHuecos ? ctrlEdit() : null, p = k && UI.punto >= 0 ? k.pts[UI.punto] : null;
  caja.classList.toggle('oculto', !p); if (!p) return;
  const ej = esPlano() && piezaSel() ? PLANOS[piezaSel().plano].ejes.map(t => t.replace(/.*\((\w)\)/, '$1')) : ['u', 'v'];
  $('#ptLu').textContent = ej[0]; $('#ptLv').textContent = ej[1];
  if (document.activeElement !== $('#ptU')) $('#ptU').value = p[0];
  if (document.activeElement !== $('#ptV')) $('#ptV').value = p[1];
}
// con relieve (texto o modelo) no hay perfiles clave: se ven las lamas y la seleccionada
function dibujarPerfilRelieve(ctx, V) {
  ctx.fillStyle = 'rgba(150,156,164,.28)'; const [xp] = V.aPantalla(0, 0); ctx.fillRect(0, 0, xp, V.h);
  ctx.lineWidth = 1; ctx.strokeStyle = colorCostilla(.18);
  R.costillas.forEach(c => { if (c.ok) { V.camino(ctx, c.poly); ctx.stroke(); } });
  const cs = piezaSel();
  if (cs && cs.ok && !cs.z) { ctx.fillStyle = conAlfa(cssVar('--acento'), .13); ctx.strokeStyle = cssVar('--acento'); ctx.lineWidth = 2; V.camino(ctx, cs.poly); ctx.fill(); ctx.stroke(); }
  R.rastreles.forEach(rr => { const [a, y] = V.aPantalla(0, rr.v + P.pared.alto / 2), [b] = V.aPantalla(P.pared.grueso, 0); ctx.fillStyle = 'rgba(205,179,138,.6)'; ctx.fillRect(a, y, b - a, P.pared.alto * V.sc); });
  ctx.fillStyle = cssVar('--acento'); ctx.font = '600 12.5px system-ui'; ctx.textAlign = 'center';
  ctx.fillText(`Forma desde ${{ texto: 'el texto', modelo: 'el modelo 3D', imagen: 'la imagen' }[P.relieve.fuente]}: se cambia en el panel izquierdo (lama ${cs ? cs.etq : ''})`, V.w / 2, 66);
  ctx.textAlign = 'left';
}
function ayudaPerfil() {
  if (UI.vistaHuecos) return '<span><kbd>Arrastrar</kbd> mover el hueco · asas: estirar</span><span><kbd>Doble clic</kbd> vértice nuevo (libre)</span><span><kbd>↻</kbd> girar</span><span><kbd>Clic dcho.</kbd> quitar vértice</span><span><kbd>Supr</kbd> borrar el hueco</span><span><kbd>Mayús</kbd> sin rejilla</span>';
  return '<span><kbd>Doble clic</kbd> línea: punto nuevo · punto: esquina</span><span><kbd>Clic dcho.</kbd> borrar</span><span><kbd>Mayús</kbd> sin rejilla</span>';
}
function encuadrarPerfil() {
  if (!R) return;
  if (esPlano()) { const k = ctrlEdit(), c = piezaSel(); if (!k) { VP.pintar(); return; } const b = cajaDe(curvaCerrada(k.pts, k.esq)); if (c && c.ok) { const d = c.caja; b.x0 = Math.min(b.x0, d.x0); b.y0 = Math.min(b.y0, d.y0); b.w = Math.max(b.x0 + b.w, d.x1) - b.x0; b.h = Math.max(b.y0 + b.h, d.y1) - b.y0; } VP.encuadrar(b, 50); return; }
  if (formaCalculada()) { const cs = R.costillas.filter(c => c.ok); if (cs.length) VP.encuadrar({ x0: 0, y0: 0, w: Math.max(...cs.map(c => c.caja.x1)), h: Math.max(...cs.map(c => c.caja.y1)) }, 50); return; }
  let x0 = Infinity, y0 = 0, x1 = -Infinity, y1 = -Infinity;
  P.claves.forEach(c => c.pts.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }));
  VP.encuadrar({ x0, y0, w: x1 - x0, h: y1 - y0 }, 50);
}

/* ---------- vista de la costilla seleccionada ---------- */
function dibujarCostilla(ctx, V) {
  V.rejilla(ctx);
  if (!R) return;
  const c = piezaSel(); if (!c || !c.ok) return;
  ctx.fillStyle = colorCostilla(.28); ctx.strokeStyle = colorCostilla(1); ctx.lineWidth = 2;
  // la pieza con sus huecos de dentro (si los tiene)
  ctx.beginPath(); [polyVista(c.poly), ...(c.int || [])].forEach(pol => pol.forEach((p, i) => { const [x, y] = V.aPantalla(p[0], p[1]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }) || ctx.closePath());
  ctx.fill('evenodd'); ctx.stroke();
  // los otros trozos de la misma lama o costilla, en claro
  const pad = c.padre || c; (pad.partes || []).forEach(q => { if (q === c || !q.ok) return; ctx.save(); ctx.globalAlpha = .35; ctx.setLineDash([4, 3]); V.camino(ctx, q.poly); ctx.stroke(); ctx.restore(); });
  const r = radioAgujero();
  (c.taladros || []).forEach(t => { const [x, y] = V.aPantalla(t[0], t[1]); ctx.fillStyle = cssVar('--vista'); ctx.beginPath(); ctx.arc(x, y, Math.max(2, t[2] * V.sc), 0, PI2); ctx.fill(); ctx.stroke(); });
  c.agujeros.forEach(k => {
    const [x, y] = V.aPantalla(P.varillas.lista[k][0], P.varillas.lista[k][1]);
    ctx.fillStyle = cssVar('--vista'); ctx.beginPath(); ctx.arc(x, y, Math.max(2, r * V.sc), 0, PI2); ctx.fill(); ctx.stroke();
  });
  // varillas que no caben en esta costilla
  R.varillas.forEach(rv => {
    if (rv.usada && !c.z && rv.fallan.includes(c.i)) {
      const [x, y] = V.aPantalla(rv.u, rv.v); ctx.strokeStyle = cssVar('--peligro'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, Math.max(4, r * V.sc), 0, PI2); ctx.stroke(); ctx.strokeStyle = colorCostilla(1);
    }
  });
  const [lx, ly] = V.aPantalla(...puntoEtiqueta(c));
  ctx.fillStyle = colorCostilla(1); ctx.font = 'bold ' + clamp(30 * V.sc, 11, 26) + 'px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(c.etq, lx, ly); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  V.cota(ctx, [c.caja.x0, c.caja.y0], [c.caja.x1, c.caja.y0], 18, fmt(c.caja.w) + ' mm', false);
  V.cota(ctx, [c.caja.x1, c.caja.y0], [c.caja.x1, c.caja.y1], 20, fmt(c.caja.h) + ' mm', true);
}
function selCostilla(i, encuadrar) {
  if (!R) return;
  UI.costilla = clamp(i, 0, nPiezas() - 1);
  // si en esa costilla hay un perfil clave, se selecciona también (para editarlo arriba)
  const c = piezaSel();
  if (esPlano()) { const cambia = UI.piezaVista !== UI.costilla; UI.piezaVista = UI.costilla; if (cambia) { UI.punto = -1; encuadrarPerfil(); } refrescarPiezaSel(); }
  if (c && UI.costilla < R.n && !formaCalculada() && P.tipo !== 'radial' && !esPlano()) {
    const C = clavesOrdenadas(), tol = Math.max(grosor(), (R.sep || 0) / 2);
    let mej = -1, md = Infinity; C.forEach((k, j) => { const d = Math.abs(k.x - c.x); if (d < md) { md = d; mej = j; } });
    if (mej >= 0 && md <= tol && mej !== UI.clave) { UI.clave = mej; UI.punto = -1; refrescarClaves(); construirClaves3D(); }
  }
  refrescarCostilla();
  if (encuadrar !== false) encuadrarCostilla();
  VP.pintar(); resaltar3D();
  const li = $('#listaCost').children[UI.costilla]; if (li) li.scrollIntoView({ block: 'nearest' });
}
// pieza seleccionada: costilla o larguero (retícula)
const nPiezas = () => R.n + (R.otras ? R.otras.length : 0);
const piezaSel = () => R ? (UI.costilla < R.n ? R.costillas[UI.costilla] : R.otras[UI.costilla - R.n]) : null;
function encuadrarCostilla() { const c = piezaSel(); if (c && c.ok) VC.encuadrar(c.caja, 40); else VC.pintar(); }
function refrescarCostilla() {
  const c = piezaSel(); if (!c) return;
  $('#tipoPieza').textContent = esPlano() ? 'Pieza' : c.disco ? 'Disco' : c.z ? 'Larguero' : P.tipo === 'pared' ? 'Lama' : 'Costilla';
  $('#numCost').textContent = c.etq;
  $('#infoCost').textContent = esPlano() ? `${c.nombre} · ${PLANOS[c.plano].nombre.toLowerCase()} en ${PLANOS[c.plano].normal} = ${fmt(c.x)} mm · ${fmt(c.caja.w)} × ${fmt(c.caja.h)} mm · ${textoUnionesPieza(c)}` : c.disco ? `a ${fmt(c.v)} mm de altura · Ø ${fmt(2 * c.rD)} mm · ${R.n} ranuras`
    : c.z ? `z = ${fmt(c.u)} mm · ${fmt(c.caja.w)} × ${fmt(c.caja.h)} mm · ${c.ranuras.length} ranuras`
    : `de ${R.n} · ${P.tipo === 'radial' ? 'ángulo' : 'x'} = ${textoPos(c.x)} · ${fmt(c.caja.w)} × ${fmt(c.caja.h)} mm` + (c.ranuras.length ? ` · ${c.ranuras.length} ${P.tipo === 'reticula' ? 'ranuras' : 'muescas'}` : '');
  $$('#listaCost li').forEach((li, i) => li.classList.toggle('sel', i === UI.costilla));
  if (esPlano()) refrescarPiezaSel();
}
