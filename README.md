# Made-rebanadas — Por Eloi A.A.

**Versión 1.0** · novedades en [NOVEDADES.md](NOVEDADES.md)

Muebles de formas orgánicas hechos con **rebanadas**: costillas de tablero puestas una detrás de otra, separadas y unidas con varillas pasantes.
Funciona en el navegador (Chrome, Edge o Firefox), sin instalar nada y **sin conexión a internet**.

## Cómo se usa

1. Descarga la carpeta y descomprímela.
2. Abre **`index.html`** (la portada) o directamente **`Made_Rebanadas.html`**, con doble clic.
3. Manual en HTML y PDF en `ayuda/` (también en el botón ❓ Ayuda).

> Copia siempre **la carpeta completa**: el programa necesita `assets/` y `ayuda/`.

## Qué hace

- **Forma paramétrica**: plantillas de banco ondulado, tumbona, pouf / taburete, mesa baja «ola», estantería «duna» y forma libre, con sus medidas en deslizadores.
- **Perfiles clave**: la forma se define con unos pocos perfiles a lo largo del mueble; cada costilla es la mezcla suave de los perfiles que tiene a los lados. Se editan a mano (puntos de curva o de esquina).
- **Costillas**: grosor del tablero, reparto por separación o por número, base aplanada y corte plano arriba.
- **Varillas**: roscada, redondo de madera o tubo, con separadores; colocación automática y comprobación de la madera que queda al borde en cada costilla.
- **Comprobaciones**: varillas que no caben o demasiado juntas, costillas sueltas o con una sola varilla, separadores que asoman.
- **3D**: maderas y cantos de contrachapado, varillas, tuercas y separadores, vista explosionada, volumen ideal e imagen PNG.
- **Fabricar**: costillas colocadas en tableros con su número grabado; **DXF** (capas CORTE, TALADROS, GRABADO, TABLERO) y **SVG** en mm.
- **Despiece y lista de compra** en CSV.

## Archivos

| Archivo / carpeta | Qué es |
|---|---|
| `Made_Rebanadas.html` | El programa |
| `index.html` | Portada |
| `assets/js/app.js` | Código del programa (se genera uniendo las partes de `herramientas_desarrollo/src`) |
| `assets/js/three-bundle.js` | [Three.js](https://threejs.org) empaquetado sin módulos, para funcionar con doble clic |
| `assets/texturas/` | Maderas y almas de tablero (`texturas.js`) |
| `assets/ejemplos/` | Muebles de ejemplo (`ejemplos.js`) |
| `ayuda/` | Manual en HTML y PDF |
| `herramientas_desarrollo/` | Partes del código, scripts para unirlas y empaquetado de Three.js (ver su `LEEME.md`) |

## Licencias

- Programa: **EUPL-1.2** (archivo [`LICENSE`](LICENSE)).
- Manual: **CC BY-SA 4.0** (archivo [`LICENCIA-MANUAL.txt`](LICENCIA-MANUAL.txt)).
- Three.js: licencia MIT (`assets/js/three-LICENSE.txt`).
