
/* ===================== PLANTILLAS PARAMÉTRICAS =====================
   Cada plantilla genera el largo, las esquinas y los perfiles clave a partir de sus parámetros.
   Todos los perfiles de un mueble tienen el mismo número de puntos de control. */
const PI2 = Math.PI * 2;
function clavesUniformes(K, L, f) { const out = []; for (let k = 0; k < K; k++) { const t = k / (K - 1); out.push({ x: Math.round(t * L * 10) / 10, pts: f(t) }); } return out; }
function redondeaPts(pts) { return pts.map(p => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]); }

const PLANTILLAS = {
  banco: {
    nombre: 'Banco ondulado',
    desc: 'Banco con el asiento en onda a lo largo y un arco por debajo.',
    params: [
      { id: 'largo', nombre: 'Largo del banco', min: 500, max: 3000, paso: 10, valor: 1600 },
      { id: 'fondo', nombre: 'Fondo', min: 250, max: 800, paso: 5, valor: 420 },
      { id: 'alto', nombre: 'Altura del asiento', min: 250, max: 700, paso: 5, valor: 440 },
      { id: 'onda', nombre: 'Altura de la onda', min: 0, max: 200, paso: 1, valor: 60 },
      { id: 'ondas', nombre: 'Número de ondas', min: 0.5, max: 4, paso: 0.5, valor: 1.5 },
      { id: 'arco', nombre: 'Altura del arco inferior', min: 0, max: 450, paso: 5, valor: 200 },
      { id: 'pata', nombre: 'Ancho de cada apoyo', min: 30, max: 250, paso: 5, valor: 80 },
      { id: 'hundido', nombre: 'Hundido del asiento', min: 0, max: 60, paso: 1, valor: 18 },
      { id: 'panza', nombre: 'Panza de los lados', min: -60, max: 120, paso: 1, valor: 25 },
    ],
    generar(p) {
      const F = p.fondo, w = Math.min(p.pata, F / 2 - 20);
      const esquinas = [true, true, false, false, false, true, true, false, false, false, false, false];
      const K = clamp(Math.ceil(p.ondas * 4) + 1, 5, 17);
      const claves = clavesUniformes(K, p.largo, t => {
        const h = p.alto + p.onda * Math.sin(PI2 * p.ondas * t);
        const a = Math.max(0, Math.min(p.arco, h - 110)), m = (F / 2 - w) * 0.28;
        return redondeaPts([
          [0, 0], [w, 0], [w + m, a * 0.8], [F / 2, a], [F - w - m, a * 0.8], [F - w, 0], [F, 0],
          [F + p.panza, h * 0.5], [F - F * 0.07, h], [F * 0.5, h - p.hundido], [F * 0.07, h], [-p.panza, h * 0.5],
        ]);
      });
      return { largo: p.largo, esquinas, claves };
    },
  },
  tumbona: {
    nombre: 'Tumbona',
    desc: 'Tumbona en S: respaldo, asiento y apoyo de piernas, abombada en el centro.',
    params: [
      { id: 'largo', nombre: 'Ancho de la tumbona', min: 400, max: 1400, paso: 10, valor: 640 },
      { id: 'lt', nombre: 'Largo (de la cabeza a los pies)', min: 1000, max: 2200, paso: 10, valor: 1600 },
      { id: 'respaldo', nombre: 'Altura del respaldo', min: 400, max: 1100, paso: 5, valor: 760 },
      { id: 'asiento', nombre: 'Altura del asiento', min: 150, max: 500, paso: 5, valor: 300 },
      { id: 'pies', nombre: 'Altura en los pies', min: 150, max: 600, paso: 5, valor: 340 },
      { id: 'rodilla', nombre: 'Curva de las rodillas', min: 0, max: 200, paso: 1, valor: 70 },
      { id: 'grueso', nombre: 'Grueso bajo el asiento', min: 60, max: 300, paso: 5, valor: 130 },
      { id: 'bombeo', nombre: 'Abombado en el centro', min: -80, max: 120, paso: 1, valor: 30 },
    ],
    generar(p) {
      const L = p.lt, pf = 0.1 * L;
      const esquinas = [true, true, false, true, true, false, false, false, false, false, false, false, false];
      const claves = clavesUniformes(5, p.largo, t => {
        const b = p.bombeo * Math.sin(Math.PI * t), hs = p.asiento + b;
        return redondeaPts([
          [L * 0.12, 0], [L * 0.12 + pf, 0], [L * 0.45, Math.max(10, hs - p.grueso)], [L * 0.96 - pf, 0], [L * 0.96, 0],
          [L, (p.pies + b) * 0.55], [L * 0.97, p.pies + b], [L * 0.73, p.pies + p.rodilla + b], [L * 0.47, hs],
          [L * 0.26, hs + (p.respaldo - p.asiento) * 0.42 + b * 0.6], [L * 0.04, p.respaldo + b * 0.3], [0, p.respaldo * 0.9 + b * 0.3], [L * 0.08, p.respaldo * 0.42],
        ]);
      });
      return { largo: p.largo, esquinas, claves };
    },
  },
  pouf: {
    nombre: 'Pouf / taburete',
    desc: 'Volumen redondeado (superelipsoide) con cintura opcional.',
    params: [
      { id: 'largo', nombre: 'Largo (X)', min: 250, max: 1200, paso: 5, valor: 460 },
      { id: 'fondo', nombre: 'Fondo (Z)', min: 250, max: 1200, paso: 5, valor: 460 },
      { id: 'alto', nombre: 'Altura', min: 200, max: 900, paso: 5, valor: 430 },
      { id: 'redondez', nombre: 'Forma (2 = huevo · 5 = cubo blando)', min: 1.6, max: 6, paso: 0.1, valor: 3.2 },
      { id: 'cintura', nombre: 'Cintura', min: 0, max: 0.45, paso: 0.01, valor: 0.12 },
      { id: 'apoyo', nombre: 'Base aplanada', min: 0, max: 150, paso: 1, valor: 40 },
    ],
    generar(p) {
      const M = 16, esquinas = new Array(M).fill(false), pe = p.redondez;
      const yc = (p.alto - p.apoyo) / 2, c = (p.alto + p.apoyo) / 2, B = p.fondo / 2;
      const sg = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
      const claves = [];
      const K = 11;
      for (let k = 0; k < K; k++) {
        const t = 0.5 - 0.5 * Math.cos(Math.PI * k / (K - 1)); // más claves cerca de los extremos
        const s = Math.max(0.0004, 1 - Math.pow(Math.abs(2 * t - 1), pe)), f = Math.pow(s, 1 / pe);
        const pts = [];
        for (let i = 0; i < M; i++) {
          const th = -Math.PI / 2 + PI2 * i / M;
          const y = yc + c * f * sg(Math.sin(th), 2 / pe);
          const cin = 1 - p.cintura * Math.exp(-Math.pow((y - yc) / (0.45 * c), 2));
          pts.push([B + B * f * sg(Math.cos(th), 2 / pe) * cin, y]);
        }
        claves.push({ x: Math.round(t * p.largo * 10) / 10, pts: redondeaPts(pts) });
      }
      return { largo: p.largo, esquinas, claves };
    },
  },
  mesa: {
    nombre: 'Mesa baja «ola»',
    desc: 'Mesa de centro con el tablero plano y la parte de abajo en ola.',
    params: [
      { id: 'largo', nombre: 'Largo de la mesa', min: 500, max: 2200, paso: 10, valor: 1100 },
      { id: 'fondo', nombre: 'Fondo', min: 300, max: 1000, paso: 5, valor: 560 },
      { id: 'alto', nombre: 'Altura', min: 250, max: 800, paso: 5, valor: 400 },
      { id: 'arco', nombre: 'Altura media del arco', min: 0, max: 600, paso: 5, valor: 200 },
      { id: 'onda', nombre: 'Variación del arco', min: 0, max: 250, paso: 1, valor: 90 },
      { id: 'ondas', nombre: 'Número de ondas', min: 0.5, max: 4, paso: 0.5, valor: 1 },
      { id: 'pata', nombre: 'Ancho de cada apoyo', min: 30, max: 250, paso: 5, valor: 70 },
      { id: 'vuelo', nombre: 'Vuelo del tablero', min: 0, max: 150, paso: 1, valor: 40 },
      { id: 'cintura', nombre: 'Curva de los lados', min: -60, max: 120, paso: 1, valor: 45 },
    ],
    generar(p) {
      const F = p.fondo, w = Math.min(p.pata, F / 2 - 20), H = p.alto;
      const esquinas = [true, true, false, false, false, true, true, false, true, true, false];
      const K = clamp(Math.ceil(p.ondas * 4) + 1, 5, 17);
      const claves = clavesUniformes(K, p.largo, t => {
        const a = clamp(p.arco + p.onda * Math.sin(PI2 * p.ondas * t), 0, H - 60), m = (F / 2 - w) * 0.22;
        return redondeaPts([
          [0, 0], [w, 0], [w + m, a * 0.8], [F / 2, a], [F - w - m, a * 0.8], [F - w, 0], [F, 0],
          [F - p.cintura, H * 0.55], [F + p.vuelo, H], [-p.vuelo, H], [p.cintura, H * 0.55],
        ]);
      });
      return { largo: p.largo, esquinas, claves };
    },
  },
  estante: {
    nombre: 'Estantería «duna»',
    desc: 'Mueble alto con un hueco corrido para libros, la espalda recta y el frente ondulado.',
    params: [
      { id: 'largo', nombre: 'Largo', min: 500, max: 2400, paso: 10, valor: 1200 },
      { id: 'fondo', nombre: 'Fondo', min: 200, max: 600, paso: 5, valor: 340 },
      { id: 'alto', nombre: 'Altura', min: 400, max: 2000, paso: 5, valor: 900 },
      { id: 'onda', nombre: 'Ondulación del frente', min: 0, max: 150, paso: 1, valor: 70 },
      { id: 'ondas', nombre: 'Número de ondas', min: 0.5, max: 4, paso: 0.5, valor: 2 },
      { id: 'hueco', nombre: 'Profundidad del hueco', min: 50, max: 500, paso: 5, valor: 230 },
      { id: 'altoHueco', nombre: 'Alto del hueco', min: 100, max: 900, paso: 5, valor: 320 },
      { id: 'altoBase', nombre: 'Altura del hueco sobre el suelo', min: 60, max: 1200, paso: 5, valor: 300 },
    ],
    generar(p) {
      const F = p.fondo, H = p.alto, hy = Math.min(p.altoHueco, H - 160), y0 = clamp(p.altoBase, 60, H - hy - 100);
      const esquinas = [true, true, false, true, true, true, true, false, false, false, true];
      const K = clamp(Math.ceil(p.ondas * 4) + 1, 5, 17);
      const claves = clavesUniformes(K, p.largo, t => {
        const o = p.onda * (0.5 + 0.5 * Math.sin(PI2 * p.ondas * t)), hp = Math.min(p.hueco, F - 60);
        return redondeaPts([
          [0, 0], [F, 0], [F + o * 0.45, y0 * 0.5], [F, y0], [F - hp, y0], [F - hp, y0 + hy], [F, y0 + hy],
          [F + o * 0.45, (y0 + hy + H) / 2], [F * 0.72, H], [F * 0.15, H - 12], [0, H * 0.82],
        ]);
      });
      return { largo: p.largo, esquinas, claves };
    },
  },
  libre: {
    nombre: 'Forma libre',
    desc: 'Un bloque redondeado para empezar a dibujar tus propios perfiles.',
    params: [
      { id: 'largo', nombre: 'Largo', min: 200, max: 3000, paso: 10, valor: 900 },
      { id: 'fondo', nombre: 'Fondo', min: 150, max: 1200, paso: 5, valor: 400 },
      { id: 'alto', nombre: 'Altura', min: 150, max: 1500, paso: 5, valor: 420 },
    ],
    generar(p) {
      const F = p.fondo, H = p.alto;
      const esquinas = [true, true, false, false, false, false];
      const claves = clavesUniformes(3, p.largo, () => redondeaPts([[0, 0], [F, 0], [F + 10, H * 0.55], [F * 0.75, H], [F * 0.25, H], [-10, H * 0.55]]));
      return { largo: p.largo, esquinas, claves };
    },
  },
  vacio: {
    nombre: 'Vacío: empezar de cero',
    desc: 'Dos perfiles rectangulares de partida, para dibujarlos punto a punto o traerlos de un DXF.',
    params: [
      { id: 'largo', nombre: 'Largo', min: 200, max: 3000, paso: 10, valor: 1000 },
      { id: 'fondo', nombre: 'Fondo', min: 100, max: 1200, paso: 5, valor: 300 },
      { id: 'alto', nombre: 'Altura', min: 100, max: 1500, paso: 5, valor: 300 },
      { id: 'claves', nombre: 'Perfiles clave', min: 2, max: 12, paso: 1, valor: 2 },
    ],
    generar(p) {
      const F = p.fondo, H = p.alto;
      return { largo: p.largo, esquinas: [true, true, true, true], claves: clavesUniformes(clamp(Math.round(p.claves || 2), 2, 12), p.largo, () => redondeaPts([[0, 0], [F, 0], [F, H], [0, H]])) };
    },
  },
};

