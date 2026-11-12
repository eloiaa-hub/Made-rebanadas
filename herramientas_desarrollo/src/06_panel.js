
/* ===================== PANELES ===================== */
let tRecalc = 0;
// recalcula costillas y lo dibuja todo
function recalcular() {
  R = calcular();
  UI.costilla = clamp(UI.costilla, 0, nPiezas() - 1);
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
  sp.onchange = () => {
    if (P.editado && !confirm('Se perderán los retoques hechos a mano en los perfiles. ¿Cambiar de plantilla?')) { sp.value = P.plantilla; return; }
    P.plantilla = sp.value; P.params = paramsDefecto(sp.value); P.nombre = PLANTILLAS[sp.value].nombre;
    aplicarPlantilla(); UI.clave = 0;
    if (P.tipo === 'costillas') { R = calcular(); autoVarillas(P.varillas.autoN); }
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
  // tipo de mueble y retícula
  enlazar('#sTipo', () => {
    const nuevo = $('#sTipo').value, gN = grupoTipo(nuevo);
    if (gN !== grupoDe(P.plantilla) && P.editado && !confirm('Este tipo de mueble usa otras plantillas: se perderán los retoques de los perfiles. ¿Seguir?')) { $('#sTipo').value = P.tipo; return; }
    P.tipo = nuevo;
    if (gN !== grupoDe(P.plantilla)) {
      const id = Object.keys(PLANTILLAS).find(k => grupoDe(k) === gN);
      P.plantilla = id; P.params = paramsDefecto(id); P.nombre = PLANTILLAS[id].nombre; aplicarPlantilla(); UI.clave = 0;
    }
    if (P.tipo === 'radial') { P.costillas.modo = 'numero'; P.costillas.numero = clamp(P.costillas.numero, 3, 48); if (P.costillas.numero > 24) P.costillas.numero = 12;
      if (grosor() > 10 && confirm('Las piezas radiales (lámparas) suelen hacerse con tablero fino. ¿Pasar a contrachapado de 6 mm?')) P.costillas.grosor = 6;
      const tMin = Math.ceil(P.costillas.numero * (grosor() + 1) / Math.PI); if (P.radial.tubo < tMin) P.radial.tubo = tMin; }
    if (P.tipo === 'pared') {
      if (grosor() > 12 && confirm('Los paneles de pared suelen hacerse con lamas de 12 mm, bastante juntas. ¿Pasar a tablero de 12 mm?')) P.costillas.grosor = 12;
      P.costillas.modo = 'separacion';
      if (P.costillas.separacion > 2.5 * grosor()) P.costillas.separacion = Math.round(2.2 * grosor());
    }
    if (P.tipo === 'reticula' && P.costillas.modo === 'separacion' && P.costillas.separacion < 3 * grosor()) P.costillas.separacion = Math.round(Math.max(100, 6 * grosor()));
    if (P.tipo !== 'radial' && P.costillas.modo === 'numero' && grupoDe(P.plantilla) !== 'radial') P.costillas.modo = 'separacion';
    R = calcular();
    if (P.tipo === 'costillas' && !P.varillas.lista.length) autoVarillas(P.varillas.autoN);
    UI.costilla = 0; ponerControles();
    cambio({ costillas: 'Costillas con varillas', reticula: 'Retícula entrelazada', radial: 'Rebanadas radiales', pared: 'Panel de pared' }[P.tipo]);
    encuadrarSiHaceFalta(); camara('tres4');
  });
  // relieve: texto o modelo 3D
  LETRAS_SISTEMA.forEach(l => $('#rlLetra').add(new Option(l, l)));
  const Rl = () => P.relieve;
  enlazar('#sOrigen', () => {
    Rl().fuente = $('#sOrigen').value;
    if (relieveActivo() && P.pared.rastreles && Rl().fondo < P.pared.grueso + 15) Rl().fondo = P.pared.grueso + 15;
    UI.costilla = 0; ponerControles(); cambio({ plantilla: 'Forma desde la plantilla', texto: 'Relieve de texto', modelo: 'Relieve desde un modelo 3D' }[Rl().fuente]);
    encuadrarSiHaceFalta(); camara('tres4');
  });
  const num = (sel, k, min = 0) => enlazar(sel, () => { Rl()[k] = Math.max(min, +$(sel).value || 0); cambio(); });
  num('#rlTam', 'tamLetra', 5); num('#rlFondo', 'fondo', 2); num('#rlRelieve', 'relieve'); num('#rlSuave', 'suavizado'); num('#rlOnda', 'ondaAmp'); num('#rlOndas', 'ondas', 0.5); num('#rlInter', 'interlinea', 0.5);
  enlazar('#rlBase', () => { Rl().base = clamp(+$('#rlBase').value || 0, 0, 0.9); cambio(); });
  const medida = (sel, k) => enlazar(sel, () => { Rl()[k] = Math.max(100, +$(sel).value || 500); if (Rl().fuente === 'modelo') reproyectarModelo(); cambio(); encuadrarSiHaceFalta(); camara('tres4'); });
  medida('#rlAncho', 'ancho'); medida('#rlAlto', 'alto');
  enlazar('#rlLetra', () => { Rl().letra = $('#rlLetra').value; cambio(); });
  enlazar('#rlNegrita', () => { Rl().negrita = $('#rlNegrita').checked; cambio(); });
  enlazar('#rlInvertir', () => { Rl().invertir = $('#rlInvertir').checked; cambio(); });
  let tTexto = 0;
  $('#rlTexto').addEventListener('input', () => { clearTimeout(tTexto); tTexto = setTimeout(() => { Rl().texto = $('#rlTexto').value; cambio('Texto'); }, 450); });
  const vista = () => { Rl().vista = $('#rlVista').value; Rl().giro = +$('#rlGiro').value; if (reproyectarModelo()) cambio('Vista del modelo'); else aviso('Para cambiar la vista, vuelve a cargar el modelo (el proyecto guarda solo su relieve).', 5000); };
  enlazar('#rlVista', vista); enlazar('#rlGiro', vista);
  $('#bCargarModelo').onclick = () => {
    const f = $('#fModelo'); f.value = '';
    f.onchange = () => {
      const a = f.files[0]; if (!a) return;
      aviso('Leyendo ' + esc(a.name) + '…');
      const rd = new FileReader();
      rd.onload = () => { try { const n = cargarModelo(rd.result, a.name); ponerControles(); cambio('Modelo: ' + a.name); encuadrarSiHaceFalta(); camara('tres4'); aviso(`${esc(a.name)}: ${n.toLocaleString('es-ES')} triángulos`); } catch (e) { aviso('⚠ ' + esc(e.message), 5000); } };
      rd.readAsArrayBuffer(a);
    };
    f.click();
  };
  $('#bModeloEjemplo').onclick = dialogoModelos;
  enlazar('#paOrient', () => { Rl().orient = $('#paOrient').value; cambio(Rl().orient === 'h' ? 'Lamas horizontales' : 'Lamas verticales'); encuadrarSiHaceFalta(); camara('tres4'); });
  // planta curva
  enlazar('#plForma', () => { P.planta.forma = $('#plForma').value; mostrarSecciones(); cambio('Planta ' + $('#plForma').selectedOptions[0].text.toLowerCase()); camara('tres4'); });
  enlazar('#plRadio', () => { P.planta.radio = Math.max(150, +$('#plRadio').value || 2500); cambio(); });
  enlazar('#plSentido', () => { P.planta.sentido = +$('#plSentido').value; cambio(); });
  enlazar('#plAmp', () => { P.planta.amplitud = Math.max(0, +$('#plAmp').value || 0); cambio(); });
  enlazar('#plOndas', () => { P.planta.ondas = clamp(+$('#plOndas').value || 1, 0.5, 4); cambio(); });
  // radial
  enlazar('#raNum', () => { P.costillas.numero = clamp(Math.round(+$('#raNum').value || 12), 3, 120); cambio(P.costillas.numero + ' costillas'); });
  enlazar('#raTubo', () => { P.radial.tubo = Math.max(4, +$('#raTubo').value || 20); cambio(); });
  enlazar('#raHolTubo', () => { P.radial.holguraTubo = Math.max(0, +$('#raHolTubo').value || 0); cambio(); });
  enlazar('#raDiscos', () => { P.radial.discos = clamp(Math.round(+$('#raDiscos').value || 0), 0, 6); cambio(); });
  enlazar('#raRDisco', () => { P.radial.rDisco = Math.max(0, +$('#raRDisco').value || 0); cambio(); });
  enlazar('#raHolgura', () => { P.radial.holgura = clamp(+$('#raHolgura').value || 0, 0, 3); cambio(); });
  // pared
  enlazar('#paNum', () => { P.pared.rastreles = clamp(Math.round(+$('#paNum').value || 0), 0, 10); cambio(); });
  enlazar('#paAlto', () => { P.pared.alto = Math.max(10, +$('#paAlto').value || 45); cambio(); });
  enlazar('#paGrueso', () => { P.pared.grueso = Math.max(5, +$('#paGrueso').value || 20); cambio(); });
  enlazar('#paMargen', () => { P.pared.margen = Math.max(0, +$('#paMargen').value || 0); cambio(); });
  enlazar('#paHolgura', () => { P.pared.holgura = clamp(+$('#paHolgura').value || 0, 0, 3); cambio(); });
  enlazar('#paVer', () => { P.pared.verPared = $('#paVer').checked; construir3D(); });
  enlazar('#cClaves3d', () => { P.vista.claves = $('#cClaves3d').checked; construirClaves3D(); });
  enlazar('#rNum', () => { P.reticula.num = clamp(Math.round(+$('#rNum').value || 1), 1, 20); cambio(P.reticula.num + ' largueros'); });
  enlazar('#rMargen', () => { P.reticula.margen = Math.max(0, +$('#rMargen').value || 0); cambio(); });
  enlazar('#rVuelo', () => { P.reticula.vuelo = Math.max(0, +$('#rVuelo').value || 0); cambio(); });
  enlazar('#rHolgura', () => { P.reticula.holgura = clamp(+$('#rHolgura').value || 0, 0, 3); cambio(); });
  enlazar('#rArriba', () => { P.reticula.xArriba = $('#rArriba').value === '1'; cambio(); });
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
    const c = piezaSel(); if (!c || c.z) { aviso('Selecciona antes una costilla (no un larguero).'); return; }
    const x = Math.round(c.x * 10) / 10;
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
// plantillas del grupo del tipo de mueble
function llenarPlantillas() {
  const sp = $('#sPlantilla'), g = grupoTipo(P.tipo); sp.innerHTML = '';
  Object.entries(PLANTILLAS).forEach(([id, pl]) => { if ((pl.grupo || 'lineal') === g) sp.add(new Option(pl.nombre, id)); });
  sp.value = P.plantilla;
}
// enseña los apartados de cada tipo de mueble
function mostrarSecciones() {
  const t = P.tipo;
  $('#secVarillas').classList.toggle('oculto', t !== 'costillas');
  $('#secReticula').classList.toggle('oculto', t !== 'reticula');
  $('#secPlanta').classList.toggle('oculto', t !== 'costillas');
  $('#secRadial').classList.toggle('oculto', t !== 'radial');
  $('#secPared').classList.toggle('oculto', t !== 'pared');
  $$('.filaArco').forEach(f => f.classList.toggle('oculto', P.planta.forma !== 'arco'));
  $$('.filaS').forEach(f => f.classList.toggle('oculto', P.planta.forma !== 's'));
  const rad = t === 'radial';
  $('#cModo').closest('label').classList.toggle('oculto', rad);
  $('#filaSep').classList.toggle('oculto', rad || P.costillas.modo !== 'separacion');
  $('#filaNum').classList.toggle('oculto', rad || P.costillas.modo !== 'numero');
  $('#kPosTit').textContent = rad ? 'Posición (°)' : 'Posición (mm)';
  // relieve (paneles de pared)
  const rel = relieveActivo(), Rl = P.relieve;
  $('#filaOrigen').classList.toggle('oculto', t !== 'pared');
  $('#filaPlantilla').classList.toggle('oculto', rel); $('#params').classList.toggle('oculto', rel); $('#descPlantilla').classList.toggle('oculto', rel);
  $('#secRelieve').classList.toggle('oculto', !rel);
  $('#relTexto').classList.toggle('oculto', Rl.fuente !== 'texto'); $('#relModelo').classList.toggle('oculto', Rl.fuente !== 'modelo');
  $('#secClaves').classList.toggle('oculto', rel);
  $('#sClave').classList.toggle('oculto', rel); $('#bEsquina').classList.toggle('oculto', rel); $('#infoClave').classList.toggle('oculto', rel);
}
function ponerControles() {
  llenarPlantillas();
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
  $('#sTipo').value = P.tipo; const Rt = P.reticula; $('#rNum').value = Rt.num; $('#rMargen').value = Rt.margen; $('#rVuelo').value = Rt.vuelo; $('#rHolgura').value = Rt.holgura; $('#rArriba').value = Rt.xArriba !== false ? '1' : '0';
  const Pl = P.planta; $('#plForma').value = Pl.forma; $('#plRadio').value = Pl.radio; $('#plSentido').value = String(Pl.sentido === -1 ? -1 : 1); $('#plAmp').value = Pl.amplitud; $('#plOndas').value = Pl.ondas;
  const Ra = P.radial; $('#raNum').value = P.costillas.numero; $('#raTubo').value = Ra.tubo; $('#raHolTubo').value = Ra.holguraTubo; $('#raDiscos').value = Ra.discos; $('#raRDisco').value = Ra.rDisco; $('#raHolgura').value = Ra.holgura;
  const Pa = P.pared; $('#paNum').value = Pa.rastreles; $('#paAlto').value = Pa.alto; $('#paGrueso').value = Pa.grueso; $('#paMargen').value = Pa.margen; $('#paHolgura').value = Pa.holgura; $('#paVer').checked = Pa.verPared;
  $('#cClaves3d').checked = P.vista.claves !== false;
  const Rl = P.relieve; $('#sOrigen').value = P.tipo === 'pared' ? Rl.fuente : 'plantilla'; $('#paOrient').value = Rl.orient || 'v';
  $('#rlTexto').value = Rl.texto; $('#rlLetra').value = Rl.letra; $('#rlNegrita').checked = Rl.negrita; $('#rlTam').value = Rl.tamLetra; $('#rlInter').value = Rl.interlinea;
  $('#rlVista').value = Rl.vista; $('#rlGiro').value = String(Rl.giro || 0); $('#rlBase').value = Rl.base;
  $('#rlAncho').value = Rl.ancho; $('#rlAlto').value = Rl.alto; $('#rlFondo').value = Rl.fondo; $('#rlRelieve').value = Rl.relieve; $('#rlSuave').value = Rl.suavizado; $('#rlInvertir').checked = Rl.invertir; $('#rlOnda').value = Rl.ondaAmp; $('#rlOndas').value = Rl.ondas;
  $('#rlModeloInfo').textContent = Rl.modelo ? `Modelo: ${Rl.modelo.nombre}` + (Rl.modelo.triangulos ? ` (${Rl.modelo.triangulos.toLocaleString('es-ES')} triángulos)` : '') + (mallaVigente() ? '' : '. El proyecto guarda su relieve; para cambiar la vista, vuelve a cargarlo.') : 'Sin modelo. Carga un STL u OBJ (rostro, figura, logo en 3D…).';
  mostrarSecciones();
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
  $('#infoClave').textContent = P.tipo === 'radial' ? `a ${fmt(k.x, 1)}°` : `en x = ${fmt(k.x)} mm (${fmt(k.x / P.largo * 100)} %)`;
  if (G.modelo) construirClaves3D();
  $('#kPos').value = k.x;
  $('#nClaves').textContent = C.length;
  const ul = $('#listaClaves'); ul.innerHTML = '';
  C.forEach((o, i) => {
    const li = document.createElement('li'); li.className = i === UI.clave ? 'sel' : '';
    li.innerHTML = `<span class="icono">◆</span><span class="nom">Perfil clave ${i + 1}</span><span class="pos">${P.tipo === 'radial' ? '' : 'x '}${textoPos(o.x)}</span>`;
    li.onclick = () => { UI.clave = i; UI.punto = -1; refrescarClaves(); VP.pintar(); };
    ul.appendChild(li);
  });
  $('#avisoEditado').classList.toggle('oculto', !P.editado);
}

function refrescarListas() {
  // resumen del reparto
  $('#resCost').innerHTML = P.tipo === 'radial' ? `<b>${R.n}</b> costillas cada <b>${fmt(R.sep, 1)}°</b> · junto al tubo quedan <b>${fmt(Math.max(0, R.hueco), 1)}</b> mm entre ellas`
    : `<b>${R.n}</b> ${P.tipo === 'pared' ? 'lamas' : 'costillas'} · separación <b>${fmt(R.sep, 1)}</b> mm · hueco <b>${fmt(Math.max(0, R.hueco), 1)}</b> mm`;
  // costillas y largueros
  const ret = P.tipo === 'reticula';
  $('#nCost').textContent = R.n + (R.otras.length ? ' + ' + R.otras.length : '');
  const malas = new Set(); R.avisos.forEach(a => { if (a.tipo === 'error') R.varillas.forEach(v => v.fallan.forEach(i => malas.add(i))); });
  if (P.tipo === 'costillas') R.costillas.forEach(c => { if (!c.ok || (P.varillas.lista.length && c.nVar === 0)) malas.add(c.i); });
  else if (!ret) { R.costillas.forEach(c => { if (!c.ok) malas.add(c.i); }); (R.ranurasMal || []).forEach(p => malas.add(p.i)); (R.discosMal || []).forEach(d => malas.add(d.i)); (R.rastrelesMal || []).forEach(i => malas.add(i)); }
  else { R.costillas.forEach(c => { if (!c.ok || !c.ranuras.length) malas.add(c.i); }); (R.ranurasMal || []).forEach(p => malas.add(p.i)); }
  const ul = $('#listaCost'); ul.innerHTML = '';
  [...R.costillas, ...R.otras].forEach(c => {
    const li = document.createElement('li'); li.className = c.i === UI.costilla ? 'sel' : '';
    li.innerHTML = `<span class="icono">${malas.has(c.i) ? '<span class="mal">!</span>' : c.disco ? '◎' : c.z ? '▬' : '▮'}</span><span class="nom">${c.nombre}</span><span class="med">${c.ok ? fmt(c.caja.w) + ' × ' + fmt(c.caja.h) : 'vacía'}</span>`;
    li.onclick = () => selCostilla(c.i);
    ul.appendChild(li);
  });
  // avisos
  const av = $('#avisos'); av.innerHTML = '';
  R.avisos.forEach(a => {
    const li = document.createElement('li'); li.className = a.tipo; li.textContent = a.txt;
    if (a.cost != null) { li.dataset.cost = a.cost; li.title = 'Ver la pieza'; li.onclick = () => selCostilla(a.cost); }
    av.appendChild(li);
  });
  $('#nAvisos').textContent = R.avisos.filter(a => a.tipo === 'error' || a.tipo === 'atencion').length;
  // resumen (siempre a tamaño real)
  const cm = calcularCompra(), largoV = cm.varillas.reduce((a, v) => a + v.largo, 0);
  $('#resumen').innerHTML = `<table>
    <tr><td>Medidas totales</td><td>${(G.dims || [0, 0, 0]).map(v => fmt(v)).join(' × ')} mm</td></tr>
    <tr><td>${P.tipo === 'pared' ? 'Lamas' : 'Costillas'}</td><td>${R.n} de ${fmt(grosor(), 1)} mm</td></tr>
    <tr><td>Superficie de tablero</td><td>${fmt(cm.area / 1e6, 2)} m²</td></tr>
    <tr><td>Tableros ${fmt(cm.tablero[0])}×${fmt(cm.tablero[1])}</td><td>${cm.nTableros}</td></tr>
    ${P.tipo === 'radial' ? `<tr><td>Tubo central</td><td>Ø ${fmt(P.radial.tubo)} mm</td></tr><tr><td>Discos de unión</td><td>${R.discos.length}</td></tr>`
    : P.tipo === 'pared' ? `<tr><td>Rastreles ${fmt(P.pared.alto)} × ${fmt(P.pared.grueso)}</td><td>${R.rastreles.length} de ${fmt(P.largo)} mm</td></tr>`
    : ret ? `<tr><td>Largueros</td><td>${R.largueros.length} de ${fmt(grosor(), 1)} mm</td></tr>
    <tr><td>Cruces a media madera</td><td>${R.cruces.length}</td></tr>
    <tr><td>Ancho de las ranuras</td><td>${fmt(grosor() + P.reticula.holgura, 2)} mm</td></tr>` : `
    <tr><td>${esc(VARILLA_TIPOS[P.varillas.tipo].nombre)} Ø${P.varillas.diam}</td><td>${cm.varillas.length} · ${fmt(largoV)} mm</td></tr>
    ${cm.nSep ? `<tr><td>Separadores Ø${P.varillas.sepD} × ${cm.sepMax - cm.sepMin > 0.2 ? fmt(cm.sepMin) + '–' + fmt(cm.sepMax) : fmt(cm.sepMin, 1)}</td><td>${cm.nSep}</td></tr>` : ''}
    ${cm.nTuercas ? `<tr><td>Tuercas y arandelas M${P.varillas.diam}</td><td>${cm.nTuercas}</td></tr>` : ''}
    <tr><td>Broca para los agujeros</td><td>Ø ${fmt(P.varillas.diam + P.varillas.holgura, 1)} mm</td></tr>`}
  </table>`;
  mostrarSecciones();
  if (ret) { const mz = R.largueros.reduce((m, z) => Math.max(m, z.caja.w), 0); $('#resRet').innerHTML = `<b>${R.largueros.length}</b> largueros (hasta ${fmt(mz)} mm de largo) · <b>${R.cruces.length}</b> cruces · ranura de <b>${fmt(grosor() + P.reticula.holgura, 2)}</b> mm`; }
  // maqueta
  const M = P.maqueta;
  $('#secMaqueta').classList.toggle('activa', M.activa);
  $('#maqCtl').classList.toggle('oculto', !M.activa);
  $('#bFabricar').innerHTML = '<span>🪚</span><span class="txt"> Fabricar</span>' + (M.activa ? '<span class="barra-maq">1:' + M.escala + '</span>' : '');
  if (M.activa) {
    const cf = calcularCompraFab(), mayor = R.costillas.reduce((m, c) => c.ok && c.caja.w * c.caja.h > m.w * m.h ? c.caja : m, { w: 0, h: 0 }), k = 1 / M.escala;
    $('#resMaq').innerHTML = `Mueble de <b>${(G.dims || [0, 0, 0]).map(v => fmt(v * k)).join(' × ')}</b> mm · ` + (P.tipo === 'radial' ? '' : `separación <b>${fmt(cf.sep, 1)}</b> mm · hueco <b>${fmt(Math.max(0, cf.hueco), 1)}</b> mm · `) + ` costilla mayor ${fmt(mayor.w * k)} × ${fmt(mayor.h * k)} mm · <b>${cf.nTableros}</b> tablero${cf.nTableros === 1 ? '' : 's'} de ${fmt(cf.tablero[0])} × ${fmt(cf.tablero[1])}`;
  }
  $('#version').textContent = 'v' + VERSION;
  document.title = (P.nombre ? P.nombre + ' — ' : '') + 'Made-rebanadas';
}

// compra del mueble a tamaño real, aunque esté activa la maqueta
function calcularCompra() {
  const a = P.maqueta.activa; P.maqueta.activa = false;
  try { return calcularCompraFab(); } finally { P.maqueta.activa = a; }
}
