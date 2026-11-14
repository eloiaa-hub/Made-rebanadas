# Novedades de Made-rebanadas

## v1.5

- La ventana **🗋 Mueble nuevo** enseña las plantillas en **cuadrícula, con una foto** del mueble que genera cada una (y la descripción entera, sin cortar).
- Plantilla nueva **«Vacío: empezar de cero»**: dos perfiles rectangulares de partida, sin ninguna forma hecha, para dibujar el mueble punto a punto o traer los perfiles de un DXF.
- Arreglado: con perfiles de muy pocos puntos (un rectángulo), las «Medidas totales» del resumen salían con el fondo a 0.
- **Huecos y perfiles desde un DXF**: dibuja un contorno cerrado en LibreCAD, QCAD, Inkscape o AutoCAD y tráelo con **📐 DXF…** (apartado Huecos) como forma libre, o con **📐 Perfil desde un DXF…** (Perfiles clave) como perfil del mueble, en uno o en todos los perfiles. Lee líneas, arcos, círculos, elipses, polilíneas y splines; junta los trazos por sus extremos y clava un punto en cada esquina viva.
- **Veta del tablero** en Fabricar: con «A lo largo», cada pieza lleva unas rayitas con su veta y no se gira sola; clic en una pieza para cambiarla (↔ a lo ancho → ↕ a lo alto → libre). La respetan la colocación, el DXF, el SVG, el plano, el CSV de cortes y el Anidador (las piezas llegan marcadas y las de «a lo alto», ya giradas).
- **Grosor propio de los muebles de los huecos**: lamas de 12 con caja o armario de 18, por ejemplo. Sus piezas van en tableros aparte en Fabricar (con el grosor en el rótulo, también en el DXF y el SVG), con su línea en la lista de compra, su grosor en el despiece y en la hoja 3c del plano.
- **Revisión general**: se han probado los 28 ejemplos con planta en arco y en S, maqueta, huecos, lamas horizontales y figuras de pie (124 combinaciones) sin fallos; el DXF, el SVG, el 3D, el Anidador y el plano salen bien en todas.
- **Más rápido**: recalcular un panel de pared grande es unas 7 veces más rápido (la colocación de los números de pieza se calcula una vez por pieza y se guarda). Las figuras en retícula guardan sus cortes y se recalculan unas 4 veces más rápido.
- Si una varilla no cabe y el proyecto tiene huecos, el aviso sugiere mover el hueco o pulsar ✨ Auto para recolocar las varillas.
- Huecos: se pueden **girar** (campo Giro o asa ↻ en la vista) y **borrar** desde la lista (🗑), con el botón 🗑 Borrar o con Supr.
- Tableros: **1220 × 1220** es medio tablero (de 2440 × 1220) y **1220 × 610**, un cuarto (antes se llamaba «medio» por error).
- **Huecos** en paneles de pared, costillas y retícula: rectángulo, redondeado, arco, círculo o forma libre, que se dibujan y se arrastran en la nueva vista **▦ Huecos**.
  - **Pasante** (se ve la pared o se abre un túnel), **rebaje** a una profundidad (pared) o **con mueble**: balda, caja (hornacina) o armario con puerta lisa o con las lamas delante (puerta escondida).
  - Las lamas y costillas se parten en trozos numerados (12a, 12b…) o llevan agujeros por dentro; los rastreles se cortan; los muebles salen como tableros en el despiece, el DXF, el Anidador y la hoja 3c del plano.
  - Avisos de trozos sueltos (sin rastrel, sin varillas o sin mueble), rebajes que se comen la muesca y trozos muy pequeños.
  - Ejemplos «Pared con hornacinas y armario» y «Banco con revistero».
