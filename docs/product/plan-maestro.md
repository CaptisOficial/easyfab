# Plan maestro de EasyFAB

Fecha de corte: 2026-10-28 · Responsable de producto: Alan · Estado: planificación completa; ejecución del backlog pendiente.

## Objetivo y autoridad

Sistema de escritorio Tauri v2, Rust y React para captura, consolidación y reporte FAB, local-first en la carpeta corporativa seleccionada. AGENTS.md y contracts/v1 son autoridad. La ruta inicial OneDrive es propuesta; todos los módulos usan el mismo espacio validado y fallan si no está disponible. Cambiar raíz cierra sesión y no migra datos.

## Base real

Existen selección de espacio, acceso independiente de Windows, Argon2id/HMAC, contraseña de 8 caracteres, temporal con cambio obligatorio, directorio Admin y portable 0.1.0. Evidencia histórica: 21 pruebas Rust y 4 frontend; las pruebas IPC simuladas y el arranque de ventana no acreditan flujos nativos completos. Los módulos FAB y las preferencias locales persistentes siguen pendientes. Ver [revisión técnica](planning/reviews/baseline.md) y [brechas de dominio](planning/reviews/domain-gaps.md).

## Fuentes únicas del plan

- [DAG canónico](planning/easyfab.strategy.json): dependencias, interfaces, propietarios de escritura y límites.
- [Catálogo de entregables](planning/roadmap.json): estado observado, DoR, DoD, evidencia y decisiones; no es un registro de ejecución.
- [Contrato de misión](planning/mission-contract.md): reglas de ejecución y aceptación.
- [DAG generado](planning/easyfab-dag.mmd) y [FSM de ejecución generada](planning/easyfab-fsm.mmd).
- [Revisiones](planning/reviews/): evidencia de alcance y brechas.

## Entregas de producto

| Hito | Resultado aceptable | Entregables |
|---|---|---|
| M0 | Base existente revalidada | F00 |
| M1 | Contratos, carpetas y confianza | F01–F03 |
| M2 | Primer recorrido: proyecto → actividad → evidencia → aprobación | F04–F07, integración parcial controlada |
| M3 | Incidencias, métricas y vistas de roles/Gantt | F08–F12 |
| M4 | Excel oficial reproducible | F13–F14 |
| M5 | Recuperación, integración, piloto y distribución | F15–F19 |

Los hitos expresan resultados, no fechas ni porcentajes inventados. F13 puede avanzar junto con el backend; las vistas de roles pueden desarrollarse en paralelo cuando sus contratos estén aceptados. Las modificaciones del registro Rust se serializan explícitamente. Cada entrega mantiene funciones y archivos por responsabilidad.

## Decisiones de entrada

| ID | Decisión | Responsable | Cierre requerido |
|---|---|---|
| D01 | Concurrencia OneDrive | Arquitectura + Alan | Elegir protocolo verificable para múltiples escritores de issues/projects/team y misma cuenta en dos equipos. Append-only y rename local no garantizan convergencia. Eventos inmutables/proyección o escritor único son alternativas, no cambios ya autorizados. |
| D02 | Autoridad de aprobación | Supervisor + Arquitectura | Elegir registro autoritativo separado del JSON propiedad del ingeniero, unido a revisión y huella de evidencias. Un booleano escrito por el ingeniero no concede aprobación. |
| D03 | Carpetas y evidencias | Alan + Arquitectura | Aprobar layout por usuario, contrato de adjuntos, tipos/tamaños/retención y migración con rollback antes de sustituir engineers/<id>.json. |
| D04 | Confianza y recuperación | Alan | Definir custodio, provisión, rotación y recuperación del único Admin. HMAC compartido con un verificador permite firmar; no sincronizar master.key ni prometer revocación instantánea sin conexión. Otro esquema criptográfico requiere cambio explícito de invariante. |
| D05 | Reglas FAB | Supervisor | Confirmar calendario, semanas, turnos, esfuerzo, capacidad, pesos, unidades y línea base para desviaciones. Datos insuficientes se muestran como desconocidos. |
| D06 | Excel oficial | Alan + Supervisor | Seleccionar e inspeccionar plantilla oficial EN o EN-R2; el sufijo R2 no acredita autoridad. Las hojas/tablas del brief siguen por verificar. |

