# Revisión de baseline verificable — EasyFAB

Fecha: 2026-10-28. Alcance: inspección estática de código y documentación del repositorio. No se ejecutaron suites, aplicación, red ni operaciones sobre datos corporativos o llaves. Los resultados históricos se citan como evidencia documentada; Gate 0 de esta entrega corresponde al consolidado del plan maestro.

## Estado observado

| Área | Evidencia de implementación | Verificación disponible y límite |
|---|---|---|
| Espacio configurable local-first | `src-tauri/src/workspace.rs`: layout embebido, identidad estable, referencia local, prioridad de ubicación guardada, rechazo de ubicación inaccesible y datos legacy; `workspace_commands.rs`: cambio bloqueado durante sesión; `bootstrap.rs`: archivos iniciales sin sobrescritura; `workspace_assets.rs`: publicación de arquitectura y contratos. UI: `src/components/WorkspaceSetup.tsx`. | `workspace_tests.rs` verifica layout, preservación, descubrimiento de solo lectura, falta de raíz/datos, identidad y prioridad. PLAN-006 documenta traslado, publicación y arranque. No demuestra sincronización concurrente o disponibilidad entre equipos. |
| Acceso y recuperación | `auth/crypto.rs`: Argon2id y HMAC; `auth/credentials.rs`: temporales, vencimiento, revisión/revalidación, contraseña propia y reset Admin; `auth_commands.rs`: sesión backend, logout, limitación de intentos y epoch de cancelación; `Login.tsx`, `PasswordChangeForm.tsx`, `RecoveryForm.tsx`. | `auth/tests.rs`, `auth/crypto.rs` y `auth/user_tests.rs` contienen casos de reglas, manipulación y persistencia sintética. El usuario confirmó login Admin. Esto no prueba E2E Engineer/Supervisor ni recuperación nativa o sincronización entre equipos. |
| Directorio Admin | `auth/users.rs`, `user_commands.rs`, `UserDirectory.tsx`, `NewUserForm.tsx`, `InitialAdminForm.tsx`: alta inicial, altas engineer/supervisor, listado, baja/reactivación y temporales. Restricción de sesión normal Admin aplicada en Rust. | PLAN-003A documenta pruebas y revisión de formularios; alta/baja/reactivación nativas siguen pendientes. Los tests de autorización de helpers no equivalen a recorrer todos los comandos por IPC real. |
| Portable | PLAN-006 y `REGISTRO_20261028_WORKSPACE.md` registran portable 0.1.0 publicado, copia idéntica por SHA-256 y ventana/proceso observados. | Publicación y smoke de arranque documentados; login Admin confirmado por el usuario como evidencia adicional. No se inspeccionó el binario ni se repitió el smoke en esta revisión. No inferir flujos completos de otros roles. |
| Base de pruebas | `src/lib/api.test.ts`: cuatro casos de adaptador con mocks IPC; pruebas internas Rust junto a auth/bootstrap/workspace; `docs/architecture/testing.md` delimita niveles. PLAN-007 registra 21 Rust + 4 frontend PASS. | Sin suite React DOM, pruebas IPC con runtime Tauri ni E2E nativas documentadas por esta base. Los conteos son baseline histórico, no resultado de ejecución de esta revisión. |

## Brecha operativa real

`src-tauri/src/lib.rs` registra únicamente comandos de workspace, autenticación y usuarios. `src/App.tsx` monta `WorkspaceSetup`; `Login.tsx` declara que las vistas de trabajo se incorporarán en fase 3. Los componentes existentes cubren acceso y administración de usuarios, no trabajo FAB.

Por tanto, siguen pendientes las vistas Engineer/Supervisor, proyectos asignados y macroproyectos, subtareas y avances, hitos y aprobación DoD, incidencias downtime/scrap append-only, catálogos operativos, balance de carga/varianza y exportación KMX-FW. La presencia de semillas JSON y esquemas en `contracts/v1/` no demuestra lectores, reglas, mutaciones o flujos UI implementados para esas capacidades. La matriz de `docs/product/capabilities-matrix.md` mezcla permisos objetivo con capacidades actuales: debe rotular explícitamente esa tabla como objetivo y separar el estado implementado.

## Partición actual y propuesta futura

La ruta efectiva de perfiles es `data/engineers/<id-easyfab>.json`: `auth/directory.rs::own_path` devuelve `dir.join("engineers").join(format!("{}.json", m.id))`; `credentials.rs::change_password` conserva contenido del perfil y actualiza su credencial; `user_tests.rs::accounts_are_independent_of_windows_and_have_distinct_profiles` verifica rutas por ID. Aplica también a perfiles de Supervisor/Admin según el mismo resolver.

Una carpeta por ingeniero con `profile.json` y `evidence/` es propuesta, no runtime entregado. Adoptarla requiere decisión de arquitectura, contrato/layout de contenido, límites de autoridad, migración explícita reversible y regresiones antes de cambiar el resolver. No presentar esa estructura como baseline ni crear compatibilidad o migración implícita. La separación de JSON por usuario reduce colisiones; no acredita por sí sola cero conflictos OneDrive ni resuelve concurrencia del archivo compartido `issues.json`, cuyo append operativo aún no existe.

## Correcciones recomendadas a STATUS.md

1. PLAN-001: retirar la evidencia obsoleta «backend descargando crates». El núcleo inicial fue implementado y superado por planes 002/006/007; cerrar solo si su alcance original queda trazado o marcarlo absorbido por esos planes. No dejar esa frase como estado actual.
2. PLAN-005: dividir entregables. El portable 0.1.0 y su publicación ya tienen evidencia en PLAN-006; marcar ese subalcance entregado. Mantener cualquier BAT/acceso directo o validación de distribución pendiente que realmente se decida conservar; no afirmar que el instalador BAT es necesario para el portable canónico.
3. PLAN-003: conservar pendiente para las vistas operativas FAB. Sustituir «componentes base listos» por «acceso/workspace/directorio Admin implementados; vistas Engineer/Supervisor y timeline pendientes», vinculando `Login.tsx` y `lib.rs`.
4. PLAN-002/003A/003B/006/007: conservar cierre de implementación cuando corresponde, pero añadir una columna o nota independiente de validación nativa. Registrar login Admin confirmado; conservar pendientes los flujos nativos de altas, baja/reactivación, recuperación, otros roles y segundo equipo. No convertir el PASS unitario o el arranque en aprobación E2E.
5. PLAN-007: incorporar su fila a la tabla principal en vez de mantenerlo solo como párrafo separado; citar 21 Rust + 4 frontend como resultado histórico y añadir el resultado actualizado del Gate 0 del plan maestro cuando esté disponible.

## Criterio para el plan maestro

Priorizar contratos/reglas y partición de escrituras antes de habilitar operaciones FAB; después implementar flujos verticales con pruebas de comportamiento y regresión en la misma entrega. Mantener estados separados para diseño, implementación, pruebas automatizadas y validación nativa. El siguiente cierre no debe depender de credenciales reales: usar fixtures y espacios temporales aislados; la aceptación manual corporativa queda como evidencia separada y explícita.
