
/* ===================== FICHA DE PRÁCTICA PARA ALUMNOS =====================
   El plano de montaje con una hoja de enunciado delante (datos del alumno, objetivos, tareas, registro de
   mediciones) y una rúbrica de evaluación al final. Los textos salen solos según el mueble y se pueden cambiar;
   se guardan con el proyecto (P.ficha). */
const NIVELES_RUBRICA = ['Excelente (4)', 'Bien (3)', 'Suficiente (2)', 'Insuficiente (1)'];
const RUBRICA_BASE = [
  ['Interpretación del plano', 10, 'Lee todas las vistas, cotas y uniones sin ayuda', 'Con alguna duda puntual', 'Necesita ayuda con varias cotas o uniones', 'No interpreta el plano'],
  ['Preparación del CAM (DXF, fresa, holgura, colocación)', 20, 'Archivo correcto a la primera y buen aprovechamiento del tablero', 'Pequeños errores que corrige por su cuenta', 'Errores que corrige con ayuda', 'El archivo no sirve para cortar'],
  ['Mecanizado y seguridad', 20, 'Sujeción, cero, EPI y orden correctos; sin incidencias', 'Algún descuido menor', 'Necesita que se le recuerden las normas', 'Pone en riesgo la máquina o a las personas'],
  ['Precisión de las piezas', 20, 'Medidas a +/- 0,5 mm y uniones que entran a mano', 'A +/- 1 mm; ajustes con poco repaso', 'A +/- 2 mm; hay que repasar varias uniones', 'Piezas fuera de medida'],
  ['Montaje', 15, 'En orden, a escuadra y sin forzar', 'Pequeños desajustes', 'Necesita ayuda o fuerza las uniones', 'No llega a montarlo'],
  ['Acabado y limpieza', 10, 'Lijado y acabado uniformes; puesto limpio', 'Algún defecto menor', 'Defectos a la vista', 'Sin acabar'],
  ['Organización y tiempo', 5, 'Dentro del tiempo y con el registro completo', 'Ligero retraso', 'Retraso notable o registro incompleto', 'No termina'],
];
function fichaP() { return P.ficha = Object.assign(proyectoBase().ficha, P.ficha || {}); }
const lineas = t => String(t || '').split('\n').map(s => s.trim()).filter(Boolean);
function fichaDefecto() {
  const pl = esPlano(), r = calcularPresupuesto(), maq = enMaqueta();
  const horas = Math.max(2, Math.ceil(r.minTotal / 60 * 1.5 + (pl ? 1 : 2) + R.n * 0.05));
  const obj = [
    'Interpretar un plano de fabricación con vistas acotadas, despiece y orden de montaje.',
    esApilado() ? 'Pasar un modelo 3D a capas (planos seriados) y preparar el archivo de corte (DXF) con las llaves de alineación y su holgura.' : `Preparar el archivo de corte (DXF) con la fresa, la holgura de las ${pl || P.tipo === 'reticula' ? 'uniones' : 'ranuras y agujeros'} y el hueso de perro adecuados.`,
    'Colocar las piezas en el tablero aprovechando el material.',
    `Mecanizar las piezas en ${maq ? 'la cortadora láser' : 'la CNC'} con seguridad y comprobar sus medidas.`,
    esApilado() ? 'Montar una figura de planos seriados: pegar las capas de abajo arriba, alineadas con las llaves, y repasar los escalones.'
      : pl && R.uniones.some(u => u.tipo === 'herraje') ? `Montar un mueble de kit con uniones a tope y ${NOMBRE_HERRAJE[planoP().herraje]}, y hacer a mano los taladros de canto con una guía.`
      : pl ? 'Montar un mueble de piezas planas con uniones a media madera, caja y espiga o dentadas, sin herrajes.'
      : P.tipo === 'costillas' ? 'Montar un mueble de costillas con varillas y separadores, en orden y a escuadra.'
      : 'Montar el mueble en el orden del plano y comprobar que ajusta.',
  ];
  const tar = [
    'Estudia el plano: vistas acotadas, piezas y uniones. Comprueba en las vistas el ancho, el fondo y el alto.',
    'Mide el grosor real del tablero con el calibre en tres puntos y corta la pieza de prueba de holgura (Fabricar). Apunta la holgura elegida en el registro.',
    'Prepara el DXF en Fabricar y coloca las piezas en el tablero. Apunta cuántos tableros necesitas.',
    `Mecaniza las piezas. Mide con el calibre ${pl ? 'dos piezas y el ancho de una ranura o caja' : 'dos piezas y un agujero'} y apúntalo en el registro.`,
    'Lija y numera las piezas (cara que no se vea) y monta el mueble en el orden del plano.',
    'Da el acabado. Compara el tiempo y el coste reales con los de Fabricar > Tiempo y presupuesto.',
  ];
  return { titulo: 'Práctica: ' + P.nombre, modulo: '', duracion: `${horas} h`, objetivos: obj.join('\n'), tareas: tar.join('\n'),
    entrega: 'El mueble montado y acabado, el archivo DXF y esta ficha con el registro de mediciones.',
    criterios: RUBRICA_BASE.map(c => c.join(' | ')).join('\n') };
}
function fichaTextos() {   // lo escrito por el profesor o, si está vacío, lo de por defecto
  const F = fichaP(), d = fichaDefecto(), o = {};
  Object.keys(d).forEach(k => o[k] = String(F[k] || '').trim() ? F[k] : d[k]);
  return Object.assign({}, F, o);
}
function criteriosRubrica(t) {
  return lineas(t).map(l => {
    const p = l.split('|').map(s => s.trim()), base = RUBRICA_BASE.find(b => b[0].toLowerCase() === (p[0] || '').toLowerCase());
    const gen = ['Lo hace sin errores y con autonomía', 'Con pequeños errores', 'Con errores que corrige con ayuda', 'No lo consigue'];
    return { nombre: p[0] || '—', peso: isFinite(+String(p[1]).replace(',', '.')) && p[1] !== '' ? +String(p[1]).replace(',', '.') : (base ? base[1] : 10),
      niveles: [2, 3, 4, 5].map((k, i) => p[k] || (base ? base[k] : gen[i])) };
  }).filter(c => c.nombre !== '—');
}
function hojaEnunciado(D, cabecera, o) {
  const { M, W, H, gris, azul, madera, F } = o;
  cabecera('Enunciado de la práctica');
  // título y casillas del alumno
  D.texto(M, M + 23, F.titulo, { pt: 15, b: true });
  const sub = [F.modulo, F.duracion ? 'Duración: ' + F.duracion : ''].filter(Boolean).join(' · ');
  if (sub) D.texto(M, M + 29, sub, { pt: 9.5, col: gris });
  const yA = M + 33, cajas = [['Alumno/a', 110], ['Grupo', 40], ['Fecha', 40], ['Nota', 25]];
  let xA = M;
  cajas.forEach(([t, w]) => { D.trazo([170, 170, 170]).grosor(0.25).rect(xA, yA, w, 9).trazo(); D.texto(xA + 1.5, yA + 3.3, t, { pt: 6.5, col: gris }); xA += w + 4; });
  // imagen del mueble
  const cap = captura3D(), iw = 112, ih = Math.min(80, iw * cap.h / cap.w), wImg = ih * cap.w / cap.h;   // sin deformar
  D.imagen(cap.bin, cap.w, cap.h, M + (iw - wImg) / 2, yA + 14, wImg, ih);
  D.trazo([210, 210, 210]).grosor(0.2).rect(M, yA + 14, iw, ih).trazo();
  // registro de mediciones, bajo la imagen
  let yR = yA + 14 + ih + 7;
  D.texto(M, yR, 'Registro de mediciones', { pt: 9.5, b: true, col: azul }); yR += 2.5;
  const cols = [['Medida', 40], ['Plano (mm)', 24], ['Real (mm)', 24], ['Diferencia', 24]], filas = ['Grosor del tablero', 'Holgura elegida', 'Pieza …', 'Pieza …', 'Ranura / caja / agujero', 'Tableros usados', 'Tiempo de máquina'];
  const fh = 5.2;
  let xx = M; cols.forEach(([t, w]) => { D.relleno([236, 241, 248]).rect(xx, yR, w, fh, 'f').relleno([0, 0, 0]); D.texto(xx + 1.5, yR + 3.9, t, { pt: 7, b: true }); xx += w; });
  filas.forEach((t, i) => { const y = yR + fh * (i + 1); xx = M; cols.forEach(([, w], j) => { D.trazo([200, 200, 200]).grosor(0.2).rect(xx, y, w, fh).trazo(); if (!j) D.texto(xx + 1.5, y + 3.9, t, { pt: 7 }); xx += w; }); });
  // a la derecha: objetivos, tareas y entrega
  const x2 = M + iw + 9, a2 = W - M - x2;
  let y = yA + 17;
  const bloque = (titulo, items, num) => {
    D.texto(x2, y, titulo, { pt: 10, b: true, col: azul }); y += 5;
    items.forEach((t, i) => {
      if (num) { D.relleno(madera).circulo(x2 + 2.4, y - 1.1, 2.3, 'f').relleno([0, 0, 0]); D.texto(x2 + 2.4, y - 0.1, String(i + 1), { pt: 7.5, b: true, al: 'c', col: [255, 255, 255] }); }
      else D.relleno(madera).circulo(x2 + 1.6, y - 1.1, 0.8, 'f').relleno([0, 0, 0]);
      y = D.parrafo(x2 + (num ? 6.5 : 4.5), y, a2 - (num ? 6.5 : 4.5), t, { pt: 8.5 }) + 1.2;
    });
    y += 2.5;
  };
  bloque('Objetivos', lineas(F.objetivos));
  bloque('Tareas', lineas(F.tareas), true);
  if (String(F.entrega || '').trim()) { D.texto(x2, y, 'Qué se entrega', { pt: 10, b: true, col: azul }); y = D.parrafo(x2, y + 5, a2, F.entrega, { pt: 8.5 }) + 2; }
  D.parrafo(x2, Math.max(y + 1, H - M - 22), a2, `Material: ${enMaqueta() ? `tablero de maqueta de ${fmt(P.maqueta.grosor, 1)} mm` : `${MATERIALES[P.costillas.material].nombre.toLowerCase()} de ${fmt(grosor(), 1)} mm`}. Las hojas siguientes traen el conjunto y la lista de compra, las vistas acotadas, las piezas, el corte y el montaje paso a paso; la última, la rúbrica de evaluación.`, { pt: 7.5, col: gris });
}
function hojaRubrica(D, cabecera, o) {
  const { M, W, H, gris, azul } = o, cs = criteriosRubrica(o.F.criterios), total = cs.reduce((s, c) => s + c.peso, 0) || 1;
  cabecera('Rúbrica de evaluación');
  const wC = 54, wP = 13, wN = 16, wL = (W - 2 * M - wC - wP - wN) / 4, cab = 7;
  let y = M + 18, x = M;
  [['Criterio', wC], ['Peso', wP], ...NIVELES_RUBRICA.map(n => [n, wL]), ['Nivel', wN]].forEach(([t, w]) => { D.relleno([31, 79, 138]).rect(x, y, w, cab, 'f').relleno([0, 0, 0]); D.texto(x + 1.5, y + 4.8, t, { pt: 8, b: true, col: [255, 255, 255] }); x += w; });
  y += cab;
  // altura de cada fila: la del texto más largo (se mide sin dibujar, con un documento de prueba)
  const prueba = new PDFDoc(); prueba.pagina(W, H);
  cs.forEach((c, i) => {
    const hTxt = Math.max(prueba.parrafo(0, 0, wC - 3, c.nombre, { pt: 8, b: true }), ...c.niveles.map(t => prueba.parrafo(0, 0, wL - 3, t, { pt: 7.5 })));
    const h = Math.max(11, hTxt + 3.5);
    if (i % 2) D.relleno([247, 248, 250]).rect(M, y, W - 2 * M, h, 'f').relleno([0, 0, 0]);
    x = M;
    D.parrafo(x + 1.5, y + 4.3, wC - 3, c.nombre, { pt: 8, b: true }); x += wC;
    D.texto(x + wP / 2, y + 4.3, fmt(Math.round(c.peso / total * 1000) / 10, 1) + ' %', { pt: 8, al: 'c' }); x += wP;
    c.niveles.forEach(t => { D.parrafo(x + 1.5, y + 4.3, wL - 3, t, { pt: 7.5 }); x += wL; });
    D.trazo([170, 170, 170]).grosor(0.25).rect(x + 3, y + 2.5, wN - 6, 6).trazo();
    D.trazo([215, 215, 215]).grosor(0.2).linea(M, y + h, W - M, y + h).trazo();
    y += h;
  });
  // líneas verticales de la tabla
  x = M; [wC, wP, wL, wL, wL, wL, wN].reduce((xx, w) => { D.trazo([215, 215, 215]).grosor(0.2).linea(xx, M + 18, xx, y).trazo(); return xx + w; }, M);
  D.trazo([215, 215, 215]).grosor(0.2).linea(W - M, M + 18, W - M, y).trazo();
  y += 6;
  D.texto(M, y, `Nota (sobre 10) = suma de (nivel × peso) / 40. Con todo en «Excelente» sale 10; con todo en «Suficiente», 5.`, { pt: 8.5, col: gris });
  D.texto(W - M - 30, y, 'Nota final:', { pt: 10, b: true, al: 'r', col: azul });
  D.trazo([170, 170, 170]).grosor(0.3).rect(W - M - 27, y - 5, 27, 8).trazo();
  y += 7;
  const hO = Math.max(14, H - M - 10 - y);
  D.trazo([190, 190, 190]).grosor(0.25).rect(M, y, W - 2 * M - 70, hO).rect(W - M - 64, y, 64, hO).trazo();
  D.texto(M + 2, y + 4, 'Observaciones', { pt: 8, b: true, col: gris });
  D.texto(W - M - 62, y + 4, 'Firma del profesor/a', { pt: 8, b: true, col: gris });
}
function fichaPDF() { return planoPDF(fichaTextos()); }
function exportarFicha() {
  if (!R) return;
  try {
    const b = fichaPDF();
    descargar(nombreArchivo(P.nombre) + '_ficha_practica' + sufijoFab() + '.pdf', new Blob([b], { type: 'application/pdf' }));
    aviso('Ficha de práctica guardada (PDF)');
  } catch (e) { console.error(e); aviso('⚠ No se pudo crear la ficha: ' + esc(e.message), 5000); }
}
function dialogoFicha() {
  if (!R) return;
  const F = fichaP(), d = fichaDefecto(), v = k => esc(String(F[k] || '').trim() ? F[k] : d[k]);
  modal('🎓 Ficha de práctica para alumnos', `
    <p class="nota">Un PDF para repartir: el <b>enunciado</b> (datos del alumno, objetivos, tareas y un registro de mediciones), el <b>plano</b> con las vistas acotadas, las piezas, el corte y el montaje, y una <b>rúbrica</b> de evaluación. Los textos salen solos del mueble; cámbialos a tu gusto (se guardan con el proyecto) o vacía un campo para volver al de por defecto.</p>
    <label class="fila">Título <input type="text" id="fiTit" value="${v('titulo')}" style="width:62%"></label>
    <label class="fila">Módulo o curso <input type="text" id="fiMod" value="${esc(F.modulo || '')}" placeholder="p. ej. Mecanizado por CNC · 1.º" style="width:62%"></label>
    <label class="fila">Duración <input type="text" id="fiDur" value="${v('duracion')}" style="width:62%"></label>
    <label class="bloque">Objetivos (uno por línea)<textarea id="fiObj" rows="5" style="width:100%">${v('objetivos')}</textarea></label>
    <label class="bloque">Tareas (una por línea; salen numeradas)<textarea id="fiTar" rows="6" style="width:100%">${v('tareas')}</textarea></label>
    <label class="bloque">Qué se entrega<textarea id="fiEnt" rows="2" style="width:100%">${v('entrega')}</textarea></label>
    <label class="bloque" title="Criterio | peso | Excelente | Bien | Suficiente | Insuficiente. Si solo pones el criterio y el peso, los niveles salen genéricos">Rúbrica: criterio | peso | excelente | bien | suficiente | insuficiente<textarea id="fiRub" rows="7" style="width:100%;font-size:12px">${v('criterios')}</textarea></label>
    <label class="fila chk"><input type="checkbox" id="fiCorte" ${F.corte !== false ? 'checked' : ''}> Incluir la colocación en los tableros (si no, la hacen los alumnos)</label>`,
    [['Textos por defecto', () => { P.ficha = proyectoBase().ficha; guardado(); dialogoFicha(); }], ['📄 Descargar la ficha (PDF)', () => { leer(); exportarFicha(); }, true]], true);
  const campos = { fiTit: 'titulo', fiMod: 'modulo', fiDur: 'duracion', fiObj: 'objetivos', fiTar: 'tareas', fiEnt: 'entrega', fiRub: 'criterios' };
  const leer = () => {   // solo se guarda lo que difiere del texto de por defecto
    Object.entries(campos).forEach(([id, k]) => { const t = $('#' + id).value; F[k] = t.trim() === String(d[k] || '').trim() ? '' : t; });
    F.corte = $('#fiCorte').checked; guardado();
  };
  Object.keys(campos).concat('fiCorte').forEach(id => $('#' + id).onchange = leer);
}
