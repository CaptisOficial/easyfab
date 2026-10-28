# PLAN-012 — Primer acceso y prueba de perfiles

Estado: complete · Inicio y cierre: 2026-10-28.

Alcance autorizado: dejar disponible apertura → Admin inicial si directorio vacío →
cambio obligatorio → gestión de usuarios → ingreso de Engineer/Supervisor.
Alan autorizó regenerar datos de prueba compartidos; no requiere migrarlos.
Respaldo Git previo: e119d9e. No crear cuentas reales ni elegir contraseñas del operador.

P0 inspección → P1 pruebas y claridad del recorrido → P2 Gate 0/build →
P3 preparar espacio de prueba/portable y documentar: completos.

write_surfaces: src/components/Login.tsx, src/components/auth/NewUserForm.tsx,
src/components/auth/InitialAdminForm.tsx, src/components/Login.test.tsx,
src-tauri/src/auth.rs, src-tauri/src/auth/onboarding_tests.rs,
package.json, package-lock.json, vitest.config.ts, este plan, STATUS.md,
docs/architecture/testing.md, docs/architecture/auth.md,
docs/product/execution/f01/first-access.md, scripts/prepare_first_access.ps1,
scripts/prepare_first_access.Tests.ps1, docs/product/execution/f01/propuesta-d03.md,
docs/product/execution/f01/acceptance.md.
Preparación operativa: solo data de prueba y software/easyfab.exe en el espacio
validado mediante installation.json real; conservar referencia, ID y llave locales.

Esta entrega usa los contratos de acceso vigentes. No implementa adjuntos ni
adelanta F02 completo. La limpieza autorizada elimina la necesidad de una migración
de datos de prueba; layout/evidencias D03 siguen como entrega posterior delimitada.

Aceptación: recorrido backend con filesystem/llave sintéticos en proceso aislado;
UI probada con DOM e IPC simulado; npm test, Gate 0 y build portable; raíz compartida
validada y directorio vacío para que Alan cree sus propias cuentas. La aceptación
nativa del operador queda separada y pendiente hasta que pruebe el recorrido.

Evidencia: 7 frontend + 23 Rust aprobadas; Gate 0 aprobado; prueba PowerShell aislada
aprobada. Release compilado y copiado al espacio configurado con hash coincidente.
Respaldo first-access-0143c07b4f3b44bd8231bbd0ca0d3163. Directorio compartido con
0 usuarios y pantalla nativa Crear administrador inicial comprobada (sin crear cuenta).
[Guía y límites](../../product/execution/f01/first-access.md).
