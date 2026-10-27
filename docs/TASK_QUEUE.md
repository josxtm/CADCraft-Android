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
| Generación real desatendida | Issue #1: PR #8 verificada tras 4 invocaciones acumuladas y 1 reparación supervisada; Issue #2 pendiente de renovar la sesión restaurada |
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

Validación local de esta entrega: 41 pruebas del controlador correctas, regresiones
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

## Revalidación de red y conexión mínima: autenticación pendiente

La nueva red permite llegar a `chatgpt.com`: una petición HEAD al endpoint de
respuestas devolvió 405/Allow POST en lugar del anterior bloqueo CONNECT 403.
Eso comprueba transporte, no autenticación ni generación.

Se ejecutó una prueba mínima real de `codex exec`, sin herramientas y con sandbox
de solo lectura, conservando completos stdout y stderr en archivos privados fuera
del repositorio. El primer resultado fue:

```text
Error: failed to initialize in-process app-server client: Read-only file system (os error 30)
```

El código oficial del tag `rust-v0.163.0`,
`codex-rs/core/src/installation_id.rs`, confirma que el arranque abre
`$CODEX_HOME/installation_id` con lectura/escritura incluso en modo efímero. Se
concedió permiso de escritura en la ubicación original de estado para este turno;
no se cambió CODEX_HOME ni se copiaron credenciales. Este permiso no modifica por
sí solo la configuración persistente del entorno.

Tras ese cambio, una segunda prueba mínima pudo arrancar el cliente y alcanzar el
servicio, pero terminó con 401 en catálogo y respuestas. El error final fue:

```text
Your access token could not be refreshed because you have since logged out or signed in to another account. Please sign in again.
```

Ahora la causa está registrada: la autenticación que recibe el CLI no es válida o
renovable. `codex login status` no basta para demostrar una sesión utilizable. No
se volvió a intentar la tarea de código ni se alteró el estado de la cola:
Issue #1 sigue bloqueada con un intento registrado e Issue #2 sigue pendiente.
No hay nuevas PR ni ejecuciones de Actions para esas dos tareas.

Los errores completos originales están en directorios privados
`/workspace/.cadcraft-queue/connection-check-*`; la segunda prueba corresponde a
`connection-check-3c8be6e0`. Se guardó también
`error-completo.redactado.log` para revisión sin exponer credenciales.

La autenticación interactiva del CLI necesita el host `auth.openai.com`, cuyo
CONNECT sigue devolviendo 403. Se incorporó ese dominio al borrador de red sin
quitar los anteriores; falta revisar, guardar y publicar. Después, el propietario
debe autenticar el CLI de forma segura con su cuenta ChatGPT, por ejemplo mediante
`codex login --device-auth`, sin API key de pago ni valores de tokens en el chat.
Será necesario mantener acceso de escritura al estado del CLI durante esa
operación y las siguientes ejecuciones. La autorización de la tanda ya existe;
lo pendiente es conectividad de login y autenticación válida. Solo una prueba
mínima correcta permite reconciliar/reanudar la cola preservando contadores.

## Login completado y reanudación real: límite alcanzado sin cambios

El propietario completó personalmente `codex login --device-auth`. El CLI confirmó
`Successfully logged in` y la prueba mínima posterior respondió `CONNECTION_OK`
con código 0. No se copian aquí códigos de acceso, credenciales ni tokens.

Se reanudó Issue #1 preservando el intento anterior. El agente terminó con código
0 sin modificar archivos. Un diagnóstico de herramientas de solo lectura reveló:

```text
error building bubblewrap command: app-server socket directory must be a user-owned directory with mode 0700
```

La ruta `/tmp/codex-daemon-1000` aparece enmascarada con modo 000 dentro del sandbox
padre. El código oficial de `codex-uds` confirma que es una ruta reservada para RPC
privilegiado. No se modificaron sus permisos ni se desactivó el sandbox de Codex.

Se solicitó y concedió la ejecución de una prueba fuera del sandbox padre,
manteniendo el sandbox propio del CLI y la red de shell desactivada. Esa prueba
ejecutó `pwd` y `git status` con código 0. Después se autorizó por la misma vía la
tanda acotada, conservando protecciones, contadores, locks y checks del controlador.

El último intento de Issue #1 volvió a salir con código 0 sin producir cambios.
El adaptador anterior descartó su mensaje final, por lo que no se atribuye una causa
específica a ese último resultado. Las pruebas locales del código existente pasaron,
pero no constituyen una corrección de Issue #1. No hubo commit/PR/CI de esa tarea.

Estado final de la prueba: Issue #1 `blocked`, `agent_calls: 3`, motivo
`Agent produced no changes`; Issue #2 `pending`, 0 llamadas. Son invocaciones
registradas, no tres generaciones verificadas: la primera falló al arrancar el CLI.
Se conservaron las instantáneas de estado, se liberó el lock remoto, se restauró
la rama del controlador y se desactivó la copia externa de configuración. No se
reiniciaron contadores ni se hicieron merge/APK/cambios en native3d.