// ---------- plantillas radiales (la posición de cada perfil es un ángulo: 0 a 360°) ----------
function generarRevolucion(p) {
  const M = 7, esquinas = [true, true, ...new Array(M - 2).fill(false), true, true];
  const K = clamp(Math.round(p.lobulos) * 4, 8, 48) + 1, H = p.alto;
  const gam = Math.log(0.5) / Math.log(clamp(p.panza, 0.1, 0.9));
  const claves = [];
  for (let k = 0; k < K; k++) {
    const th = 360 * k / (K - 1), pts = [[0, 0]];
    for (let j = 0; j < M; j++) {
      const t = j / (M - 1), v = t * H, lin = lerp(p.abajo, p.arriba, t);
      const base = lin + (p.radio - lin) * Math.sin(Math.PI * Math.pow(t, gam));
      const lob = Math.round(p.lobulos) ? 1 + (p.amplitud / p.radio) * Math.cos((th - p.giro * t) * Math.PI / 180 * Math.round(p.lobulos)) : 1;
      pts.push([Math.max(1, (j === 0 || j === M - 1) ? lin : base * lob), v]);
    }
    pts.push([0, H]);
    claves.push({ x: Math.round(th * 100) / 100, pts: redondeaPts(pts) });
  }
  return { largo: 360, esquinas, claves };
}
PLANTILLAS.lampara = {
  nombre: 'Lámpara de lóbulos', grupo: 'radial',
  desc: 'Pantalla colgante en forma de bulbo, con lóbulos que pueden girar en espiral.',
  params: [
    { id: 'alto', nombre: 'Altura', min: 150, max: 1200, paso: 5, valor: 420 },
    { id: 'radio', nombre: 'Radio mayor', min: 60, max: 600, paso: 5, valor: 180 },
    { id: 'abajo', nombre: 'Radio abajo', min: 10, max: 500, paso: 5, valor: 70 },
    { id: 'arriba', nombre: 'Radio arriba', min: 10, max: 500, paso: 5, valor: 30 },
    { id: 'panza', nombre: 'Altura de la panza (0 a 1)', min: 0.15, max: 0.85, paso: 0.01, valor: 0.5 },
    { id: 'lobulos', nombre: 'Lóbulos', min: 0, max: 12, paso: 1, valor: 6 },
    { id: 'amplitud', nombre: 'Profundidad de los lóbulos', min: 0, max: 150, paso: 1, valor: 28 },
    { id: 'giro', nombre: 'Giro en espiral (°)', min: -180, max: 180, paso: 1, valor: 40 },
  ],
  generar: generarRevolucion,
};
PLANTILLAS.columna = {
  nombre: 'Columna / pie de lámpara', grupo: 'radial',
  desc: 'Pieza alta de revolución con cintura y lóbulos torsionados: pie de lámpara, columna o peana.',
  params: [
    { id: 'alto', nombre: 'Altura', min: 300, max: 2400, paso: 10, valor: 1100 },
    { id: 'radio', nombre: 'Radio mayor', min: 60, max: 500, paso: 5, valor: 150 },
    { id: 'abajo', nombre: 'Radio abajo', min: 20, max: 500, paso: 5, valor: 170 },
    { id: 'arriba', nombre: 'Radio arriba', min: 20, max: 500, paso: 5, valor: 110 },
    { id: 'panza', nombre: 'Altura de la panza (0 a 1)', min: 0.15, max: 0.85, paso: 0.01, valor: 0.3 },
    { id: 'lobulos', nombre: 'Lóbulos', min: 0, max: 12, paso: 1, valor: 4 },
    { id: 'amplitud', nombre: 'Profundidad de los lóbulos', min: 0, max: 150, paso: 1, valor: 35 },
    { id: 'giro', nombre: 'Giro en espiral (°)', min: -360, max: 360, paso: 1, valor: 180 },
  ],
  generar: generarRevolucion,
};
// ---------- plantillas de pared (u = lo que sale de la pared, v = altura) ----------
function generarPared(p, prof) {
  const M = 13, H = p.alto, esquinas = [true, true, ...new Array(M - 2).fill(false), true, true];
  const K = p.claves ? clamp(Math.round(p.claves), 2, 31) : clamp(Math.round((p.ondasX || 1) * 6) + 1, 7, 31);
  const claves = clavesUniformes(K, p.largo, t => {
    const pts = [[0, 0]];
    for (let j = 0; j < M; j++) { const v = H * j / (M - 1); pts.push([Math.max(4, prof(t, v / H)), v]); }
    pts.push([0, H]);
    return redondeaPts(pts);
  });
  return { largo: p.largo, esquinas, claves };
}
PLANTILLAS.radial_vacio = {
  nombre: 'Vacío radial: cilindro', grupo: 'radial',
  desc: 'Un cilindro liso de partida, para dibujar tu lámpara, columna o peana desde cero.',
  params: [
    { id: 'alto', nombre: 'Altura', min: 100, max: 1500, paso: 5, valor: 400 },
    { id: 'radio', nombre: 'Radio', min: 40, max: 600, paso: 5, valor: 150 },
    { id: 'claves', nombre: 'Perfiles clave', min: 3, max: 12, paso: 1, valor: 3 },
  ],
  generar(p) {
    const r = p.radio, H = p.alto;
    return { largo: 360, esquinas: [true, true, true, true], claves: clavesUniformes(clamp(Math.round(p.claves || 3), 3, 12), 360, () => redondeaPts([[0, 0], [r, 0], [r, H], [0, H]])) };
  },
};
PLANTILLAS.pared_ondas = {
  nombre: 'Panel de pared ondulado', grupo: 'pared',
  desc: 'Lamas verticales cuyo canto dibuja ondas en horizontal y en vertical (o en diagonal).',
  params: [
    { id: 'largo', nombre: 'Ancho del panel', min: 400, max: 6000, paso: 10, valor: 1800 },
    { id: 'alto', nombre: 'Alto del panel', min: 300, max: 3000, paso: 10, valor: 1200 },
    { id: 'fondo', nombre: 'Fondo mínimo', min: 10, max: 300, paso: 1, valor: 35 },
    { id: 'relieve', nombre: 'Relieve (lo que sale la onda)', min: 0, max: 400, paso: 1, valor: 90 },
    { id: 'ondasX', nombre: 'Ondas a lo ancho', min: 0.5, max: 5, paso: 0.5, valor: 1.5 },
    { id: 'ondasY', nombre: 'Ondas a lo alto', min: 0, max: 4, paso: 0.5, valor: 1 },
    { id: 'diagonal', nombre: 'Diagonal (0 = cuadrícula, 1 = diagonal)', min: 0, max: 1, paso: 0.05, valor: 0.6 },
  ],
  generar(p) {
    return generarPared(p, (t, y) => p.fondo + p.relieve * (0.5 + 0.25 * Math.sin(PI2 * p.ondasX * t) + 0.25 * Math.sin(PI2 * (p.ondasY * y + p.diagonal * p.ondasX * t))));
  },
};
PLANTILLAS.pared_libre = {
  nombre: 'Panel de pared libre', grupo: 'pared',
  desc: 'Lamas planas para dibujar a mano. También es la forma que queda al convertir un texto, un modelo 3D o una imagen en perfiles editables.',
  params: [
    { id: 'largo', nombre: 'Largo del panel (donde van las lamas)', min: 200, max: 6000, paso: 10, valor: 1200 },
    { id: 'alto', nombre: 'Largo de cada lama', min: 200, max: 3000, paso: 10, valor: 1000 },
    { id: 'claves', nombre: 'Perfiles clave', min: 2, max: 15, paso: 1, valor: 7 },
  ],
  generar(p) { return generarPared({ largo: p.largo, alto: p.alto, claves: p.claves }, () => 40); },
};
PLANTILLAS.pared_relieve = {
  nombre: 'Panel de pared con relieve', grupo: 'pared',
  desc: 'Lamas que forman uno o dos relieves redondeados (cúpula o duna) sobre la pared.',
  params: [
    { id: 'largo', nombre: 'Ancho del panel', min: 400, max: 6000, paso: 10, valor: 1600 },
    { id: 'alto', nombre: 'Alto del panel', min: 300, max: 3000, paso: 10, valor: 1100 },
    { id: 'fondo', nombre: 'Fondo mínimo', min: 10, max: 300, paso: 1, valor: 30 },
    { id: 'relieve', nombre: 'Altura del relieve', min: 0, max: 500, paso: 1, valor: 160 },
    { id: 'anchura', nombre: 'Anchura del relieve (0 a 1)', min: 0.1, max: 1, paso: 0.01, valor: 0.35 },
    { id: 'cx', nombre: 'Posición a lo ancho (0 a 1)', min: 0, max: 1, paso: 0.01, valor: 0.4 },
    { id: 'cy', nombre: 'Posición a lo alto (0 a 1)', min: 0, max: 1, paso: 0.01, valor: 0.55 },
    { id: 'dos', nombre: 'Segundo relieve (0 = no, 1 = igual)', min: 0, max: 1, paso: 0.05, valor: 0.5 },
  ],
  generar(p) {
    const g = (t, y, cx, cy) => Math.exp(-((t - cx) ** 2 + (y - cy) ** 2) / (p.anchura * p.anchura * 0.5));
    p.ondasX = 2;
    return generarPared(p, (t, y) => p.fondo + p.relieve * Math.min(1, g(t, y, p.cx, p.cy) + p.dos * g(t, y, 1 - p.cx * 0.6, 1 - p.cy)));
  },
};
PLANTILLAS.pared_estante = {
  nombre: 'Estantería de pared ondulada', grupo: 'pared',
  desc: 'Lamas contra la pared que salen formando baldas; el fondo de las baldas ondula a lo ancho.',
  params: [
    { id: 'largo', nombre: 'Ancho de la estantería', min: 400, max: 6000, paso: 10, valor: 2000 },
    { id: 'alto', nombre: 'Alto', min: 300, max: 2500, paso: 10, valor: 1000 },
    { id: 'baldas', nombre: 'Número de baldas', min: 1, max: 8, paso: 1, valor: 3 },
    { id: 'fondoMax', nombre: 'Fondo mayor de las baldas', min: 60, max: 600, paso: 5, valor: 220 },
    { id: 'fondoMin', nombre: 'Fondo menor de las baldas', min: 30, max: 600, paso: 5, valor: 110 },
    { id: 'ondas', nombre: 'Ondas a lo ancho', min: 0.5, max: 5, paso: 0.5, valor: 1.5 },
    { id: 'desfase', nombre: 'Desfase entre baldas (0 a 1)', min: 0, max: 1, paso: 0.05, valor: 0.3 },
    { id: 'gruesoBalda', nombre: 'Grueso de la balda', min: 15, max: 120, paso: 1, valor: 40 },
    { id: 'fondo', nombre: 'Fondo de la lama entre baldas', min: 20, max: 200, paso: 1, valor: 45 },
    { id: 'mensula', nombre: 'Altura de la ménsula bajo la balda', min: 0, max: 300, paso: 5, valor: 90 },
  ],
  generar(p) {
    const n = Math.round(p.baldas), H = p.alto, F = p.fondo;
    const esquinas = [true, true];
    for (let j = 0; j < n; j++) esquinas.push(true, false, true, true, true);
    esquinas.push(true, true);
    const K = clamp(Math.round(p.ondas * 6) + 1, 7, 31);
    const claves = clavesUniformes(K, p.largo, t => {
      const pts = [[0, 0], [F, 0]];
      for (let j = 0; j < n; j++) {
        const h = H * (j + 1) / (n + 0.6), g = p.gruesoBalda, m = Math.max(g * 0.5, p.mensula);
        const D = Math.max(F + 10, p.fondoMin + (p.fondoMax - p.fondoMin) * (0.5 + 0.5 * Math.sin(PI2 * (p.ondas * t + j * p.desfase))));
        pts.push([F, Math.max(1, h - g - m)], [F + (D - F) * 0.6, h - g - m * 0.25], [D, h - g], [D, h], [F, h]);
      }
      pts.push([F, H], [0, H]);
      return redondeaPts(pts);
    });
    return { largo: p.largo, esquinas, claves };
  },
};
// ---------- piezas planas (flat-pack): cada plantilla da la lista de piezas ----------
// rectángulo con las esquinas redondeadas que se pidan (radio r): [abajo-izq, abajo-dcha, arriba-dcha, arriba-izq]
function rectPlano(x0, y0, x1, y1, r = 0, cuales = [1, 1, 1, 1]) {
  const pts = [], rr = Math.max(0, Math.min(r, (x1 - x0) / 2 - 0.1, (y1 - y0) / 2 - 0.1));
  const vert = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], cen = [[x0 + rr, y0 + rr], [x1 - rr, y0 + rr], [x1 - rr, y1 - rr], [x0 + rr, y1 - rr]], ang = [Math.PI, -Math.PI / 2, 0, Math.PI / 2];
  for (let k = 0; k < 4; k++) {
    if (!cuales[k] || rr < 0.5) pts.push(vert[k]);
    else for (let j = 0; j <= 4; j++) { const a = ang[k] + Math.PI / 2 * j / 4; pts.push([cen[k][0] + rr * Math.cos(a), cen[k][1] + rr * Math.sin(a)]); }
  }
  return { pts: redondeaPts(pts), esq: pts.map(() => true) };
}
// puntos con su marca de esquina: [[x, y, esquina?]…]
const ptsPlano = L => ({ pts: redondeaPts(L.map(q => [q[0], q[1]])), esq: L.map(q => q[2] !== false) });
const piezaPlana = (nombre, plano, c, forma, extra) => Object.assign({ nombre, plano, c: Math.round(c * 10) / 10, pts: forma.pts, esq: forma.esq }, extra || {});
const igualQue = (nombre, plano, c, k, extra) => Object.assign({ nombre, plano, c: Math.round(c * 10) / 10, igualA: k }, extra || {});
const CLAVE_PLANO = { largo: 100, esquinas: [true, true, true], claves: [{ x: 0, pts: [[0, 0], [100, 0], [100, 100]] }] };
PLANTILLAS.taburete_plano = {
  nombre: 'Taburete de patas cruzadas', grupo: 'plano',
  desc: 'Dos patas con arco y dos travesaños cruzados a media madera; las espigas de las patas pasan por el asiento.',
  params: [
    { id: 'ancho', nombre: 'Ancho del asiento', min: 250, max: 900, paso: 5, valor: 400 },
    { id: 'fondo', nombre: 'Fondo del asiento', min: 200, max: 700, paso: 5, valor: 320 },
    { id: 'alto', nombre: 'Altura', min: 200, max: 900, paso: 5, valor: 460 },
    { id: 'vuelo', nombre: 'Vuelo del asiento', min: 0, max: 80, paso: 1, valor: 25 },
    { id: 'arco', nombre: 'Altura del arco de las patas', min: 0, max: 500, paso: 5, valor: 170 },
    { id: 'pie', nombre: 'Ancho de cada pie', min: 30, max: 200, paso: 1, valor: 60 },
    { id: 'faldon', nombre: 'Alto de los travesaños', min: 40, max: 200, paso: 1, valor: 80 },
    { id: 'espiga', nombre: 'Ancho de las espigas', min: 20, max: 120, paso: 1, valor: 40 },
    { id: 'abre', nombre: 'Patas abiertas (°)', min: 0, max: 15, paso: 0.5, valor: 4 },
  ],
  generar(p, e) {
    const ab = p.abre ? { eje: 'arriba' } : {};
    const W = p.ancho - 2 * p.vuelo, H = p.alto, te = p.espiga, zl = p.fondo / 2 - p.vuelo - e / 2;
    const xt = W / 2 - 15 - te / 2, xa = W / 2 - 15 - te - 35, pie = Math.min(p.pie, W / 2 - 20);
    const arco = Math.max(0, Math.min(p.arco, H - e - p.faldon - 40)), m = (W / 2 - pie);
    const pata = ptsPlano([[-W / 2, 0], [-m, 0], [-m * 0.55, arco * 0.82, false], [0, arco, false], [m * 0.55, arco * 0.82, false], [m, 0], [W / 2, 0], [W / 2, H - e],
      [xt + te / 2, H - e], [xt + te / 2, H], [xt - te / 2, H], [xt - te / 2, H - e], [-xt + te / 2, H - e], [-xt + te / 2, H], [-xt - te / 2, H], [-xt - te / 2, H - e], [-W / 2, H - e]]);
    const Z = zl + 35, yb = H - e - p.faldon, zi = Math.max(10, zl - e / 2 - 25);
    const trav = ptsPlano([[-Z, yb], [-zi, yb], [0, yb + p.faldon * 0.4, false], [zi, yb], [Z, yb], [Z, H - e], [-Z, H - e]]);
    return Object.assign({}, CLAVE_PLANO, { piezas: [
      piezaPlana('Asiento', 'horizontal', H - e / 2, rectPlano(-p.ancho / 2, -p.fondo / 2, p.ancho / 2, p.fondo / 2, 22)),
      piezaPlana('Pata delantera', 'frente', zl, pata, p.abre ? Object.assign({ giro: -p.abre }, ab) : {}), igualQue('Pata trasera', 'frente', -zl, 1, p.abre ? Object.assign({ giro: p.abre }, ab) : {}),
      piezaPlana('Travesaño izquierdo', 'lado', -xa, trav), igualQue('Travesaño derecho', 'lado', xa, 3),
    ] });
  },
};
PLANTILLAS.banco_lamas = {
  nombre: 'Banco de lamas', grupo: 'plano',
  desc: 'Dos laterales con el asiento curvo y lamas de canto encajadas a media madera; un travesaño pasante los une por debajo.',
  params: [
    { id: 'largo', nombre: 'Largo del banco', min: 400, max: 2400, paso: 10, valor: 1000 },
    { id: 'fondo', nombre: 'Fondo', min: 220, max: 700, paso: 5, valor: 360 },
    { id: 'alto', nombre: 'Altura del asiento', min: 250, max: 700, paso: 5, valor: 440 },
    { id: 'hundido', nombre: 'Hundido del asiento', min: 0, max: 80, paso: 1, valor: 25 },
    { id: 'lamas', nombre: 'Número de lamas', min: 3, max: 30, paso: 1, valor: 8 },
    { id: 'altoLama', nombre: 'Alto de cada lama', min: 25, max: 150, paso: 1, valor: 55 },
    { id: 'margen', nombre: 'Laterales desde el extremo', min: 20, max: 400, paso: 5, valor: 90 },
    { id: 'arco', nombre: 'Altura del arco de los laterales', min: 0, max: 400, paso: 5, valor: 160 },
    { id: 'pata', nombre: 'Ancho de cada pata', min: 30, max: 200, paso: 1, valor: 70 },
  ],
  generar(p, e) {
    const D = p.fondo, hl = p.altoLama, xs = p.largo / 2 - p.margen, pata = Math.min(p.pata, D / 2 - 20);
    const T = z => p.alto - hl * 0.25 - p.hundido * (1 - (2 * z / D) ** 2);   // canto de arriba de los laterales
    const arco = Math.max(0, Math.min(p.arco, T(0) - hl - 120)), m = D / 2 - pata;
    const lat = ptsPlano([[-D / 2, 0], [-m, 0], [-m * 0.5, arco * 0.8, false], [0, arco, false], [m * 0.5, arco * 0.8, false], [m, 0], [D / 2, 0], [D / 2, T(D / 2)],
      [D / 4, T(D / 4), false], [0, T(0), false], [-D / 4, T(-D / 4), false], [-D / 2, T(-D / 2)]]);
    const n = Math.max(2, Math.round(p.lamas)), z0 = -D / 2 + e / 2 + 6, z1 = D / 2 - e / 2 - 6, piezas = [
      piezaPlana('Lateral izquierdo', 'lado', -xs, lat), igualQue('Lateral derecho', 'lado', xs, 0)];
    for (let i = 0; i < n; i++) {
      const z = z0 + (z1 - z0) * i / (n - 1), t = T(z);
      piezas.push(piezaPlana('Lama ' + (i + 1), 'frente', z, rectPlano(-p.largo / 2, t - hl * 0.75, p.largo / 2, t + hl * 0.25, 6)));
    }
    const yt = arco + Math.max(30, (T(0) - hl - arco) * 0.35), ht = Math.min(80, Math.max(40, (T(0) - hl - arco) * 0.4)), xt = xs + e / 2 + 30;
    piezas.push(piezaPlana('Travesaño', 'frente', 0, rectPlano(-xt, yt, xt, yt + ht, 8)));
    return Object.assign({}, CLAVE_PLANO, { piezas });
  },
};
PLANTILLAS.silla_plana = {
  nombre: 'Silla de tableros', grupo: 'plano',
  desc: 'Dos laterales con espigas que pasan por el asiento, respaldo y travesaño delantero a media madera y un travesaño trasero pasante.',
  params: [
    { id: 'ancho', nombre: 'Ancho', min: 300, max: 700, paso: 5, valor: 440 },
    { id: 'fondo', nombre: 'Fondo', min: 300, max: 650, paso: 5, valor: 430 },
    { id: 'asiento', nombre: 'Altura del asiento', min: 250, max: 600, paso: 5, valor: 450 },
    { id: 'alto', nombre: 'Altura del respaldo', min: 500, max: 1200, paso: 5, valor: 820 },
    { id: 'respaldo', nombre: 'Alto del respaldo', min: 80, max: 500, paso: 5, valor: 200 },
    { id: 'pata', nombre: 'Ancho de las patas', min: 40, max: 120, paso: 1, valor: 56 },
    { id: 'faldon', nombre: 'Alto del faldón bajo el asiento', min: 40, max: 200, paso: 1, valor: 70 },
    { id: 'espiga', nombre: 'Ancho de las espigas', min: 20, max: 100, paso: 1, valor: 40 },
    { id: 'inclina', nombre: 'Inclinación del respaldo (°)', min: 0, max: 20, paso: 0.5, valor: 8 },
  ],
  generar(p, e) {
    const hs = p.asiento, H = Math.max(p.alto, hs + p.respaldo + 40), pa = Math.max(p.pata, 2 * e + 20), te = p.espiga;
    const al = (p.inclina || 0) * Math.PI / 180, y0 = hs, dz = y => (y - y0) * Math.tan(al);   // por encima del asiento, el poste se va hacia atrás
    const zb = -p.fondo / 2 + pa / 2, zf = p.fondo / 2 - pa / 2, xs = p.ancho / 2 - 40, yr = hs - e - p.faldon;
    const t2 = zf - pa / 2 - te / 2 - 20, t1 = zb + pa / 2 + te / 2 + 30, zm = (zb + zf) / 2;
    const lat = ptsPlano([[zb - pa / 2, 0], [zb + pa / 2, 0], [zb + pa / 2, yr], [zm, yr + p.faldon * 0.35, false], [zf - pa / 2, yr], [zf - pa / 2, 0], [zf + pa / 2, 0], [zf + pa / 2, hs - e],
      [t2 + te / 2, hs - e], [t2 + te / 2, hs], [t2 - te / 2, hs], [t2 - te / 2, hs - e], [t1 + te / 2, hs - e], [t1 + te / 2, hs], [t1 - te / 2, hs], [t1 - te / 2, hs - e],
      [zb + pa / 2, hs - e], [zb + pa / 2, y0], [zb + pa / 2 - dz(H), H], [zb - pa / 2 - dz(H), H], [zb - pa / 2, y0]]);
    const xT = xs + e / 2 + 20, yT = Math.min(160, yr * 0.35), bL = y => y0 + (y - y0) / Math.cos(al);   // alto medido a lo largo del respaldo inclinado
    return Object.assign({}, CLAVE_PLANO, { piezas: [
      piezaPlana('Lateral izquierdo', 'lado', -xs, lat), igualQue('Lateral derecho', 'lado', xs, 0),
      piezaPlana('Asiento', 'horizontal', hs - e / 2, rectPlano(-p.ancho / 2, zb + pa / 2 + 1, p.ancho / 2, p.fondo / 2 + 15, 30, [0, 0, 1, 1])),
      piezaPlana('Respaldo', 'frente', zb, rectPlano(-p.ancho / 2, bL(H - p.respaldo), p.ancho / 2, bL(H), 40, [0, 0, 1, 1]), al ? { giro: -(p.inclina), pivote: y0 } : {}),
      piezaPlana('Travesaño delantero', 'frente', zf, rectPlano(-xT, yr, xT, hs - e, 0)),
      piezaPlana('Travesaño trasero', 'frente', zb, rectPlano(-(xs + e / 2 + 25), yT, xs + e / 2 + 25, yT + 60, 6)),
    ] });
  },
};
PLANTILLAS.silla_solapada = {
  nombre: 'Silla de piezas solapadas', grupo: 'plano',
  desc: 'Cada lateral es de dos capas: la pata trasera (que sube hasta el respaldo) y el lateral del asiento con la pata delantera, solapadas y unidas con tacos.',
  params: [
    { id: 'ancho', nombre: 'Ancho', min: 320, max: 700, paso: 5, valor: 440 },
    { id: 'fondo', nombre: 'Fondo', min: 300, max: 650, paso: 5, valor: 430 },
    { id: 'asiento', nombre: 'Altura del asiento', min: 250, max: 600, paso: 5, valor: 450 },
    { id: 'alto', nombre: 'Altura del respaldo', min: 550, max: 1200, paso: 5, valor: 820 },
    { id: 'respaldo', nombre: 'Alto del travesaño de arriba', min: 40, max: 250, paso: 5, valor: 70 },
    { id: 'pata', nombre: 'Ancho de las patas', min: 40, max: 120, paso: 1, valor: 46 },
    { id: 'faldon', nombre: 'Alto del lateral del asiento', min: 50, max: 200, paso: 1, valor: 85 },
    { id: 'espiga', nombre: 'Ancho de las espigas', min: 20, max: 100, paso: 1, valor: 40 },
  ],
  generar(p, e) {
    const W = p.ancho, hs = p.asiento, pa = Math.max(p.pata, 2 * e + 8), te = p.espiga, H = Math.max(p.alto, hs + p.respaldo + 120);
    const xo = W / 2 - e / 2, xi = W / 2 - 1.5 * e, zb = -p.fondo / 2 + pa / 2, zf = p.fondo / 2 - pa / 2, yr = hs - e - p.faldon;
    const t2 = zf - pa / 2 - te / 2 - 20, t1 = zb + pa / 2 + te / 2 + 30;
    // pata trasera (capa de fuera): sube recta hasta arriba, un poco más estrecha en el pie
    const pata = ptsPlano([[zb - pa / 2 + 4, 0], [zb + pa / 2 - 4, 0], [zb + pa / 2, yr - 40], [zb + pa / 2, H - 14], [zb + pa / 2 - 4, H - 3, false], [zb + pa / 2 - 14, H], [zb - pa / 2, H], [zb - pa / 2, yr - 40]]);
    // lateral del asiento (capa de dentro): llega por detrás hasta cubrir la pata trasera y baja delante como pata
    const lat = ptsPlano([[zb - pa / 2, yr], [(zb + zf) / 2, yr + p.faldon * 0.3, false], [zf - pa / 2, yr], [zf - pa / 2 + 4, 0], [zf + pa / 2 - 4, 0], [zf + pa / 2, hs - e],
      [t2 + te / 2, hs - e], [t2 + te / 2, hs], [t2 - te / 2, hs], [t2 - te / 2, hs - e], [t1 + te / 2, hs - e], [t1 + te / 2, hs], [t1 - te / 2, hs], [t1 - te / 2, hs - e], [zb - pa / 2, hs - e]]);
    const yM = Math.min(hs + 150, H - p.respaldo - 90);
    // asiento: llega a los lados por encima de los laterales y por detrás se estrecha entre las patas traseras
    const r0 = rectPlano(-(W / 2 - 1), zb + pa / 2 + 1, W / 2 - 1, p.fondo / 2 + 15, 30, [0, 0, 1, 1]), aa = W / 2 - e - 1, y0 = zb + pa / 2 + 1;
    const ap = [r0.pts[0], [-aa, y0], [-aa, zb - pa / 2], [aa, zb - pa / 2], [aa, y0], ...r0.pts.slice(1)];
    const asiento = { pts: redondeaPts(ap), esq: ap.map(() => true) };
    return Object.assign({}, CLAVE_PLANO, { piezas: [
      piezaPlana('Pata trasera izquierda', 'lado', -xo, pata), igualQue('Pata trasera derecha', 'lado', xo, 0),
      piezaPlana('Lateral del asiento izquierdo', 'lado', -xi, lat), igualQue('Lateral del asiento derecho', 'lado', xi, 2),
      piezaPlana('Asiento', 'horizontal', hs - e / 2, asiento),
      piezaPlana('Travesaño de arriba', 'frente', zb, rectPlano(-W / 2 - 15, H - p.respaldo, W / 2 + 15, H, 14, [0, 0, 1, 1])),
      piezaPlana('Travesaño del respaldo', 'frente', zb, rectPlano(-W / 2 - 10, yM, W / 2 + 10, yM + 50, 4)),
      piezaPlana('Travesaño delantero', 'frente', zf, rectPlano(-(xi + e / 2 + 12), yr + 10, xi + e / 2 + 12, hs - e, 0)),
    ] });
  },
};
PLANTILLAS.mesilla_dentada = {
  nombre: 'Mesilla de uniones dentadas', grupo: 'plano',
  desc: 'Tapa y laterales con esquinas dentadas; la balda entra en los laterales con espigas en T y un travesaño trasero pasante los ata.',
  params: [
    { id: 'ancho', nombre: 'Ancho', min: 250, max: 900, paso: 5, valor: 420 },
    { id: 'fondo', nombre: 'Fondo', min: 200, max: 600, paso: 5, valor: 340 },
    { id: 'alto', nombre: 'Altura', min: 250, max: 900, paso: 5, valor: 520 },
    { id: 'balda', nombre: 'Altura de la balda', min: 80, max: 700, paso: 5, valor: 190 },
    { id: 'arco', nombre: 'Altura del arco de los laterales', min: 0, max: 300, paso: 5, valor: 110 },
    { id: 'pie', nombre: 'Ancho de cada pie', min: 30, max: 150, paso: 1, valor: 50 },
    { id: 'trasero', nombre: 'Alto del travesaño trasero', min: 40, max: 150, paso: 1, valor: 70 },
  ],
  generar(p, e) {
    const W = p.ancho, D = p.fondo, H = p.alto, pie = Math.min(p.pie, D / 2 - 20), m = D / 2 - pie;
    const arco = Math.max(0, Math.min(p.arco, p.balda - e / 2 - 40)), hB = clamp(p.balda, arco + e / 2 + 30, H - p.trasero - 2 * e - 40);
    const lat = ptsPlano([[-D / 2, 0], [-m, 0], [-m * 0.55, arco * 0.82, false], [0, arco, false], [m * 0.55, arco * 0.82, false], [m, 0], [D / 2, 0], [D / 2, H], [-D / 2, H]]);
    return Object.assign({}, CLAVE_PLANO, { piezas: [
      piezaPlana('Lateral izquierdo', 'lado', -(W / 2 - e / 2), lat), igualQue('Lateral derecho', 'lado', W / 2 - e / 2, 0),
      piezaPlana('Tapa', 'horizontal', H - e / 2, rectPlano(-W / 2, -D / 2, W / 2, D / 2, 0)),
      piezaPlana('Balda', 'horizontal', hB, rectPlano(-W / 2, -D / 2 + e + 4, W / 2, D / 2 - 15, 0)),
      piezaPlana('Travesaño trasero', 'frente', -D / 2 + e / 2, rectPlano(-W / 2, H - e - p.trasero, W / 2, H - e, 0)),
    ], asiento: false });
  },
};
PLANTILLAS.estanteria_kit = {
  nombre: 'Estantería de kit', grupo: 'plano',
  desc: 'Laterales, tapa, base, baldas, zócalo y travesaño trasero unidos a tope con excéntricas y tubillones: se monta y se desmonta con un destornillador. El herraje (excéntrica o perno y tuerca de barril) se elige en «Piezas planas: uniones → Cantos a tope».',
  params: [
    { id: 'ancho', nombre: 'Ancho', min: 300, max: 1200, paso: 5, valor: 800 },
    { id: 'fondo', nombre: 'Fondo', min: 150, max: 600, paso: 5, valor: 300 },
    { id: 'alto', nombre: 'Altura', min: 300, max: 2200, paso: 5, valor: 1200 },
    { id: 'baldas', nombre: 'Baldas intermedias', min: 0, max: 8, paso: 1, valor: 3 },
    { id: 'zocalo', nombre: 'Alto del zócalo', min: 30, max: 150, paso: 1, valor: 70 },
    { id: 'trasero', nombre: 'Alto del travesaño trasero', min: 40, max: 200, paso: 1, valor: 80 },
  ],
  generar(p, e) {
    const W = p.ancho, D = p.fondo, H = p.alto, z = clamp(p.zocalo, 30, H / 4), tr = clamp(p.trasero, 40, H / 4);
    const yBase = z + e / 2, yTop = H - e - tr - e / 2 - 10, n = Math.round(p.baldas), paso = (yTop - yBase) / (n + 1);
    const piezas = [
      piezaPlana('Lateral izquierdo', 'lado', -(W / 2 - e / 2), rectPlano(-D / 2, 0, D / 2, H, 0)), igualQue('Lateral derecho', 'lado', W / 2 - e / 2, 0),
      piezaPlana('Tapa', 'horizontal', H - e / 2, rectPlano(-W / 2, -D / 2, W / 2, D / 2, 0)),
      piezaPlana('Base', 'horizontal', yBase, rectPlano(-W / 2, -D / 2, W / 2, D / 2 - 20 - e, 0)),
      piezaPlana('Zócalo', 'frente', D / 2 - 20 - e / 2, rectPlano(-W / 2, 0, W / 2, z, 0)),
      piezaPlana('Travesaño trasero', 'frente', -D / 2 + e / 2, rectPlano(-W / 2, H - e - tr, W / 2, H - e, 0)),
    ];
    for (let i = 1; i <= n; i++) piezas.push(piezaPlana('Balda ' + i, 'horizontal', yBase + paso * i, rectPlano(-W / 2, -D / 2, W / 2, D / 2 - 10, 0)));
    return Object.assign({}, CLAVE_PLANO, { piezas, asiento: false, herraje: 'excentrica' });
  },
};
PLANTILLAS.plano_vacio = {
  nombre: 'Vacío: piezas planas', grupo: 'plano',
  desc: 'Un tablero de frente y otro de lado que se cruzan, para construir el mueble pieza a pieza o traer los contornos de un DXF o SVG.',
  params: [
    { id: 'ancho', nombre: 'Ancho del tablero de frente', min: 100, max: 2400, paso: 5, valor: 500 },
    { id: 'alto', nombre: 'Alto', min: 100, max: 2400, paso: 5, valor: 400 },
    { id: 'fondo', nombre: 'Fondo del tablero de lado', min: 100, max: 1200, paso: 5, valor: 300 },
  ],
  generar(p) {
    return Object.assign({}, CLAVE_PLANO, { piezas: [
      piezaPlana('Tablero de frente', 'frente', 0, rectPlano(-p.ancho / 2, 0, p.ancho / 2, p.alto)),
      piezaPlana('Tablero de lado', 'lado', 0, rectPlano(-p.fondo / 2, 0, p.fondo / 2, p.alto * 0.8)),
    ], asiento: false });
  },
};
const grupoDe = id => PLANTILLAS[id].grupo || 'lineal';
const grupoTipo = t => t === 'radial' ? 'radial' : t === 'pared' ? 'pared' : t === 'plano' ? 'plano' : 'lineal';

function paramsDefecto(id) { const o = {}; PLANTILLAS[id].params.forEach(q => o[q.id] = q.valor); return o; }
// genera la forma desde la plantilla; si solo cambia el largo y hay retoques a mano, escala las claves
function aplicarPlantilla(soloLargo) {
  const pl = PLANTILLAS[P.plantilla];
  if (soloLargo && P.editado) {
    const k = P.params.largo / P.largo;
    P.claves.forEach(c => c.x = Math.round(c.x * k * 10) / 10);
    P.largo = P.params.largo;
    return;
  }
  const g = pl.generar(P.params, grosor());
  P.largo = g.largo; P.esquinas = g.esquinas; P.claves = g.claves; P.editado = false;
  if (g.piezas && g.herraje && planoP().herraje == null) planoP().herraje = g.herraje;
  if (g.piezas) { planoP().asiento = g.asiento !== false; planoP().piezas = g.piezas; UI.costilla = Math.min(UI.costilla || 0, g.piezas.length - 1); }
  UI.clave = Math.min(UI.clave, P.claves.length - 1); UI.punto = -1;
}
