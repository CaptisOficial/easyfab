# Evidencia R1: contrato y permisos del flujo por resultados

Fecha: 2026-10-29. Alcance seleccionado: R1 del [plan maestro](../plan-maestro.md#evolución-hacia-planeación-y-cierre-por-resultados).

## Resultado comprobado

- [Contrato canónico](../../../contracts/v1/project_results.schema.json) y
  [semántica del dominio](../../../contracts/v1/project_results.md): compromiso,
  entregables/criterios, actividades/previsiones, solicitudes, decisiones y bloqueos.
- Tipos TypeScript generados desde el esquema, con comprobación de divergencia.
  Modelos Rust estrictos y validadores de relaciones, fechas, ciclos, estados,
  evidencia por criterio y precondición de cierre.
- Consulta IPC `project_results_capabilities`: identidad y espacio derivados de
  sesión revalidada; Engineer asignado planea, Supervisor único cambia compromiso
  y revisa, Admin consulta. No contiene comandos de escritura del nuevo dominio.
- La regresión de entrada activa admite `hours_spent` no negativo/null y WBS vacío
  generado por Rust, conforme a los consumidores existentes. No altera la lógica
  activa de aprobación de actividades.

## Comprobaciones ejecutadas

| Comando / prueba | Resultado real |
|---|---|
| `npm.cmd test` | Aprobado: 48 casos de preferencias, 52 casos del esquema nuevo en ese corte, 50 pruebas frontend y 47 Rust |
| `pwsh -NoProfile -File scripts/verify_contracts.ps1` | Gate 0 aprobado: contratos, TypeScript, cargo check, suites y prueba aislada de upgrade/rollback de layout existente |
| `pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/test_results_contract.ps1` tras añadir cobertura de decisiones y WBS vacío | 55 casos aprobados y tipos generados sincronizados; total de casos de esquema comprobados: 48 preferencias + 55 resultados |
| `git diff --check` | Sin errores; avisos de conversión LF/CRLF en archivos existentes |

Las 47 pruebas Rust incluyen ocho nuevas pruebas de dominio, ampliación del
recorrido real aislado de proyectos para capacidades y ampliación de la frontera
IPC. El recorrido usa cuentas sintéticas, revalida asignación/revocación y niega
autoridad con dos Supervisors. Conserva `projects.json` byte por byte al consultar
capacidades. Prueba de frontend del adaptador IPC aprobada dentro de las 50.

Cargo emitió avisos de hard links en la caché incremental y copió archivos; no
impidieron compilación ni pruebas. Se conservaron los cambios previos del árbol.
La prueba de layout opera en `src-tauri/target` con datos sintéticos: no migró
ningún espacio corporativo.

## Límites

Los validadores puros no verifican criptografía ni persisten aprobaciones.
La autenticidad, selección de revisiones vigentes, control de concurrencia,
historial y publicación del nuevo dominio corresponden a R2/R6. No aceptar desde
el cliente el conjunto de evidencia verificada ni el booleano de estado final.

No se probaron WebView, tabla/Gantt/modal nuevos, sincronización entre equipos,
migración al almacenamiento por proyecto ni eficiencia del método. La aplicación
actual sigue usando el contrato de operaciones vigente para captura/cierre.
Siguiente integración: R2; esta evidencia no acredita R2–R7.
