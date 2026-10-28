# PLAN-013 — Carpetas personales

Estado: complete · Inicio y cierre: 2026-10-28.

Alan confirmó primer recorrido nativo y pidió continuar con carpeta por usuario,
conservando cuentas recién creadas. Subalcance explícito de F02: resolver versionado,
carpeta y evidence vacía; sin subida/retención/aprobación de adjuntos (F06/D02).
No cerrar F01 ni D01–D05 en conjunto; excepción acotada al DoR del plan maestro
para preparar almacenamiento sin habilitar escritores FAB concurrentes.

P0 inspección/baseline → P1 contratos y resolver → P2 herramienta
de mantenimiento y pruebas → P3 Gate 0/evidencia: completos. Publicación corporativa solo
con app cerrada y respaldo; no reiniciar usuarios ni contraseñas.

write_surfaces: AGENTS.md; contracts/v1/workspace.layout.json, workspace.schema.json,
profile_upgrade.schema.json; scripts/verify_contracts.ps1; src-tauri/src/workspace_assets.rs;
src-tauri/src/workspace.rs, workspace_tests.rs, auth/directory.rs,
src-tauri/examples/provision_admin.rs,
auth/credentials.rs, auth/tests.rs, auth/user_tests.rs, auth/onboarding_tests.rs;
scripts/upgrade_profile_layout.ps1, upgrade_profile_layout.Tests.ps1;
docs/architecture/{auth,espacio-de-trabajo,invariantes-arquitectura}.md;
docs/product/plan-maestro.md; docs/product/execution/f02/acceptance.md;
este plan, STATUS.md, docs/product/planning/mission-contract.md y roadmap.json.
Registro de regresión: docs/logs/quality/CASE-002-profile-folder-transition.md.

Confirmación operativa: Alan indicó que EasyFAB está cerrado en los equipos donde
lo abrió. Aplicar solo después de Gate 0 y build; conservar respaldo y comparar hashes.

Validación: cuentas sintéticas y clave aislada; rutas por versión, creación solo del
titular, perfiles preservados, falta/corrupción sin fallback; cambio/rollback probado
con bytes y huellas; npm test y Gate 0. Concurrencia OneDrive sigue pendiente D01.

Resultado: 7 frontend + 24 Rust y Gate 0 (incluye PowerShell) aprobados. Build release
aprobado. Espacio activo actualizado tras confirmación de cierre; 2 perfiles y team.json
idénticos por SHA-256, respaldo profile-layout-185a0fde2a0942138d822cef9b063649.
Portable/contratos publicados; ventana nativa Espacio listo/Ingresar comprobada.
No se ingresó con contraseña del usuario; reingreso manual posterior pendiente.
