# CADCraft Android — Protocolo de pruebas en móvil

## Regla de compilación

- Los cambios normales en `main` ejecutan **solo las verificaciones** (`preflight`).
- No generar una APK por cada commit ni por cada corrección.
- Proponer una APK **solo al completar un bloque funcional importante**, con regresión de código superada y un objetivo claro de prueba en el teléfono.
- Antes de probar, facilitar siempre: versión, cambios incluidos, enlace a la ejecución de GitHub Actions, estado verificado de la compilación y pruebas que debe realizar el usuario.
- La generación real requiere ejecutar manualmente `CADCraft · Verificación continua / APK manual` y marcar **GENERAR APK**. El campo **Qué funcionalidades se van a probar** documenta el objetivo. Si no está marcado, **no compila la APK**.
- Si falla una comprobación en `preflight`, no debería iniciarse la generación de la APK.
- No confundir un commit publicado o pruebas JavaScript/Rust correctas con una APK compilada. Solo un `android` en verde y el artefacto descargable permiten confirmarlo.

## Criterios para recomendar una nueva APK

1. Se ha completado un conjunto de funciones que debe comprobarse con gestos reales, almacenamiento Android o interfaz WebView.
2. Los cambios han sido revisados y las pruebas de regresión del código han pasado.
3. Existe un guion corto y verificable de pruebas que aporte información para el siguiente bloque.
4. No hay todavía un error conocido bloqueante que aconseje corregir primero sin hacer instalar otra APK.

## Guion de prueba de referencia para la próxima versión importante

Dispositivo: Nothing Phone 2a; registrar si el teléfono está vertical u horizontal al aparecer un fallo.

| N.º | Acción en la APK | Resultado esperado |
|---|---|---|
| 1 | Instalar y abrir la APK | Inicia sin cerrarse y aparece la pantalla CADCraft 2D |
| 2 | Dibujar un círculo y una polilínea cerrada en 2D | Se pueden dibujar y seleccionar por separado |
| 3 | Seleccionar solo un círculo y pulsar `EXTRUIR SELECCIÓN` | Se abre el estudio 3D mostrando la extrusión del círculo |
| 4 | Girar con un dedo y hacer zoom con dos dedos | La cámara gira y el zoom cambia sin modificar geometría |
| 5 | Pulsar orientación superior, frontal e isométrica | Cambia la orientación en la vista 3D |
| 6 | Activar `Seleccionar cara`, tocar una cara y deseleccionar | La cara se resalta y después se elimina el resaltado |
| 7 | Aumentar o reducir la altura y aplicar una medida exacta | La altura del sólido cambia; el valor coincide con lo indicado |
| 8 | Crear otra pieza, duplicarla y alternar entre piezas | Se visualizan varias piezas y se puede cambiar la pieza activa |
| 9 | Mover la pieza activa mediante X, Y, Z y eliminar una pieza | La pieza se mueve al valor indicado y puede eliminarse |
| 10 | Guardar proyecto JSON, cerrar y volver a abrirlo | Se conservan número de piezas, perfiles, alturas y posiciones |
| 11 | Exportar OBJ y STL | Android permite elegir el destino y aparecen los archivos |
| 12 | Introducir una medida imposible (altura 0) | Se muestra error y no desaparece el sólido anterior |

## Pruebas previstas del análisis de contactos (futura APK importante)

Estas comprobaciones **no requieren generar una APK ahora**. Se incorporarán a un hito de prueba cuando el bloque 3D esté suficientemente maduro.

| N.º | Preparación y acción | Resultado esperado |
|---|---|---|
| C1 | Crear dos piezas y superponerlas usando XYZ; pulsar `Comprobar contactos` | Debe señalar intersección entre ambas piezas |
| C2 | Situar las dos piezas contiguas, tocándose por una cara, y volver a comprobar | Debe indicar contacto, no intersección volumétrica |
| C3 | Pulsar `Separar pieza +10 mm` y repetir la comprobación | No debe detectar contactos |
| C4 | Guardar el proyecto, volverlo a abrir y comprobar los contactos | Debe conservar las posiciones y la separación de las piezas |
| C5 | Modificar la altura o mover una pieza después de analizar los contactos | El resultado anterior debe invalidarse hasta volver a comprobar |

## Pruebas previstas del primer paquete booleano (futura APK importante)

