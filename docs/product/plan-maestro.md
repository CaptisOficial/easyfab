# Plan e historias de EasyFAB

Corte: 2026-10-29 · Responsable de producto: Alan · [Índice](../indice.md).

Este archivo concentra el orden de construcción, la aceptación y el estado del trabajo. El catálogo define funciones y arquitectura/contratos desarrolla sus reglas. Método y significado de estados: [guía de desarrollo](../desarrollo.md).

## Trabajo por hito

Cada fila es un alcance verificable. Los hitos agrupan historias, sin otro estado manual. Las filas terminadas acreditan únicamente el resultado indicado; las comprobaciones nativas pendientes se mantienen separadas. Los IDs Fxx/PLAN anteriores sirven para consultar evidencia, no para ordenar otro backlog.

| Hito / historia | Resultado y aceptación | Estado | Pendiente o impedimento | Evidencia |
|---|---|---|---|---|
| 1 · Acceso y cuentas: base | Espacio, acceso propio y directorio Admin implementados y comprobados localmente | terminada | Validaciones adicionales en fila siguiente | [Primer acceso](execution/f01/first-access.md) |
| 1 · Carpetas personales | Layout elegido por manifiesto; cambio explícito reversible e idempotente, preservando credenciales | terminada | Adjuntos pertenecen al hito 3 | [Carpetas](execution/f02/acceptance.md) |
| 1 · Proyectos: alta y consulta | Supervisor guarda y recupera proyectos; Admin consulta; backend rechaza altas no autorizadas | terminada | Validación WebView en fila siguiente | [Proyectos](execution/f04/acceptance.md) |
| 1 · Navegación contextual | Menú, foco, roles y preservación de borradores comprobados con pruebas DOM | terminada | Validación visual nativa en fila siguiente | [Navegación](execution/navigation-acceptance.md) |
| 1 · Comprobar la base en escritorio | Acceso/reingreso por roles, carpetas, proyectos y navegación funcionan con datos sintéticos; comprobar uso entre equipos autorizados | pendiente | Ejecutar recorridos nativos descritos en evidencia, sin confundir mocks con escritorio | Evidencias anteriores |
| 1 · Catálogos FAB | Admin mantiene equipos y configuración general con referencias consistentes | pendiente | Concretar detalle y validaciones de ADM-02 | — |
| 2 · Trabajo diario del ingeniero | Engineer abre proyecto autorizado, guarda actividad/avance propio y lo recupera al volver a entrar; otra cuenta no lo modifica | pendiente | Definir consulta/asignación y contrato de actividad; no requiere adjuntos ni cierre aprobado | — |
| 3 · Evidencias | Adjuntos recuperables por actividad/revisión, referencias relativas y rechazo de rutas fuera del espacio | pendiente | Resolver restante D03 | [Antecedente D03](execution/f01/propuesta-d03.md) |
| 3 · Validar cierre | Supervisor acepta/devuelve una revisión con evidencia; 100 solicitado no equivale a aprobación | pendiente | D02 | — |
| 4 · Incidencias | Registrar paro/scrap sin pérdida ni duplicación; correcciones como eventos | pendiente | D01 para archivo compartido; confirmar nombre FAB de la superficie | — |
| 4 · Panorama y capacidad | Totales y calendario coinciden con fixtures; datos faltantes explícitos | pendiente | Reglas FAB D05 | — |
| 5 · Reporte semanal | Exportar periodo a Excel oficial preservando datos, fórmulas, tablas, estilos e impresión | pendiente | Seleccionar e inspeccionar plantilla D06 | — |
| 6 · Contrato de preferencias | Esquema local cerrado y defaults comprobados; sin persistencia ni UI | terminada | Consumidores en fila siguiente | [Contrato](execution/preferences-contract-acceptance.md) |
| 6 · Preferencias persistentes | Aislar opciones por espacio/usuario, recuperar inválidas y restablecer sin tocar referencia, llave ni datos | pendiente | Implementar persistencia, IPC y controles según arquitectura | [Política](../architecture/preferencias.md) |
| 6 · Confianza y recuperación | Provisión, rotación y recuperación del único Admin; restauración comprobada | pendiente | D04 | — |
| 6 · Validación con equipo y distribución | Recorrido completo, dos equipos, reconexión, respaldo/rollback y portable reproducible comprobados | pendiente | Completar capacidades consumidas; publicación requiere destino, versión y autorización concreta | — |

**Siguiente historia propuesta:** trabajo diario del ingeniero. La solicitud vigente selecciona el alcance que se ejecuta; esta prioridad no inicia automáticamente todas las filas.

## Aceptación de los hitos

Los siguientes criterios desarrollan las filas anteriores; no constituyen otra lista de estados. Pruebas, manejo de errores, respaldo e integridad se incorporan desde cada escritura. Las decisiones bloquean solo sus consumidores.

### 1. Base disponible

- **Carpetas y migración:** Validar el subalcance de layout ya implementado: cambio explícito reversible e idempotente, credenciales preservadas y una sola fuente activa. Las políticas de adjuntos pendientes de D03 pertenecen a la entrega 3.
- **Proyectos y catálogos:** RBAC real, asignaciones válidas, fechas, líneas, máquinas, fallas y referencias consistentes.

### 2. Trabajo diario

- **Actividades e hitos:** Escritura por sesión propietaria; hitos 0/25/50/75; 100 solicitado no equivale a aprobado.
- **Vista Engineer:** Proyectos autorizados, captura diaria e hitos; objetivo de captura diaria <60 s medido en piloto. Adjuntos se añaden en la entrega 3 e incidencias en la 4, sin bloquear este primer recorrido.

