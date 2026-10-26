# CADCraft Android — Hoja de ruta del motor geométrico

**Estado: desarrollo experimental posterior al código 0.5.0.** La versión Android declarada en Gradle sigue siendo `0.5.0`; los cambios entre hitos no generan APK automáticamente. Las pruebas JavaScript no sustituyen una compilación Android ni pruebas táctiles reales.

## Objetivo

Acercar el proyecto a un CAD mecánico táctil en Android, con un único flujo de boceto → sólido → edición → exportación, sin confundir una malla triangular cerrada con un sólido paramétrico B-Rep. Las capacidades reales se distinguen de las previstas.

## Qué existe

- **CADCraft 2D integrado como interfaz web** mediante WASM, con selección de algunos perfiles y transferencia al estudio 3D.
- **Estudio 3D propio:** extrusión de perfiles simples, cilindros aproximados por segmentos, navegación y orientación, ViewCube, selección de piezas/caras y varios sólidos por escena.
- **Mallas y operaciones:** booleanas para pares de prismas con perfiles XY ortogonales (rectángulos, L y otros contornos rectilíneos); volúmenes compartidos de perfiles extruidos; edición directa limitada de planos; selección de aristas y vértices; cambio de cotas en cajas y escalado afín de mallas más complejas.
- **Persistencia:** JSON v3 para proyecto y mallas derivadas, y exportaciones trianguladas STL/OBJ.
- **Validación geométrica actual:** triángulos no degenerados ni repetidos; aristas con dos caras y orientación inversa; abanico de caras conexo por vértice; cascarones cerrados con volumen; diagnóstico de números V/E/F, Euler, cascarones y cavidades orientadas.
- **Pruebas:** regresiones JavaScript en cada cambio de `main`; APK generada exclusivamente al lanzar manualmente el trabajo Android con `build_apk=true`.

## Bloque A — Motor geométrico fiable (máxima prioridad)

| Paso | Capacidad | Estado | Criterio de aceptación |
|---|---|---|---|
| A1 | Manifold, orientación de triángulos, triángulos duplicados, cascarones, cavidades, volumen | **Implementado con límites** | Valida el abanico local de vértices, aristas dirigidas y alternancia de cascarones anidados (+ exterior / − cavidad / + isla) |
| A2 | Detección de autointersecciones triángulo-triángulo y superficies superpuestas | **Parcial, en desarrollo** | Barrido por cajas 3D, cruce de superficies y solape coplanar; se rechazan además contactos tangenciales entre caras sin índices compartidos, incluso en un mismo cascarón. Faltan contactos degenerados entre caras adyacentes y tolerancias rigurosas |
| A3 | Tolerancias y robustez numérica | **Parcial, en desarrollo** | Volúmenes calculados con origen local por cascarón; probado hasta 90 millones de mm de desplazamiento. Faltan predicados robustos y tolerancias adaptativas para geometría casi degenerada |
| A4 | Operaciones booleanas generales sobre sólidos cerrados | **Parcial: perfiles ortogonales** | Unión, resta e intersección de perfiles rectilíneos XY extruidos (incluye formas L y cavidades). Los resultados se contrastan con volúmenes por recorte independiente antes de devolver las mallas. Pendientes curvas, cortes oblicuos, rotaciones y mallas generales |
| A5 | Núcleo geométrico compartido y trazable | **Pendiente** | El editor 2D, visor 3D, almacenamiento y exportación usan resultados consistentes del mismo modelo |

**A1/B2 — topología de agujeros:** el diagnóstico calcula el género de cada cascarón cerrado a partir de Euler (V − E + F = 2 − 2g): una placa con un agujero pasante rectangular debe tener un solo cascarón de género 1; una cavidad interior sellada tiene dos cascarones de género 0. Se añade una regresión de resta CSG con volumen 840 mm³, pero todavía no existe una herramienta general de boceto multibucle ni redondeo de taladros.

**A3 — costuras casi coincidentes:** el validador detecta vértices de índices distintos separados por menos que la precisión local de su par mediante un índice espacial, sin recurrir a una búsqueda cuadrática. La presencia de un tercer sólido muy remoto no aumenta el umbral de rechazo para detalles próximos al origen. Los ensayos preservan separaciones reales de 0,000001 mm y rechazan contactos indistinguibles a 90 millones de mm. No equivale a predicados geométricos exactos.

**A1 — cierre incremental:** el validador rechaza ahora vértices con coordenadas 3D exactamente iguales pero índices diferentes (costuras no soldadas), antes de comprobar aristas y abanicos. Dos cascarones realmente separados y las cavidades orientadas válidas siguen admitidos. La detección de vértices *casi* coincidentes queda pendiente de tolerancias adaptativas (A3); no se afirma que esto resuelva todas las autointersecciones A2.

