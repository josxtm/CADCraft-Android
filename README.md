# CADCraft Android

Adaptación experimental de [CADCraft](https://github.com/storytold/cadcraft) para **Android**, con compilación de APK en la nube utilizando **GitHub Actions**.

> **Estado:** la APK 2D v0.1.0 fue probada en Nothing Phone 2a. Se ha añadido un estudio 3D independiente aún no validado en móvil.

## Flujo de desarrollo y APK (desde octubre de 2026)

**No se compila una APK en cada cambio de código.** Los envíos a `main` ejecutan únicamente el control automático `preflight` (JavaScript, Rust y validaciones), sin construir Android ni subir ningún APK.

Solo al completar **una mejora importante** y cuando haya un guion de pruebas útil, propondremos generar una nueva APK. La compilación Android requiere ir a **Actions → CADCraft · Verificación continua / APK manual → Run workflow**, marcar **GENERAR APK** e indicar en el campo de objetivo qué se desea comprobar. La casilla está desactivada de forma predeterminada. Si no se marca, se ejecutan pruebas pero no se crea el APK.

La versión en `app/build.gradle` se reserva para las compilaciones de prueba de una versión importante; corregir código entre versiones no implica distribuir una APK nueva. Antes de recomendar una APK se explicarán las novedades y se facilitará una lista concreta de pruebas para el Nothing Phone 2a. El guion completo y los criterios para decidir cuándo compilar están en [Protocolo de pruebas en móvil](docs/MOBILE_TESTING.md).

**Importante:** una compilación solo está confirmada cuando el trabajo `android` de GitHub Actions finaliza correctamente y publica un artefacto instalable. Pasar `preflight` no implica que exista una APK.

## Objetivo

Disponer de una aplicación CAD para Android que aproveche el código abierto de CADCraft y permita trabajar con dibujos desde una pantalla táctil. Las prioridades son dibujo 2D, precisión, cotas, apertura/guardado de archivos y evolución posterior de las herramientas 3D.

La primera vía técnica prevista consiste en compilar la versión web **Rust → WebAssembly** y empaquetarla en una APK con una actividad Android **WebView**. Una integración nativa de Rust/egui queda como opción futura si WebView impone limitaciones.

## Modo experimental 3D (nuevos cambios)

La actividad Android añade el botón **3D EXTRUIR**, que abre una pantalla 3D táctil empaquetada sin conexión en `app/src/main/assets/3d/index.html`. Esta pantalla ofrece:

- Crear un sólido extruyendo un rectángulo con ancho, largo y altura numéricos.
- Rotar con un dedo, zoom con pellizco y botones de orientación (superior, frontal, izquierda, derecha, isométrica).
- Importar un archivo DXF **LWPOLYLINE cerrado con segmentos rectos** para extruirlo; por ahora utiliza el primer contorno compatible, sin agujeros ni arcos.
- Exportar la malla a STL (sin garantía todavía de compatibilidad del selector de descarga Android).

**Integración Android v0.3.0:** al compilar se aplica `scripts/patch-upstream-selection.py` sobre CADCraft `v0.13.0`. El editor 2D expone una única entidad seleccionada (LWPOLYLINE cerrada sin arcos o círculo) al botón **EXTRUIR SELECCIÓN**, que transfiere el perfil al estudio 3D sin exportar DXF. Los círculos se convierten en perfiles de 64 segmentos. La extrusión se crea en el estudio 3D independiente, **no modifica el dibujo original CADCraft** ni implementa todavía edición de sólidos dentro del mismo editor. Si no hay selección o no es compatible, el botón muestra una advertencia. El ViewCube original sigue sin repararse; el del estudio 3D es independiente.

Este modo todavía requiere una **compilación manual nueva** y pruebas en Nothing Phone 2a. No confundir código publicado con APK generada.

## Estudio 3D táctil (desarrollo octubre 2026)

Se han incorporado herramientas experimentales de boceto 2D directamente en la vista 3D:

- Crear rectángulos por ancho y largo exactos y círculos por diámetro (aproximados con 48 segmentos rectos).
- Añadir puntos XY en milímetros, seleccionar o arrastrar vértices, borrar vértices, deshacer y rehacer.
- Activar/desactivar el ajuste a cuadrícula de 5 mm.
- Extruir un contorno simple sin autointersecciones y exportar su perfil 2D a DXF.
- Importar perfiles DXF LWPOLYLINE cerrados y rectos mediante selector Android, y exportar el sólido a STL.
- Guardar y abrir proyectos propios JSON con perfil y altura, independientes del proyecto original de CADCraft.
- Transferir desde la pantalla principal un archivo DXF seleccionado por el usuario al módulo 3D.

**Alcance:** la selección de objetos directamente desde el lienzo del editor original CADCraft y su extrusión sin archivos intermedios todavía no está integrada. Los círculos se aproximan mediante segmentos; no se admiten agujeros, splines ni arcos DXF. Esta rama exige probar el APK en teléfono: los commits por sí solos no validan la compilación ni el funcionamiento Android.

En GitHub Actions, el trabajo `preflight` comprueba la sintaxis JavaScript, la geometría y las pruebas Rust antes de `android`. El archivo APK solo aparecerá si todos los pasos concluyen correctamente.

### Paquete de verificación 0.2.0
- Estadísticas geométricas (área de base, superficie exterior y volumen) con unidades de dibujo asumidas como mm.
- Exportación OBJ de malla triangulada además de STL y DXF.
- Rectángulos y círculos precisos, rejilla opcional, deshacer y rehacer, selección, desplazamiento y borrado de vértices.
- Android permite cambiar la orientación de pantalla (en lugar de estar bloqueado en apaisado).
- Compilación de CADCraft web desde la etiqueta de origen `v0.13.0` para evitar cambios inesperados en cada ejecución.
- APK de desarrollo versionada `0.2.0`, aplicación id `com.josxtm.cadcraft` (se conserva para actualización).

**Calidad:** se prueban automáticamente los cálculos geométricos y la estructura del OBJ. Esta verificación no sustituye la compilación en GitHub Actions ni las pruebas en el teléfono.

### Selección 2D → 3D sin archivos (v0.3.0, pendiente de validar en APK)

1. En CADCraft 2D, dibuja un círculo o una polilínea **cerrada** de segmentos rectos.
2. Selecciona **solo esa entidad**.
3. Pulsa **EXTRUIR SELECCIÓN**, elige la altura en la vista 3D y pulsa EXTRUIR si necesitas cambiarla.
4. Puedes exportar STL/OBJ o guardar el proyecto JSON; el perfil se asocia al handle original cuando existe.

El puente WebAssembly es de **solo lectura** y funciona con la versión fija `v0.13.0`. No ofrece todavía selección múltiple, curvas DXF con bulge, agujeros, reconocimiento de límites a partir de líneas sueltas, sincronización de vuelta al documento original ni operaciones booleanas. La compilación WASM de GitHub Actions es obligatoria para comprobar que el parche Rust funciona con ese código. Las pruebas JavaScript por sí solas **no confirman un APK válida**.

### Estudio 3D: selección y edición (v0.4.0)

- Alternar entre **giro de cámara** y **selección de caras** en la barra inferior.
- Seleccionar con un toque un triángulo visible de la malla y resaltarlo en naranja. La interfaz indica si pertenece a la cara superior, inferior o lateral.
- **Deseleccionar** y continuar girando libremente al salir del modo selección.
- Modificar la altura de extrusión en pasos de ±5 mm o mediante el campo de altura y **APLICAR EXTRUSIÓN**.
- Comprobar la nueva geometría antes de sustituir la actual: entradas incorrectas o altura cero mantienen el último sólido válido.
- Añadir 19 pruebas para selección, geometría y cambios de altura. La prueba JavaScript conjunta alcanza 71 comprobaciones, ejecutadas localmente; la compilación Rust/WASM y la APK requieren verificación por Actions.

**Alcance:** esta es selección de triángulos de una única malla de extrusión, no un selector topológico B-Rep ni edición paramétrica de caras arbitrarias. Todavía no incluye múltiples sólidos, operaciones booleanas ni modificación de la geometría original de CADCraft 2D.

### Escena 3D de varias piezas (v0.5.0)

El estudio 3D incorpora una escena con un máximo de **24 sólidos extruidos**:

- **Nueva pieza**: conserva las piezas anteriores y crea otra para modificarla.
- **Duplicar pieza**: crea una copia independiente separada en el eje X.
- **Siguiente pieza**: cambia cuál de las piezas es la activa para editar su altura o su perfil.
- **Eliminar pieza**: elimina la pieza activa, dejando como mínimo una pieza.
- **Mover pieza activa**: desplazamiento XYZ introduciendo coordenadas absolutas respecto al origen de la escena.
- Renderizar todas las piezas a la vez y exportar la escena completa en **STL** u **OBJ**.
- **Proyecto JSON v2**: guarda los sólidos, perfiles, alturas, identificadores y desplazamientos; sigue abriendo proyectos JSON v1 de una sola pieza.
- Validación transaccional: un archivo inválido se rechaza antes de sustituir la escena cargada.
- El indicador de medidas sigue mostrando la geometría de la **pieza activa**, no la suma de toda la escena.

**Limitaciones:** el motor sigue basado en triangulación de contornos 2D extruidos, no en un sólido B-Rep. No hay unión, resta, intersección, agujeros ni restricciones geométricas entre piezas. La selección de caras opera únicamente sobre la pieza activa. Las piezas exportadas se agrupan como malla, sin operación booleana. El límite de 24 piezas es provisional para controlar memoria y rendimiento en Android.

La regresión JavaScript de esta fase suma **98 comprobaciones**, incluida compatibilidad JSON v1/v2, agregado de mallas, operaciones de escena y preservación ante errores. Esto no sustituye la confirmación de la compilación APK ni pruebas táctiles en el teléfono.

### Análisis de contactos entre piezas — desarrollo posterior a 0.5.0

Este bloque se publica en el código **sin crear una APK** y sin cambiar aún el número de versión:

- Botón **Comprobar contactos**: identifica parejas de piezas que se interpenetran volumétricamente, que solo están en contacto o que están separadas.
- El análisis utiliza los contornos 2D reales de cada extrusión (incluidos los perfiles cóncavos), la posición X/Y y los intervalos en Z. No se limita a comprobar si se superponen sus cajas rectangulares.
- La comprobación admite alturas de extrusión negativas y distingue el contacto por una cara de la intersección con volumen compartido.
- Botón **Separar pieza +10 mm**: sitúa la pieza activa a la derecha de las demás dejando al menos 10 mm entre sus límites en X.
- El resultado del análisis se marca como no actualizado si se edita o mueve una pieza; es necesario volver a comprobarlo.
- Se han añadido pruebas de superposición, contacto lateral, contacto vertical, contención, perfil cóncavo, altura negativa y separación automática.

**Todavía NO implementa booleanas** (unir, cortar, restar, intersecar como nueva malla), ni garantiza tolerancias de fabricación. Las intersecciones se detectan entre prismas simples, no entre superficies B-Rep arbitrarias. Esta fase de análisis sirve para preparar las futuras operaciones booleanas de manera controlada.

El paquete JavaScript del estudio 3D suma **115 comprobaciones locales correctas**, pero se mantiene el compromiso de **no generar una nueva APK por cada modificación**. Se indicará cuándo se alcance un hito que merezca una nueva prueba en Android.

### Booleanas iniciales y mediciones geométricas (desarrollo después de v0.5.0)

Implementadas en el estudio 3D, todavía **sin solicitar una nueva APK**:

- **Calcular unión/resta** muestra los volúmenes teóricos en mm³ de dos extrusiones, incluso con perfiles cóncavos y alturas negativas. El volumen común se calcula triangulando los contornos y recortando triángulos en XY, multiplicando el área compartida por el intervalo común en Z.
- **Unión OBJ · bloques**, **Resta OBJ · bloques** e **Intersección OBJ · bloques** generan un archivo de malla real de dos prismas **de perfil ortogonal en XY, extruidos en Z**, sin superficies interiores redundantes. Se prueban casos superpuestos, disjuntos, idénticos y uno contenido dentro del otro. Los bordes de las mallas producidas en esos casos son cerrados.
- Los dos operandos son la **pieza activa** y la **primera pieza almacenada** de la escena. Si no hay segunda pieza, no hay operación.
- Las geometrías se exportan a **OBJ** como resultado independiente. **No reemplazan la escena actual, no se pueden editar como una entidad paramétrica y no se guardan en el JSON del proyecto**.
- Los perfiles circulares, inclinados o las booleanas entre más de dos piezas siguen **sin generar una malla booleana**; los perfiles cóncavos de aristas ortogonales (como una L) sí admiten malla. Las mediciones de volumen de dos perfiles concavos sí están admitidas.
- Una resta que no deja volumen, o una intersección vacía, se indica como resultado vacío y no intenta exportar una malla inexistente.

Estas operaciones son una etapa limitada y explícita antes de integrar un motor CSG/B-Rep general. Las pruebas JavaScript de geometría no sustituyen la compilación Android ni las pruebas manuales en el teléfono.

### Booleanas como piezas de escena — siguiente bloque, sin nueva APK

El estudio 3D incorpora ahora un flujo de resultados booleanos **persistentes**:

- **Añadir unión / resta / intersección a escena** convierte el cálculo de dos bloques rectangulares alineados en una **pieza de malla triangulada independiente**, sin modificar las extrusiones originales.
- **Seleccionar resultado**, **Volver a extrusión**, **Duplicar resultado** y **Eliminar resultado** permiten gestionar las piezas resultantes.
- La pieza booleana seleccionada se puede **mover en XYZ** con los campos existentes; el resto de piezas mantiene sus coordenadas.
- La visualización, el encuadre y la exportación de la **escena completa a STL/OBJ** incluyen las mallas booleanas.
- El formato de proyecto propio pasa a **JSON v3** e incluye mallas, IDs, operaciones, referencias de las piezas origen, desplazamientos y selección actual. Abre los formatos v1 y v2 anteriores.
- Antes de importar una malla, se comprueban coordenadas, índices, caras degeneradas, bordes abiertos, volumen y límites de tamaño. Un error no reemplaza la escena en memoria.
- Se separan explícitamente los controles de extrusión paramétrica y de malla booleana: las mallas resultantes pueden **moverse, seleccionarse, duplicarse y borrarse**. Además, ahora admiten un desplazamiento geométrico **limitado de un plano de caras**, con deshacer/rehacer, pero siguen sin admitir croquis paramétricos, extrusión paramétrica ni edición B-Rep general. No hay todavía historial de operaciones reconstruible ni recomputación automática al cambiar sus fuentes.
- Máximo de **24 piezas totales** entre extrusiones y resultados booleanos.
- Las operaciones booleanas de creación de malla se limitan a **dos prismas con perfiles rectilíneos alineados a X/Y**. El volumen de intersección sí puede calcularse para perfiles extruidos más generales, pero eso no genera una malla booleana editable.
- Para evitar proyectos imposibles de reabrir, el guardado JSON rechaza un archivo demasiado grande (límite de 2 MB).

El control JavaScript alcanza **180 pruebas de regresión**, incluidas creación, desplazamiento, exportación, duplicación, persistencia y rechazo de proyectos corruptos. Este bloque **no modifica la versión APK (0.5.0)**. GitHub Actions mantiene el trabajo de compilación Android reservado al disparo manual.

### Selección táctil y desplazamiento de planos en mallas — desarrollo posterior a 0.5.0

- En modo **Seleccionar cara**, tocar cualquier sólido visible de la escena activa su pieza, incluso si previamente estaba seleccionada otra extrusión o una malla booleana. La referencia del triángulo seleccionado se actualiza después del cambio de objeto.
- Los resultados booleanos admiten **Mover plano + / Mover plano −** introduciendo una distancia en milímetros. La herramienta mueve **todos los vértices situados en el plano coordenado de la cara elegida**; no desplaza únicamente una cara aislada ni realiza una operación B-Rep.
- Solo admite caras planas alineadas con X/Y/Z. Se rechazan pasos nulos, demasiado grandes, caras oblicuas, mallas abiertas, degeneradas y movimientos que crucen otro plano paralelo de la misma malla.
- **Deshacer cara / Rehacer cara** proporciona hasta 20 pasos por resultado booleano seleccionado. El historial de deshacer es temporal: al cambiar de resultado o abrir un proyecto se reinicia.
- Los cambios geométricos se guardan en **JSON v3** y se exportan en **STL y OBJ**, pero **no se recalculan automáticamente** si se modifica una de las piezas que dio origen al resultado.
- La detección de contactos sigue evaluando únicamente las **extrusiones**; no analiza todavía colisiones entre mallas booleanas de geometría general.
- Regresión JavaScript ampliada a más de 200 casos sin generar ninguna nueva APK. La validez del APK continúa sin verificarse para este bloque.

### Modo Mover táctil y navegación — desarrollo sin APK

- Nuevo botón en la barra inferior **Mover: ON/OFF**. En modo Mover, tocar una pieza y arrastrarla modifica su desplazamiento XYZ; **la cámara no gira** durante ese arrastre.
- Restricciones de movimiento **Plano XY, X, Y o Z**. El desplazamiento proyecta los movimientos de pantalla sobre el eje/plano elegido, utilizando la orientación y escala actuales de la cámara.
- **Rejilla** opcional ajustable en milímetros (0 = desactivada) y **sensibilidad táctil** regulable de 0,1 a 5.
- Los ejes demasiado paralelos a la dirección de la cámara se rechazan para evitar cambios descontrolados; para arrastrar en XY cuando el plano se ve de canto, seleccionar la **vista superior**.
- **Deshacer mover / Rehacer mover**: hasta 50 desplazamientos, tanto arrastrando como escribiendo coordenadas XYZ. Cada gesto completo produce **una única entrada** en el historial. Un gesto cancelado revierte el desplazamiento.
- **Seleccionar cara** y **Mover** son modos excluyentes: cambiar a uno desactiva el otro y cancela sin guardar un arrastre incompleto. Con ambos desactivados se mantiene la navegación por giro y zoom.
- **Panel: ON/OFF** permite ocultar temporalmente el panel lateral de herramientas, dejando libre el dibujo en teléfonos de pantalla pequeña.
- El proyecto JSON v3 conserva posiciones finales, pero el historial de movimiento es temporal y se borra al cargar un proyecto o eliminar una pieza; esto evita deshacer movimientos de objetos ya inexistentes.
- El modo Mover funciona para las extrusiones y para los resultados booleanos triangulados. No cambia su geometría interna, solo la transformación XYZ.
- La batería de regresión JavaScript suma **252 comprobaciones correctas**, incluidas simulaciones de eventos pointerdown / pointermove / pointerup y validación de que la cámara permanezca inmóvil. Este bloque **no ha generado APK**.

**Limitaciones:** gestos verificados con eventos simulados, no todavía mediante pruebas en pantalla táctil Android. El zoom con dos dedos está disponible en modo navegación; en modo Mover se prioriza evitar que un segundo dedo modifique accidentalmente la pieza o la cámara.

### Manipulador 3D: selección visible, medición y foco de cámara (desarrollo posterior a v0.5.0)

- El estudio 3D muestra un **contorno amarillo de la pieza activa** al activar **Mover: ON**. Esto permite distinguir la pieza que se desplazará incluso en escenas con varios sólidos.
- Cuando se arrastra una flecha X, Y o Z del manipulador, se destaca el eje bloqueado y se muestra el **desplazamiento acumulado en milímetros** junto a la pieza. El dato desaparece al terminar el gesto.
- El control amarillo **XY** se desactiva automáticamente cuando el plano se observa de canto, para evitar desplazamientos incorrectos por proyección numéricamente inestable. Al cambiar a **Superior** vuelve a poder utilizarse.
- Nuevo control **Centrar pieza**: cambia el pivote y el zoom de la cámara para encuadrar solo la pieza seleccionada sin desplazar ninguna geometría.
- Los botones **Mover: ON/OFF** y **Seleccionar cara** redibujan inmediatamente la vista y el manipulador al cambiar de modo; no es necesario tocar la pantalla de nuevo.
- El cálculo del contorno seleccionado utiliza un recorrido incremental de los vértices, sin listas de argumentos de tamaño proporcional al número de triángulos, para soportar mejor mallas grandes.
- Pruebas automáticas: **299 comprobaciones JavaScript**; se han añadido regresiones de contorno, centrado de cámara, distancia mostrada, eje fijo durante el gesto y desactivación de XY cuando la cámara queda alineada con el plano.

**Sin nueva APK:** esta fase se mantiene como desarrollo comprobado mediante pruebas JavaScript. Falta validar la interacción táctil real y la compilación Android en una versión importante. El motor sigue sin ofrecer booleanas B-Rep arbitrarias ni modificación paramétrica general de mallas.

### Edición directa de planos mediante gestos — desarrollo posterior a v0.5.0

- **Arrastrar plano: ON/OFF** activa un tercer modo táctil, independiente de **Mover pieza** y **Seleccionar cara**. Solo las **mallas booleanas** son editables así; las extrusiones originales se mantienen intactas.
- Tocar un triángulo de un plano válido selecciona la malla y **resalta todos los triángulos coplanares**. Arrastrar mueve el plano completo sobre su eje normal (X, Y o Z), con una **vista previa en tiempo real**, milímetros en el mensaje de estado y soporte de **rejilla** y **sensibilidad táctil**.
- Soltar el dedo consolida **una única edición deshacible**, aunque se hayan producido múltiples eventos de movimiento. **Cancelar** el gesto, cambiar de modo, eliminar el resultado o cambiar la pieza devuelve la malla a su geometría anterior.
- Los movimientos que cruzarían otro plano, crearían triángulos degenerados, invertirían la malla o usarían un eje casi invisible para la cámara se rechazan **sin sustituir la geometría válida**.
- **Deshacer cara / Rehacer cara** y el guardado **JSON v3** siguen disponibles; el historial temporal de edición se reinicia al abrir un proyecto. Las piezas booleanas guardan su nueva malla, pero no mantienen historial paramétrico regenerable.
- Regresión local ampliada a **340 comprobaciones JavaScript**, incluidas secuencias reales de eventos simulados de pulsar/arrastrar/soltar, cancelación, cambio de modo, volumen, plano coplanar completo, deshacer/rehacer y guardado.

**Alcance:** esta edición desplaza vértices que comparten un mismo plano alineado con los ejes y valida la malla resultante. No implementa operaciones B-Rep generales, arrastre de caras curvas, redondeos ni relaciones paramétricas de Shapr3D. Sigue sin requerirse una APK nueva hasta el siguiente hito aprobado.

### Selección de vértices y aristas en mallas 3D — fase posterior a v0.5.0

- Modos **Vértices: ON/OFF** y **Aristas: ON/OFF**, independientes del giro de cámara, movimiento de piezas, selección de caras y arrastre de planos. Tocando el modelo en pantalla se selecciona un vértice o una arista del resultado booleano activo.
- Las aristas visibles que el selector maneja son **aristas geométricas de la malla**; se descartan las diagonales interiores utilizadas solo para triangular caras coplanares. En un bloque rectangular se reconocen **12 aristas**, no 18.
- Se indican el elemento seleccionado, sus índices, sus coordenadas globales X/Y/Z en mm y los ejes compatibles con su selección. Si el eje elegido no pertenece al plano exterior de una arista, la interfaz propone uno válido.
- **Cota + / Cota −** cambian un plano exterior entero en el eje X/Y/Z especificado, tomando un vértice o una arista como referencia. Esta operación modifica únicamente **mallas que siguen siendo ortoedros macizos** (volumen coincidente con su caja rectangular, superficies ortogonales y sin agujeros). No desplaza vértices aislados ni deforma libremente los triángulos.
- Los intentos de editar siguiendo el propio eje longitudinal de una arista, superar otra cara, usar distancias no válidas o modificar una pieza con huecos o forma en L se **rechazan sin alterar la geometría**.
- Las modificaciones se pueden **deshacer/rehacer** con el historial de edición de malla y se conservan al guardar y volver a abrir el proyecto **JSON v3**. Los croquis y las extrusiones de origen no cambian.
- Los resultados booleanos complejos admiten **selección e inspección**, pero su deformación libre seguirá bloqueada hasta contar con validación de autointersecciones y topología más completa.
- La regresión JavaScript cuenta con **386 comprobaciones**, incluidas pruebas táctiles simuladas de selección de vértice/arista, rechazo de diagonales, edición por cotas, deshacer/rehacer, JSON y conservación tras errores.

No se ha generado ninguna nueva APK. La experiencia táctil real se comprobará únicamente en el siguiente hito de pruebas aprobado.

### Escalado dimensional de sólidos no rectangulares — fase posterior a v0.5.0

La edición geométrica incorpora **Escalar eje + / Escalar eje −**, para modificar una dimensión global de un resultado booleano cerrado incluso si tiene contorno en L, entrantes u otras formas no rectangulares:

- Se selecciona un vértice o arista de un **extremo exterior** y el eje X/Y/Z. Se introduce una distancia en milímetros. La aplicación conserva inmóvil el plano opuesto y **escala proporcionalmente toda la malla sobre ese eje**.
- El volumen debe variar por el mismo factor lineal que la escala aplicada; el resultado se comprueba antes de sustituir el objeto. La transformación positiva e invertible preserva la conectividad de una malla previamente válida.
- Se mantienen las herramientas **Cota + / Cota −** para trasladar solo el plano exterior de un bloque rectangular. Las herramientas **Escalar eje + / −** son distintas: *cambian proporcionalmente toda la geometría*, no desplazan libremente el vértice elegido.
- El proceso rechaza selecciones internas, aristas que discurren en el mismo eje, distancias vacías o desmesuradas, inversión o colapso de la geometría y cualquier resultado que no supere la validación de malla cerrada y volumen.
- Los cambios permiten **deshacer/rehacer**, exportar la nueva malla con la escena y guardarla como proyecto **JSON v3**. Las extrusiones originales no se modifican.
- Verificación JavaScript ampliada a **422 comprobaciones**, con un caso real de resto booleano en L, escalas sucesivas en X y Z, pruebas del volumen esperado, historial, persistencia y rechazo sin pérdida de datos.

**Limitación:** esto es un **escalado afín global por eje**, no un editor libre de vértices y aristas ni un motor B-Rep paramétrico. Las piezas creadas a partir de mallas ya inválidas no pueden considerarse reparadas mediante esta operación. No se ha generado una nueva APK.

### Integridad geométrica y planificación del motor

La hoja de ruta completa —funciones existentes, prioridades, limitaciones del motor actual y criterios para aprobar cada hito— está en **[Hoja de ruta del motor 3D](docs/ENGINE_ROADMAP.md)**.

El primer bloque de integridad incorpora el botón **Diagnóstico malla** para revisar un resultado booleano seleccionado: número de vértices, aristas y triángulos, cantidad de superficies cerradas, cavidades orientadas, característica de Euler y volumen firmado.

La validación previa al guardado/carga y a las operaciones de malla ahora rechaza:

- Triángulos repetidos o degenerados, vértices aislados, bordes sin la pareja de triángulos y bordes con más de dos caras.
- Caras vecinas con el mismo sentido de recorrido, incompatibles con una superficie orientable.
- Superficies que se tocan únicamente en un vértice (*bow-tie*) sin un abanico local conectado.
- Cascarones cerrados sin volumen y mallas cuyo volumen global no sea positivo.

Se permiten explícitamente **varios cascarones cerrados**, incluidas **cavidades internas con orientación opuesta**. Se añadieron regresiones con una caja hueca, piezas disjuntas y ejemplos dañados; un proyecto JSON con malla defectuosa se rechaza **sin sobrescribir la escena válida**.

La batería local suma **445 comprobaciones JavaScript**, pero estas pruebas **no prueban la compilación Android ni garantizan ausencia de autointersecciones**. El siguiente bloque pendiente es precisamente detectar autointersecciones entre triángulos no vecinos, seguido de booleanas generales.

El trabajo `android` sigue bloqueado en cambios ordinarios y solo se ejecuta mediante lanzamiento manual de una APK de hito.

### Detección de autointersecciones, anidamiento y exportación segura

El motor examina parejas candidatas de triángulos mediante un **barrido de cajas de contorno 3D** y una comprobación geométrica posterior. Se rechazan penetraciones claras entre triángulos, solapes coplanares con área, dos cascarones que se cruzan o tocan, y mallas plegadas que atraviesan su propia superficie.

El diagnóstico de cascarones añade comprobación de **anidamiento por ángulo sólido**: la superficie exterior tiene orientación positiva, una cavidad interior negativa y una isla de material dentro de la cavidad positiva. Dos cascarones sólidos anidados con orientación positiva ya no se aceptan como si representaran dos piezas válidas.

**Exportación segura:** antes de exportar una unión, resta o intersección OBJ entre cajas, se valida la malla booleana. Si dos cajas se tocan solo por una arista o un vértice, su unión puede ser no manifold; en ese caso se **rechaza la exportación**, en lugar de generar un OBJ geométricamente inválido.

Se añadieron verificaciones de **375 operaciones booleanas parametrizadas** y regresiones de autointersección, cavidades e islas: **490 aserciones JavaScript locales**. La validación es una barrera de seguridad, **no una garantía completa de ausencia de autointersecciones geométricas**, ni equivale a un CAD B-Rep de precisión industrial.

No se ha solicitado una nueva APK. La prueba Android real continúa pendiente del hito principal.

### Precisión numérica de los volúmenes — Bloque A3

Los volúmenes de mallas trianguladas y sus cascarones se calculan ahora respecto a **orígenes locales independientes por componente conectada**. Esto evita perder precisión al sumar caras de sólidos situados muy lejos del origen de coordenadas, sin cambiar sus vértices ni sus posiciones.

La regresión comprueba cubos de 10 × 10 × 10 mm desplazados hasta **90 millones de milímetros** en las tres coordenadas, componentes separadas por esa distancia y piezas con cavidades. El error de volumen medido permanece inferior a 0,000001 mm³ en estos casos de ensayo.

**Sigue pendiente** resolver todas las tolerancias adaptativas, casi tangencias y predicados geométricos robustos; este avance no convierte el motor en un núcleo CAD industrial.

## Hoja de ruta

| Versión | Objetivo | Estado |
|---|---|---|
| v0.1.0 | Proyecto Android, compilación de CADCraft WebAssembly y APK con GitHub Actions | Pendiente |
| v0.2.0 | Gestos táctiles, zoom, selección y botones adaptados al móvil | Planificada |
| v0.3.0 | Abrir/guardar y comprobar compatibilidad de archivos DXF/DWG | Planificada |
| v0.4.0 | Acotaciones, entrada numérica y mejoras de interfaz en castellano | Planificada |
| v0.5.0 | Investigar extrusión y funciones 3D | Exploración |

## Arquitectura propuesta

1. Obtener el código fuente de `storytold/cadcraft`.
2. Compilar su frontend con Rust, destino `wasm32-unknown-unknown` y Trunk.
3. Copiar los archivos web generados a `app/src/main/assets/web/`.
4. Cargarlos localmente mediante `WebViewAssetLoader`, sin necesidad de un servidor externo.
5. Construir `app-debug.apk` con Gradle dentro de GitHub Actions.
6. Publicar el APK como *artifact* para descargarlo e instalarlo manualmente.

**Nota:** esto es un diseño de integración, no una garantía de compatibilidad. Debemos comprobar el renderizado y el almacenamiento de CADCraft en Android WebView.

## Generación manual de APK solo para hitos importantes

Una vez incorporado el proyecto y el archivo `.github/workflows/android-apk.yml`:

1. Esperar a que se indique que una versión contiene mejoras importantes y qué debemos probar en el teléfono.
2. Entrar en **Actions** y seleccionar **CADCraft · Verificación continua / APK manual**.
3. Pulsar **Run workflow** y marcar la casilla **GENERAR APK**. Añadir el objetivo de las pruebas.
4. Comprobar que terminan correctamente los trabajos **preflight** y **android**.
5. Descargar el artefacto de la ejecución, extraer el ZIP e instalar `app-debug.apk` en el teléfono Android.
6. Seguir las pruebas indicadas en [Protocolo de pruebas en móvil](docs/MOBILE_TESTING.md) y comunicar los resultados.

El APK *debug* es únicamente para pruebas. La compilación necesita además revisión de licencias, permisos Android, manejo de archivos y pruebas reales.

## Pruebas previstas

- Arranque sin conexión tras la instalación.
- Dibujo de líneas, rectángulos y círculos.
- Zoom y desplazamiento con pantalla táctil.
- Selección y edición de entidades.
- Introducción de medidas precisas.
- Abrir/guardar un dibujo y comprobar persistencia.
- Importar/exportar DXF y evaluar DWG.
- Rendimiento, consumo de memoria y estabilidad en un **Nothing Phone 2a**.

## Limitaciones y precauciones

- CADCraft está en desarrollo; la compatibilidad 3D completa no debe darse por supuesta.
- Las funciones de archivo del navegador pueden requerir puentes específicos de Android.
- Conservar siempre copias de los dibujos originales: las conversiones de formatos CAD pueden perder elementos no soportados.
- Hasta superar las pruebas, no utilizar la APK para documentación técnica crítica.

## Relación con MyCAD

**CADCraft Android es independiente de MyCAD.** Su objetivo es experimentar con el motor CAD original sin alterar la aplicación MyCAD existente.

## Origen, atribución y licencia

Este proyecto se basa en [storytold/cadcraft](https://github.com/storytold/cadcraft). CADCraft publica código bajo términos **MIT OR Apache-2.0**; antes de distribuir binarios es necesario conservar los avisos de copyright, atribuciones y licencias correspondientes a las dependencias incluidas. Este proyecto no está afiliado oficialmente a sus desarrolladores.

---

**Registro de cambios**

- **v0.1.0 (preparación):** documentación del propósito, arquitectura, fases previstas y procedimiento de compilación. APK todavía sin verificar.
