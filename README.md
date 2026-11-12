# Made-rebanadas — Por Eloi A.A.

**Versión 1.5** · novedades en [NOVEDADES.md](NOVEDADES.md)

**Portada en línea:** <https://eloiaa-hub.github.io/Made-rebanadas/>

Muebles de formas orgánicas hechos con **rebanadas**: costillas de tablero puestas una detrás de otra, separadas y unidas con varillas pasantes.
Funciona en el navegador (Chrome, Edge o Firefox), sin instalar nada y **sin conexión a internet**.

## Cómo se usa

1. Descarga el repositorio (**Code → Download ZIP**) y descomprímelo.
2. Abre **`index.html`** (la portada) o directamente **`Made_Rebanadas.html`**, con doble clic.
3. Manual en HTML y PDF en `ayuda/` (también en el botón ❓ Ayuda).

> Copia siempre **la carpeta completa**: el programa necesita `assets/` y `ayuda/`.

## Qué hace

- **Forma paramétrica**: plantillas de banco ondulado, tumbona, pouf / taburete, mesa baja «ola», estantería «duna» y forma libre, con sus medidas en deslizadores.
- **Perfiles clave**: la forma se define con unos pocos perfiles a lo largo del mueble; cada costilla es la mezcla suave de los perfiles que tiene a los lados. Se editan a mano (puntos de curva o de esquina).
- **Cuatro tipos**: costillas unidas con varillas (en planta recta, en **arco** o **en S**), **retícula entrelazada** a media madera, **radiales** (lámparas y columnas alrededor de un tubo, con discos de unión) y **paneles de pared** (lamas sobre rastreles).
- **Arte mural, rótulos y estanterías**: relieve de pared a partir de un **texto** (nombres, logos) o de una **figura STL/OBJ** (caras, labios, formas; trae cuatro STL de ejemplo en `assets/modelos`), en lamas verticales u horizontales, y estantería de pared ondulada de lamas.
- **Perfiles clave en el 3D**: se seleccionan pinchándolos.
- **Costillas**: grosor del tablero, reparto por separación o por número, base aplanada y corte plano arriba.
- **Varillas**: roscada, redondo de madera o tubo, con separadores; colocación automática y comprobación de la madera que queda al borde en cada costilla.
- **Comprobaciones**: varillas que no caben o demasiado juntas, costillas sueltas o con una sola varilla, separadores que asoman.
- **3D**: maderas y cantos de contrachapado, varillas, tuercas y separadores, vista explosionada, volumen ideal e imagen PNG.
- **CNC**: hueso de perro automático en ranuras y muescas, y contornos en rectas y arcos (G02/G03).
- **➜ Calcador**: cada pieza se abre en el Calcador de la Suite CNC para programar su G-code.
- **Fabricar**: costillas colocadas en tableros con su número grabado; **DXF** (capas CORTE, TALADROS, GRABADO, TABLERO) y **SVG** en mm.
- **Despiece y lista de compra** en CSV, y **CSV de cortes** con el formato del Anidador.
- **Maqueta a escala** (1:2 a 1:20) para cortarla antes en la láser.
- **Plano de montaje en PDF**: conjunto, orden de montaje, varillas, costillas acotadas, tableros y pasos.
- **Anidador de tableros** integrado: coloca las costillas por su forma real.

## Archivos

| Archivo / carpeta | Qué es |
|---|---|
| `Made_Rebanadas.html` | El programa |
| `index.html` | Portada |
| `assets/js/app.js` | Código del programa (se genera uniendo las partes de `herramientas_desarrollo/src`) |
| `assets/js/three-bundle.js` | [Three.js](https://threejs.org) empaquetado sin módulos, para funcionar con doble clic |
| `assets/texturas/` | Maderas y almas de tablero (`texturas.js`) |
| `assets/ejemplos/` | Muebles de ejemplo (`ejemplos.js`) |
| `assets/modelos/` | Modelos 3D de ejemplo para el relieve (`cara.stl`, `labios.stl`, `ondas.stl`, `burbuja.stl` y `modelos.js`) |
| `assets/anidador/` | Anidador de tableros de la Suite CNC (`anidador.html`), que se abre desde el programa |
| `ayuda/` | Manual en HTML y PDF |
| `herramientas_desarrollo/` | Partes del código, scripts para unirlas y empaquetado de Three.js (ver su `LEEME.md`) |

## Licencias

- Programa: **EUPL-1.2** (archivo [`LICENSE`](LICENSE)).
- Manual: **CC BY-SA 4.0** (archivo [`LICENCIA-MANUAL.txt`](LICENCIA-MANUAL.txt)).
- Three.js: licencia MIT (`assets/js/three-LICENSE.txt`).