| N.º | Acción en el estudio 3D | Resultado esperado |
|---|---|---|
| B1 | Crear dos bloques que se solapen y pulsar `Calcular unión/resta` | Se muestran los volúmenes común, unido y restado |
| B2 | Exportar `Unión OBJ · bloques` | Android permite guardar un OBJ con la superficie exterior de la unión |
| B3 | Exportar `Resta OBJ · bloques` | Se guarda el OBJ del bloque activo descontando la segunda pieza |
| B4 | Probar los mismos botones sobre cilindros o perfiles inclinados | La exportación rechaza el tipo de geometría y conserva el proyecto original |
| B5 | Separar completamente los bloques y volver a calcular | El solapamiento tiene volumen 0; intersección OBJ no exporta malla vacía |

Esta lista se usará **solo cuando se recomiende una nueva APK**, no ahora.

## Comprobaciones pendientes: resultados booleanos persistentes (próximo hito)

No instalar otra APK todavía. Cuando se anuncie la próxima versión para móvil, añadir al guion:

| N.º | Operación | Resultado esperado |
|---|---|---|
| R1 | Crear dos bloques parcialmente superpuestos y pulsar `Añadir resta a escena` | Aparece una pieza nueva de malla booleana |
| R2 | Pulsar `Seleccionar resultado`, mover XYZ y volver a `Volver a extrusión` | Solo se desplaza la malla booleana seleccionada; las fuentes conservan su posición |
| R3 | Duplicar y eliminar resultados booleanos | Solo cambian las piezas elegidas |
| R4 | Guardar JSON, cerrar y abrir proyecto | Se conservan todas las piezas, resultados y posiciones |
| R5 | Importar un proyecto anterior v1/v2 | Se abre sin perder sus extrusiones |
| R6 | Exportar OBJ y STL de la escena | Los archivos incluyen extrusiones y resultados booleanos |
| R7 | Seleccionar un resultado e intentar cambiar su altura | Se rechaza la edición paramétrica sin modificar geometría |

## Comprobaciones pendientes: selección táctil y edición de planos (futura APK)

| N.º | Operación | Resultado esperado |
|---|---|---|
| F1 | Crear dos extrusiones separadas; activar `Seleccionar cara` y tocar la pieza que no está activa | La pieza tocada pasa a estar activa y la cara se resalta |
| F2 | Añadir una resta booleana a escena, tocar una cara superior y pulsar `Mover plano +` con 5 mm | Cambia la geometría del resultado booleana y aumenta su volumen, sin modificar las piezas de origen |
| F3 | Usar `Deshacer cara` y `Rehacer cara` | Recupera los volúmenes anteriores y posteriores |
| F4 | Intentar mover una cara más allá del plano opuesto | Rechaza el cambio y mantiene la malla anterior |
| F5 | Guardar JSON y volver a abrirlo | La malla modificada y sus coordenadas XYZ se conservan; el historial de deshacer se reinicia |
| F6 | Seleccionar una cara de una extrusión normal y pulsar las herramientas de plano booleano | Rechaza la operación; la extrusión sigue intacta |

Este guion se ejecutará únicamente cuando se acuerde compilar una APK importante.

## Pruebas pendientes de los controles táctiles (próxima APK importante)

| N.º | Acción en Nothing Phone 2a | Resultado esperado |
|---|---|---|
| T1 | En 3D, activar `Mover: ON`, tocar una pieza y arrastrar con un dedo | Se mueve la pieza, pero no gira la cámara |
| T2 | En `Plano XY`, usar la vista superior y arrastrar diagonalmente | La pieza cambia X/Y manteniendo Z |
| T3 | Cambiar a eje `Z` y arrastrar en una vista frontal | Solo cambia la coordenada Z |
| T4 | Activar rejilla de 5 mm | El desplazamiento se ajusta a múltiplos de 5 mm |
| T5 | Probar sensibilidad 0,5 y 2 para el mismo gesto | Con 2 el desplazamiento es mayor |
| T6 | Arrastrar una pieza, soltar y pulsar `Deshacer mover` / `Rehacer mover` | Vuelve a la posición anterior y recupera la nueva |
| T7 | Mover usando los campos XYZ y deshacer | También se recuperan los valores anteriores |
| T8 | Cambiar a `Seleccionar cara` mientras Mover está activo | Se desactiva Mover; la herramienta selecciona sin trasladar |
| T9 | Ocultar el panel con `Panel: OFF`, girar la vista y volver a mostrarlo | El dibujo ocupa más espacio y los controles se recuperan |
| T10 | Guardar JSON v3, cerrar y abrir | Las posiciones de todas las piezas siguen iguales |

