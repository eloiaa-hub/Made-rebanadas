# Novedades de Made-rebanadas

## v1.5

- **Pieza de prueba de holgura** (Fabricar → 🧪 Pieza de prueba): un retal con ranuras y cajas de varios anchos, con la medida grabada, para probar con el tablero real y elegir la holgura buena. DXF o SVG.
- **Coordenadas del punto seleccionado**: al hacer clic en un punto del perfil (o de una pieza plana), arriba salen sus dos medidas y se pueden escribir para dibujar a cota exacta.
- Piezas planas: **espigas pasantes con cuña** (casilla en «Piezas planas: uniones»): la espiga asoma lo justo, lleva un agujero y la cuña sale del mismo tablero; firme sin cola y desmontable.
- Piezas planas: **uniones dentadas**. Esquinas dentadas (*finger joints*) cuando dos piezas terminan una en la otra, y espigas en T cuando un canto largo entra en la cara de otra pieza (con sus cajas). Plantilla y ejemplo nuevos: **Mesilla de uniones dentadas**.
- Piezas planas: **piezas inclinadas**. Cada pieza puede girar sobre su borde de abajo, el de arriba o su centro (respaldo inclinado, asiento que baja por detrás, patas abiertas) y las uniones se recalculan con la ranura o la caja inclinada. La Silla de tableros trae el respaldo inclinado 8° y el Taburete, las patas abiertas 4°.
- Piezas planas: **comprobaciones de asiento**: medidas habituales para un adulto y tres pruebas orientativas de vuelco (hacia atrás apoyado en el respaldo, hacia delante y de costado sentado en el borde), con el peso del propio mueble.
- Piezas planas: **▶ Montaje animado** en 3D: las piezas entran una a una, en el orden del plano de montaje.
- **Tipo de mueble nuevo: piezas planas** (sillas, taburetes, bancos de lamas…). Cada pieza es un tablero con su propio contorno, de lado, de frente u horizontal, y el programa busca dónde se cruzan y hace las uniones: **a media madera** (una ranura desde arriba y otra desde abajo) o **espiga en caja pasante** (cuando una pieza queda entera dentro de la otra: espigas que asoman por el asiento, travesaños pasantes), con hueso de perro, o **por solape** (dos piezas paralelas pegadas cara con cara, como las dos capas de un lateral) con **tacos** o **tornillos** repartidos solos en la zona común. Plantillas **Taburete de patas cruzadas**, **Banco de lamas**, **Silla de tableros**, **Silla de piezas solapadas** y **Vacío: piezas planas**, y cuatro ejemplos nuevos. Cada pieza se edita como un perfil, con las piezas que la cruzan a la vista; se pueden añadir, copiar, hacer simétricas (comparten el contorno), quitar o traer de un DXF o SVG. La explosión enseña cómo se montan, y el plano de montaje trae las piezas separadas, la tabla de uniones y los pasos en orden.
- El **hueso de perro** de las ranuras (retícula, discos de los radiales, muescas de los rastreles) se ve ahora también en la **vista 3D** y en la **vista de la pieza**, no solo en Fabricar, el DXF y el plano.
- Arreglado: en las ranuras estrechas para la fresa (tablero fino, como en el «Busto en retícula»), los dos huesos de perro del fondo se pisaban y el contorno se cruzaba consigo mismo en el DXF. Ahora se unen en un solo fondo redondeado.
- **Guardar en GLB para Blender** (🧊 3D → *GLB (Blender, con texturas)*): cada pieza con su nombre, agrupadas en Tablero / Rastreles / Herrajes, con los materiales de la vista 3D y, si quieres, las **texturas de madera dentro** (color, relieve y rugosidad). En metros; Blender lo coloca solo con Z arriba. Pasa el validador oficial de glTF.
- **Importar SVG** para los huecos y los perfiles clave (📐 DXF / SVG…, 📐 Perfil desde un DXF o SVG…): trayectos con curvas y arcos, rectángulos redondeados, círculos, elipses y polígonos, con sus transformaciones, en mm según el tamaño del documento.
- **Importar GLB / glTF y PLY** en el relieve de pared y en las figuras de pie, además de STL y OBJ: modelos de Sketchfab, de Blender, de apps de escaneo con el móvil o de MeshLab.
- **Exportar a SolidCraft**: en 🧊 3D, formatos nuevos **SolidCraft (.sc)** (el suyo, recomendado) y **SolidCraft (JSON plano)**. Cada pieza llega como un cuerpo con su nombre y su color.
- Arreglado: en el STL y el OBJ de un panel con lamas partidas o en módulos **solo salían los trozos de abajo** (Meshmixer, SolidCraft…). Ahora salen todos los trozos y los muebles de los huecos.
- Las mallas del STL, OBJ y SolidCraft salen **cerradas y bien orientadas** (se sueldan los vértices, se limpian puntos repetidos y se tapan los agujeros diminutos que dejaba el texto hundido).
- **Hueco extra entre módulos**: una raya más ancha entre columnas (o filas). Cada módulo se corre ese hueco, el panel crece lo mismo por junta y la onda sigue seguida; los rastreles se cortan a medio paso de la última lama de cada módulo.
- **Dividir los paneles a lo ancho** (módulos en columnas; con lamas horizontales, en filas): en partes iguales o con el ancho que digas para cada módulo. Los rastreles se cortan entre módulos (cada corte en el hueco entre dos lamas), así cada módulo se monta y se cuelga por separado. Con «Partir las lamas» se hace una cuadrícula de módulos. El plano marca los módulos y da el largo de cada trozo de rastrel; la lista de compra los cuenta por largos.
- La hoja 2 del plano pone el alzado grande a la izquierda y la tabla a la derecha cuando la pared es más alta que ancha.
- Arreglado: con lamas partidas, las medidas del panel (Resumen, plano, 3D) solo contaban el trozo de abajo.
- **Partir las lamas** de los paneles de pared (paredes altas o para aprovechar el tablero), en *Pared: rastreles → Partir*: para que quepan en el tablero (el programa pone las juntas) o en las alturas que digas. Junta **a tope** o **con sombra** (una raya a la vista), y juntas **a la misma altura**, **alternas** (al tresbolillo) o **en escalera**. Con las juntas a la misma altura, un **rastrel a cada lado de la junta**: cada banda es un **módulo** que se monta por separado. Los trozos salen como «Lama 12a, 12b…» en el plano, el despiece, el DXF y el Anidador, con su paso de montaje y sus comprobaciones.
- **Corte láser en el Anidador**: elige *Máquina → Cortadora láser*. Las piezas van separadas solo por el ancho del corte, y salen el **G-code del láser** (GRBL, M4; grabado, interiores y al final los contornos, con potencia, velocidad, pasadas y compensación del corte) y un **SVG para láser** (LightBurn, RDWorks…: rojo cortar contorno, azul interiores, negro grabar). Las maquetas llegan ya en modo láser.
- Arreglado: con lamas partidas o con huecos, el alzado de la hoja 2 del plano se salía de la hoja.
- **Texto en las lamas** (paneles de pared): nuevo hueco **🔤 Texto**. Se coloca, se estira y se gira como cualquier hueco en la vista ▦ Huecos, con su texto (varias líneas), su letra (también las tuyas) y negrita, y puede **salir hacia fuera** o **hundirse hacia dentro** los milímetros que digas siguiendo la curva del panel, o recortarse del todo. Avisa si la letra es demasiado pequeña para la separación de las lamas o si al hundir queda poca madera delante de un rastrel.
- Los huecos de cualquier forma también pueden **salir hacia fuera** o **hundirse** (tipos nuevos «En relieve» y «Hundido»).
- Ejemplo nuevo: **Panel ondulado con rótulo** («TALLER» saliendo 25 mm).
- Quitado el modelo y el ejemplo de **Nefertiti** (su escaneo es CC BY-NC-SA, que no permite vender lo hecho con él; los demás modelos siguen, todos de licencia libre).
- La ventana **🪑 Ejemplos** también va en cuadrícula, con una foto de cada uno de los 27 ejemplos.
- La ventana 🗋 Mueble nuevo con fotos también se abre desde el panel izquierdo, con el botón **🗔 Ver las plantillas con fotos…** bajo el selector de plantilla.
- Arreglado: la hoja de estilos no se recargaba al actualizar el programa (los textos de la ventana de plantillas podían salir montados); ahora lleva sello de versión como los scripts. Si lo ves raro, un último Ctrl + F5.
- **Maderas con veta real en el 3D**: las caras de los cinco materiales de madera (abedul, chopo, pino, chapa de roble y de nogal, y el alistonado) usan ahora maderas escaneadas de Poly Haven (CC0) con color, relieve y rugosidad de verdad, recoloreadas al tono de cada material para que el 3D siga casando con los alzados y el plano. Los cantos (alma de contrachapado, MDF) siguen como estaban.
- Las plantillas de partida dejan elegir **cuántos perfiles clave** quieres: «Panel de pared libre» (de 2 a 15; antes siempre 7), «Vacío: empezar de cero» (2 a 12) y «Vacío radial» (3 a 12). Después se pueden seguir añadiendo o quitando con **+ Clave / − Clave**.
- Plantilla **«Vacío radial: cilindro»**: el «empezar de cero» de las lámparas y columnas. En los paneles de pared ese papel lo hace «Panel de pared libre».
- Arreglado: al elegir **Lámpara de lóbulos** o **Columna** en la ventana 🗋 Mueble nuevo, el mueble se creaba como costillas en vez de radial. Ahora además sale con tablero de 6 mm, 12 costillas y un tubo en el que caben, como al cambiar el tipo con el selector.
- La ventana **🗋 Mueble nuevo** enseña las plantillas en **cuadrícula, con una foto** del mueble que genera cada una (y la descripción entera, sin cortar). Las fotos son capturas limpias, sin las líneas de los perfiles.
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
- **Modelos 3D de ejemplo** (STL en `assets/modelos` y botón «🗿 Modelos de ejemplo…»): busto de mujer, labios, ondas en el agua y anomalía (burbuja).
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
