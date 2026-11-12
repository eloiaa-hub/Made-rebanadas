/* Made-rebanadas — Por Eloi A.A.
   Programa: EUPL-1.2 · Manual: CC BY-SA 4.0
   Muebles por rebanadas (costillas separadas unidas con varillas).
   Unidades: milímetros. Ejes 3D: X largo del mueble (donde se reparten las costillas), Y alto, Z fondo.
   Cada costilla es un perfil 2D en el plano (u, v): u = fondo, v = alto.
   Este archivo se genera uniendo las partes de la carpeta herramientas_desarrollo/src (01_base … 09_inicio). */
(function () {
'use strict';
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const VERSION = '1.5';
const T = window.THREE;

/* ===================== UTILIDADES ===================== */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const clonar = o => JSON.parse(JSON.stringify(o));
function fmt(v, d = 0) {
  if (!isFinite(v)) return '—';
  return Number(v).toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
let tAviso = 0;
function aviso(msg, ms = 2600) {
  const a = $('#aviso'); a.innerHTML = msg; a.classList.add('ver');
  clearTimeout(tAviso); tAviso = setTimeout(() => a.classList.remove('ver'), ms);
}
function lsGet(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : v; } catch (e) { return def; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* sin almacenamiento */ } }
function descargar(nombre, contenido, tipo) {
  const blob = contenido instanceof Blob ? contenido : new Blob([contenido], { type: tipo || 'text/plain' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function nombreArchivo(s) { return (s || 'mueble').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '') || 'mueble'; }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

/* ===================== MATERIALES DEL TABLERO ===================== */
// cara: textura de madera de la biblioteca (80 x 80 cm); canto: alma del tablero
const MATERIALES = {
  abedul:   { nombre: 'Contrachapado de abedul', cara: 'fresno', canto: 'alma_contrachapado', hex: '#dcc49c' },
  chopo:    { nombre: 'Contrachapado de chopo', cara: 'haya', canto: 'alma_contrachapado', hex: '#d9b892' },
  pino_ply: { nombre: 'Contrachapado de pino', cara: 'pino', canto: 'alma_contrachapado', hex: '#ddb77f' },
  roble:    { nombre: 'Contrachapado chapa roble', cara: 'roble', canto: 'alma_contrachapado', hex: '#b88d5e' },
  nogal:    { nombre: 'Contrachapado chapa nogal', cara: 'nogal', canto: 'alma_contrachapado', hex: '#6a4630' },
  pino:     { nombre: 'Tablero alistonado de pino', cara: 'pino', canto: 'pino', hex: '#ddb77f' },
  mdf:      { nombre: 'MDF crudo', cara: 'alma_mdf', canto: 'alma_mdf', hex: '#a9845c', mm: 200 },
  lacado:   { nombre: 'MDF lacado (color a elegir)', color: true, hex: '#f2efe8' },
};
const VARILLA_TIPOS = {
  roscada: { nombre: 'Varilla roscada', sep: 'Tubo separador', hex: '#b8bcc0', metal: true },
  madera:  { nombre: 'Redondo de madera', sep: 'Tubo / casquillo separador', hex: '#d2b07c', metal: false },
  tubo:    { nombre: 'Tubo de acero', sep: 'Tubo separador', hex: '#c7c9cb', metal: true },
};

/* ===================== ESTADO ===================== */
let P = null;          // proyecto (lo que se guarda)
let R = null;          // resultado calculado: costillas, varillas, avisos
const UI = {
  clave: 0,            // índice de la clave que se edita
  punto: -1,           // punto de control seleccionado
  varilla: -1,         // varilla seleccionada
  costilla: 0,         // pieza seleccionada: 0…n-1 costillas, n… largueros (retícula)
  modo: 'normal',      // 'normal' | 'varilla' (colocar varilla con un clic)
  sucio: false,        // cambios sin guardar
};

function proyectoBase() {
  return {
    app: 'Made-rebanadas', version: 1, versionPrograma: VERSION,
    nombre: 'Mueble', tipo: 'costillas', plantilla: 'banco', params: {}, editado: false,
    largo: 1600,
    esquinas: [],                // por punto de control: true = esquina, false = curva
    claves: [],                  // [{ x: mm a lo largo, pts: [[u, v], …] }]
    interp: 'curva',
    costillas: { grosor: 18, modo: 'separacion', separacion: 60, numero: 25, base: true, tope: false, topeAlt: 400, material: 'abedul', color: '#f2efe8' },
    varillas: { tipo: 'roscada', diam: 10, holgura: 0.5, margen: 20, tramo: 'todas', separadores: true, sepD: 22, sobra: 12, autoN: 3, lista: [] },
    vista: { explosion: 0, fantasma: false, varillas: true, resalta: true, claves: true },
    maqueta: { activa: false, escala: 5, grosor: 3, diam: 3, holgura: 0.2, fresa: 0 },
    cnc: { fresa: 6, hueso: true, arcos: true, tolArco: 0.05 },
    reticula: { num: 4, margen: 40, holgura: 0.3, xArriba: true, vuelo: 25 },
    planta: { forma: 'recta', radio: 2500, sentido: 1, amplitud: 150, ondas: 1 },
    radial: { tubo: 20, holguraTubo: 0.5, discos: 2, rDisco: 0, holgura: 0.3 },
    pared: { rastreles: 3, alto: 45, grueso: 20, margen: 120, holgura: 0.5, verPared: true },
    relieve: { fuente: 'plantilla', orient: 'v', ancho: 1200, alto: 500, fondo: 20, relieve: 60, suavizado: 10, invertir: false,
      texto: 'Made', letra: 'Arial Black', tamLetra: 320, negrita: true, interlinea: 1.05, ondaAmp: 0, ondas: 2,
      vista: 'frente', giro: 0, base: 0.15, modelo: null },
  };
}
