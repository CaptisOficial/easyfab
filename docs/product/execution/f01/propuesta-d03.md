# F01 / D03 — Carpetas personales y evidencias

Fecha: 2026-10-28. Estado: propuesta pendiente de aceptación de Alan.
Autoridad vigente: AGENTS.md, contracts/v1 y arquitectura de espacio/acceso.
Esta entrega prepara decisiones; no modifica contratos publicados, runtime ni datos.
F01 completo sigue pendiente de D01–D05, preferencias y restantes contratos.

## Layout recomendado

Ruta actual única: `<raíz validada>/easy-fab/data/engineers/<id-easyfab>.json`.
Destino propuesto, aplicable también a Supervisor/Admin porque comparten resolver:

```text
easy-fab/
  workspace.json
  data/
    team.json
    projects.json
    issues.json
    config_plant.json
    engineers/<id-easyfab>/
      profile.json
      evidence/<actividad-id>/
        index.json
        <adjunto-id>.<ext>
  backups/migrations/<migration-id>/
    journal.json
    original/workspace.json
    original/engineers/<id-easyfab>.json
```

El ID personal conserva exactamente el ID canónico existente; no renombrar cuentas
ni generar IDs desde Windows. Nuevos IDs de actividad y adjunto: UUID v4 generado
en Rust, minúsculas, con comprobación de colisión y creación sin sobrescritura.
Actividades heredadas conservan su ID; si no es seguro como segmento, F02 se detiene
y requiere un mapeo explícito que preserve referencias, nunca normalización silenciosa.
No crear perfiles vacíos para cuentas que todavía no han cambiado su temporal.

La sesión normal escribe solo su perfil, índices y adjuntos propios. Admin conserva
la gestión de team.json; no obtiene edición cotidiana de perfiles ajenos. La migración
es una operación de mantenimiento explícita del Admin, con aplicaciones cerradas.
La lectura de evidencias por otros roles depende de asignación/permisos de F04/F07;
no se concede lectura universal aquí. El acceso directo a la carpeta mediante Windows
sigue sujeto a permisos corporativos: RBAC de aplicación no equivale a ACL de archivos.

## Contratos a promover después de aceptación

La fuente definitiva será contracts/v1; esta tabla especifica el borrador para revisión,
no un esquema alternativo consumible por runtime.

| Contrato | Propuesta concreta |
|---|---|
| engineer_tasks.schema.json | Mantener engineer_id, last_synced, subactivities y credential con semántica actual. Mover bytes completos a profile.json sin reserializar: conserva hash Argon2id, revisión, firma, fechas, historial y campos existentes. engineer_id debe coincidir con propietario/ruta y directorio. credential puede faltar cuando aún no exista definitiva; no inventarla. |
| evidence.schema.json (nuevo) | index.json por actividad: version=1, engineer_id, activity_id, revision (entero >=1), attachments (array). Campos cerrados, salvo contenido legado del perfil que se preserva. |
| Registro de adjunto | id (UUID), original_name (1–255 caracteres, solo presentación), extension (enum), media_type (enum coherente), size_bytes (entero 1–26214400), sha256 (64 hex minúsculas), created_at (RFC3339 UTC), created_by (ID propietario), state (active/withdrawn), withdrawn_at (fecha solo si retirado). ID único en índice; actor/fechas/huella se fijan en backend. |
| Referencia física | Se deriva de propietario + actividad + id + extensión. No almacenar rutas absolutas ni aceptar rutas destino del frontend. La referencia relativa al espacio es data/engineers/<id>/evidence/<actividad>/<adjunto>.<ext>. original_name jamás participa en ella. |
| workspace.schema.json / layout | Añadir data_layout_version: legacy=1, carpetas=2; ausencia en manifiesto existente significa explícitamente legacy 1 en el contrato de transición. Añadir mínimo de lector compatible. Separar versión de datos de versión del contrato y del portable. |
| migration.schema.json (nuevo) | journal: version, migration_id, workspace_id, source_layout, target_layout, phase, inventario de rutas relativas/hash/tamaño y checkpoints. Fases prepared/staged/retired/committed/rolled_back; validación por estado y referencias. Sin secretos ni hashes de contraseña adicionales. |

`index.revision` cambia al adjuntar/retirar; reemplazar archivo siempre crea otro ID,
conservando bytes antiguos. `deliverable_evidence` legado se conserva como texto;
no interpretar cadenas como rutas ni importar archivos automáticamente.
`supervisor_approved` legado tampoco adquiere autoridad por migrarse.
F05/F07 definirán revisión de actividad y decisión externa ligada a IDs/huellas
exactos; cambiar evidencias exige nueva revisión, sin escribir aprobación en el perfil.
SHA-256 detecta diferencia de contenido; no acredita identidad ni aprobación.

## Política inicial propuesta para Alan

- PDF, PNG, JPEG, DOCX y XLSX; máximo **25 MiB por archivo**, **20 adjuntos activos
  por actividad** y **200 MiB activos por actividad**. Son límites propuestos,
  no necesidades corporativas ya confirmadas. Sin cuota global hasta medir uso.
- Validar extensión, contenido real y MIME coherentes; inspeccionar contenedor OOXML
  con límites de expansión. Rechazar ejecutables, formatos con macros y ZIP genérico.
  No ejecutar adjuntos ni abrirlos automáticamente. No prometer antivirus integrado.
- Retiro lógico por el propietario: ocultar de selección futura y conservar bytes,
  metadatos y referencias históricas, incluidos adjuntos de actividades archivadas
  y usuarios desactivados. Sin purga automática inicial; duración legal/corporativa
  y eliminación física quedan pendientes de política de Alan/FAB.

