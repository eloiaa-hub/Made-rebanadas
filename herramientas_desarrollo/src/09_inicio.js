
/* ===================== INICIO ===================== */
function ponerTema(t) {
  document.documentElement.dataset.theme = t; lsSet('made-rebanadas.tema', t);
  colores3D(); if (VP) { VP.pintar(); VC.pintar(); }
}
function iniciar() {
  if (!T || !T.WebGLRenderer) { document.body.innerHTML = '<p style="padding:30px">No se encuentra <b>assets/js/three-bundle.js</b>. Copia la carpeta completa del programa.</p>'; return; }
  const tema = lsGet('made-rebanadas.tema', window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = tema;
  P = proyectoDePlantilla('banco');
  iniciarEditor(); iniciarHuecos(); iniciarPanel(); iniciar3D(); arrastrarModal();
  $('#bNuevo').onclick = dialogoNuevo;
  $('#bAbrir').onclick = abrirArchivo;
  $('#bGuardar').onclick = guardarArchivo;
  $('#bEjemplo').onclick = dialogoEjemplos;
  $('#bDeshacer').onclick = () => irHistoria(-1);
  $('#bRehacer').onclick = () => irHistoria(1);
  $('#bDespiece').onclick = abrirDespiece;
  $('#bFabricar').onclick = abrirFabricar;
  $('#bImagen').onclick = imagenPNG;
  $('#b3D').onclick = dialogo3D;
  $('#bPlano').onclick = exportarPlano;
  $('#bAnidador').onclick = abrirAnidador;
  $('#anidCerrar').onclick = cerrarAnidador;
  $('#bTema').onclick = () => ponerTema(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  $('#bAyuda').onclick = () => window.open('ayuda/manual.html', '_blank');
  $('#mCerrar').onclick = cerrarModal;
  $('#modal').addEventListener('pointerdown', ev => { if (ev.target.id === 'modal') cerrarModal(); });
  document.addEventListener('keydown', ev => {
    const enCampo = /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
    if ((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && ev.key.toLowerCase() === 'z') { if (enCampo) return; ev.preventDefault(); irHistoria(-1); return; }
    if ((ev.ctrlKey || ev.metaKey) && (ev.key.toLowerCase() === 'y' || (ev.shiftKey && ev.key.toLowerCase() === 'z'))) { if (enCampo) return; ev.preventDefault(); irHistoria(1); return; }
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') { ev.preventDefault(); guardarArchivo(); return; }
    if (!$('#anidVentana').classList.contains('oculto')) return;
    if (enCampo || !$('#modal').classList.contains('oculto')) { if (ev.key === 'Escape') cerrarModal(); return; }
    if (ev.key === 'Escape') { UI.modo = 'normal'; UI.punto = -1; UI.varilla = -1; VP.pintar(); }
    else if (ev.key === 'Delete' || ev.key === 'Backspace') {
      if (UI.vistaHuecos && huecoSel()) borrarHueco(UI.hueco);
      else if (UI.varilla >= 0) { P.varillas.lista.splice(UI.varilla, 1); UI.varilla = -1; cambio('Varilla quitada'); }
      else if (UI.punto >= 0) borrarPunto(UI.punto);
    }
    else if (ev.key.toLowerCase() === 'e') alternarEsquina(UI.punto);
    else if (ev.key.toLowerCase() === 'f') { camara('tres4'); encuadrarPerfil(); encuadrarCostilla(); }
    else if (ev.key === 'ArrowLeft') selCostilla(UI.costilla - 1);
    else if (ev.key === 'ArrowRight') selCostilla(UI.costilla + 1);
    else if (ev.key === 'PageUp') { UI.clave = Math.max(0, UI.clave - 1); UI.punto = -1; refrescarClaves(); VP.pintar(); construirClaves3D(); costillaDeClave(); }
    else if (ev.key === 'PageDown') { UI.clave = Math.min(P.claves.length - 1, UI.clave + 1); UI.punto = -1; refrescarClaves(); VP.pintar(); construirClaves3D(); costillaDeClave(); }
  });
  window.addEventListener('beforeunload', ev => { if (UI.sucio) { ev.preventDefault(); ev.returnValue = ''; } });
  // espera a que las vistas tengan tamaño
  requestAnimationFrame(() => { ajustar3D(); VP.ajustar(); VC.ajustar(); cargarProyecto(P, true); });
}
// para las pruebas automáticas
window.MadeRebanadas = { get P() { return P; }, get R() { return R; }, calcular: () => { const t = performance.now(); R = calcular(); return performance.now() - t; }, autoVar: () => autoVarillas(P.varillas.autoN), construir3D: () => { const t = performance.now(); construir3D(); return performance.now() - t; }, cargar: o => cargarProyecto(validarProyecto(o)), dxf: () => dxf(), svg: () => svg(), plano: () => planoPDF(), malla3D: o => piezasMalla3D(o || {}), pieza: i => piezaCalcador([...R.costillas, ...R.otras][i]), geo: i => geoFab([...R.costillas, ...R.otras][i]), camara: t => camara(t), selCostilla: i => selCostilla(i),
  leerDXF: t => leerDXF(t), colocar: () => colocarEnTableros(fabActual()), compra: () => listaCompra(), despiece: () => filasDespiece(), csvCortes: () => { let out; const d0 = descargar; descargar = (n, c) => { out = c; }; try { exportarCSVCortes(); } finally { descargar = d0; } return out; }, vetaDe: c => vetaDe(c), ponVeta: (c, v) => ponVeta(c, v),
  pantallaPunto: i => { const k = claveActual().pts[i], r = $('#cPerfil').getBoundingClientRect(), q = VP.aPantalla(k[0], k[1]); return [r.left + q[0], r.top + q[1]]; },
  pantallaVarilla: i => { const k = P.varillas.lista[i], r = $('#cPerfil').getBoundingClientRect(), q = VP.aPantalla(k[0], k[1]); return [r.left + q[0], r.top + q[1]]; } };
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar); else iniciar();
})();
