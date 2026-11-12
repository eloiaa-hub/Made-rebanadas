
/* ===================== ANIDADOR DE TABLEROS (assets/anidador) =====================
   Se abre en una ventana dentro del programa. Cuando avisa «anidador-listo», recibe las costillas
   como piezas del Calcador (contorno exterior y agujeros de las varillas) y las medidas del tablero. */
const PUENTES0 = { n: 0, ancho: 5, alto: 2 };
function piezaCalcador(c) {
  const g = geoFab(c), b = g.caja, r3 = v => +v.toFixed(3);
  const cc = contornoCNC(g.poly), ext = cc.pts.map(p => ({ x: r3(p[0] - b.x0), y: r3(p[1] - b.y0) }));
  const contornos = [{ pts: ext, b: cc.b.map(v => +v.toFixed(6)), cerrado: true, tipo: 'exterior', mec: { op: 'corte', prof: null, puentes: { ...PUENTES0 } } }];
  // cada agujero: círculo de dos medias vueltas (bulge 1)
  g.agujeros.forEach(a => {
    const x = a[0] - b.x0, y = a[1] - b.y0;
    contornos.push({ pts: [{ x: r3(x + a[2]), y: r3(y) }, { x: r3(x - a[2]), y: r3(y) }], b: [1, 1], cerrado: true, tipo: 'interior', mec: { op: 'corte', prof: null, puentes: { ...PUENTES0 } } });
  });
  return { nombre: c.nombre, cantidad: 1, veta: false, calcador: { contornos } };
}
let tAnid = 0;
function abrirAnidador() {
  if (!R) return;
  const n = piezasFab().length;
  if (!n) { aviso('No hay costillas que colocar.'); return; }
  UI.anidListo = false;
  $('#anidInfo').textContent = `${P.nombre}: ${n} piezas · ${textoEscala()} · tablero de ${fmt(grosorFab(), 1)} mm`;
  const caja = $('#anidCaja'); caja.innerHTML = '';
  const fr = document.createElement('iframe'); fr.src = 'assets/anidador/anidador.html?desde=rebanadas'; fr.title = 'Anidador de tableros';
  caja.appendChild(fr); UI.anidFrame = fr;
  $('#anidAviso').classList.add('oculto'); $('#anidVentana').classList.remove('oculto');
  clearTimeout(tAnid); tAnid = setTimeout(() => { if (!UI.anidListo) $('#anidAviso').classList.remove('oculto'); }, 7000);
}
function cerrarAnidador() {
  $('#anidVentana').classList.add('oculto'); $('#anidCaja').innerHTML = ''; UI.anidFrame = null; clearTimeout(tAnid);
}
window.addEventListener('message', e => {
  const d = e.data; if (!d || d.tipo !== 'anidador-listo' || !UI.anidFrame || e.source !== UI.anidFrame.contentWindow) return;
  UI.anidListo = true; $('#anidAviso').classList.add('oculto');
  const f = fabActual();
  e.source.postMessage({
    tipo: 'rebanadas-piezas',
    nombre: P.nombre + (enMaqueta() ? ` (maqueta 1:${P.maqueta.escala})` : ''),
    piezas: piezasFab().map(piezaCalcador),
    tablero: { largo: f.ancho, ancho: f.alto, grosor: grosorFab(), margen: f.borde, modo: 'forma' },
  }, '*');
});