### 3. Cierre verificable

- **Evidencias:** Adjuntos múltiples con ID/revisión, límites acordados, referencias relativas y rechazo de rutas fuera del espacio; recuperación de copia interrumpida.
- **Aprobación y retrabajo:** D02 resuelta para la historia; autoridad del único Supervisor activo separada del perfil del ingeniero y ligada a revisión/evidencia; rechazo, reapertura e historial. Admin consulta, sin aprobación por rol.

### 4. Panorama del área

- **Incidencias de piso:** Resolver el protocolo pendiente de D01 para este alcance; append-only, deduplicación, correcciones como eventos, horas no negativas y scrap entero no negativo; prueba de reconexión y objetivo de captura <30 s medido en piloto.
- **Lecturas y métricas:** D05 aprobada; calendario, esfuerzo, capacidad neta, pesos y línea base explícitos; avance declarado/aprobado y datos faltantes diferenciados.
- **Vistas por rol:** Supervisor registra/asigna proyectos y aprueba o rechaza cierres; Admin administra usuarios/catálogos y consulta. Ambos consultan desviaciones según contrato; estados vacíos y errores accesibles. No conceder aprobación ni alta de proyectos a Admin.
- **Gantt y capacidad:** Ventana 21 días W-1/W0/W+1, zona America/Mexico_City; calendario FAB confirmado y capacidad basada en esfuerzo, no conteo de tareas.

### 5. Reporte semanal

- **Plantilla oficial Excel:** D06: Alan selecciona versión oficial; inspeccionar hojas, tablas, fórmulas, estilos e impresión y fijar fixture autorizado.
- **Exportación KMX-FW:** Snapshot consistente, plantilla oficial preservada y comparación de valores, tablas, fórmulas e impresión; salida en exports del espacio activo.

### 6. Uso validado

- **Confianza, recuperación y preferencias:** D04 aprobada; recuperación del único Admin, provisión de equipos y rotación; llave siempre local. Contraseña de 8 caracteres, temporal de 24 h y cambio obligatorio. Implementar preferencias locales por espacio/usuario, UI y pruebas; reset no modifica referencia, llave ni permisos.
- **Resiliencia y respaldo:** Respaldo de datos/evidencias/manifest sin master.key; restauración validada, compatibilidad de versiones, disco lleno y JSON inválido sin reinicializar datos.
- **Integración completa:** Proyecto → actividad → evidencia → aprobación → reporte, roles reales y sesiones restringidas probados en backend y UI.
- **Piloto y aceptación:** Preparar portable de piloto con hash antes de pruebas nativas. Pruebas sintéticas aisladas, roles, dos equipos, desconexión/reconexión, ausencia de pérdida/duplicación, tiempos de captura y evidencia nativa separada de mocks.
- **Candidato portable:** Build reproducible, hash, documentos/contratos, compatibilidad y rollback; portable único sin Node/Rust ni instalador obligatorio.
- **Publicación controlada:** Aprobación explícita futura, raíz resuelta y validada, backup, aceptación FAB y evidencia de publicación/rollback; sin migración implícita.

Preferencias personales son una historia de Configuración dentro de esta entrega.
No bloquean trabajo diario, evidencia ni reportes. Recuperación y respaldo se
preparan desde las escrituras que los necesitan; el piloto comprueba su conjunto.

## Decisiones pendientes

Abiertas para su alcance restante. Los subalcances confirmados no se reabren ni
se consideran aceptación de todo el tema. Cada decisión bloquea solo su consumidor.

| ID | Tema / responsable | Qué falta resolver o comprobar |
|---|---|---|
| D01 | Concurrencia OneDrive · Arquitectura + Alan | Confirmado para proyectos: único Supervisor activo escritor, Admin gestiona cuentas y consulta; una sesión por cuenta. Sigue pendiente protocolo verificable para incidencias compartidas. Append-only y rename local no garantizan convergencia ni exclusión distribuida. |
| D02 | Autoridad de aprobación · Supervisor + Arquitectura | Elegir registro autoritativo separado del JSON propiedad del ingeniero, unido a revisión y huella de evidencias. Un booleano escrito por el ingeniero no concede aprobación. |
| D03 | Carpetas y evidencias · Arquitectura | Layout 2 y selección única por manifiesto implementados en PLAN-013; layout 1 se conserva hasta mantenimiento explícito. Siguen pendientes aceptación completa, contrato operativo de adjuntos, tipos/tamaños/retención y recuperación. Ver [carpetas](execution/f02/acceptance.md) y [antecedente de adjuntos](execution/f01/propuesta-d03.md). |
| D04 | Confianza y recuperación  | Definir custodio, provisión, rotación y recuperación del único Admin. HMAC compartido con un verificador permite firmar; no sincronizar master.key ni prometer revocación instantánea sin conexión. Otro esquema criptográfico requiere cambio explícito de invariante. |
| D05 | Reglas FAB · Supervisor | Confirmar calendario, semanas, turnos, esfuerzo, capacidad, pesos, unidades y línea base para desviaciones. Datos insuficientes se muestran como desconocidos. |
| D06 | Excel oficial ·  Supervisor | Seleccionar e inspeccionar plantilla oficial EN o EN-R2; el sufijo R2 no acredita autoridad. Las hojas/tablas del brief siguen por verificar. |