## Espacio y ciclo de datos

PLAN-013 implementa el subalcance de carpetas de D03: espacios nuevos usan `<raíz>/easy-fab/data/engineers/<id>/profile.json` y preparan `evidence/`. Los anteriores mantienen `<id>.json` hasta mantenimiento explícito, con respaldo/rollback y credenciales preservadas. El manifiesto decide la única ruta activa. [Evidencia y alcance](execution/f02/acceptance.md). La subida de adjuntos, sus políticas y D03 completo siguen pendientes; no se cierra F01 ni se ejecuta automáticamente todo F02.

Desarrollo de D03 para revisión de Alan: [propuesta concreta](execution/f01/propuesta-d03.md) y [revalidación de base](execution/f01/acceptance.md), 2026-10-28. Define contratos candidatos, política inicial de adjuntos y transición recuperable; todavía no cierra F01 ni habilita F02.

Compartido: usuarios, roles, credenciales protegidas, configuración FAB, proyectos, avances y evidencias. Local: installation.json, master.key y futuras preferencias por espacio/usuario; preferencias no conceden permisos. Documentación en docs/, contratos en contracts/v1/, exportaciones en exports/, portable en software/easyfab.exe. Plantillas versionadas requieren aprobar su ubicación en el layout.

Estados de acceso: sin espacio → espacio validado → sin sesión → credencial temporal válida → sesión restringida → cambio obligatorio → sesión normal → cierre. Temporal vencida exige nueva temporal del Admin. Recuperar contraseña vuelve a restringir el acceso; ninguna operación FAB se permite antes del cambio. Cuenta deshabilitada o firma inválida bloquea acceso. Las reglas de recuperación del único Admin se cierran en D04.

Estados de actividad propuestos: borrador → en curso → revisión solicitada → aprobada; rechazo devuelve a retrabajo. Cambiar revisión o evidencia invalida/reabre la aprobación según D02. Llegar a 100 requiere autorización y documento OS/WI cuando aplique. Estos estados de negocio son distintos de la FSM del ejecutor del DAG.

## Desglose ejecutable