Publicación futura F06: copiar a temporal único en la misma carpeta, calcular tamaño
y hash durante lectura limitada, validar formato, sincronizar y publicar sin reemplazar;
solo después actualizar el índice. Fallo previo al índice deja un huérfano recuperable,
no evidencia válida. Fallo de copia conserva el índice anterior. Una referencia cuyo
archivo falta/no está hidratado/cambió muestra «evidencia no disponible» y bloquea su
uso para aprobación; no se interpreta como actividad sin evidencia. Resolver y verificar
contención real, rechazando traversal, rutas UNC/absolutas y escapes por enlaces/reparse
points. Las mismas reglas aplican a lectura/exportación. Temporales y huérfanos se
reconcilian de forma explícita; nunca purgar un archivo que pueda estar sincronizándose.

## Migración reversible e idempotente de F02

1. **Preparar:** aceptación D03 y gobernanza actualizada; respaldo con hash, espacio
   identificado y confianza local disponible. Ventana de mantenimiento: todos los
   equipos dejan de escribir y completan sincronización. Inventariar cuentas/perfiles,
   validar JSON, firmas existentes, IDs, coincidencias sin distinguir mayúsculas,
   rutas seguras y espacio libre para original + staging + margen. Conservar perfiles
   inactivos. Un perfil ausente válido de cuenta temporal sigue ausente; uno requerido
   para definitiva o un perfil huérfano/inválido exige revisión. No reparar credenciales.
2. **Compatibilidad previa:** antes de migrar, distribuir un lector transitorio que
   respete versión y journal de mantenimiento, manteniendo legacy como única autoridad.
   El portable 0.1.0 no conoce ese bloqueo; debe retirarse operativamente del uso en
   todos los equipos. Si no puede garantizarse, no iniciar. Un rename o lock local no
   excluye escritores en otros equipos: D01 debe cerrar este requisito verificable.
3. **Staging:** crear journal con ID y huellas originales; copiar perfiles byte por byte
   al área de staging del respaldo, validar igualdad y autenticación sintética antes de
   publicar. El journal enumera también perfiles ausentes. No tocar team.json,
   installation.json, master.key ni ID del espacio. Repetir con mismo ID y entradas
   idénticas reanuda checkpoints; discrepancia detiene sin sobrescribir.
4. **Retirar y publicar:** con mantenimiento activo, mover perfiles legacy a original/
   verificando respaldo; instalar carpetas preparadas sin reemplazar destinos ajenos.
   Hasta el commit ningún lector entra al espacio. Publicar manifiesto layout=2 al
   final y marcar committed. El runtime compatible lee exclusivamente la versión
   declarada y falla ante journal incompleto; jamás prueba ambas rutas como fallback.
   La transición de varios archivos no es atómica: cada corte exige recuperación.
5. **Comprobar:** inventario, hashes, propietarios, credenciales e historial iguales;
   ningún perfil legacy operativo. Verificar con fixtures Admin/Supervisor/Engineer,
   definitiva/temporal/inactivo. Fuera de pruebas, el operador verifica sincronización
   completa y compatibilidad en cada equipo antes de levantar mantenimiento.

Interrupción: al reiniciar solo ofrecer reanudar/restaurar desde journal validado,
sin login ni autoalta. Destino ya existente con contenido diferente bloquea; mismo
contenido y checkpoint consistente permite reanudar. No confiar solo en phase: verificar
estado físico/huellas. JSON/journal corrupto o conflicto OneDrive requiere recuperación
manual desde respaldo, nunca inicializar datos vacíos.

**Rollback antes de reabrir operación:** mantener mantenimiento, verificar respaldo,
retirar destinos publicados, restaurar bytes/rutas/manifiesto originales y validar
inventario, luego marcar rolled_back. Repetir rollback no duplica ni sobreescribe
cambios imprevistos. Liberar únicamente después de comprobar todos los equipos.
**Después de nuevas escrituras:** no restaurar respaldo antiguo automáticamente:
perdería cambios de contraseña/actividades/evidencias. Conservar snapshot actual y
requerir conversión inversa probada o reparación hacia adelante. El binario antiguo
no puede interpretar evidencias nuevas; este rollback requiere decisión operativa.
Los respaldos contienen datos sensibles protegidos por el mismo dominio corporativo;
master.key nunca se copia allí. Esta propuesta no autoriza ejecutar la migración real.

## Aceptación y siguiente paso

Alan debe aceptar o ajustar dos decisiones de producto: (1) carpeta por cada cuenta,
perfil intacto e índices de evidencia separados con migración en mantenimiento;
(2) formatos, límites y retiro lógico sin purga automática propuestos arriba.
La aceptación habilita preparar contratos/gobernanza y fixtures, no publicar ni migrar
producción. No requiere decidir algoritmos de hash, nombres temporales o UUID.

D01 sigue bloqueando el protocolo de concurrencia/corte; D02 la autoridad de revisión;
D04 la custodia/recuperación; D05 las reglas FAB. F02 no queda listo por aceptar solo
D03: el DoR actual exige F01 aceptado completo. Si se quiere adelantar un subalcance,
revisar expresamente dependencias/DoR sin declarar terminado F01.

Pruebas exigidas para F02/F06: igualdad de bytes y credenciales/historial; repetir
migración y rollback; fallo tras cada checkpoint; perfil faltante/corrupto/destino
contradictorio; rechazo de versión vieja, otra raíz/ID y journal incompleto; disco
lleno y permisos; aislamiento por sesión; enlaces y traversal; formatos/tamaños y
conteos en límite y límite+1; copia interrumpida/huérfanos; evidencia no hidratada o
alterada. Fixtures temporales, ninguna cuenta o llave real. IPC mock y filesystem
local no acreditan RBAC nativo ni convergencia entre equipos.
