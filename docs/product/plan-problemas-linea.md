# Plan: Problemas de línea (LIN-01)

## Alcance
- Registrar incidencia por línea/equipo con paro y scrap.
- Mostrar línea histórica temporal (paros, duración, piezas afectadas).
- Modal flotante para nuevo caso (similar a registro de proyecto).

## Fases
1. Contratos: `line_issues.schema.json` (creado).
2. Backend Rust: storage, commands, permisos, audit.
3. Frontend: panel "Problemas de línea", modal y timeline.
4. Pruebas: contract + DOM + permisos.

## No implementado todavía
- No se altera el comportamiento actual; solo contrato mínimo y plan.