| ID | Entregable / responsable | Depende de | Criterio de aceptación |
|---|---|---|
| F00 | Base verificada · Arquitectura | Misión | Auditar código, contratos y evidencia nativa; distinguir pruebas de mocks. |
| F01 | Decisiones y contratos · Arquitectura + Alan | F00 | Resolver D01–D05; contratos versionados, pruebas y autorización de cambios de invariantes antes de consumidores. |
| F02 | Carpetas y migración · Rust almacenamiento | F01 | D03 aprobada; migración reversible e idempotente, credenciales preservadas y una sola fuente activa. |
| F03 | Confianza, recuperación y preferencias · Rust acceso | F02, F01 | D04 aprobada; recuperación del único Admin, provisión de equipos y rotación; llave siempre local. Contraseña de 8 caracteres, temporal de 24 h y cambio obligatorio. Implementar preferencias locales por espacio/usuario, UI y pruebas; reset no modifica referencia, llave ni permisos. |
| F04 | Proyectos y catálogos · Rust dominio | F03, F01 | RBAC real, asignaciones válidas, fechas, líneas, máquinas, fallas y referencias consistentes. |
| F05 | Actividades e hitos · Rust dominio | F04, F02, F03, F01 | Escritura por sesión propietaria; hitos 0/25/50/75; 100 solicitado no equivale a aprobado. |
| F06 | Evidencias · Rust archivos | F05, F02, F03, F01 | Adjuntos múltiples con ID/revisión, límites acordados, referencias relativas y rechazo de rutas fuera del espacio; recuperación de copia interrumpida. |
| F07 | Aprobación y retrabajo · Rust dominio | F06, F05, F04, F03, F01 | D02 aprobada; autoridad Supervisor/Admin separada del perfil del ingeniero, ligada a revisión y evidencia; rechazo, reapertura e historial. |
| F08 | Incidencias de piso · Rust dominio | F07, F04, F03, F02, F01 | D01 aprobada; append-only, deduplicación, correcciones como eventos, horas no negativas y scrap entero no negativo; prueba de reconexión. |
| F09 | Lecturas y métricas · Rust analítica | F08, F07, F06, F05, F04, F01 | D05 aprobada; calendario, esfuerzo, capacidad neta, pesos y línea base explícitos; avance declarado/aprobado y datos faltantes diferenciados. |
| F10 | Vista Engineer · React | F08, F06, F05, F03, F01 | Proyectos asignados, captura diaria, hitos y adjuntos; objetivo de captura diaria <60 s e incidencia <30 s medido en piloto. |
| F11 | Vistas Supervisor y Admin · React | F09, F07, F04, F03, F01 | Asignar proyectos, mantener catálogos, revisar evidencias, aprobar/rechazar y consultar desviaciones; estados vacíos y errores accesibles. |
| F12 | Gantt y capacidad · React | F09, F01 | Ventana 21 días W-1/W0/W+1, zona America/Mexico_City; calendario FAB confirmado y capacidad basada en esfuerzo, no conteo de tareas. |
| F13 | Plantilla oficial Excel · Especialista Excel | F01 | D06: Alan selecciona versión oficial; inspeccionar hojas, tablas, fórmulas, estilos e impresión y fijar fixture autorizado. |
| F14 | Exportación KMX-FW · Rust reportes | F09, F13, F03, F01 | Snapshot consistente, plantilla oficial preservada y comparación de valores, tablas, fórmulas e impresión; salida en exports del espacio activo. |
| F15 | Resiliencia y respaldo · Rust almacenamiento | F14, F02, F03, F01 | Respaldo de datos/evidencias/manifest sin master.key; restauración validada, compatibilidad de versiones, disco lleno y JSON inválido sin reinicializar datos. |
| F16 | Integración completa · Integrador | F10, F11, F12, F14, F15, F09, F01 | Proyecto → actividad → evidencia → aprobación → reporte, roles reales y sesiones restringidas probados en backend y UI. |
| F17 | Piloto y aceptación · QA + FAB | F16, F01 | Preparar portable de piloto con hash antes de pruebas nativas. Pruebas sintéticas aisladas, roles, dos equipos, desconexión/reconexión, ausencia de pérdida/duplicación, tiempos de captura y evidencia nativa separada de mocks. |
| F18 | Candidato portable · Release | F17, F16, F01 | Build reproducible, hash, documentos/contratos, compatibilidad y rollback; portable único sin Node/Rust ni instalador obligatorio. |
| F19 | Publicación controlada · Operador + Alan | F18, F17 | Aprobación explícita futura, raíz resuelta y validada, backup, aceptación FAB y evidencia de publicación/rollback; sin migración implícita. |

## Cobertura del sistema

| Capacidad | Entregables |
|---|---|
| Espacio, identidad, usuarios, recuperación y preferencias locales | F01–F03, F15–F16 |
| Catálogos FAB y proyectos/asignación | F04, F11 |
| Actividades, hitos, avances y evidencia | F05–F07, F10 |
| Downtime, scrap e historial | F08, F10 |
| Calendario, carga, desviaciones y Gantt 21 días | F09, F11–F12 |
| Reporte KMX-FW y exportaciones | F13–F14 |
| Respaldo, restauración, portable, documentación y soporte | F15–F19 |
| Pruebas de contratos, unitarias, integración y nativas | Cada nodo + F17 |

## Control y próximo paso

La solicitud actual autoriza estructurar el plan. No inicia automáticamente sus veinte entregables. El siguiente trabajo concreto es F01: resolver contratos y D03 para la carpeta de usuario/evidencias, manteniendo las otras decisiones que bloquean consumidores. Preferencias locales requieren contrato propio antes de persistirlas.

Cada cierre exige npm test y scripts/verify_contracts.ps1, más pruebas del comportamiento modificado. Los datos de prueba son sintéticos y aislados. El piloto de dos equipos se prepara con espacio de prueba autorizado y no usa producción. La aceptación final exige además resultados nativos, prueba de concurrencia, plantilla oficial y aprobación FAB. Ningún mock sustituye esa evidencia.

Los planes históricos son evidencia de entregas parciales; este documento es la entrada al alcance completo. Cambiar decisiones actualiza primero contratos/DAG y sus vistas, luego código. No se certifica hoy la ausencia de conflictos OneDrive.
