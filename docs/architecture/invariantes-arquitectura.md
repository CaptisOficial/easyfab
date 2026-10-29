# Invariantes de arquitectura

Restricciones generales del diseño. [Espacio de trabajo](espacio-de-trabajo.md) desarrolla ubicación y layouts; [acceso y cuentas](auth.md) desarrolla identidad, RBAC y confianza.

## Ubicación y distribución

- Local-first en la carpeta compartida corporativa seleccionada y validada. La propuesta inicial es `%USERPROFILE%\OneDrive - Kawasaki Motores de México S.A. de C.V\ENGINEERING FILES - 10.FAB\`; no obliga a una ruta fija.
- Todos los módulos resuelven sus rutas en Rust desde el mismo espacio activo. Una referencia guardada no disponible bloquea acceso; no buscar ni crear otro origen de datos.
- El espacio reside en `<raíz>/easy-fab/`: datos, documentación, contratos y portable según [workspace.layout.json](../../contracts/v1/workspace.layout.json). Portable único en `software/easyfab.exe`, sin instalar Node/Rust en equipos de uso.
- `%LOCALAPPDATA%/EasyFAB` contiene referencia de instalación, llave y preferencias locales. Preferencias separadas por ID de espacio/usuario, sin autoridad sobre identidad o permisos. Datos operativos, roles, credenciales protegidas y configuración general permanecen compartidos.
- La llave nunca se sincroniza ni se incluye en el portable. No almacenar contraseñas en claro ni enviar datos a nubes públicas no autorizadas.

## Escrituras y sincronización

- Cada cuenta escribe solo su partición: layout 2 `engineers/<id>/profile.json` y `evidence/`; layout 1 conserva `engineers/<id>.json` hasta mantenimiento explícito. El manifiesto selecciona una versión, sin fallback al otro perfil. Ningún rol escribe perfiles ajenos en operación normal.
- Admin gestiona `team.json` y catálogos; el único Supervisor activo escribe `projects.json`. Autoridad de roles y sesiones: auth. Una sesión de trabajo por cuenta.
- `issues.json` es append-only: añadir eventos, conservando registros anteriores. Esto no garantiza convergencia de escritores simultáneos en OneDrive; el protocolo compartido debe resolverse antes de implementar su consumidor.
- OneDrive sincroniza eventualmente. Mutex o rename locales no ofrecen exclusión distribuida ni revocación instantánea sin conexión.

## Seguridad y contratos

- Contraseñas con Argon2id y salt aleatorio seguro. Privilegios protegidos con HMAC-SHA256; payload de rol `id:role:status`. Una firma inválida rechaza acceso. Las limitaciones del secreto compartido se explican en auth.
- Los esquemas de [contracts/v1](../../contracts/v1/) definen estructuras canónicas. Rust y TypeScript se ajustan a ellos; no inventar campos en runtime. Contratos versionados en el repositorio, no editables como configuración operativa.
- Rust aplica permisos y persistencia. React presenta captura y consulta, sin decidir autorización ni aceptar rutas arbitrarias del cliente.

## Integridad y verificación

Cambiar raíz exige cerrar sesión y validar la nueva ubicación, sin migración implícita. Mantenimiento, restauración y publicación preservan una sola fuente activa y requieren alcance explícito. Las preferencias personales nunca cambian referencia, llave o permisos.

Las pruebas acompañan cada comportamiento y regresión. [testing.md](testing.md) define comandos, datos sintéticos y límites. Gate 0 verifica contratos, compilación y suites; su aprobación no acredita por sí sola paridad exhaustiva de esquemas, sincronización entre equipos ni aceptación nativa.
