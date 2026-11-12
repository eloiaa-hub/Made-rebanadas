
/* ===================== PANELES ===================== */
let tRecalc = 0;
// recalcula costillas y lo dibuja todo
function recalcular() {
  R = calcular();
  UI.costilla = clamp(UI.costilla, 0, R.n - 1);
  if (UI.varilla >= P.varillas.lista.length) UI.varilla = -1;
  construir3D();
  refrescarListas();
  VP.pintar(); refrescarCostilla(); VC.pintar();
}
// durante un arrastre: como mucho cada 70 ms
function recalcularPronto() {
  VP.pintar();
  if (tRecalc) return;
  tRecalc = setTimeout(() => { tRecalc = 0; recalcular(); }, 70);
}
// después de cada cambio que se pueda deshacer
function cambio(txt) {
  UI.sucio = true;
  guardarHistoria();
  recalcular();
  refrescarClaves();
  if (txt) $('#estado').textContent = txt;
}

function construirParams() {
  const pl = PLANTILLAS[P.plantilla], cont = $('#params');
  $('#descPlantilla').textContent = pl.desc;
  cont.innerHTML = '';
  pl.params.forEach(q => {
    const v = P.params[q.id] != null ? P.params[q.id] : q.valor;
    const d = document.createElement('div'); d.className = 'param';
    d.innerHTML = `<div class="pt"><span>${q.nombre}</span><input type="number" min="${q.min}" max="${q.max}" step="${q.paso}" value="${v}"></div>
      <input type="range" min="${q.min}" max="${q.max}" step="${q.paso}" value="${v}">`;
    const [num, ran] = d.querySelectorAll('input');
    const poner = (val, final) => {
      val = clamp(+val, q.min, q.max); if (!isFinite(val)) return;
      if (P.editado && q.id !== 'largo' && !UI.avisoRegenerar) {
        if (!confirm('Has retocado los perfiles a mano. Si cambias este parámetro, la forma se vuelve a generar desde la plantilla y se pierden esos retoques.\n\n¿Seguir?')) { num.value = ran.value = P.params[q.id]; return; }
        UI.avisoRegenerar = true;
      }
      P.params[q.id] = val; num.value = ran.value = val;
      aplicarPlantilla(q.id === 'largo');
      if (final) { cambio(q.nombre + ': ' + fmt(val, q.paso < 1 ? 2 : 0)); UI.avisoRegenerar = false; encuadrarSiHaceFalta(); }
      else recalcularPronto();
      $('#avisoEditado').classList.toggle('oculto', !P.editado);
    };
    ran.oninput = () => poner(ran.value, false);
    ran.onchange = () => poner(ran.value, true);
    num.onchange = () => poner(num.value, true);
    cont.appendChild(d);
  });
  $('#avisoEditado').classList.toggle('oculto', !P.editado);
}
function encuadrarSiHaceFalta() { encuadrarPerfil(); encuadrarCostilla(); }

