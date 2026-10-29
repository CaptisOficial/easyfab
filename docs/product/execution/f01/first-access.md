# Primer acceso y prueba de perfiles

> Evidencia o propuesta fechada. Sus pendientes y referencias de método describen ese momento; consultar el plan vigente desde el índice para continuar el desarrollo.

Fecha: 2026-10-28 · PLAN-012 · Alcance: acceso y directorio de usuarios.

## Recorrido para Alan

1. Abrir `easy-fab/software/easyfab.exe` del espacio compartido configurado.
2. Con directorio vacío, aparece **Crear administrador inicial**. Elegir ID EasyFAB
   y nombre; guardar la temporal de ocho caracteres mostrada por la app.
3. Pulsar **Continuar al acceso**, ingresar con la temporal y elegir una contraseña
   distinta de exactamente ocho caracteres. Volver a ingresar con la nueva.
4. En **Gestión de usuarios**, crear Engineer o Supervisor y guardar la temporal
   asociada al ID mostrado. No se registra otro Admin en este formulario.
5. Cerrar sesión. Seleccionar el usuario nuevo (nombre e ID), ingresar su temporal,
   cambiar su contraseña y volver a ingresar. La pantalla confirma nombre, ID y rol;
   no muestra gestión de usuarios para Engineer/Supervisor.

La temporal vence en 24 horas. La app no guarda ni entrega contraseñas en claro
fuera de la pantalla. Un fallo al leer datos no equivale a un espacio vacío ni
ofrece crear otro Admin. Si existe una cuenta, se usa acceso o recuperación; no
se reinicializa al abrir. La carpeta guardada sigue siendo la autoridad; faltantes
o indisponibilidad bloquean acceso.

## Alcance de almacenamiento

Se mantiene `data/engineers/<id>.json`. Admin registra la cuenta en team.json;
su perfil se crea al cambiar su propia contraseña. La carpeta individual y los
adjuntos de D03 siguen pendientes. La autorización de Alan elimina la necesidad
de migrar los datos de prueba anteriores; no habilita módulos FAB automáticamente.

`scripts/prepare_first_access.ps1` es una herramienta de preparación del piloto,
fuera del arranque normal. Exige referencia local explícita, portable compilado y
`-ResetTestUsers`; valida ID del espacio, comprueba que EasyFAB esté cerrado,
respalda data y portable, retira perfiles anteriores y vacía solo team.members.
Conserva proyectos/incidencias/configuración, ID del espacio, installation.json y
master.key. Los perfiles retirados son respaldo, nunca una ruta alternativa de login.
Si se interrumpe la preparación, no abrir hasta completar/restaurar los archivos
del respaldo con la aplicación cerrada. No ejecutar en un espacio con usuarios productivos.

## Evidencia

- npm.cmd test: 7 pruebas frontend (3 DOM + 4 IPC) y 23 Rust aprobadas.
- scripts/verify_contracts.ps1: aprobado, con compilación TypeScript/cargo check y ambas suites.
- scripts/prepare_first_access.Tests.ps1: aprobado con datos sintéticos.
- Avisos de caché incremental Rust: usa copias por falta de hard links; sin fallos de suite.
- Build release: aprobado; portable copiado al espacio configurado y abierto.
- SHA-256 compilado/publicado: `860BE581AFB9C60B44FE58D8E789CFFA18182619F013A7B6C18A5BE288784002`.
- Preparación compartida autorizada: usuarios de prueba respaldados/retirados,
  directorio vacío verificado. Respaldo relativo al espacio:
  `backups/first-access-0143c07b4f3b44bd8231bbd0ca0d3163/`.
- Smoke nativo: ventana del portable publicado muestra Espacio listo y Crear
  administrador inicial, con Usuario EasyFAB, Nombre completo y Crear administrador.
  No se crearon cuentas ni contraseñas del operador durante esa comprobación.

Las pruebas backend ejercen credenciales/RBAC reales en proceso aislado; no verifican
el transporte IPC Tauri. Las pruebas DOM simulan IPC. La aceptación manual de Alan
del recorrido nativo completo y de sincronización entre equipos sigue pendiente.
