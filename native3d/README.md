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
