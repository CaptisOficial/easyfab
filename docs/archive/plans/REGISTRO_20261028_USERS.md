# EasyFAB — gestión administrativa de usuarios

Fecha: 2026-10-28 (America/Mexico_City).
Código: C:\Dev\easyfab.

Alcance: directorio Admin, alta de ingenieros/supervisores, activación/desactivación y recuperación existente integrada. Roles y estados se validan en Rust con sesión Admin normal revalidada. La cuenta Admin está protegida frente a desactivación.

El alta valida ID y cuenta Windows únicos sin distinguir mayúsculas, incluso en cuentas inactivas; emite temporal de 8 caracteres válida 24 horas. Desactivar conserva historial y renueva la revisión; reactivar emite otra temporal y vuelve a exigir cambio. Solo se escribe team.json; los perfiles de los ingenieros no se modifican desde Admin.

Se mantuvieron responsabilidades separadas: reglas en auth/users.rs, IPC en user_commands.rs, listado en UserDirectory.tsx y alta en NewUserForm.tsx. Generación de temporales compartida con recuperación; sin nuevas dependencias.

Verificación disponible: frontend compilado y 13 pruebas Rust aprobadas; 5 comprobaciones del patrón del contrato aprobadas. Gate 0 final aprobado. No se crearon ni modificaron usuarios reales como parte de las pruebas. El usuario confirmó previamente el acceso nativo Admin y el cambio inicial.

Pendiente de prueba manual: crear un usuario con su cuenta Windows real, acceder desde esa identidad y comprobar baja/reactivación. La confianza del equipo debe estar aprovisionada; la revocación entre equipos depende de sincronización OneDrive. Siguiente fase: vistas operativas de ingeniería y supervisión.

Documentación técnica y estados en docs/architecture/auth.md; plan en docs/archive/plans/PLAN_003A_USERS.md del repositorio local.

Registro previo: [acceso y recuperación](EasyFAB-fase2-acceso-recuperacion.md).
