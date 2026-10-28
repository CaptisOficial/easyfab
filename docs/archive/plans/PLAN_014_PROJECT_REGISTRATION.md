# PLAN-014 — Alta y consulta mínima de proyectos

Estado: in_progress · Inicio: 2026-10-28.

Excepción acotada autorizada: recorrido vertical de F04 sin cerrar F01/F03/F04
ni sus dependencias. Escritura corporativa pendiente de decisión de Alan sobre
escritor único. Preservar todos los cambios previos.

P0 Discovery: fuentes solicitadas y Git leídos; Gate 0 baseline en ejecución.
P1 Contratos y propuesta D01: in_progress.
P2 Rust/persistencia/IPC y React: pending, depende de P1.
P3 Pruebas sintéticas y Gate 0: pending, depende de P2.
P4 Entrega: pending, depende de P3; aceptación operativa separada.

write_surfaces: contracts/v1/projects.schema.json, project_registration.schema.json;
src-tauri/src/projects/**, project_commands.rs, lib.rs, auth.rs, workspace_assets.rs;
src-tauri/Cargo.toml (runtime de prueba IPC, sin dependencias de producción nuevas);
src/features/projects/**, src/lib/api.ts, src/lib/api.test.ts,
src/components/Login.tsx, Login.test.tsx; scripts/verify_contracts.ps1;
docs/product/execution/f04/**; docs/architecture/testing.md;
docs/product/plan-maestro.md, planning/{mission-contract.md,roadmap.json};
este plan y STATUS.md.

Solo fixtures sintéticos. No modificar cuentas, referencia real ni master.key;
no publicar/reemplazar portable compartido. D05 y el DAG completo no cambian.
