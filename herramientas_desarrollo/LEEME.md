# Herramientas de desarrollo

No hacen falta para usar el programa: solo para cambiarlo.

| Archivo | Para qué |
|---|---|
| `src/01_base.js` … `src/09_inicio.js` | El código del programa en partes. `assets/js/app.js` es su unión, en orden |
| `construir.bat` / `construir.sh` | Une las partes en `../assets/js/app.js` (Windows / Linux o Mac) |
| `entry.js` + `package.json` | Empaqueta Three.js y sus añadidos (OrbitControls, RoomEnvironment…) en `../assets/js/three-bundle.js`, sin módulos: `npm install` y `npm run three` |
| `texturas.py` | Genera las maderas y las almas de tablero (`python texturas.py ../assets/texturas`; necesita numpy, scipy y Pillow). Son las mismas que usa Boceto a Render 3D |

## Partes del código

| Parte | Contenido |
|---|---|
| `01_base.js` | Utilidades, materiales, estado del proyecto |
| `02_geometria.js` | Curvas de los perfiles, mezcla entre perfiles clave, recortes, costillas, varillas, comprobaciones, colocación automática de varillas |
| `02b_reticula.js` | Retícula entrelazada: largueros sacados del volumen, cruces y ranuras a media madera, comprobaciones |
| `modelos.py` | Genera los STL y las imágenes en grises de ejemplo (`assets/modelos/modelos.js`, `assets/imagenes/imagenes.js`) (numpy y scikit-image) |
| `02d_relieve.js` | Relieve de pared: mapa de alturas desde un texto (canvas) o un modelo STL/OBJ (z-buffer), perfil de cada lama, lamas horizontales |
| `02c_disposicion.js` | Dónde va cada costilla (recta, curva, radial, pared), varillas curvas, tubo y discos, rastreles, comprobaciones de radial y pared |
| `03_plantillas.js` | Plantillas paramétricas (banco, tumbona, pouf, mesa, estantería, libre) |
| `04_editor2d.js` | Editor del perfil clave y vista de la costilla |
| `05_tres.js` | Vista 3D (Three.js) |
| `06_panel.js` | Paneles, recálculo y resumen |
| `07_fabricacion.js` | Maqueta a escala, colocación en tableros, DXF, SVG, despiece y CSV |
| `07b_plano.js` | Escritor de PDF propio y plano de montaje |
| `07c_anidador.js` | Ventana del Anidador y paso de las costillas (formato .json del Calcador) |
| `07d_cnc.js` | Hueso de perro y ajuste de rectas y arcos (bulge) para el DXF, el SVG y el Anidador |
| `08_archivo.js` | Ventanas, deshacer, guardar, abrir, ejemplos |
| `09_inicio.js` | Arranque, botones y teclado |

## Anidador

`../assets/anidador/anidador.html` es el Anidador de la Suite CNC con un añadido al final: con `?desde=rebanadas` avisa `anidador-listo` al programa y recibe `rebanadas-piezas` (`piezas`: proyectos del Calcador, uno por costilla, con su contorno exterior y los agujeros como contornos interiores; `tablero`: largo, ancho, grosor, margen). Si se actualiza el Anidador, hay que volver a pegar ese bloque.

## Formato del proyecto (.json)

- `largo`: mm a lo largo del mueble (eje X).
- `claves`: perfiles clave `{ x, pts: [[u, v], …] }`; todos con el mismo número de puntos.
- `esquinas`: por punto, `true` = esquina, `false` = curva.
- `costillas`: grosor, reparto (`separacion` o `numero`), recortes de base y techo, material.
- `varillas`: tipo, diámetro, holgura, madera al borde, separadores y `lista` de posiciones `[u, v]`.
- `tipo`: `costillas` (con varillas), `reticula`, `radial` o `pared`. En `radial`, la posición de los perfiles clave (`x`) es un ángulo de 0 a 360°.
- `planta`: forma (`recta`, `arco`, `s`), radio, sentido, amplitud y ondas.
- `radial`: Ø del tubo, holgura, número y radio de los discos (0 = automático), holgura de las ranuras.
- `pared`: número, alto, grueso, margen y holgura de los rastreles.
- `relieve`: `fuente` (`plantilla`, `texto`, `modelo` o `imagen`; la imagen va en `imagen` = `{nombre, w, h, d64}` en grises, con su `gama`), `orient` (`v` u `h`), `ancho`, `alto`, `fondo`, `relieve`, `suavizado`, `invertir`; para texto `texto`, `letra`, `tamLetra`, `negrita`, `interlinea`, `ondaAmp`, `ondas`; para modelo `vista`, `giro`, `base` y `modelo` = `{nombre, w, h, d64}` (mapa de alturas en bytes, base64; el STL no se guarda).
- `reticula`: número de largueros, margen, vuelo, holgura de la ranura y si las ranuras de las costillas van desde arriba.
- `cnc`: Ø de la fresa, hueso de perro, contornos con arcos y su tolerancia.
- `maqueta`: activa, escala, grosor, diámetro de la varilla y holgura.
