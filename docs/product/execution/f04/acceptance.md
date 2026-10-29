# Alta y consulta de proyectos — PLAN-014

Alcance confirmado: [cuatro cuentas y un ejecutable](flujo-confirmado.md).
Admin administra cuentas y consulta; Supervisor registra proyectos; los ingenieros
registrarán avances propios y Supervisor validará cierres en los siguientes pasos.

## Recorrido implementado

Admin crea un usuario Supervisor desde Gestión de usuarios; este ingresa con su
temporal, cambia contraseña y vuelve a entrar. Proyectos FAB ofrece el formulario
al Supervisor y solo consulta al Admin. No aparece para Engineer ni cambio obligatorio.

El Supervisor captura WBS, título, área, responsable activo, inicio y objetivo.
Rust valida sesión/credencial/firma/estado, identidad del espacio, fechas reales,
campos y WBS única en el documento visible. Genera identidad aleatoria, estado
Not Started, conserva proyectos/campos existentes y revalida antes de publicar.
Cargar o guardar JSON inválido falla sin reinicializar; fallo de reemplazo conserva
el archivo anterior. Nuevo acceso vuelve a leer proyectos del espacio compartido.

Las altas solo se permiten si existe una única cuenta Supervisor activa y es la
autenticada. No hay habilitación por equipo o usuario compilado, ni migración o
nuevas fuentes de datos. No se autoriza operar simultáneamente la misma cuenta
desde varios equipos; ver límite explícito del flujo confirmado. D01 general,
D05 y F01/F03/F04 completos siguen pendientes.

## Validación

El recorrido Rust usa cuatro cuentas sintéticas (Admin, Supervisor, dos ingenieros)
en proceso hijo con LOCALAPPDATA y espacio aislados. Prueba el comando de dominio
real de alta y consulta, no un bypass privado: permisos, sesión restringida,
revocación, referencias, fechas, WBS, persistencia tras nuevo login, conservación
de campos, corrupción, fallo real de reemplazo Windows y cambios previos al rename.
Añadir un segundo Supervisor activo en el fixture bloquea nuevas altas.

UI: jsdom/IPC simulado verifica formulario/listado, consulta sin formulario, carga,
vacío, éxito/error, reintento, relectura y evitar duplicación durante guardado.
Tauri MockRuntime verifica registro y errores IPC. No equivalen a aceptación nativa.

Verificación del flujo confirmado: npm.cmd test aprobado (18 frontend + 29 Rust). Gate 0 final aprobado: contratos, TypeScript, cargo check, 18 frontend + 29 Rust y PowerShell de migración/rollback. Build frontend y npm.cmd run tauri -- build aprobados. Candidato nativo preparado localmente; aceptación WebView pendiente. CASE-003/004 registran correcciones.

## Cómo probar nativamente

1. Admin: crear la cuenta Supervisor desde la aplicación y entregar su temporal.
2. Cerrar sesión; ingresar como Supervisor, cambiar temporal y volver a ingresar.
3. Registrar un proyecto con WBS nueva, responsable y fechas válidas; comprobar Sin iniciar.
4. Cerrar/reabrir y volver a entrar como Supervisor; comprobar el mismo proyecto.
5. Entrar como Admin: consultar el proyecto y administrar usuarios, sin formulario de alta.
6. Engineer: comprobar que no aparece el alta; sus avances siguen pendientes.

Para errores, usar solo fixtures aislados; nunca corromper datos corporativos para
probar. No se crearon cuentas reales ni se publicaron/reemplazaron portables en esta
entrega. La aceptación nativa, incluido reingreso posterior a PLAN-013, está pendiente.

Candidato local: src-tauri/target/release/easyfab.exe (3567104 bytes).
SHA-256: 9B5CEDDCE8BCF14675CDB22DB14368B3A704132B16A35A09A54D3137C0091362.
No se publicó en la carpeta compartida. El build tardó 5m05s y no abrió la aplicación.
