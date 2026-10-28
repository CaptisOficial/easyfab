# PLAN-006 — Espacio canónico configurable y portable
Estado: complete
Fecha: 2026-10-28
Paso activo: ninguno. P0–P5 completados.
DAG: P0 inventario y baseline -> P1 raíz/layout/estado -> P2 instanciación UI -> P3 traslado Admin/datos -> P4 Gate 0 y portable -> P5 documentación y registro.
write_surfaces: AGENTS.md, contracts/v1/{workspace.layout.json,workspace.schema.json,installation.schema.json}, src-tauri/src/{workspace_commands.rs,lib.rs,workspace.rs,workspace_commands.rs,workspace_tests.rs,auth_commands.rs,bootstrap.rs,onedrive.rs}, src-tauri/examples/prepare_workspace.rs, src/{components/Login.tsx,App.tsx,lib/api.ts,components/WorkspaceSetup.tsx}, src-tauri/tauri.conf.json, scripts/verify_contracts.ps1, docs/architecture/*, docs/product/capabilities-matrix.md, docs/archive/plans/*, src-tauri/target/* (utilidad de traslado única y compilación).
Superficies compartidas autorizadas por el usuario: ENGINEERING FILES - 10.FAB/easy-fab/* y datos previos de Management/Data (únicamente EasyFAB); instalación local %LOCALAPPDATA%/EasyFAB/installation.json. Nunca copiar master.key al espacio compartido.
HSS: una raíz configurable, un layout relativo canónico, una referencia local por instalación; sin detecciones que reemplacen silenciosamente un espacio guardado no disponible. Sin identidad Windows en usuarios.

Superficies adicionales para instanciación completa: src-tauri/src/workspace_assets.rs, src-tauri/src/auth/{models,users,user_tests}.rs, src-tauri/src/user_commands.rs, src-tauri/src/auth.rs, src/components/auth/InitialAdminForm.tsx, contracts/v1/{auth,config_plant}.schema.json. El espacio nuevo permite alta inicial desde UI; no se usa Windows como identidad.

HSS adicional: el ejemplo provision_admin queda como adaptador de la misma alta inicial usada por UI; se elimina la implementación duplicada de aprovisionamiento.

Verificación: Gate 0 PASS, 21 pruebas Rust y 4 frontend PASS; frontend release PASS. Ajuste real Admin y traslado de Data verificados; identidad local/compartida coincide y llave permanece local.

Entrega: portable 0.1.0 de 3.31 MiB publicado en easy-fab/software/easyfab.exe; copia SHA-256 idéntica al release. Arranque nativo verificado: proceso activo y ventana EasyFAB, instancia de prueba cerrada sin login ni modificaciones. README, arquitectura y contratos publicados; respaldos normalizados en easy-fab/backups. Sin archivos .key dentro del espacio compartido. Login manual con contraseña real queda para el usuario, sin afirmar prueba E2E de credenciales.
