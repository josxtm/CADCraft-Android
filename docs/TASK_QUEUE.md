# Cola acotada de tareas — Issue #6

## Estado real de esta entrega

El controlador y su adaptador `codex exec` están implementados. **La ejecución de
agentes está desactivada** en los dos campos de autorización de `automation/queue.json`.
No hay cron, `schedule`, `workflow_run`, servicio residente ni webhook que genere
código. El workflow de esta PR ejecuta pruebas, nunca un modelo.

Se distingue entre:

| Capacidad | Evidencia / estado |
| --- | --- |
| CLI no interactiva | `codex-cli 0.163.0`, `codex exec --help` disponibles |
| Sesión existente | `codex login status` indica ChatGPT; solo se registra el modo, nunca credenciales |
| GitHub del entorno publicado | API y Git operativos; PR #5 y su CI verificadas anteriormente |
| Encadenamiento del controlador | Prueba con dos tareas, ramas/commits Git reales en repositorios temporales; agente, PR y checks simulados |
| Reparación y detención | Fallos locales/CI inyectados; máximo dos reparaciones; no avanza tras bloqueo |
| Generación real desatendida | **No ejecutada**; no se ha autorizado/activado una tanda con el adaptador |
| Nueva tarea automática en Codex Cloud | **No implementada ni demostrada**; no hay un servicio de despacho conectado |

La simulación no cumple por sí sola el criterio de la Issue #6 de demostrar dos
tareas reales con PR y checks reales sin mensaje intermedio. Ese criterio queda
pendiente de una prueba real, acotada y autorizada. No se presenta CI como agente.

## Límite técnico y alternativa segura

Publicar un entorno conserva archivos/herramientas y configuración. No instala un
planificador, no mantiene procesos vivos indefinidamente y no permite que este
chat se envíe a sí mismo otro mensaje. El entorno sirve para ejecutar el controlador
en primer plano; una tanda termina al agotar su cola o sus límites.

El CLI instalado ofrece `codex cloud exec --env <ENV_ID> --branch <rama>`, pero es
una interfaz experimental de envío de tareas: la presencia del comando no prueba
acceso de creación, facturación, restauración ni lectura de resultados. No se ha
invocado, no se ha deducido un ENV_ID de metadatos internos y no se ha conectado a
la cola. Si se adopta ese backend habrá que comprobar por separado esas capacidades
y las garantías de coste/cancelación antes de autorizarlo.

La alternativa implementada es **una tanda finita local con `codex exec`** dentro
del entorno publicado. Una vez iniciada y autorizada, el mismo proceso puede pasar
de una tarea a otra, sin pedir mensajes entre pasos, esperando la CI. No crea nuevas
sesiones cloud. Para usarla se requiere aprobación explícita del propietario para
consumir su suscripción existente; la autorización no se presume de `login status`.

No se ha instalado ni usado `openai/codex-action`: su documentación exige una API
key del proveedor y usa Responses API. Eso sería otra integración y podría generar
cargos. No se copia la sesión de ChatGPT a GitHub Actions ni se solicita una clave
en el chat. Sin autorización, la alternativa inmediata es continuar de forma
supervisada en este entorno, una issue por rama y PR.

