# PLAN-002 - Acceso y RBAC
Estado: in_progress
Fecha: 2026-10-28

DAG: P0 discovery -> P1 criptografia y contratos -> P2 login -> P3 Gate 0 -> P4 registro.
Paso activo: P1.
write_surfaces: src-tauri/src/auth.rs, src-tauri/src/lib.rs, src-tauri/Cargo.toml, src-tauri/Cargo.lock, contracts/v1/auth.schema.json, src/lib/api.ts, src/components/Login.tsx, src/App.tsx, scripts/verify_contracts.ps1, docs/archive/plans/*, docs/architecture/auth.md, docs/logs/quality/*.

Alcance: fase 2. No exponer firmas ni llaves mediante IPC. Directorio vacio requiere provision administrativa; no crear administradores implicitos.

Ampliacion autorizada: primer acceso y recuperacion obligatoria; contrasenas de 8 caracteres.
write_surfaces adicionales: src-tauri/src/auth/*, src-tauri/src/auth_commands.rs, src-tauri/examples/provision_admin.rs, contracts/v1/team.schema.json, contracts/v1/engineer_tasks.schema.json; formato Rust de bootstrap.rs y onedrive.rs.