- Las restas se hacen con **Clipper** (Angus Johnson, licencia Boost), incluido en `assets/js/clipper.js`.
- **Figuras de pie desde un modelo 3D** (costillas y retícula): cada costilla es un corte de verdad del STL/OBJ. Alto, cortes de lado a lado o de delante a atrás, giro, unir trozos sueltos con puentes y quitar las costillas pequeñas. El modelo se guarda en el proyecto. Ejemplos «Busto de rebanadas» y «Busto en retícula».
- **Texto añadido encima** de cualquier relieve (imagen, modelo, ondas u otro texto), que sale o se hunde.
- **Letras propias** (.ttf, .otf, .woff): se guardan dentro del proyecto.
- **Luz rasante** en la vista 3D, con su dirección.
- Los modelos y las imágenes de ejemplo **solo se cargan cuando se usan**: el programa abre más rápido.
- **Tres uniones distintas de verdad**: varilla roscada (rosca, arandela y tuerca hexagonal), tubo de acero (brillante, enrasado, con tapas roscadas abombadas) y espiga de madera (mismo diámetro en todo el largo, encolada, sin separadores). El 3D, la lista de compra, los avisos y los pasos del plano cambian con el tipo.
- **Convertir en perfiles editables** pregunta cuántos perfiles y cuántos puntos por perfil. Nuevo **✂ Simplificar puntos…** en Perfiles clave: quita puntos a la vez en todos los perfiles, primero los que menos cambian la forma.
- Arreglado: tras convertir una figura no aparecía el apartado Perfiles clave.
- Con una figura desde un modelo 3D, el editor de perfil ya no enseña los puntos de la plantilla de antes (no se usan y no se podían mover).
- Al seleccionar una costilla que tiene perfil clave, se selecciona también ese perfil (y al revés): el editor de arriba y la costilla de abajo van a la par.
- Las varillas van de la primera a la última costilla que existe.
- **Origen de la forma** en los paneles de pared: plantilla, **texto en relieve** o **modelo 3D (STL / OBJ)**.
- **Texto en relieve** para rótulos y nombres: letra, tamaño, negrita, varias líneas, suavizado de los bordes y onda de fondo.
- **Figuras desde un modelo 3D** (caras, labios, formas de arte mural): vista, giro y base; el proyecto guarda el mapa de alturas.
- **Lamas horizontales** (con rastreles verticales) además de las verticales.
- Plantilla **Estantería de pared ondulada**: lamas con baldas y ménsulas, de fondo ondulado.
- Los paneles de pared empiezan con **lamas de 12 mm cada 26 mm** (antes 18 mm cada 60 mm); los ejemplos de pared, más juntos.
- **Relieve desde una imagen en escala de grises** (png, jpg…): lo blanco sale más; gama, invertir, suavizado y «Alto según la imagen». Cuatro imágenes de ejemplo en `assets/imagenes` (mapa del busto, espiral, hoja, montañas) y dos ejemplos nuevos.
- **🧊 Guardar el modelo 3D** en **STL** (una malla, para imprimir en 3D) o **OBJ + MTL** (una pieza por objeto, con su color), con Z o Y arriba, a escala y con o sin herrajes.
- **✏ Convertir en perfiles editables**: el texto, el modelo 3D o la imagen se pasan a perfiles clave (uno por lama) para retocar los puntos a mano. Avisa de que no se puede revertir.
- Plantilla **Panel de pared libre**.
- El material por defecto es **MDF crudo** (se ve mejor en pantalla).
- **Modelos 3D de ejemplo** (STL en `assets/modelos` y botón «🗿 Modelos de ejemplo…»): busto de mujer, labios, ondas en el agua, anomalía (burbuja) y Nefertiti (escaneo del Neues Museum, CC BY-NC-SA).
- Se quita el enlace al **Calcador** (botón «➜ Calcador»): las piezas siguen saliendo en DXF y SVG con arcos, y en el Anidador.
- Seis ejemplos nuevos: estantería ondulada, rótulo de texto, arte mural «ondas», retrato en lamas horizontales, labios y anomalía.

## v1.4

- **Hueso de perro** automático en las esquinas interiores de ranuras (retícula) y muescas (discos y rastreles), con el Ø de la fresa; la maqueta tiene su propia fresa (0 en láser). Aviso si la fresa no cabe en la ranura.
- **Contornos con arcos**: el DXF (polilínea con *bulge*), el SVG, y el Anidador reciben rectas y arcos en lugar de cientos de tramos rectos, con la tolerancia que se elija (0,05 mm por defecto).
- **➜ Calcador**: cada pieza se abre en el Calcador de la Suite CNC (en internet o copia local) para programar su G-code, o se guarda como proyecto del Calcador (.json), de una en una o todas.

## v1.3

