# PLAN-008 — Autoridad de la carpeta compartida configurada

Estado: `complete`. Fecha: 2026-10-28.

Alcance: aclaración documental; sin cambios de runtime ni publicación de portable.

DAG: P0 revisar resolver y baseline -> P1 aclarar autoridad y criterios de aceptación -> P2 verificar Gate 0 y pruebas -> P3 registrar cierre. Todos los pasos completados.

write_surfaces: `AGENTS.md`, `docs/architecture/espacio-de-trabajo.md`, `docs/architecture/invariantes-arquitectura.md`, este plan y `docs/archive/plans/STATUS.md`.

Evidencia: `workspace.rs::probe` prioriza la referencia guardada; `open` valida raíz e identidad. Se retira la descripción obsoleta que hacía depender las rutas de la detección OneDrive. La configuración determina la raíz; el layout determina las rutas relativas. La ubicación corporativa inicial es únicamente una propuesta.

Validación: `npm.cmd test` y `scripts/verify_contracts.ps1` aprobados: 21 pruebas Rust y 4 frontend, TypeScript y cargo check correctos. Incluyen prioridad de configuración sobre portable y fallo cerrado ante raíz ausente o identidad incorrecta. `git diff --check` sin errores. Cargo informó avisos de caché incremental por hard links; usó copia de archivos y terminó correctamente. Sin validación nativa de red ni publicación del ejecutable/documentos en la carpeta corporativa.
