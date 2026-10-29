# CASE-003 — Arranque del harness Tauri en Windows

Fecha: 2026-10-28 · Alcance: PLAN-014, runtime de pruebas IPC.

Síntoma reproducido: con la prueba de registro IPC usando Tauri MockRuntime,
el harness Rust terminó antes de ejecutar pruebas con 0xc0000139
(STATUS_ENTRYPOINT_NOT_FOUND). El frontend y cargo check sí pasaban.

Causa: el runtime de prueba enlaza rutas de menú que importan TaskDialogIndirect,
DefSubclassProc y SetWindowSubclass desde Common Controls. El ejecutable de
pruebas necesita la dependencia de Microsoft.Windows.Common-Controls v6 en su
manifest, al igual que la aplicación nativa. El loader anterior no podía resolver
esa importación; no era un rechazo de credenciales ni un error de datos.

Corrección: build.rs emite MANIFEST:EMBED y MANIFESTDEPENDENCY v6 para targets
Windows MSVC, incluidos los ejecutables del harness. El binario easyfab conserva el manifest ID 1 de tauri-build y desactiva la generación duplicada del linker. No modifica dependencias
de datos, roles, cuentas ni instalación del usuario.

Regresión: ejecutar npm.cmd test y Gate 0 con el test IPC registrado, incluyendo
arranque y ejecución de la suite completa. Resultado final en acceptance.md de F04.