**Nota de precisión:** la detección actual encuentra penetraciones de triángulos, superficies coplanares con área compartida, contactos de punto/arista entre caras sin vértices topológicamente compartidos, contactos entre cascarones separados y cascarones anidados con signos incorrectos. **Aún no certifica una malla arbitraria como libre de todo contacto degenerado**, especialmente contactos tangenciales entre triángulos del mismo cascarón, coincidencias geométricas de vértices no soldados y errores en escalas extremas. El control de coste interrumpe geometrías cuya cantidad de parejas candidatas supera 2,5 millones. Una cavidad válida tiene orientación interior opuesta y no debe confundirse con dos sólidos solapados.

**Regresión ampliada:** 490 verificaciones JavaScript, con pruebas de 375 combinaciones de posiciones y operaciones booleanas, más 8 pruebas de estabilidad volumétrica numérica sobre dos cajas (266 válidas, 10 uniones no manifold correctamente rechazadas, 99 resultados vacíos). La exportación OBJ booleana valida ahora la geometría antes de entregar el archivo. Ninguna de estas pruebas sustituye a GitHub Actions ni al APK Android.

**Mejora A3 adicional:** área 2D, triangulación de bocetos, volumen y recorte de contornos usan productos relativos al origen local para evitar cancelaciones cuando las coordenadas absolutas están a ±90 millones de mm. La detección de contacto emplea además tolerancias por pareja de triángulos, no el tamaño de toda la escena, para no confundir huecos pequeños con intersecciones cuando hay otras piezas a gran distancia. Se añadieron 10 regresiones JavaScript de perfiles cóncavos remotos, cotas, intersección y volúmenes; el núcleo de prototipo Rust tiene regresiones equivalentes, sin afirmar que ya sea el motor del APK.

**Avance A2:** detección de aristas coplanares que atraviesan una cara no coplanar aunque sus dos extremos queden fuera del triángulo. Se comprueban también contactos simétricos y separaciones sin contacto. Este control no elimina las restantes limitaciones de robustez geométrica.

**Siguiente secuencia:** profundizar en contactos tangenciales, robustez de intersección coplanar, tolerancias numéricas y validación cruzada con mallas grandes antes de proponer booleanas generales.


**A1 — tres niveles de anidamiento (26-10-2026):** el diagnóstico expone `materialComponents` (cascarones de profundidad par: sólido exterior e islas de material dentro de cavidades). Se añaden regresiones de tres cascarones anidados (+ exterior, − cavidad, + isla), profundidad `[0, 1, 2]`, volumen neto de 920 mm³ y rechazo de una isla con orientación invertida. Es un contador topológico de componentes materiales, no una validación B-Rep general ni una nueva operación de modelado. No se genera APK en este incremento.

## Bloque B — Modelado CAD

| Paso | Capacidad | Estado | Criterio de aceptación |
|---|---|---|---|
| B1 | Restricciones de boceto: horizontal, vertical, coincidencia, tangencia, cotas | Parcial | Solucionador de restricciones estable y perfiles cerrados reproducibles |
| B2 | Agujeros, islas, perfiles múltiples y extrusiones con vaciados | Pendiente | Crear una placa perforada desde el boceto y medir su volumen |
| B3 | Historial paramétrico y dependencias | **Parcial: regeneración manual** | Los resultados CSG guardan las IDs de sus dos fuentes y pueden regenerarse manualmente tras modificar una extrusión; falta grafo de dependencias, propagación automática e historial paramétrico |
| B4 | Edición directa de caras, vértices y aristas arbitrarios | Parcial | Operaciones sobre sólidos no rectangulares con autocorrección o rechazo sin daño |
| B5 | Revolución, barrido, chaflán, redondeo, vaciado, patrón y simetría | Pendiente | Geometría validada, deshacer/rehacer y pruebas volumétricas |
| B6 | Ensamblajes básicos y organización de piezas | Parcial | Árbol de objetos con nombres, visibilidad, selección y transformaciones por pieza |

**B3 — duplicado seguro:** duplicar una malla derivada valida primero topología y desplazamiento, y solo después reserva un nuevo ID. Si la malla de origen está dañada no se crea ninguna pieza, no cambia la selección y se muestra un error; la copia válida preserva las referencias CSG y queda independiente.

**B3 — integridad del origen:** la orden «Eliminar pieza» rechaza borrar una extrusión utilizada por cualquier resultado booleano, incluido uno heredado. El aviso identifica los resultados dependientes; la escena no cambia. Una vez eliminados los resultados que la referencian, permite borrar la fuente. Esto impide nuevas referencias huérfanas durante la edición, sin modificar proyectos anteriores que ya estén incompletos.

