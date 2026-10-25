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

## Cómo comunicar los resultados

Responder preferentemente con los números y el estado: `1 OK, 2 OK, 3 FALLA, 4 SIN PROBAR...`. En las pruebas fallidas, indicar lo que ocurrió y adjuntar una captura si el error es visual; la captura no es obligatoria.

No pedir la instalación de otra APK por cambios pequeños, documentación o refactorizaciones. Agrupar los fallos corregidos para la siguiente versión importante, salvo cuando un fallo impida utilizar la versión actual.