function iniciarPanel() {
  const sp = $('#sPlantilla');
  Object.entries(PLANTILLAS).forEach(([id, pl]) => sp.add(new Option(pl.nombre, id)));
  sp.onchange = () => {
    if (P.editado && !confirm('Se perderán los retoques hechos a mano en los perfiles. ¿Cambiar de plantilla?')) { sp.value = P.plantilla; return; }
    P.plantilla = sp.value; P.params = paramsDefecto(sp.value); P.nombre = PLANTILLAS[sp.value].nombre;
    aplicarPlantilla(); UI.clave = 0;
    autoVarillas(P.varillas.autoN);
    construirParams(); cambio('Plantilla: ' + PLANTILLAS[sp.value].nombre);
    encuadrarSiHaceFalta(); camara('tres4');
  };
  const sm = $('#cMaterial');
  Object.entries(MATERIALES).forEach(([id, m]) => sm.add(new Option(m.nombre, id)));
  // costillas
  const enlazar = (sel, fn, ev = 'change') => $(sel).addEventListener(ev, fn);
  enlazar('#cGrosor', () => {
    const v = $('#cGrosor').value; $('#filaGrosorOtro').classList.toggle('oculto', v !== 'otro');
    P.costillas.grosor = v === 'otro' ? +$('#cGrosorOtro').value : +v; cambio('Grosor ' + P.costillas.grosor + ' mm');
  });
  enlazar('#cGrosorOtro', () => { P.costillas.grosor = clamp(+$('#cGrosorOtro').value || 18, 3, 80); cambio('Grosor ' + P.costillas.grosor + ' mm'); });
  enlazar('#cModo', () => {
    P.costillas.modo = $('#cModo').value;
    // conserva el reparto actual al cambiar de modo
    if (R) { P.costillas.numero = R.n; P.costillas.separacion = Math.round(R.sep * 10) / 10; }
    ponerControles(); cambio();
  });
  enlazar('#cSep', () => { P.costillas.separacion = Math.max(1, +$('#cSep').value || 60); cambio('Separación ' + P.costillas.separacion + ' mm'); });
  enlazar('#cNum', () => { P.costillas.numero = clamp(Math.round(+$('#cNum').value || 2), 2, 400); cambio(P.costillas.numero + ' costillas'); });
  enlazar('#cBase', () => { P.costillas.base = $('#cBase').checked; cambio(); });
  enlazar('#cTope', () => { P.costillas.tope = $('#cTope').checked; $('#filaTope').classList.toggle('oculto', !P.costillas.tope); cambio(); });
  enlazar('#cTopeAlt', () => { P.costillas.topeAlt = Math.max(10, +$('#cTopeAlt').value || 400); cambio(); });
  enlazar('#cMaterial', () => { P.costillas.material = sm.value; $('#filaColor').classList.toggle('oculto', !MATERIALES[sm.value].color); cambio(MATERIALES[sm.value].nombre); });
  enlazar('#cColor', () => { P.costillas.color = $('#cColor').value; cambio(); });
  // varillas
  const V = () => P.varillas;
  enlazar('#vTipo', () => { V().tipo = $('#vTipo').value; cambio(); });
  enlazar('#vDiam', () => { V().diam = +$('#vDiam').value; if (V().sepD <= V().diam + 4) { V().sepD = V().diam + 12; $('#vSepD').value = V().sepD; } cambio('Varilla Ø ' + V().diam); });
  enlazar('#vHolgura', () => { V().holgura = clamp(+$('#vHolgura').value || 0, 0, 5); cambio(); });
  enlazar('#vMargen', () => { V().margen = clamp(+$('#vMargen').value || 0, 0, 200); cambio(); });
  enlazar('#vTramo', () => { V().tramo = $('#vTramo').value; cambio(); });
  enlazar('#vSep', () => { V().separadores = $('#vSep').checked; $('#filaSepD').classList.toggle('oculto', !V().separadores); cambio(); });
  enlazar('#vSepD', () => { V().sepD = clamp(+$('#vSepD').value || 20, 4, 120); cambio(); });
  enlazar('#vSobra', () => { V().sobra = clamp(+$('#vSobra').value || 0, 0, 200); cambio(); });
  enlazar('#vAutoN', () => { V().autoN = clamp(Math.round(+$('#vAutoN').value || 3), 1, 8); });
  $('#bVarAuto').onclick = () => {
    const n = autoVarillas(V().autoN);
    if (!n) { aviso('No hay sitio común para las varillas: baja «Madera al borde» o el diámetro, o usa «Solo donde caben».', 5000); return; }
    cambio(n < V().autoN ? `Solo caben ${n} varillas` : n + ' varillas colocadas');
    if (n < V().autoN) aviso(`Solo hay sitio para ${n} varilla${n > 1 ? 's' : ''} con esa separación.`);
  };
  $('#bVarMas').onclick = () => { UI.modo = UI.modo === 'varilla' ? 'normal' : 'varilla'; VP.pintar(); };
  $('#bVarQuitar').onclick = () => { if (!V().lista.length) return; V().lista = []; UI.varilla = -1; cambio('Varillas quitadas'); };
  // maqueta
  enlazar('#mActiva', () => { P.maqueta.activa = $('#mActiva').checked; cambio(P.maqueta.activa ? 'Maqueta 1:' + P.maqueta.escala : 'Tamaño real'); });
  enlazar('#mEscala', () => { P.maqueta.escala = +$('#mEscala').value; cambio('Maqueta 1:' + P.maqueta.escala); });
  enlazar('#mGrosor', () => { P.maqueta.grosor = clamp(+$('#mGrosor').value || 3, 0.5, 20); cambio(); });
  enlazar('#mDiam', () => { P.maqueta.diam = clamp(+$('#mDiam').value || 3, 0.5, 20); cambio(); });
  enlazar('#mHolgura', () => { P.maqueta.holgura = clamp(+$('#mHolgura').value || 0, 0, 2); cambio(); });
  // claves
  $('#kPos').onchange = () => {
    const k = claveActual(); k.x = clamp(+$('#kPos').value || 0, 0, P.largo); P.editado = true;
    UI.clave = clavesOrdenadas().indexOf(k); cambio('Clave movida');
  };
  $('#bClaveMas').onclick = () => {
    const c = R.costillas[UI.costilla], x = Math.round(c.x * 10) / 10;
    if (P.claves.some(k => Math.abs(k.x - x) < 1)) { aviso('Ya hay un perfil clave en esa costilla.'); return; }
    const nueva = { x, pts: perfilEn(x).map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]) };
    P.claves.push(nueva); P.editado = true; UI.clave = clavesOrdenadas().indexOf(nueva); cambio('Clave añadida en la costilla ' + (c.i + 1));
  };
  $('#bClaveMenos').onclick = () => {
    if (P.claves.length <= 1) { aviso('Tiene que quedar al menos un perfil clave.'); return; }
    const k = claveActual(); P.claves.splice(P.claves.indexOf(k), 1); UI.clave = Math.max(0, UI.clave - 1); P.editado = true; cambio('Clave quitada');
  };
  $('#bClaveCopia').onclick = () => {
    const k = claveActual(); P.claves.forEach(o => { if (o !== k) o.pts = clonar(k.pts); }); P.editado = true; cambio('Perfil copiado en todas las claves');
  };
  $('#kInterp').onchange = () => { P.interp = $('#kInterp').value; cambio(); };
  // vista 3D
  $('#rExplosion').oninput = () => { P.vista.explosion = +$('#rExplosion').value; colocarExplosion(); if (P.vista.fantasma) { construirFantasma(); pedirRender(); } };
  $('#cFantasma').onchange = () => { P.vista.fantasma = $('#cFantasma').checked; construirFantasma(); pedirRender(); };
  $('#cVarillas3d').onchange = () => { P.vista.varillas = $('#cVarillas3d').checked; colocarExplosion(); };
  $('#cResalta').onchange = () => { P.vista.resalta = $('#cResalta').checked; resaltar3D(); };
  // distribución
  $$('[data-dist]').forEach(b => b.onclick = () => {
    $$('[data-dist]').forEach(o => o.classList.toggle('activo', o === b));
    $('#vistas').className = 'vistas ' + b.dataset.dist;
  });
  $('#bPanelIzq').onclick = () => { const a = $('#app').classList.toggle('sin-izq'); $('#bPanelIzq').textContent = a ? '▶' : '◀'; };
  $('#bPanelDer').onclick = () => { const a = $('#app').classList.toggle('sin-der'); $('#bPanelDer').textContent = a ? '◀' : '▶'; };
  // apartados plegables
  $$('.panel section > h3').forEach(h => h.addEventListener('click', ev => { if (ev.target === h || ev.target.parentElement === h) h.parentElement.classList.toggle('plegada'); }));
}

