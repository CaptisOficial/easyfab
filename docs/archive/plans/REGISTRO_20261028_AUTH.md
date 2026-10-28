# EasyFAB — fase 2: acceso y recuperación

Fecha: 2026-10-28, America/Mexico_City.
Estado: implementación de acceso verificada localmente; proyecto general abierto.
Código: C:\Dev\easyfab.

Se implementaron Argon2id, firmas HMAC, sesión autoritativa en Rust, acceso React y creación explícita de confianza local. El primer acceso y cualquier recuperación mediante temporal exigen cambiar la contraseña antes de entrar normalmente. Política confirmada por Alan: 8 caracteres. Temporal aleatoria válida 24 horas, emitida solo por Admin con sesión normal.

El cambio de contraseña escribe exclusivamente el perfil del titular; la recuperación administrativa cambia team.json y su revisión firmada. La revocación entre equipos depende de OneDrive. Backend y formularios separados por responsabilidad para mantener un desarrollo ágil.

Máquina de estados, transiciones, permisos y límites documentados en docs/architecture/auth.md del repositorio local. Plan y evidencia en docs/archive/plans/PLAN_002_AUTH.md.

Verificación: Gate 0 aprobado, npm.cmd run build aprobado, 9 pruebas Rust aprobadas, ejemplo de provisión compilado. Se corrigió la codificación del script para Windows PowerShell. La prueba de persistencia se ejecutó dentro del repositorio por restricción de escritura del entorno temporal.

No se ejecutó la provisión contra datos corporativos ni se generaron contraseñas reales. Pendientes: provisión controlada de confianza en equipos, prueba nativa y de sincronización, altas/bajas y contingencia de administrador; después, vistas operativas de la fase 3. HMAC compartido no protege frente al custodio de la llave ni frente a restauración completa de versiones antiguas; límites descritos en la documentación técnica.

Referencia previa: [prompt maestro](PROMPT-AGENTE-KMX-ENGINEERING-OS.md).
