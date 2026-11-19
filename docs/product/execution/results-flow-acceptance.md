# Flujo por resultados: integración y evidencia

Fecha de comprobación: 2026-10-30. Estado y aceptación pendientes se registran solo
en el [plan maestro](../plan-maestro.md#evolución-hacia-planeación-y-cierre-por-resultados).
Reglas: [catálogo](../catalogo-modulos.md#planeación-por-entregables-y-cierre-verificable).

## Resultado integrado

El alta solicita estado final, alcance y entregables con criterios/evidencia.
El Supervisor mantiene ese compromiso; los ingenieros desarrollan actividades en
tabla y Gantt del mismo conjunto y actualizan desde un modal contextual sin aprobación.
Un bloqueo tiene reporte, primera atención y resolución distintos. Terminar una
actividad no solicita aceptación: el ingeniero presenta explícitamente el entregable,
el Supervisor acepta/devuelve y el proyecto cierra con el conjunto aceptado y su
declaración de cumplimiento del estado final.

Los cambios conservan revisiones firmadas, autoría, motivos y alternativas concurrentes.
No se elige una rama por timestamp. Activar un proyecto con trabajo anterior exige
seleccionar su entregable receptor; conserva IDs, evidencias y perfiles originales
y no hereda sus aprobaciones como aceptación nueva. El formato de espacio impide
que un binario anterior continúe escribiendo sobre el historial activo.

La lectura semanal diferencia ejecución y aceptación. Mantiene la referencia inicial,
denominadores, zona de México, ausencia de datos y conflictos; no promedia avances
personales ni transforma número de tareas en capacidad. La captura diaria menor
a 60 s continúa siendo un objetivo a medir, no un resultado acreditado.

## Fuentes e integración

| Concepto | Fuente canónica / consumidor |
|---|---|
| Dominio, criterios y transiciones | `contracts/v1/project_results.schema.json`, semántica en `project_results.md`, validadores `project_results.rs` |
| Entradas/respuestas IPC | `project_results_operations.schema.json`; tipos TS generados y `results-api.ts`; comandos delgados `results_commands.rs` |
| Revisiones y autoridad persistida | `project_results_storage.schema.json`; `results_store.rs`; nombres relativos del layout de espacio |
| Tabla/Gantt/modal y creación | `ResultsWork*`, `CommitmentEditor.tsx`, `Projects.tsx` |
| Indicadores | `results-metrics.ts`, con entradas autenticadas del detalle y pruebas temporales sintéticas |
| Listado/reporte | Proyecciones de `projects` y `activities`; snapshot incluye `result_projects`; no vuelve a escribir datos del dominio |

El DAG documentado distribuyó escrituras disjuntas de backend, interfaz y métricas.
La integración revisó contrato y consumidores y todas las ramas convergieron en
la comprobación del conjunto. El grafo se comprobó acíclico con un único destino
`ce_gate`; no se creó otro backlog o estado paralelo.

## Evidencia automatizada

| Comprobación | Resultado |
|---|---|
| Contratos y bindings | 48 casos de preferencias, 55 de dominio y 98 de operaciones/almacenamiento; generadores TS sincronizados |
| Frontend | 88 pruebas en 13 archivos aprobadas; captura autónoma, roles, borradores, doble envío, reintento de archivo, foco, migración explícita, revisión/cierre y métricas |
| Rust | 53 pruebas aprobadas; incluye recorrido aislado con sesiones reales y pruebas IPC/serialización |
| Gate 0 | Aprobado: contratos, TypeScript, cargo check, suites y upgrade/rollback aislado de perfiles |
| `npm.cmd test` final | Aprobado: 201 casos de contratos, 88 frontend y 53 Rust |
| Compilación frontend | `npm.cmd run build` aprobada |
| Compilación nativa local | `cargo build --manifest-path src-tauri/Cargo.toml --bin easyfab --features tauri/custom-protocol` aprobada; assets de producto embebidos |

Ejecutable local de prueba: `src-tauri/target/debug/easyfab.exe`, 17 236 480 bytes.
SHA256: `A982460D0A85146D6D4F59413EB06730907D7B244CC9A472F3AFC3CC996E7857`.
No constituye publicación en la carpeta corporativa ni aceptación operativa.
La recompilación posterior incluye el estado actual del panel de actividades; las pruebas anteriores conservan su corte de integración y no equivalen a una nueva aceptación funcional de ese panel.


Se ejecutó `npm.cmd test`; el primer enlace Rust encontró LNK1104 porque otra prueba
todavía mantenía abierto el ejecutable. Se dejó terminar esa ejecución y se repitió
la verificación sin pruebas enfocadas concurrentes: `npm.cmd test` final salió con
código 0. Cargo también emitió avisos
de hard links de caché y copió archivos; no son errores de lógica.

El recorrido aislado demuestra dos ingenieros autenticados sobre el mismo proyecto,
edición compartida conservando creador/editor, solicitudes y devolución/resubmisión,
primera atención y resolución, cierre/reapertura, revocación y rechazo de accesos no
asignados. La migración compara bytes del perfil antes/después y recupera evidencia
histórica sin convertir aprobación antigua en aceptación nueva.

Regresiones de recuperación verificadas:

- Dos ediciones válidas en streams distintos pueden combinar fechas incompatibles:
  el proyecto sigue consultable, muestra `plan_issues` y permite corregirlas.
- Un conflicto de revisión antigua se integra bajo el compromiso actual sin perder
  las decisiones anteriores ni quedar permanentemente bloqueado.
- Un cierre antiguo recibido después de un cambio de compromiso puede reabrirse
  explícitamente sin ocultar su historia ni simular aceptación vigente.
- Una evidencia aceptada sigue verificable desde su revisión inmutable aunque se
  seleccione otra rama de actividad. Un archivo opcional ajeno sin sincronizar no
  impide comprobar otro criterio.
- Una carpeta de resultados sin marcador de formato no recurre al trabajo anterior.
  Una fuente alterada falla; no se reinicializa ni se elige otra raíz.
- El acceso a un proyecto sano no requiere proyectar el grafo de otro proyecto
  dañado; la autorización se acota al proyecto solicitado.

## Límites y piloto operativo

Los escenarios de ramas desconectadas son fixtures firmados con cuentas sintéticas
en un solo equipo. No acreditan OneDrive real, dos equipos físicos, exclusión
distribuida ni revocación instantánea. No se migró un espacio corporativo ni se
publicó un portable en la carpeta del área.

El arnés nativo de QA compila con assets embebidos y servicios reales, sin simular
IPC ni añadir un acceso alternativo al ejecutable de producto. Solo admite datos
en `src-tauri/target/results-pilot-<id>`. En la revisión reanudada se observaron
en WebView real el compromiso, los dos entregables, la tabla, el Gantt, la evidencia
PDF sintética y las acciones permitidas al ingeniero. PageDown permitió consultar
la tabla. El controlador devolvió límites incorrectos de 15×15 para los clics;
ese fallo del controlador no se contabiliza como un defecto de la aplicación.

La revisión detectó que el panel semanal desplazaba las actividades fuera de la
primera pantalla. Se priorizaron tabla/Gantt sobre indicadores semanales, se añadió
un resumen actual junto al nombre y se acortaron acciones conservando sus nombres
accesibles. Las fechas de previsión se mantienen en una línea.

El control interactivo se detuvo nuevamente con Escape. No se acredita el recorrido
nativo completo, temas/foco/modales ni la revisión visual posterior a ese ajuste;
esas comprobaciones siguen en R7b. La prueba DOM y los recorridos Rust conservan
su alcance; compilar o abrir una ventana no sustituye aceptación WebView.

Para el piloto con Supervisor e ingenieros, usar dos entregables, un bloqueo, una
devolución y un cierre. Registrar por intento: actividad/operación, presencia de
adjunto, tiempo desde apertura hasta confirmación, errores/reintentos y si el
participante pudo explicar qué faltaba para cerrar. Presentar n, mediana y p90
separando capturas con/sin adjunto; no extrapolar el modal a todo el recorrido diario.
Comparar semanas completas y mantener cambios de alcance/dependencias externos
visibles. No presentar una puntuación individual ni atribuir causalidad a esos datos.

Instrucciones reproducibles del arnés: [pruebas](../../architecture/testing.md#piloto-nativo-aislado-por-resultados).

## Comprobación del 2026-11-19

`npm.cmd test` terminó con código 0: 206 casos de contratos (53 preferencias,
55 dominio y 98 operaciones/almacenamiento), 179 pruebas frontend en 23 archivos
y 60 Rust. Son verificaciones automáticas con datos aislados.
`pwsh -NoProfile -File scripts/verify_contracts.ps1` también terminó con código 0:
contratos, TypeScript, cargo check, suites y cambio/rollback de layout aprobados.
Enlaces locales de los documentos modificados y `git diff --check` aprobados.

Alan informó que completó la compilación. Se verificó el ejecutable local
`src-tauri/target/release/easyfab.exe`: 4 512 256 bytes, SHA-256
`36C558FC75A1BF75904324EE0AE8724B313AC33BC27D060A6CB797B09320A916`.
La ventana abierta corresponde a esa ruta. No se verificó el hash del segundo
equipo ni se publicó este ejecutable desde esta revisión.

La referencia local de AppData del usuario apunta a la raíz habitual
`ENGINEERING FILES - 10.FAB`; el manifiesto coincide con el ID guardado,
layout 2, resultados 1 y mantenimiento desactivado. El AppData del proceso
Codex está redirigido por el sandbox y no es la instalación del usuario.
Se observó en WebView el cronograma con sesión Supervisor y 19 proyectos activos
en la vista anual. No se guardaron datos de prueba ni se modificaron proyectos
existentes. La interacción intentada con Nuevo proyecto no abrió el modal;
no se atribuye a la aplicación sin distinguir un posible desplazamiento del
controlador. No acredita alta, foco, miniaturas ni el recorrido completo.

Se preparó el [protocolo de ejecución y registro](results-pilot-runbook.md).
La disponibilidad de participantes y autorización de la carpeta no equivalen
a observaciones de comprensión, tiempos ni sincronización real entre equipos.