No se necesita instalar nada todavía. Se integrará este bloque en la lista de aceptación de la siguiente **APK aprobada expresamente**.

## Pruebas del manipulador visual (incorporar en el próximo hito de APK)

| Código | Prueba en Nothing Phone 2a | Resultado esperado |
|---|---|---|
| G1 | Crear dos piezas y activar `Mover: ON` | La pieza activa muestra un contorno amarillo y controles X, Y, Z |
| G2 | Arrastrar la flecha X 20–30 píxeles | Solo cambia X y aparece el desplazamiento en mm |
| G3 | Cambiar el eje seleccionado de la barra lateral mientras arrastras la flecha Y | El gesto sigue limitado a Y hasta soltar |
| G4 | Elegir vista frontal y tocar el punto central XY | No comienza un desplazamiento XY inestable |
| G5 | Cambiar a vista superior y arrastrar el punto central XY | Se mueve la pieza en el plano XY |
| G6 | Seleccionar una segunda pieza y pulsar `Centrar pieza` | La cámara encuadra esa pieza sin modificar sus coordenadas |
| G7 | Activar y desactivar el modo Mover y después Seleccionar cara | El manipulador aparece/desaparece inmediatamente |
| G8 | Arrastrar una pieza, soltar, deshacer y rehacer | La posición anterior y la nueva coinciden con el resultado del gesto |

Estas pruebas solo se pedirán al generar **la siguiente APK de hito**, no tras cada commit.

## Pruebas futuras: arrastrar directamente planos 3D

Solo se solicitarán cuando preparemos la próxima APK importante para el Nothing Phone 2a.

| Código | Prueba | Resultado esperado |
|---|---|---|
| D1 | Crear dos bloques parcialmente superpuestos y añadir una resta a la escena | Aparece una malla booleana independiente de las dos extrusiones |
| D2 | Seleccionar `Arrastrar plano: ON`, tocar la cara superior en vista isométrica y arrastrarla ligeramente | Se ilumina el plano completo y la geometría cambia mientras se mueve el dedo |
| D3 | Soltar y pulsar `Deshacer cara`, después `Rehacer cara` | Recupera el volumen anterior y después el modificado |
| D4 | Empezar un arrastre y cancelar o cambiar a `Mover: ON` | La vista previa se descarta y no se crea una operación extra de deshacer |
| D5 | Activar rejilla de 5 mm e intentar arrastrar demasiado una cara | El arrastre se ajusta a 5 mm y se rechaza cualquier posición que invalide la malla |
| D6 | Guardar JSON v3, cerrar y volver a abrir el proyecto | La malla conserva su edición y las extrusiones originales no han cambiado |
| D7 | Intentar arrastrar una cara de una extrusión normal | La aplicación explica que ese modo solo admite resultados booleanos |

## Pruebas futuras: selección de vértices y aristas

Este guion se reservará para la próxima APK importante, sin generar una ahora.

| Código | Acción en el teléfono | Resultado esperado |
|---|---|---|
| V1 | Generar una unión rectangular, activar `Vértices: ON` y tocar una esquina | Se marca el vértice y aparecen sus coordenadas X/Y/Z |
| V2 | Cambiar a `Aristas: ON` y tocar una arista exterior | Se identifica la arista; no aparecen diagonales interiores de triangulación |
| V3 | Elegir eje X, distancia 5 mm y pulsar `Cota +` en una esquina | Se mueve el plano exterior correspondiente y cambia la cota del bloque |
| V4 | Deshacer y rehacer la operación, después guardar y abrir JSON | La dimensión vuelve atrás, se rehace y se conserva tras abrir |
| V5 | Intentar cambiar la cota siguiendo el propio eje longitudinal de una arista | Se muestra un aviso y no se modifica el sólido |
| V6 | Crear una resta que forme una L, seleccionar un vértice y pulsar `Cota +` | Se permite inspeccionar pero se rechaza deformar la malla compleja |
| V7 | Cambiar entre `Mover`, `Seleccionar cara`, `Vértices` y `Aristas` | Los modos son excluyentes y no cambian accidentalmente ni la cámara ni la pieza |

## Pruebas pendientes: cambiar cotas de una pieza no rectangular

Reservadas para la siguiente APK de hito, **no para cada commit**.