// pone los controles con los valores del proyecto
function ponerControles() {
  $('#sPlantilla').value = P.plantilla;
  const C = P.costillas, V = P.varillas;
  const op = [...$('#cGrosor').options].map(o => o.value);
  if (op.includes(String(C.grosor))) { $('#cGrosor').value = String(C.grosor); $('#filaGrosorOtro').classList.add('oculto'); }
  else { $('#cGrosor').value = 'otro'; $('#cGrosorOtro').value = C.grosor; $('#filaGrosorOtro').classList.remove('oculto'); }
  $('#cModo').value = C.modo; $('#cSep').value = C.separacion; $('#cNum').value = C.numero;
  $('#filaSep').classList.toggle('oculto', C.modo !== 'separacion'); $('#filaNum').classList.toggle('oculto', C.modo !== 'numero');
  $('#cBase').checked = C.base; $('#cTope').checked = C.tope; $('#cTopeAlt').value = C.topeAlt; $('#filaTope').classList.toggle('oculto', !C.tope);
  $('#cMaterial').value = C.material; $('#cColor').value = C.color; $('#filaColor').classList.toggle('oculto', !MATERIALES[C.material].color);
  $('#vTipo').value = V.tipo; $('#vDiam').value = String(V.diam); $('#vHolgura').value = V.holgura; $('#vMargen').value = V.margen;
  $('#vTramo').value = V.tramo; $('#vSep').checked = V.separadores; $('#vSepD').value = V.sepD; $('#vSobra').value = V.sobra; $('#vAutoN').value = V.autoN;
  $('#filaSepD').classList.toggle('oculto', !V.separadores);
  $('#kInterp').value = P.interp;
  const M = P.maqueta; $('#mActiva').checked = M.activa; $('#mEscala').value = String(M.escala); $('#mGrosor').value = M.grosor; $('#mDiam').value = M.diam; $('#mHolgura').value = M.holgura;
  $('#rExplosion').value = P.vista.explosion; $('#cFantasma').checked = P.vista.fantasma; $('#cVarillas3d').checked = P.vista.varillas; $('#cResalta').checked = P.vista.resalta;
  construirParams();
}

