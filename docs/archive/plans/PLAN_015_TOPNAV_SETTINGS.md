# PLAN-015 — Configuración en navegación superior

Estado: complete · Inicio: 2026-10-28 · Cierre: 2026-10-29.

Solicitud: mover configuración/rutas de la carpeta activa a una tuerca en topnav
con panel flotante para liberar espacio de trabajo. Alan añade nombre/rol, salida con icono de puerta y fecha en la misma barra. Conservar autoridad de raíz,
permisos y bloqueo de cambio con sesión; no tocar almacenamiento ni cuentas.

P0 Inspección/estado Git y flujo actual: complete.
P1 Topnav/panel, usuario/salida/fecha y reubicación del formulario: complete.
P2 Pruebas de interacción, npm test y Gate 0: complete; Gate 0 revalidado 2026-10-29: 25 frontend + 29 Rust y pruebas PowerShell aprobados. npm test aprobado durante implementación (24 frontend + 29 Rust; el caso adicional de fallo al salir pasó en Gate 0).
P3 Build y entrega: complete, depende de P2. Build release y comprobación de barra/panel en ventana nativa aprobados.

write_surfaces: src/App.tsx; src/components/WorkspaceSetup.tsx, TopNav.tsx,
WorkspaceMenu.tsx, WorkspaceSetup.test.tsx, TopNav.test.tsx, Login.tsx; docs/architecture/testing.md;
docs/logs/quality/CASE-005-active-root-editor.md; este plan y STATUS.md. No modificar cambios previos de PLAN-014.
Datos de prueba sintéticos e IPC simulado; no cambiar carpeta real ni publicar portable.

Reanudado 2026-10-29 tras interrupción. Cambios previos preservados; el proceso de build anterior ya no existía, por lo que se regeneró el candidato local. Revisión visual solo en la propia ventana de EasyFAB; no seleccionar navegadores con documentos de trabajo ajenos a la tarea.

Resultado: barra superior fija con fecha America/Mexico_City, usuario y rol de la
sesión real, salida con puerta y tuerca. Panel no modal, Escape/clic exterior,
foco recuperable y formulario/rutas fuera del área principal. Ampliado ancho de
trabajo. Cambio de raíz continúa bloqueado con cualquier sesión activa.

Verificación 2026-10-29: Gate 0 aprobado (25 frontend, 29 Rust, PowerShell),
TypeScript y build frontend aprobados; npm.cmd run tauri -- build aprobado (3m00s).
En la propia ventana EasyFAB se observó fecha, usuario/rol, salida y tuerca; el
árbol nativo confirmó diálogo Carpeta activa y bloqueo de cambio con sesión.
El usuario interactuó con la app durante la inspección: no se automatizó acceso,
cambio de contraseña, cierre de sesión, cuentas ni escritura de datos.

La selección de una ventana Edge ajena fue rechazada automáticamente por riesgo
de exponer documentos no relacionados. No se insistió ni se accedió a ella; se
completó la revisión mediante la ventana propia de EasyFAB. Navegador integrado
no accedía al servidor local. No queda bloqueo de revisión de la barra/panel.
La regresión CASE-005 cubre prioridad de carpeta activa frente a sugerencia.
Candidato local: src-tauri/target/release/easyfab.exe; 3570176 bytes.
SHA-256: 7A215A134F6045083B40435464ED8A5DD5266C9E93A40D7B11764B3C88DDFC7F.
Portable compartido no reemplazado.