| Código | Operación en Nothing Phone 2a | Resultado esperado |
|---|---|---|
| E1 | Crear una resta de dos bloques que deje un resultado con forma de L | Se conserva una malla compleja independiente |
| E2 | Activar Vértices, elegir una esquina exterior y el eje X; pulsar `Escalar eje +` con 5 mm | Se mueve ese extremo, el opuesto queda fijo y el resto de la pieza se escala proporcionalmente |
| E3 | Cambiar al eje Z desde un vértice superior o inferior y aplicar otra escala | Cambia la altura global manteniendo el contorno en L |
| E4 | Deshacer y rehacer ambas escalas | Se recuperan correctamente cotas y volúmenes |
| E5 | Guardar y volver a abrir JSON v3 | Las escalas se conservan y las extrusiones originales siguen intactas |
| E6 | Intentar colapsar toda una dimensión hasta cero | Se rechaza y se conserva la última geometría válida |
| E7 | Seleccionar un vértice interior o una arista longitudinal en el eje que se intenta escalar | Se muestra aviso y no se altera el volumen |
| E8 | Comparar `Cota` en bloque rectangular frente a `Escalar eje` en pieza en L | La primera mueve un plano exterior; la segunda modifica proporcionalmente toda la pieza |

## Pruebas pendientes: diagnóstico de integridad de mallas (próxima APK de hito)

La herramienta **Diagnóstico malla** no necesita una compilación independiente. Estas pruebas se incorporarán al siguiente paquete importante:

| Código | Acción | Resultado esperado |
|---|---|---|
| M1 | Crear una unión de dos bloques y elegir `Diagnóstico malla` | Informa de vértices, aristas, triángulos, un cascarón y volumen positivo |
| M2 | Crear un resultado booleano con cavidad interna y ejecutar el diagnóstico | Identifica cascarón exterior e interior sin rechazarlos como error |
| M3 | Escalar una pieza en L y repetir el diagnóstico | Conserva topología cerrada y actualiza volumen |
| M4 | Abrir un proyecto JSON antiguo y diagnosticar las piezas derivadas | Las mallas válidas siguen cargando sin alteraciones |
| M5 | Intentar importar un JSON de prueba previamente preparado con una cara invertida | Se rechaza el archivo y el proyecto abierto permanece intacto |

**Seguridad:** no modificar manualmente un proyecto de trabajo para fabricar datos corruptos; usar exclusivamente un archivo de pruebas separado.

## Comprobaciones pendientes del bloque de autointersecciones

Se incluirán **cuando se autorice una nueva APK de hito**, no durante los commits de desarrollo.

| Código | Preparación y acción | Resultado esperado |
|---|---|---|
| I1 | Generar una unión entre dos cajas que solapan en volumen y ejecutar `Diagnóstico malla` | Geometría cerrada, volumen coherente y sin autointersección |
| I2 | Crear dos cajas que se tocan únicamente por una arista e intentar exportar su unión OBJ | Se rechaza la unión no manifold; las piezas originales siguen intactas |
| I3 | Unir dos cajas que comparten exactamente una cara | Debe permitir exportar un sólido cerrado sin superficie interior duplicada |
| I4 | Crear una cavidad interior sin perforar la superficie exterior y diagnosticar el resultado | Reconoce los cascarones anidados con signos opuestos |
| I5 | Abrir un JSON **de prueba independiente** con dos mallas cruzadas o una orientación interior incorrecta | Se muestra aviso; el proyecto que estaba abierto no cambia |
| I6 | Guardar y volver a abrir un proyecto válido tras operaciones booleanas | Las piezas y los resultados se conservan, sin recalcular automáticamente las booleanas |

Las pruebas de geometría corrupta deben hacerse solo con archivos específicos de prueba, nunca manipulando un proyecto de trabajo.

## Pruebas de precisión numérica (solo para un futuro hito)

Los casos con piezas alejadas del origen se validan principalmente mediante pruebas automáticas del motor. En una futura APK, la comprobación visual puede consistir en guardar y recuperar un proyecto con varias piezas separadas espacialmente, y verificar que las cotas y volúmenes calculados no cambian tras abrirlo. No generar una APK exclusivamente para esta comprobación.

## Cómo comunicar los resultados

Responder preferentemente con los números y el estado: `1 OK, 2 OK, 3 FALLA, 4 SIN PROBAR...`. En las pruebas fallidas, indicar lo que ocurrió y adjuntar una captura si el error es visual; la captura no es obligatoria.

No pedir la instalación de otra APK por cambios pequeños, documentación o refactorizaciones. Agrupar los fallos corregidos para la siguiente versión importante, salvo cuando un fallo impida utilizar la versión actual.