function refrescarClaves() {
  const C = clavesOrdenadas(); UI.clave = clamp(UI.clave, 0, C.length - 1);
  const s = $('#sClave'); s.innerHTML = '';
  C.forEach((k, i) => s.add(new Option(`Perfil clave ${i + 1}`, i)));
  s.value = UI.clave;
  const k = C[UI.clave];
  $('#infoClave').textContent = `en x = ${fmt(k.x)} mm (${fmt(k.x / P.largo * 100)} %)`;
  $('#kPos').value = k.x;
  $('#nClaves').textContent = C.length;
  const ul = $('#listaClaves'); ul.innerHTML = '';
  C.forEach((o, i) => {
    const li = document.createElement('li'); li.className = i === UI.clave ? 'sel' : '';
    li.innerHTML = `<span class="icono">◆</span><span class="nom">Perfil clave ${i + 1}</span><span class="pos">x ${fmt(o.x)} mm</span>`;
    li.onclick = () => { UI.clave = i; UI.punto = -1; refrescarClaves(); VP.pintar(); };
    ul.appendChild(li);
  });
  $('#avisoEditado').classList.toggle('oculto', !P.editado);
}

function refrescarListas() {
  // resumen del reparto
  $('#resCost').innerHTML = `<b>${R.n}</b> costillas · separación <b>${fmt(R.sep, 1)}</b> mm · hueco <b>${fmt(Math.max(0, R.hueco), 1)}</b> mm`;
  // costillas
  $('#nCost').textContent = R.n;
  const malas = new Set(); R.avisos.forEach(a => { if (a.tipo === 'error') R.varillas.forEach(v => v.fallan.forEach(i => malas.add(i))); });
  R.costillas.forEach(c => { if (!c.ok || (P.varillas.lista.length && c.nVar === 0)) malas.add(c.i); });
  const ul = $('#listaCost'); ul.innerHTML = '';
  R.costillas.forEach(c => {
    const li = document.createElement('li'); li.className = c.i === UI.costilla ? 'sel' : '';
    li.innerHTML = `<span class="icono">${malas.has(c.i) ? '<span class="mal">!</span>' : '▮'}</span><span class="nom">Costilla ${c.i + 1}</span><span class="med">${c.ok ? fmt(c.caja.w) + ' × ' + fmt(c.caja.h) : 'vacía'}</span>`;
    li.onclick = () => selCostilla(c.i);
    ul.appendChild(li);
  });
  // avisos
  const av = $('#avisos'); av.innerHTML = '';
  R.avisos.forEach(a => {
    const li = document.createElement('li'); li.className = a.tipo; li.textContent = a.txt;
    if (a.cost != null) { li.dataset.cost = a.cost; li.title = 'Ver la costilla ' + (a.cost + 1); li.onclick = () => selCostilla(a.cost); }
    av.appendChild(li);
  });
  $('#nAvisos').textContent = R.avisos.filter(a => a.tipo === 'error' || a.tipo === 'atencion').length;
  // resumen (siempre a tamaño real)
  const cm = calcularCompra(), largoV = cm.varillas.reduce((a, v) => a + v.largo, 0);
  $('#resumen').innerHTML = `<table>
    <tr><td>Medidas totales</td><td>${fmt(P.largo)} × ${fmt(G.fondo || 0)} × ${fmt(G.alto || 0)} mm</td></tr>
    <tr><td>Costillas</td><td>${R.n} de ${fmt(grosor(), 1)} mm</td></tr>
    <tr><td>Superficie de tablero</td><td>${fmt(cm.area / 1e6, 2)} m²</td></tr>
    <tr><td>Tableros ${fmt(cm.tablero[0])}×${fmt(cm.tablero[1])}</td><td>${cm.nTableros}</td></tr>
    <tr><td>${esc(VARILLA_TIPOS[P.varillas.tipo].nombre)} Ø${P.varillas.diam}</td><td>${cm.varillas.length} · ${fmt(largoV)} mm</td></tr>
    ${cm.nSep ? `<tr><td>Separadores Ø${P.varillas.sepD} × ${fmt(cm.hueco, 1)}</td><td>${cm.nSep}</td></tr>` : ''}
    ${cm.nTuercas ? `<tr><td>Tuercas y arandelas M${P.varillas.diam}</td><td>${cm.nTuercas}</td></tr>` : ''}
    <tr><td>Broca para los agujeros</td><td>Ø ${fmt(P.varillas.diam + P.varillas.holgura, 1)} mm</td></tr>
  </table>`;
  // maqueta
  const M = P.maqueta;
  $('#secMaqueta').classList.toggle('activa', M.activa);
  $('#maqCtl').classList.toggle('oculto', !M.activa);
  $('#bFabricar').innerHTML = '<span>🪚</span><span class="txt"> Fabricar</span>' + (M.activa ? '<span class="barra-maq">1:' + M.escala + '</span>' : '');
  if (M.activa) {
    const cf = calcularCompraFab(), mayor = R.costillas.reduce((m, c) => c.ok && c.caja.w * c.caja.h > m.w * m.h ? c.caja : m, { w: 0, h: 0 }), k = 1 / M.escala;
    $('#resMaq').innerHTML = `Mueble de <b>${fmt(P.largo * k)} × ${fmt((G.fondo || 0) * k)} × ${fmt((G.alto || 0) * k)}</b> mm · separación <b>${fmt(cf.sep, 1)}</b> mm · hueco <b>${fmt(Math.max(0, cf.hueco), 1)}</b> mm · costilla mayor ${fmt(mayor.w * k)} × ${fmt(mayor.h * k)} mm · <b>${cf.nTableros}</b> tablero${cf.nTableros === 1 ? '' : 's'} de ${fmt(cf.tablero[0])} × ${fmt(cf.tablero[1])}`;
  }
  $('#version').textContent = 'v' + VERSION;
  document.title = (P.nombre ? P.nombre + ' — ' : '') + 'Made-rebanadas';
}

// compra del mueble a tamaño real, aunque esté activa la maqueta
function calcularCompra() {
  const a = P.maqueta.activa; P.maqueta.activa = false;
  try { return calcularCompraFab(); } finally { P.maqueta.activa = a; }
}