**B3 — lotes seguros:** el panel 3D incorpora «Estado de dependencias» (resultados actualizados, obsoletos, sin fuente y legados sin huella) y «Regenerar obsoletos». La actualización es explícita: primero valida todas las nuevas mallas y sus volúmenes, y únicamente si ninguna falla sustituye los resultados del lote. Ante un origen perdido o una booleana inválida no modifica ninguno. Las mallas heredadas sin procedencia comprobable permanecen intactas. Si falta una fuente de una malla heredada, se avisa expresamente de «origen perdido» (no solo «sin huella») y se bloquea el lote. No crea una APK por commit.\n\n**B3 — actualización controlada:** cada resultado nuevo incorpora huellas ligeras de las dos fuentes y, al seleccionarlo, avisa si el boceto, la altura o el desplazamiento de una fuente han cambiado. Los proyectos JSON v3 anteriores sin este dato continúan siendo compatibles y se señalan con procedencia no verificada. Las huellas solo avisan de cambios; nunca reemplazan la validación geométrica. El botón «Regenerar resultado» reconstruye una booleana seleccionada a partir de las dos piezas originales guardadas en `parents`. No altera las piezas de origen ni el desplazamiento propio de la malla resultado. Si alguna fuente no existe, la booleana es inválida o produce una malla vacía, el resultado anterior permanece intacto. Esta operación sí reemplaza las ediciones directas realizadas sobre la malla derivada; por ello no se ejecuta automáticamente ni constituye todavía un historial paramétrico completo.

## Bloque C — App Android, usabilidad y formatos

| Paso | Capacidad | Estado | Criterio de aceptación |
|---|---|---|---|
| C1 | Editor 2D y 3D sin transiciones artificiales | Parcial | La edición de boceto conserva asociación con el sólido y sus operaciones |
| C2 | Manipuladores táctiles, selección precisa, ViewCube y gestos | Parcial | Funcionamiento contrastado en Nothing Phone 2a, sin interferencias con la cámara |
| C3 | Guardado seguro y recuperación de sesión | Parcial | Autosalvado y restauración tras cierre forzado sin archivos corruptos |

**C3/A3 — construcción transaccional de piezas:** «Nueva pieza» y «Duplicar pieza» validan el desplazamiento y el ID antes de cambiar listas u ocupar identificadores. Si las coordenadas alcanzan el límite permitido, la operación falla sin alterar el proyecto ni perder la secuencia de IDs. Incluye regresión de los límites de ±100 millones de mm.

**C3 — guardado validado:** antes de descargar el proyecto JSON, el guardado comprueba los perfiles de origen, las mallas booleanas, las coordenadas y la unicidad de IDs sin alterar la escena. Si una malla está rota, se rechaza el guardado y se conserva el trabajo en pantalla. Una dependencia CSG obsoleta sigue pudiendo guardarse para no perder cambios pendientes; solo se bloquea su exportación geométrica. El autosalvado/recuperación tras cierre sigue pendiente.
| C4 | Intercambio CAD: STL/OBJ/DXF y STEP | Parcial | STL/OBJ fiables; DXF más completo; STEP solo si existe un motor CAD capaz de representarlo correctamente |

**C4 — coherencia de dependencias:** los resultados CSG obsoletos o sin pieza de origen impiden la exportación general OBJ/STL con un mensaje explicativo. Se conserva la escena y se requiere regeneración explícita. Los resultados heredados sin huella y con fuente existente se siguen pudiendo exportar tras validación geométrica, sin recalcular nada automáticamente.

**C4 — puerta de exportación:** la salida general OBJ y STL comprueba primero la validez topológica de **cada sólido** (caras, orientación, cierre y autointersección) y cancela la exportación completa si uno está dañado, identificando su ID. Las piezas independientes pueden solaparse sin que se traten erróneamente como una sola booleana. Estas comprobaciones no certifican conformidad CAD industrial ni un formato STEP.
| C5 | Rendimiento y memoria en Android | Pendiente | Escenas grandes, benchmarking y comprobaciones en dispositivo |
| C6 | Integración, firma y distribución privada | Parcial | APK de hito reproducible, artefacto verificado y guion de pruebas de aceptación |

## Reglas de desarrollo y entregas

1. **Corregir errores de integridad antes de habilitar operaciones más peligrosas.** Toda modificación deberá validar su malla candidata antes de reemplazar la anterior.
2. Cada bloque incluye pruebas de rechazo y casos geométricos válidos; una prueba verde de JavaScript **no demuestra** que el APK compile.
3. Agrupar commits pequeños sin APK. El trabajo `android` de GitHub Actions solo se ejecuta manualmente con consentimiento explícito `build_apk=true`.
4. En cada hito importante: comprobar `preflight`, solicitar la compilación de APK, verificar el artefacto y facilitar al usuario una tabla de pruebas concretas para su Nothing Phone 2a.
5. Documentar los fallos de compilación y su corrección antes de liberar un nuevo hito.

## Próximos pasos de ejecución

1. Completar A1 con casos límite de orientaciones y componentes de superficie, **sin romper cavidades válidas**.
2. Abordar A2 (autointersección y contacto de triángulos no adyacentes) con pruebas unitarias pequeñas.
3. Elegir un algoritmo/representación robusta para A4; la descomposición en celdas ortogonales no es suficiente para un motor CAD general.
4. Unir el modelo del boceto y el sólido antes de desarrollar muchas más herramientas visuales.
