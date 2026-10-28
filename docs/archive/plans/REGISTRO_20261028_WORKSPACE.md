# EasyFAB — espacio canónico configurable y portable

Fecha: 2026-10-28 (America/Mexico_City).
Código fuente: C:\Dev\easyfab.

Se estableció la carpeta compartida corporativa como raíz configurable y easy-fab como espacio único del sistema. Layout relativo canónico en contracts/v1/workspace.layout.json; manifiesto compartido con identidad estable y referencia absoluta local por instalación. El arranque separa resolución/configuración, alta inicial de Admin, login, cambio obligatorio y sesión.

Estructura: data (única fuente operativa), docs/architecture, contracts/v1, software/easyfab.exe, exports y backups. Solo installation.json y master.key residen en el perfil local; no se sincronizó ni publicó la llave. La UI permite seleccionar otra raíz sin sesión activa; no mueve ni mezcla datos implícitamente. Una ruta guardada no disponible bloquea el acceso en lugar de crear datos vacíos.

Se retiró la identidad Windows de usuarios. Alan confirmó que solo existe Admin y autorizó ajuste directo. Se validaron firmas, se conservó la contraseña y el perfil íntegro, se creó respaldo, se retiró el campo Windows y se trasladó Management/Data a easy-fab/data. La ubicación anterior dejó de ser fuente activa.

HSS: una definición de layout, un resolver para todas las operaciones, una referencia local y una sola implementación de alta inicial reutilizada por UI/consola. La documentación incluye FSM, mapa de dependencias, ámbitos/autoridades y rollback.

Verificación: Gate 0 PASS, 21 pruebas Rust PASS, 4 pruebas frontend PASS, compilación frontend PASS. Traslado real verificado por firmas y comparación del perfil con el respaldo. Identidad compartida/local coincidente; contratos y documentación publicados; llave fuera del espacio compartido. Portable 0.1.0 publicado en easy-fab/software/easyfab.exe (3.31 MiB), copia idéntica al release por SHA-256. Arranque nativo confirmado con ventana EasyFAB; instancia de prueba cerrada sin login ni cambios. Respaldos normalizados en easy-fab/backups; README y arquitectura actualizados.

[Arquitectura canónica](../../../easy-fab/docs/architecture/espacio-de-trabajo.md).

Pendiente: prueba manual de login en el portable con la contraseña existente; acceso desde otro equipo requiere confianza local aprovisionada por Admin. Vistas operativas FAB y exportación KMX-FW todavía pendientes.

SHA-256 del portable publicado: AC53E7A3D62CF84E56729A32D7392DA8A677576DF641CDFBF2EFBBC08B4BAD29.