Se corrigió el adaptador para conservar un informe final redactado y diagnósticos
de comandos/fallos de turno, sin guardar transcripciones brutas. Ahora bloquea
un resultado sin cambios antes de ejecutar la suite del código original. Las
regresiones cubren errores de herramientas, redacción de JWT/token y turno fallido.
No se ha reejecutado el agente con ese cambio: su límite de tres invocaciones ya
está agotado y necesita una autorización explícita para ampliarse. La demostración
de dos tareas reales con PR/CI propias sigue sin completarse.

## Intento adicional autorizado y preflight de escritura

El propietario autorizó exactamente una llamada adicional para Issue #1. El campo
opcional `additional_agent_calls` admite únicamente un mapa issue→1; por defecto
no existe ninguna ampliación. La copia externa puede contener `{"1": 1}`: el tope
de esa tarea pasa de 3 a 4 conservando `agent_calls: 3`, sin ampliar ninguna otra.
Los límites globales, de tiempo, reparaciones y paths protegidos permanecen.

Se comprobó CWD y detección mediante Git y se ejecutó un diagnóstico Codex con
sandbox workspace-write: creó un archivo temporal, leyó WRITE_OK y Git lo detectó
como untracked. El controlador lo eliminó; no se modificó código del proyecto.
Esta comprobación se hizo fuera del sandbox padre, con autorización específica,
conservando el sandbox propio del CLI y su red de shell desactivada.

El prompt declara ahora la autorización de esta invocación finita y el CLI recibe
`--cd` explícito. Se guarda el prompt efectivo en el directorio privado temporal
del controlador durante la ejecución. La causa del último resultado vacío anterior
no puede reconstruirse retroactivamente porque se descartó su informe. Se ofrece
además una referencia local de upstream v0.13.0 sin metadatos Git, fuera del checkout,
para que el agente pueda investigar offline sin cambiar el núcleo experimental.
Validación de estas correcciones: 43 pruebas locales correctas.

## Continuación supervisada: PR #8 verificada

El intento adicional autorizado sí produjo cambios para Issue #1: input HTML
enfocable con IME y botón Deseleccionar, conservados en la PR borrador
https://github.com/josxtm/CADCraft-Android/pull/8 . La cola se detuvo porque
`scripts/check-command-patch.py` era un nuevo test en un path reservado.

En la continuación supervisada se trasladaron únicamente los dos tests nuevos a
`tests/commands/`. No se cambió `FROZEN`, ningún harness existente, workflow o
configuración de build. El diff completo contra la base verificada de PR #5
pasó la misma regla original. Se conservan `agent_calls: 4` y `repairs: 1`; no
hubo quinta llamada al agente ni reinicio de contadores.

La dependencia craft-libs/hayro-jbig2 y el target WASM ya pudieron prepararse con
la red existente. `cargo check --locked --target wasm32-unknown-unknown
-p cadcraft-web -j 4` pasó sobre una copia desechable del upstream v0.13.0 con el
parche aplicado, sin cambiar pins ni lockfile. También pasaron 18 comprobaciones
del puente, 8 del parche, regresiones JS/Python, 45 pruebas Rust en copia temporal
y 13 Android (0 fallos/errores/omisiones). Los tests nuevos de comandos se ejecutan
localmente y aún no forman parte del workflow protegido.

GitHub Actions verde para el candidato exacto
`8c6fadfd958e407fc7616f9c623f42d1ac9a3851`:
https://github.com/josxtm/CADCraft-Android/actions/runs/40550328949 . Ambos checks
requeridos correctos; el job APK está omitido. Se reconcilió Issue #1 a `done`,
que aquí significa PR borrador verificada, sin cerrar la issue ni hacer merge.
Las pruebas reales de teclado y batería en dispositivo siguen pendientes de un
hito expresamente autorizado.

Antes de gastar un intento de Issue #2, la prueba mínima del CLI restaurado
devolvió 401: `Could not parse your authentication token. Please try signing in
again.` y `Your access token could not be refreshed because you have since logged
out or signed in to another account. Please sign in again.` Se inició el flujo
de dispositivo para que el propietario lo complete personalmente; no se guardan
códigos ni credenciales aquí. Issue #2 permanece `pending`, con 0 llamadas, y la
copia externa sigue desactivada. Una publicación del entorno no garantiza que
la autenticación interactiva sobreviva a la restauración.

La recuperación necesitó intervención supervisada: no demuestra por sí sola dos
tareas reales consecutivas sin intervención. Tras renovar acceso se comprobará
una conexión mínima y se podrá reanudar la segunda tarea con los límites
originales. No se habilitaron servicios, scheduler, API de pago, APK ni merge.
