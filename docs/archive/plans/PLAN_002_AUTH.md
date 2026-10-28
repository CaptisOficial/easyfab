# PLAN-002 — Acceso, RBAC y recuperación
Estado: complete
Fecha: 2026-10-28 (America/Mexico_City)
Paso activo: ninguno.

DAG completado: P0 Discovery -> P1 criptografía y contratos -> P2 acceso y recuperación -> P3 Gate 0 -> P4 registro.

write_surfaces: src-tauri/src/auth.rs, src-tauri/src/auth/*, src-tauri/src/auth_commands.rs, src-tauri/src/lib.rs, src-tauri/examples/provision_admin.rs, src-tauri/Cargo.toml, src-tauri/Cargo.lock, contracts/v1/{auth,team,engineer_tasks}.schema.json, src/lib/api.ts, src/components/Login.tsx, src/components/auth/*, src/App.tsx, scripts/verify_contracts.ps1, docs/archive/plans/*, docs/architecture/auth.md, docs/logs/quality/*. Cambios de formato Rust en bootstrap.rs y onedrive.rs.

## Resultado

- Argon2id con salt del sistema y firma HMAC de roles y credenciales.
- Llave local: creación explícita sin sobrescritura; acceso normal falla cerrado si falta.
- Primer login y reset: sesión restringida, cambio obligatorio, contraseña de exactamente 8 caracteres, temporal de 24 horas.
- Recuperación: solo Admin con sesión normal; revisión nueva revoca el acceso anterior tras sincronización.
- Partición: Admin escribe team.json; cada titular cambia contraseña en su propio perfil, conservando actividades.
- Responsabilidades separadas en módulos Rust y formularios React pequeños.

## Evidencia

`scripts/verify_contracts.ps1`: PASS (contratos JSON, TypeScript y cargo check).
`npm.cmd run build`: PASS.
`cargo test --lib --offline --quiet`: 9 PASS, 0 fallos.
`cargo check --example provision_admin --offline --quiet`: PASS; advertencias por reutilizar el módulo de autenticación en el ejemplo.

La prueba de persistencia se ejecuta dentro de target/: en el temporal del entorno restringido la publicación por rename devolvió acceso denegado. No se modificaron datos corporativos, credenciales reales ni master.key.

Límites y máquina de estados en [acceso y recuperación](../../architecture/auth.md). Aprovisionamiento entre equipos, pruebas nativas con datos reales, altas/bajas y contingencia del único Admin pendientes; vistas operativas en PLAN-003.
