# Motor 3D experimental — CADCraft Android

Este módulo Rust independiente inicia el desarrollo de las dos funciones prioritarias antes de modificar otros fallos:

1. **EXTRUIR:** convierte un perfil poligonal 2D simple y cerrado, incluido un perfil cóncavo sin agujeros, en una malla de triángulos con tapas y laterales. Acepta altura positiva o negativa.
2. **ViewCube / cámara:** posiciones predefinidas (superior, inferior, frontal, posterior, izquierda, derecha e isométricas) y rotación por arrastre (órbita).

## Estado real

**Código fuente del prototipo creado, todavía NO integrado en el CADCraft WebAssembly ni verificado con pruebas de compilación.** No crea sólidos B-Rep ni añade entidades CADCraft/DXF. Para usarlo con el programa habrá que enlazar el módulo al motor Rust, almacenar objetos 3D en el documento, renderizarlos, hacer picking, añadir controles táctiles y guardar/abrir datos. La geometría 3D puede visualizarse solo cuando se complete esa integración.

## Comprobación local

```bash
cd native3d
cargo test
```

No compilar APK hasta solicitarlo expresamente. Las incidencias de teclado, guardado y selección quedan aparcadas.

## Edición paramétrica del prototipo (26-10-2026)

El adaptador Rust `PreviewState` permite actualizar la altura de una extrusión existente con `set_solid_height(id, height)`: reconstruye y valida la malla candidata antes de cambiarla, conserva el identificador y el vínculo al perfil 2D, y rechaza alturas no válidas sin modificar la escena. `refresh_source_profile` respeta después esa altura individual. El contador de identificadores evita reutilizaciones cuando alcanza el límite de `u64`. Hay pruebas Rust para cambios válidos, rechazo, integridad de otras piezas y agotamiento de IDs. **Es una API del prototipo; todavía no está integrada en la APK.**
