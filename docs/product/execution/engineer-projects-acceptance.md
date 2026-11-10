# Consulta de proyectos del ingeniero

Alcance: 2026-10-29. Referencia funcional: PRO-01 del
[catálogo](../catalogo-modulos.md). Respuesta y autorización:
[contrato IPC](../../../contracts/v1/project_registration.schema.json).

Una sesión normal Engineer consulta los proyectos donde `lead_engineer_id` coincide
con su ID autenticado. Rust revalida credencial, rol, estado y espacio antes de leer;
filtra proyectos y devuelve únicamente la identidad propia en `leads`, con
`can_create=false`. No acepta identidad ni filtro aportados por el cliente.
Admin/Supervisor conservan su consulta general; solo el Supervisor autorizado registra.

La interfaz ofrece Proyectos a Engineer, muestra fechas/estado/responsable y omite
el formulario de alta. Cerrar sesión desmonta la lista y retira el destino del menú.
No cambia archivos operativos, credenciales ni asignaciones existentes.

## Comprobación

- `projects/tests.rs`: dos responsables con proyectos diferentes, respuesta vacía
  sin asignación, reingreso, denegación de alta, espacio incorrecto, JSON corrupto
  y revocación tras baja/reset. Fixtures sintéticos en proceso hijo aislado.
- `Login.test.tsx`: acceso normal Engineer y rechazo de sesión restringida en UI.
- `WorkspaceSetup.test.tsx`: navegación a la consulta, ausencia de alta y retirada
  de lista/menú tras salir. IPC simulado; no demuestra WebView nativo.

Resultados del 2026-10-29:

- `npm test`: aprobado; 48 casos de contrato, 32 pruebas frontend y 29 Rust.
- `pwsh -NoProfile -File scripts/verify_contracts.ps1`: Gate 0 aprobado;
  contratos, TypeScript, cargo check, suites y upgrade/rollback de layout.
- Enlaces relativos de los documentos tocados y `git diff --check`: correctos.

La ejecución inicial simultánea de ambos comandos tuvo un timeout de UI y acceso
denegado al renombrar una carpeta sintética de workspace. Ambos comandos completos
pasaron al repetirse secuencialmente, sin modificar esos casos. Cargo advierte que
copia la caché incremental al no poder crear hard links; no impidió la verificación.
La comprobación nativa y entre equipos pertenece a la historia explícita del plan.

Recorrido nativo pendiente: Supervisor registra dos proyectos sintéticos, cada uno
con un ingeniero responsable distinto; cada Engineer ingresa, abre Proyectos,
comprueba fechas/estado y ausencia del alta, sale y reingresa. Confirmar que no
aparece el proyecto del otro responsable; repetir en otro equipo autorizado tras
sincronizar, usando una sesión por cuenta. No usar datos ni credenciales reales.

## Continuidad

La captura de actividades requiere concretar su contrato de creación/actualización,
preservar credenciales y campos existentes del perfil, y definir validaciones de
hitos sin conceder autoridad a `supervisor_approved`. Esta consulta no implementa
actividad, adjuntos, solicitud de cierre ni aprobación.
