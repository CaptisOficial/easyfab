# CASE-005 — Editor de carpeta usa la ubicación activa

Fecha: 2026-10-28 · PLAN-015.

La carga de WorkspaceSetup inicializaba el editor solo con candidate_root, aunque
workspace.root ya representara la carpeta activa validada. Al cambiar carpeta,
la sugerencia podía diferir de la referencia guardada y mostrar una ruta ajena.

Corrección: priorizar workspace.root y usar la sugerencia únicamente cuando no
existe espacio activo. Cancelar restaura la raíz activa; ningún error guarda ni
selecciona otra carpeta automáticamente.

Regresión: WorkspaceSetup.test.tsx proporciona una sugerencia distinta del espacio
activo, comprueba el valor inicial del editor, un fallo de guardado y cancelación.
Pruebas UI con IPC simulado y rutas sintéticas; la autoridad definitiva sigue en Rust.
