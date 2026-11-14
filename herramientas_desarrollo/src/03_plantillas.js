
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
    ],
    generar(p) {
      const F = p.fondo, H = p.alto;
      return { largo: p.largo, esquinas: [true, true, true, true], claves: clavesUniformes(2, p.largo, () => redondeaPts([[0, 0], [F, 0], [F, H], [0, H]])) };
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
  const K = clamp(Math.round((p.ondasX || 1) * 6) + 1, 7, 31);
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
  ],
  generar(p) {
    const r = p.radio, H = p.alto;
    return { largo: 360, esquinas: [true, true, true, true], claves: clavesUniformes(3, 360, () => redondeaPts([[0, 0], [r, 0], [r, H], [0, H]])) };
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
  ],
  generar(p) { return generarPared({ largo: p.largo, alto: p.alto, ondasX: 0.5 }, () => 40); },
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
const grupoDe = id => PLANTILLAS[id].grupo || 'lineal';
const grupoTipo = t => t === 'radial' ? 'radial' : t === 'pared' ? 'pared' : 'lineal';

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
  const g = pl.generar(P.params);
  P.largo = g.largo; P.esquinas = g.esquinas; P.claves = g.claves; P.editado = false;
  UI.clave = Math.min(UI.clave, P.claves.length - 1); UI.punto = -1;
}
