# PLAN-003B — Acceso independiente de Windows
Estado: complete
Fecha: 2026-10-28
Paso activo: ninguno. Retiro de vínculo Windows y ajuste de Admin completados; traslado del espacio continúa en PLAN-006.
DAG: baseline -> contratos/backend -> formularios -> Gate 0 -> registro.
write_surfaces: contracts/v1/{team,auth}.schema.json, src-tauri/src/auth/{models,directory,credentials,users,tests,user_tests}.rs, src-tauri/examples/provision_admin.rs, src/lib/api.ts, src/components/auth/{NewUserForm,UserDirectory}.tsx, docs/architecture/{auth,invariantes-arquitectura,glosario-canonico}.md, docs/product/capabilities-matrix.md, docs/archive/plans/*.
Alcance: retirar vínculo con identidad Windows; todos los perfiles por ID EasyFAB. El usuario confirma que solo existe Admin y autoriza ajuste directo de su registro/perfil con respaldo, conservando contraseña. Sin capa de compatibilidad. Mantener roles, cambio obligatorio y temporales de 8 caracteres.

write_surfaces de datos autorizadas: únicamente Admin de Management/Data/team.json, su perfil y respaldo local corporativo de esos dos archivos. No modificar llaves ni otras cuentas.

Utilidad de ajuste única en src-tauri/target/migrate_admin_portable.py (no distribuida); fixture local verifica preservación de perfil/contraseña e idempotencia.

Evidencia: 14 pruebas base aprobadas; 21 con espacio/alta inicial; build frontend aprobado. Ajuste real Admin verificado por firmas, contraseña y perfil preservados, respaldo creado y Data trasladado a easy-fab/data. No se agregó compatibilidad Windows al runtime.
