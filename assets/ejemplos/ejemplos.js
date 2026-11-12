/* Muebles de ejemplo de Made-rebanadas.
   Cada ejemplo es una plantilla con sus parámetros, el reparto de costillas y las varillas.
   Las varillas se colocan solas al abrir el ejemplo (✨ Auto). */
window.MADE_EJEMPLOS = [
  { nombre: 'Banco ondulado de abedul', plantilla: 'banco', desc: '1,6 m, onda y media, 27 costillas de 18 mm con varilla roscada M10.',
    params: { largo: 1600, onda: 60, ondas: 1.5 }, costillas: { grosor: 18, separacion: 60, material: 'abedul' }, varillas: { diam: 10, autoN: 3 } },
  { nombre: 'Banco largo de pino', plantilla: 'banco', desc: '2,4 m con dos ondas suaves y costillas de 25 mm más separadas.',
    params: { largo: 2400, onda: 45, ondas: 2, arco: 160, alto: 430 }, costillas: { grosor: 25, separacion: 90, material: 'pino' }, varillas: { diam: 12, sepD: 26, autoN: 3 } },
  { nombre: 'Tumbona de jardín', plantilla: 'tumbona', desc: 'Tumbona en S de 1,6 m, abombada, con redondo de madera.',
    params: {}, costillas: { grosor: 18, separacion: 55, material: 'roble' }, varillas: { tipo: 'madera', diam: 20, sepD: 34, margen: 25, autoN: 3 } },
  { nombre: 'Pouf redondo', plantilla: 'pouf', desc: 'Pouf de 46 cm con cintura. Las costillas de los extremos cuelgan de las varillas.',
    params: {}, costillas: { grosor: 15, separacion: 40, material: 'chopo' }, varillas: { diam: 8, sepD: 18, margen: 18, tramo: 'cabe', autoN: 3 } },
  { nombre: 'Mesa baja «ola» lacada', plantilla: 'mesa', desc: 'Mesa de centro de 1,1 m, tablero plano y ola por debajo, en MDF lacado.',
    params: {}, costillas: { grosor: 19, separacion: 50, material: 'lacado', color: '#2f3a44' }, varillas: { diam: 10, autoN: 3 } },
  { nombre: 'Estantería duna', plantilla: 'estante', desc: 'Mueble de 90 cm de alto con un hueco corrido y frente ondulado.',
    params: {}, costillas: { grosor: 18, separacion: 60, material: 'nogal' }, varillas: { diam: 10, autoN: 4 } },
];
