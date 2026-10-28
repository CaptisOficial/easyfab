# Carpetas personales — entrega acotada PLAN-013

Fecha: 2026-10-28. Entrega acotada implementada, probada y aplicada.

Alan confirmó el registro/acceso nativo con su perfil y autorizó continuar conservando
las cuentas nuevas. Ya no se aplica la autorización anterior de borrar usuarios de
prueba a estas cuentas sin una instrucción nueva.

## Resultado previsto y autoridad

```text
data/engineers/<id-easyfab>/
  profile.json
  evidence/
```

`workspace.json.profile_layout_version=2` selecciona esta ruta. Campo ausente o 1
significa `<id>.json`. Nuevos espacios usan 2. La versión se valida antes de leer
credenciales; no se busca otra ruta si la elegida está ausente/inválida. Encontrar
un perfil en la ruta de la otra versión exige mantenimiento. `maintenance=true`
bloquea espacio y acceso. El lector anterior rechaza esos campos desconocidos:
no usar el portable antiguo con un manifiesto actualizado.

La creación sigue siendo del titular al guardar su contraseña; Admin solo registra
team.json. Las cuentas temporales sin perfil siguen sin perfil hasta su primer
cambio. evidence/ queda vacía; no hay API/UI de subida ni índices/adjuntos inventados.
El contrato de perfil/credenciales permanece intacto, incluyendo subactividades.

## Cambio explícito y recuperación

`scripts/upgrade_profile_layout.ps1 -InstallationFile <referencia-real>` requiere
cerrar EasyFAB en todos los equipos y terminar sincronización. Valida identidad,
inventario/propietario y archivos reconocidos; respalda manifiesto y perfiles;
verifica huellas antes de poner maintenance=true. Copia bytes a la nueva ruta,
verifica de nuevo, retira originales y publica versión 2 al final. No escribe
team.json, credenciales, installation.json ni master.key. Un error tras iniciar
mantenimiento deja acceso bloqueado hasta restauración explícita.

Repetir upgrade con layout 2 no modifica datos. Tras una interrupción, ejecutar
`-Mode Rollback -Backup <respaldo>` antes de reintentar upgrade. Rollback verifica
hashes, directorio y ausencia de archivos nuevos; preserva cambios posteriores al
rechazar restauración automática si encuentra un perfil/evidencia/directorio nuevo
o modificado. Repetir rollback con archivos originales no duplica datos. No se
promete reanudar automáticamente desde un corte arbitrario: restaurar y reintentar.
Si hay datos nuevos, corresponde recuperación hacia adelante, no sobrescribirlos.

No hay exclusión distribuida: todos los equipos deben permanecer cerrados durante
la ventana; procesos locales y rename no acreditan convergencia OneDrive (D01).
Antes de reabrir en otro equipo se comprueba sincronización de manifiesto y perfiles.

## Pruebas y límites

- Rust: resolución por versión, ausencia/corrupción de manifiesto, mantenimiento,
  paths incompatibles sin fallback, IDs que escapan y aislamiento de carpetas.
- Recorrido backend en proceso/llave aislados: Admin y Engineer/Supervisor, contraseña
  temporal/definitiva, perfil propio y evidence/, sin modificar perfil del Admin.
- PowerShell: credenciales/historial sintéticos idénticos por hash, cuenta temporal
  sin perfil inventado, team preservado, upgrade/rollback repetidos, bloqueo de
  rollback con perfil/evidencia nuevos y restauración de mantenimiento interrumpido.
- Pruebas DOM/IPC previas siguen en la suite; no sustituyen IPC Tauri ni RBAC nativo.
- Un primer intento de Gate 0 falló por timeout de arranque del worker Vitest;
  las ejecuciones posteriores de las 7 frontend y Gate 0 completo aprobaron.

Resultado: npm test aprobado (7 frontend + 24 Rust); Gate 0 consolidado aprobado,
incluyendo la suite PowerShell de upgrade/rollback. Se volvió a ejecutar esta suite
tras incluir protección de archivos ocultos, con resultado aprobado. Código/pruebas
listos; build release aprobado. Alan confirmó aplicación cerrada en los equipos
utilizados y se aplicó layout 2 al espacio activo, conservando 2 perfiles byte por
byte y team.json con sus huellas originales. No se borraron cuentas ni se cambiaron
contraseñas. Referencia y llave locales no forman parte de la operación de escritura.

Respaldo relativo al espacio:
`backups/profile-layout-185a0fde2a0942138d822cef9b063649/`.
Incluye perfiles/manifiesto originales, registro de huellas, portable anterior y
contratos/documentos reemplazados. Portable actualizado publicado con SHA-256
`4E81EAC815C61AF4ACA396F84B04B03709F6E899349C008E787D4BCBAC24DB1A`.
Comprobación nativa: el portable publicado abre Espacio listo y formulario Usuario /
Contraseña / Ingresar; no ofrece crear otro Admin. No se automatizó el ingreso con
credenciales del operador. Reingreso manual posterior al cambio y prueba entre
equipos quedan pendientes; el login nativo anterior fue confirmado por Alan.
Este cierre no equivale a F02 completo/F01 aceptado ni cierra D03: siguen pendientes
identidad de adjuntos por actividad, formatos/tamaños/retención, F06 y aprobación D02.