- **Perfiles clave en el 3D**: se dibujan como líneas y se seleccionan pinchándolos (el que se edita, en naranja). Casilla «Perfiles» para mostrarlos u ocultarlos.
- **Planta curva** para las costillas con varillas: en **arco** (radio y sentido) o **en S** (amplitud y ondas). Costillas perpendiculares a la curva, varillas curvadas, separadores de largo variable (lista en el plano), radio mínimo de curvado y aviso si las costillas se tocan por dentro.
- **Rebanadas radiales** (lámparas y columnas): costillas alrededor de un tubo central, con discos de unión ranurados y muescas en las costillas. Perfiles clave por ángulo. Plantillas **Lámpara de lóbulos** y **Columna / pie de lámpara**, con giro en espiral.
- **Paneles de pared**: lamas verticales con relieve sobre rastreles (muescas detrás) o tablero trasero. Plantillas **Panel ondulado** y **Panel con relieve**.
- Plano PDF, despiece, lista de compra, DXF, SVG, Anidador y maqueta para todos los tipos.
- Seis ejemplos nuevos: banco en S, banco en arco, lámpara, columna y dos paneles de pared.

## v1.2

- **Retícula entrelazada (waffle)**: nuevo tipo de mueble. Costillas y largueros que se cruzan con **ranuras a media madera**, sin herrajes. Número de largueros, margen, vuelo, holgura de la ranura y ranuras desde arriba o desde abajo.
- Los largueros se sacan cortando el volumen; si la forma tiene huecos salen partidos en varias piezas, y los trozos que no pueden encajar se quitan solos.
- Comprobaciones propias: costillas sin larguero, largueros con menos de 2 cruces, cruces flojos, ranuras imposibles.
- 3D con los largueros (la explosión los levanta), lista de piezas con costillas (números) y largueros (letras).
- Fabricar, DXF, SVG, despiece, CSV de cortes, Anidador y maqueta con las ranuras (en la maqueta, con su grosor).
- Plano en PDF con la planta de la retícula, los largueros acotados y el montaje paso a paso.
- Tres ejemplos nuevos: banco, mesa baja y pouf en retícula.

## v1.1

- **Maqueta a escala** (1:2 a 1:20): grosor, varilla y holgura propios; Fabricar, DXF, SVG, despiece, plano y Anidador salen a escala, con tableros de láser. Comprobaciones de la maqueta.
- **Plano de montaje en PDF**: conjunto en 3D con datos y lista de compra, orden de montaje con la vista lateral y la posición de las varillas, todas las costillas acotadas, tableros de corte y montaje paso a paso.
- **Anidador de tableros** dentro del programa (`assets/anidador`): recibe las costillas con su forma y sus agujeros y las coloca por su forma real.
- **CSV de cortes** con el formato de despiece del Anidador (en Fabricar y en Despiece).

## v1.0 — primera versión

- Muebles de **costillas separadas** unidas con varillas pasantes y separadores.
- Forma definida por **perfiles clave** a lo largo del mueble; cada costilla es la mezcla suave de los perfiles que tiene a los lados.
- **Plantillas paramétricas**: banco ondulado, tumbona, pouf / taburete, mesa baja «ola», estantería «duna» y forma libre.
- **Editor de perfil**: mover, añadir y borrar puntos (en todas las claves a la vez), esquina o curva, rejilla, perfiles clave nuevos en cualquier costilla.
- Base aplanada en el suelo y corte plano arriba opcional.
- **Varillas**: roscada, redondo de madera o tubo; colocación automática; comprobación de madera al borde en cada costilla; tramo por todas las costillas o solo donde caben.
- **Comprobaciones**: varillas que no caben o demasiado juntas, costillas sueltas o con una sola varilla, separadores que asoman, costillas que no llegan al suelo.
- **Vista 3D** con maderas, cantos de contrachapado, varillas, tuercas y separadores; vista explosionada y volumen ideal; imagen PNG.
- **Fabricar**: costillas colocadas en tableros (o en fila), con número grabado; **DXF R12** (capas CORTE, TALADROS, GRABADO, TABLERO) y **SVG** en milímetros.
- **Despiece** y **lista de compra** (tableros, varillas, separadores, tuercas, broca) en CSV.
- Guardar y abrir proyecto (.json), deshacer y rehacer, ejemplos, modo claro y oscuro.
