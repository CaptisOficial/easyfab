# Preferencias personales locales v1

Fecha: 2026-10-29. Autoridad estructural: [user_preferences.schema.json](../../contracts/v1/user_preferences.schema.json).
Alcance F01/F03 autorizado: contrato y pruebas de contrato. Persistencia, IPC y UI
siguen pendientes; este documento especifica el comportamiento requerido para esa
entrega y no acredita aislamiento real en disco ni un recorrido nativo.

## Propiedad y ubicación

Un documento por par (ID de espacio, ID de usuario EasyFAB) y por instalación local.
Archivo previsto: `%LOCALAPPDATA%/EasyFAB/preferences/<workspace_id>/<user_key>.json`.
`user_key` es la codificación hexadecimal minúscula de los bytes UTF-8 del ID exacto
del usuario autenticado (sin normalizar mayúsculas); evita alias entre cuentas en un
filesystem Windows insensible a mayúsculas, nombres reservados y caracteres de ruta.
El ID de espacio ya es hexadecimal de 32 caracteres según workspace.schema.json.
La aplicación construirá esa ruta en Rust con identificadores validados; ningún
comando aceptará rutas, espacio ni propietario elegidos por el frontend.

Los campos workspace_id/user_id son comprobantes de pertenencia, nunca credenciales.
Se comparan con espacio revalidado y sesión normal autenticada antes de aplicar o
guardar. No se lee la carpeta de otro usuario/espacio como fallback. Sin sesión o
con contraseña temporal se usa la presentación predeterminada en memoria y no se
lee/escribe un archivo personal. Al salir se retiran las opciones del usuario de la
memoria; no se muestran las del anterior en el acceso. Mover físicamente una misma
raíz sin cambiar su ID conserva las preferencias de ese espacio en la instalación.
Cambiar a otro ID no importa preferencias. No se sincronizan entre equipos.

## Opciones y defaults

Tema: light, dark o system; default light. Tamaño: standard o large; default standard.
El esquema es la única definición de valores/defaults; su anotación `default` no
inserta datos ni repara documentos automáticamente. Los futuros consumidores deben
proyectar y verificar esos valores; no duplicarlos sin prueba de paridad.
La UI existente conserva apariencia y comportamiento hasta implementar el consumidor.
Los tres temas y ambos tamaños requieren contraste, foco, controles y pantallas
verificados antes de habilitar su selección. No se añaden filtros ni categorías
vacías; se versionarán cuando existan funciones concretas que los necesiten.

## Lectura, escritura y recuperación requeridas

- Ausente: defaults en memoria para el usuario actual, sin crear archivo al leer.
- Inválido, propietario diferente o versión desconocida: no aplicar parcialmente;
  usar defaults en memoria y mostrar aviso recuperable. No sobrescribir ni borrar
  silenciosamente un documento desconocido o dañado. Ofrecer restablecimiento explícito.
- Raíz compartida no disponible: continúa bloqueado el acceso; las preferencias
  nunca habilitan un espacio alternativo ni suplantan installation.json.
- Guardar: revalidar sesión/espacio, validar documento completo, escribir de forma
  recuperable dentro de la partición local y comunicar éxito solo tras terminar.
  En error conservar edición, configuración aplicada anterior y documento previo;
  ofrecer reintento. No afirmar guardado si solo cambió la apariencia en memoria.
- Restablecer: acción explícita solo sobre el archivo del par autenticado; retirar
  ese documento y aplicar defaults. Si falla el retiro, informar fallo sin confirmar
  el restablecimiento persistente. No borrar recursivamente el directorio EasyFAB.
- No seguir enlaces/reparse points hacia otros ámbitos al crear, leer, reemplazar
  o retirar archivos. Rechazar escape de la raíz local o alias a otro documento.
- installation.json, master.key y todos los archivos compartidos permanecen intactos.
  No roles, firmas HMAC, tokens, hashes de contraseña ni datos operativos en preferencias.

## Verificación por etapas

Ahora: pruebas positivas/negativas del JSON Schema con Test-Json en PowerShell 7,
incluidas versiones, límites de IDs, campos extra y todas las opciones. Gate 0 y
npm test deben ejecutar la suite, sin dependencias adicionales ni datos corporativos.

Antes de persistencia: pruebas Rust con directorios temporales para dos espacios,
dos usuarios (incluida diferencia de mayúsculas), documentos cruzados/corruptos,
versión futura, reinicio, lectura sin escritura, guardado fallido, reset y enlaces.
Comparar bytes de referencia, llave y datos sintéticos antes/después. Probar sesión
restringida/cerrada y espacio inaccesible; IPC no acepta identidad del cliente.
Después: DOM del recorrido editar → guardar/error → reintentar → restablecer;
validación nativa separada para apariencia, tamaños y reinicio real.

HSS: dos opciones de presentación, ningún dato operativo recapturado. No se ha
medido ahorro ni implementado persistencia. Manpower: sin indicadores de capacidad;
calendario/esfuerzo/disponibilidad siguen sujetos a D05.
