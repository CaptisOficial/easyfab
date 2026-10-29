# PLAN-014 — Alta y consulta de proyectos

Estado: complete · Inicio y cierre técnico: 2026-10-28. Aceptación nativa pendiente.

## Alcance vigente confirmado por Alan

Cuatro cuentas: Admin, un Supervisor y dos ingenieros. Un solo ejecutable, perfiles
y datos en el espacio compartido configurado, configuración local solo si se necesita.
Admin administra cuentas y consulta proyectos; Supervisor registra proyectos; los
avances propios de ingenieros y validación de cierres son los pasos siguientes.
Esta entrega completa el recorrido Admin crea Supervisor → cambio obligatorio →
Supervisor registra proyecto → nuevo acceso conserva el proyecto.

Se retiraron las propuestas de binario habilitado por equipo/cuenta y de migrar
projects.json a archivos separados. No se sustituyen autoridades ni datos.
El único Supervisor activo es el escritor operativo de projects.json; el backend
rechaza crear desde otros roles o con varios Supervisores activos. Una sesión de
trabajo por cuenta es el límite operativo; no se certifica exclusión distribuida
entre equipos ni se cierra D01 general. No se cierran F01/F03/F04 ni D05.

## Ejecución

P0 Discovery y preservación del trabajo existente: complete.
P1 Contratos y flujo por rol confirmados: complete.
P2 Rust, IPC y UI integrados sin modos especiales: complete.
P3 Pruebas, Gate 0 y candidato local: complete; 18 frontend + 29 Rust, PowerShell, typecheck, cargo check y build release aprobados.
P4 Entrega documental del recorrido: complete, depende de P3. Candidato local y hash en acceptance.md; sin publicación corporativa.

La aceptación nativa se registra separadamente después de preparar el candidato;
no se presenta una prueba IPC simulada como validación nativa.

write_surfaces: AGENTS.md; contracts/v1/projects.schema.json,
project_registration.schema.json; src-tauri/src/projects/**, project_commands.rs,
lib.rs, auth.rs, workspace_assets.rs; src-tauri/Cargo.toml y build.rs;
src/features/projects/**, src/lib/api.ts, api.test.ts,
src/components/Login.tsx, Login.test.tsx; scripts/verify_contracts.ps1;
docs/product/execution/f04/**; docs/architecture/testing.md;
docs/product/plan-maestro.md, planning/{mission-contract.md,roadmap.json};
docs/logs/quality/CASE-003-tauri-test-manifest.md, CASE-004-project-wbs.md;
este plan y STATUS.md.

Pruebas exclusivamente sintéticas y aisladas, incluido LOCALAPPDATA de proceso hijo.
No crear/modificar cuentas reales, contraseñas o master.key. Preparar ejecutable en
src-tauri/target/release; no publicar ni reemplazar el portable compartido.

Referencias: docs/product/execution/f04/flujo-confirmado.md y acceptance.md.
