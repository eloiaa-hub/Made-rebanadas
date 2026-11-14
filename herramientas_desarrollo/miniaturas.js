// Genera las miniaturas de las plantillas para la ventana «Mueble nuevo».
// Carga cada plantilla, hace una foto de la vista 3D y la guarda en assets/miniaturas/<id>.jpg.
// Uso:  node miniaturas.js        (necesita Playwright con Chromium: npm i playwright)
// Hay que ejecutarlo otra vez si se añade una plantilla o cambia su forma.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const raiz = path.resolve(__dirname, '..');
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
  p.on('dialog', d => d.accept());
  await p.goto('file://' + raiz + '/Made_Rebanadas.html');
  await p.addStyleTag({ content: '#aviso{display:none!important} #v3d > :not(canvas){display:none!important}' });
  await p.waitForTimeout(1500);
  const ids = await p.evaluate(() => { const bs = []; document.querySelector('#bNuevo').click(); document.querySelectorAll('[data-nuevo]').forEach(x => bs.push(x.dataset.nuevo)); return bs; });
  await p.click('#mPie button:last-child');   // cierra el diálogo antes de empezar
  const fs = require('fs'); fs.mkdirSync(raiz + '/assets/miniaturas', { recursive: true });
  for (const id of ids) {
    await p.click('#bNuevo'); await p.click(`[data-nuevo="${id}"]`); await p.waitForTimeout(1600);
    await p.evaluate(() => MadeRebanadas.camara('tres4')); await p.waitForTimeout(500);
    const v = await p.locator('#v3d').boundingBox();
    // recorte centrado 16:10 de la vista 3D
    let w = v.width, h = w * 10 / 16; if (h > v.height) { h = v.height; w = h * 16 / 10; }
    await p.screenshot({ path: raiz + `/assets/miniaturas/${id}.png`, clip: { x: v.x + (v.width - w) / 2, y: v.y + (v.height - h) / 2, width: w, height: h } });
    console.log(id);
  }
  await b.close();
  // a JPEG pequeño (336 px de ancho) con sharp si está, o con ImageMagick/PIL a mano
  try {
    const sharp = require('sharp');
    for (const id of ids) {
      await sharp(raiz + `/assets/miniaturas/${id}.png`).resize(336).jpeg({ quality: 80 }).toFile(raiz + `/assets/miniaturas/${id}.jpg`);
      require('fs').unlinkSync(raiz + `/assets/miniaturas/${id}.png`);
    }
    console.log('JPEG listos');
  } catch (e) { console.log('Deja los PNG (no está sharp): conviértelos a <id>.jpg de 336 px de ancho.'); }
})();
