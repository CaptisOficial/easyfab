# PLAN-003A — Directorio administrativo
Estado: complete
Fecha: 2026-10-28
Paso activo: ninguno. P0–P4 completados.
DAG: P0 baseline -> P1 backend y contratos -> P2 formularios -> P3 Gate 0 -> P4 registro.
write_surfaces: contracts/v1/auth.schema.json, src-tauri/src/{auth.rs,auth_commands.rs,user_commands.rs,lib.rs}, src-tauri/src/auth/{models.rs,credentials.rs,directory.rs,users.rs,user_tests.rs}, src/lib/api.ts, src/components/{Login.tsx,auth/*}, docs/archive/plans/*, docs/architecture/auth.md, docs/product/capabilities-matrix.md.
Alcance: alta engineer/supervisor, directorio sin secretos, activar/desactivar y recuperación existente. No editar usuarios reales ni distribuir llaves.

Evidencia: Gate 0 PASS; npm.cmd run build PASS; cargo test --lib --offline: 13 PASS; patrón de cuenta Windows del contrato: 5 comprobaciones PASS. Se revisaron formularios React (labels, estados de espera/error, tabla con encabezados y limpieza de temporales). Prueba nativa de altas y baja/reactivación pendiente del usuario; acceso Admin ya confirmado por él.
