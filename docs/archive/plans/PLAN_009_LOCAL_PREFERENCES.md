# PLAN-009 — Configuración local y datos compartidos

Estado: `complete`. Fecha: 2026-10-28.

Alcance: documentar la decisión aprobada; sin implementación de preferencias, migraciones ni publicación del portable.

DAG: P0 revisar autoridades -> P1 alinear documentación -> P2 verificar calidad -> P3 registrar cierre. Todos los pasos completados.

write_surfaces: `AGENTS.md`, `docs/architecture/espacio-de-trabajo.md`, `docs/architecture/invariantes-arquitectura.md`, este plan y `docs/archive/plans/STATUS.md`.

Decisión: LocalAppData para referencia, llave y preferencias; espacio compartido para identidad, credenciales protegidas, configuración general y operación. Preferencias personales aisladas por espacio/usuario. Contrato y pruebas requeridos antes de implementarlas.

Validación: `npm.cmd test` y `scripts/verify_contracts.ps1` aprobados (21 pruebas Rust y 4 frontend, TypeScript y cargo check). `git diff --check` sin errores. Avisos de hard links en caché incremental con copia alternativa; sin fallos. La suite verifica el comportamiento existente; las preferencias nuevas siguen pendientes de contrato, implementación y pruebas propias. No se modificó runtime ni se publicó un portable.