Referencias verificadas: [CLI oficial, modo no interactivo](https://github.com/openai/codex/blob/main/docs/exec.md),
[acción oficial y sus requisitos de API](https://github.com/openai/codex-action#readme)
y los comandos `codex exec --help` / `codex cloud exec --help` instalados. No se
necesita contactar con un proveedor de IA para ejecutar las pruebas de esta PR.

## Cola, estados y dependencias

`automation/queue.json` contiene el repositorio, la rama base, prioridades,
dependencias, checks requeridos y límites. Los estados son `pending`, `running`,
`blocked` y `done`. `done` significa **PR en borrador abierta, SHA exacto verificado**,
nunca fusionada. Se vuelve a comprobar al reutilizar una dependencia; una PR cerrada,
lista para revisión, con nuevo SHA o CI fallida bloquea el avance hasta revisión.

Propuesta inicial, sin ejecutarla:

| Issue | Prioridad | Dependencia | Base de código | Estado inicial |
| --- | --- | --- | --- | --- |
| #4, acceso a archivos | 0 | ninguna | main | done: PR #5, `d3af0de25cc390c19c33506a1f87181a8678ace1` |
| #1, teclado/comandos | 10 | #4 | rama verificada de #4 | pending |
| #2, navegación/integración | 20 | #1 | rama verificada de #1 | pending |

Issue #6 no está en su propia cola. La propuesta no fusiona PR #3 ni PR #5. Las
instrucciones de PR #3 se recogen aquí como plantilla revisable. Cada tarea nueva
tiene una rama determinista `codex-queue/issue-N` y su PR en borrador. Con `base_task`
se crean PR apiladas contra la rama anterior, por lo que cada diff corresponde al
nuevo trabajo, sin mezclarlo con cambios aún no fusionados. Solo se admite una base
de código; el resto de dependencias son de orden. La revisión/merge seguirá siendo
humana y requerirá resolver después las bases/rebases de esas PR.

Para PR apiladas, el filtro `pull_request: branches: [main]` puede no lanzar CI.
El controlador despacha **solo** `android-apk.yml` sobre la rama actual con
`build_apk=false`. Ese workflow protegido ya existe y debe conservar este contrato.
`check_gate` exige los checks configurados sobre el SHA de esa PR. Un check vacío,
omitido o pendiente no cuenta como correcto; un job `android` que no esté omitido
bloquea. La cancelación de CI bloquea en lugar de lanzar una reparación automática.
Se consultan directamente todas las páginas de `commits/<sha>/check-runs`: el
resumen de checks de una PR puede tardar o no mostrar un dispatch manual. No se
asume que ese resumen equivale a la lista de comprobaciones del commit.

## Ejecución, credenciales y aislamiento

Consultar, sin iniciar modelos ni modificar GitHub:

```sh
python3 scripts/task_queue.py plan
python3 scripts/task_queue.py doctor
```

`doctor` requiere checkout limpio, toolchain activo, autenticación CLI de ChatGPT,
metadatos de escritura GitHub y checks correctos de las PR declaradas `done`.
No verifica una llamada al modelo ni garantiza
que una sesión restaurada tenga autenticación vigente.

En este entorno las herramientas están en `/workspace/.cadcraft-tools` (Node 22,
Rust, JDK 17 y Gradle 8.13). Activar sus rutas y las variables `CARGO_HOME`,
`RUSTUP_HOME`, `ANDROID_HOME`, `ANDROID_USER_HOME` y `GRADLE_USER_HOME` como en la
preparación del entorno. En otros repositorios esas rutas no son portables:
preparar primero el entorno equivalente y adaptar `automation_checks.py` y los
nombres de checks. El controlador no instala herramientas ni altera versiones.

**Solo después de autorización para una tanda finita**, el propietario podrá
revisar una copia de la cola fuera del checkout (por ejemplo,
`/workspace/.cadcraft-queue/authorized.json`) y poner allí `enabled` y
`executor_authorized` a `true`. La plantilla versionada permanece desactivada y
el checkout limpio. Entonces podrá ejecutar:

```sh
python3 scripts/task_queue.py run --config /workspace/.cadcraft-queue/authorized.json --authorize-subscription-use
```

Ese comando no se ejecutó como demostración en esta entrega. No es una invitación
a habilitar un planificador. Necesita GitHub con contenido/PR de escritura y Actions
de lectura/escritura para el dispatch, limitado a este repositorio. Se reutiliza
la autenticación inyectada por la plataforma; nunca se guardan valores de tokens.
El CLI reutiliza el login de ChatGPT, ignora configuración de usuario para no
heredar MCP/hooks y no admite aquí API-key billing. Si falta acceso, se bloquea.

El controlador retiene Git/GitHub. Al agente se le retiran variables cuyos nombres
indican tokens, contraseñas o API keys. Sus comandos se ejecutan con sandbox
`workspace-write`, red de shell desactivada, sin aprobaciones interactivas ni
bypass. No se solicita un modelo ni nivel de razonamiento distintos de los valores
predeterminados del CLI. No se guardan eventos brutos del agente ni salidas de
comandos en logs persistentes. La consola/estado solo publican estados, motivos
acotados y enlaces, sin valores de credenciales.

Estos controles no son una frontera de seguridad contra código hostil de otro
usuario: se requiere un entorno dedicado, cola revisada por el propietario y
credenciales acotadas. No ejecutar issues de terceros sin revisarlas. Las pruebas
locales ejecutan código del repositorio con variables de credenciales retiradas;
no debe haber secretos ajenos ni permisos amplios en el host. Cambios de
infraestructura/test harnesses se bloquean y necesitan una tarea supervisada.

## Límites, fallos y kill switch

- Una invocación: máximo 2 tareas, 3 llamadas totales al agente y 30 minutos.
- Una tarea: llamada inicial y como máximo 2 reparaciones, compartidas entre
  fallos locales y CI. Nunca hay un bucle de reparaciones sin límite.
- Comando/modelo: máximo 10 minutos, salida acotada; CI: máximo 10 minutos.
- No existe una API de gasto en euros/dólares conectada. Los límites son de tiempo
  e invocaciones, **no garantizan un importe máximo** ni disponibilidad de cuota.
  Un backend de API de pago requeriría aprobación y controles de gasto adicionales.
- Ejecutable ausente, autenticación, permiso, SHA inesperado, rama existente,
  paths protegidos o error desconocido: `blocked`, sin continuar con la siguiente.
- Una reparación de CI exige logs de fallo del mismo SHA; si no se pueden leer,
  se bloquea sin gastar llamadas al agente a ciegas. Se redactan credenciales
  conocidas antes de pasar un diagnóstico acotado al agente. El dominio de descarga
  de logs (`results-receiver.actions.githubusercontent.com`) sigue restringido en
  el entorno inspeccionado: antes de una demostración real de reparación deberá
  permitirse en red y verificarse, sin ampliar permisos a dominios innecesarios.
  Su incorporación aditiva está guardada en el borrador del entorno, conservando
  `api.github.com`; falta revisar, guardar y publicar esa configuración. No se ha
  aplicado a esta instancia ni afirmado que la descarga de logs ya funcione.
- Git local y una rama remota de bloqueo impiden controladores simultáneos. El
  bloqueo remoto se crea/elimina con compare-and-swap (`--force-with-lease`);
  otro propietario no puede liberarlo por accidente. No se fuerza main.
- El estado se escribe atómicamente fuera del checkout, por defecto en
  `/workspace/.cadcraft-queue/josxtm--CADCraft-Android/`. Un estado `running`
  interrumpido, `blocked` o con configuración cambiada nunca se reinicia solo.
- Se conserva el trabajo fallido en su rama; no se hace reset, stash ni limpieza
  destructiva. La rama original solo se restaura cuando el checkout está limpio.

Detención manual desde otro terminal, sin esperar al candado del controlador:

```sh
touch /workspace/.cadcraft-queue/josxtm--CADCraft-Android/STOP
# También, si el script/config siguen presentes en el checkout del controlador:
python3 scripts/task_queue.py stop
```

Usar la ruta del estado elegida si se pasó `--state-dir`. El `touch` funciona incluso
mientras el controlador está en una rama de tarea que no contiene estos scripts.

El archivo `STOP` se revisa antes de operaciones y durante subprocesos. Se termina
el grupo del proceso hijo en caso de detención/timeout. `SIGINT`/`SIGTERM` activan
la misma detención. Cancelar un workflow de pruebas también bloquea el avance al
observar su estado. No borrar `STOP` ni el estado para reintentar automáticamente.

Si el proceso recibe `SIGKILL` o la máquina desaparece, puede quedar la rama
`codex-queue-controller-lock` remota. **No caduca ni se roba automáticamente**:
un operador debe comprobar que no hay un controlador vivo, revisar rama/PR/SHA y
estado, preservar el trabajo y liberar el bloqueo concreto con lease. Reconciliar
los contadores existentes antes de cualquier reanudación; no reiniciar el límite
de dos reparaciones borrando el estado. Un error al liberar el bloqueo también
requiere revisión, sin activar otra tanda.

## Plantilla y pruebas

Archivos reutilizables: `AGENTS.md`, `DEVELOPMENT_PLAN.md`, `automation/queue.json`,
`scripts/task_queue.py`, `scripts/automation_checks.py`, `scripts/test_task_queue.py`
y `.github/workflows/task-queue.yml`. Adaptar explícitamente repositorio, issues,
dependencias, validadores y el workflow manual protegido antes de activar nada.
El backend de dispatch está diseñado para el contrato de `android-apk.yml` de
CADCraft; no se presenta como plug-and-play para cualquier workflow.

```sh
python3 -m unittest discover -s scripts -p 'test_task_queue.py' -v
python3 scripts/automation_checks.py
```

Las pruebas no llaman a Codex, a GitHub ni a APIs de pago. Usan bare repositorios
Git temporales y servicios simulados para demostrar secuencia sin mensaje
intermedio, una rama/commit/PR simulada por tarea, reparación, bloqueo, cancelación,
protección de native3d, exactitud de SHA, límites, locks y ausencia de secretos en
errores. También comprueban los argumentos del adaptador CLI sin invocarlo.

CI ejecuta esas pruebas y las regresiones existentes JS/Python/Rust. No se cambia
`native3d`, no se empaqueta APK y no hay merge automático. Una PR verde verifica
el controlador, no una ejecución real del agente. La demostración pendiente debe
registrar dos PR reales, SHA/checks de ambas y una detención real ante fallo, en
una tanda expresamente autorizada y con tareas de prueba revisadas.

Validación local de esta entrega: 38 pruebas del controlador correctas, regresiones
JS/Python existentes correctas y 45 pruebas Rust correctas. Además, el nuevo
validador `--android` se ejecutó sobre una copia temporal del SHA de PR #5:
13 pruebas Android nuevas y correctas, sin fallos ni omisiones ni APK. Esa prueba
valida el comando de la cola sobre su dependencia; no se atribuye a este branch
una suite Android que aún no está en main.

También se comprobaron realmente `doctor`, la lectura paginada de checks por SHA
con `gh 2.46.0` del entorno y el dispatch manual de CI con `build_apk=false` sobre
esta rama. GitHub aceptó el dispatch y omitió el job APK. Estas operaciones sí
usan GitHub; las pruebas unitarias descritas antes no lo usan. Ninguna inició un
agente ni una llamada de generación de código.

## Primera prueba real autorizada: bloqueada

El propietario autorizó una tanda finita de las dos tareas de la cola. Se habilitó
solo una copia externa de la configuración, conservando la plantilla desactivada.
El controlador comprobó la dependencia PR #5, tomó/liberó los bloqueos y llamó una
vez a `codex exec` para Issue #1. El proceso salió con código 1 antes de producir
cambios. La tarea quedó `blocked` con `agent_calls: 1`; Issue #2 permaneció
`pending`. No se crearon PR nuevas ni se despachó CI para esas tareas.

Se verificaron los argumentos del CLI sin inferencia (`exec --help`) y la lectura
del catálogo (`debug models`). El catálogo se pudo leer. El directorio de estado
`/run/codex-environment/codex-home` es de solo lectura y genera una advertencia;
no se ha demostrado que esa advertencia sea la causa fatal.

Una comprobación HTTP independiente al endpoint
`https://chatgpt.com/backend-api/codex/responses`, sin credenciales ni petición de
generación, recibió `403` del proxy al establecer CONNECT. Este es un bloqueo de
red confirmado. El controlador descartó stderr del primer proceso: solo conserva
`Command failed: codex (exit 1)`, por lo que no se atribuye con certeza su causa
interna al proxy ni a la advertencia de archivos. La demostración de dos tareas
reales continúa pendiente.

Se añadió `chatgpt.com` al borrador de red conservando los dominios anteriores;
requiere revisión, guardado y publicación. No se pidió API key, no se cambió el
modo de autenticación ni se activó un servicio permanente/de pago. Tras resolver
el acceso, hará falta revisar el estado bloqueado y la rama local vacía antes de
una reanudación explícita, conservando el intento ya registrado y los límites.
La configuración externa se volvió a desactivar; el estado y sus contadores se
conservan. No se hizo merge, APK ni cambios en `native3d`.
