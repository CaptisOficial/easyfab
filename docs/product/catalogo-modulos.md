# Catálogo funcional de módulos y ventanas

Base de producto · 2026-10-29. Este documento traduce la
[matriz de capacidades](capabilities-matrix.md) a superficies concretas. La
[navegación](../architecture/navegacion.md) define su ubicación y comportamiento.
El [plan maestro](plan-maestro.md) enlaza entregables y la política de dependencias por historia.
Las fichas no acreditan implementación ni autorizan cambios de contratos o RBAC.

Los identificadores Fxx que aparecen en trazas existentes son referencias históricas,
sin orden ni autoridad de planificación. La construcción se organiza únicamente
en las seis entregas del plan maestro; estas fichas definen funciones y permisos.

## Mapa funcional

| ID / superficie | Responsabilidad y funcionalidades esperadas | Roles y límites | Estado / trazabilidad |
|---|---|---|---|
| NAV-01 · Top Nav y panel lateral | Identidad, fecha, navegación, sección activa y cierre de sesión. Panel superpuesto con cierre exterior y teclado. | Todos; destinos según permisos. | Lateral y Configuración contextual implementados; validación nativa pendiente. PLAN-015 / PLAN-016. |
| INI-01 · Inicio | Resumen de avances, próximos cierres, vencidos y pendientes de revisión. Abrir el registro de origen desde cada indicador. | Engineer: sus asignaciones; Supervisor/Admin: panorama general. | Previsto; F09–F11. Fórmulas, periodo y agregación pendientes de D05. |
| PRO-01 · Proyectos: listado y alta | Consultar, filtrar y abrir proyectos; Supervisor registra nombre, responsable y fechas conforme al contrato vigente. | Supervisor registra; Admin consulta. Alcance Engineer asignado previsto, pendiente de implementar. | Alta/consulta Supervisor/Admin implementadas, aceptación nativa pendiente; F04/F10/F11, PLAN-014. |
| PRO-02 · Detalle, actividades y avance | Consultar fechas y estado; registrar actividades propias, hitos y evidencias; solicitar cierre y consultar resultado. | Engineer escribe su partición; Supervisor valida cierres. Admin consulta; no conceder aprobación por la matriz histórica. | Previsto; F05–F07/F10/F11. Autoridad de aprobación D02 pendiente. |
| LIN-01 · Problemas de línea: registro e historial | Registrar equipo/línea, descripción y fecha; paro y scrap cuando apliquen; consultar seguimiento hasta resolución. | Reporte previsto para los tres roles; responsables de seguimiento y correcciones por definir antes de implementar. | Previsto; F08/F10. Nombre final FAB y protocolo D01 pendientes; contrato issues conserva autoridad. |
| CFG-01 · Configuración | Punto de entrada a preferencias, carpeta de gestión y administración autorizada. | Todos; opciones filtradas por rol. | Destino desde el lateral implementado; preferencias previstas. |
| CFG-02 · Carpeta de gestión | Mostrar carpeta activa; tras cerrar sesión, seleccionar y validar otra raíz. Mostrar errores sin perder la referencia válida ni migrar datos. | Sin sesión activa; permisos de carpeta y confianza siguen aplicando. | Base existente; F02/F03, PLAN-015. No seleccionar silenciosamente la sugerencia. |
| CFG-03 · Preferencias | Personalizar tema, tamaño de interfaz y filtros por espacio/usuario. | Preferencias personales sin autoridad sobre identidad o permisos. | Contrato v1 validado; F01/F03. Persistencia y UI pendientes; ver arquitectura/preferencias.md. |
| ADM-01 · Administración del sistema → Usuarios | Consultar directorio, dar de alta Engineer/Supervisor, desactivar/reactivar y recuperar acceso mediante contraseña temporal con cambio obligatorio. | Solo Admin con sesión normal. Baja lógica; sin eliminar historial, cambiar roles ni crear otro Admin. Un solo Supervisor escritor activo. | Base integrada en esta jerarquía; validación nativa pendiente. F03/F11. Recuperación del único Admin se resuelve en D04, fuera de este flujo. |
| ADM-02 · Administración del sistema → Catálogos | Mantener catálogos FAB de equipos y configuración general para una captura consistente. | Admin edita; lectura según necesidad y contrato. | Previsto; F04/F11. Detalle de catálogos y validaciones pendiente. |

## Funciones integradas

| ID / ubicación | Responsabilidad | Condición para implementar |
|---|---|---|
| CAR-01 · Proyectos → Carga del equipo | Comparar esfuerzo asignado con capacidad disponible y consultar calendario/Gantt. Supervisor/Admin. | F09/F12; D05: calendario, jornadas, esfuerzo y capacidad neta. No inferir carga del número de proyectos. |
| REP-01 · Inicio → Resumen y exportación KMX-FW | Seleccionar periodo, consultar consolidado y exportar formato oficial. Supervisor/Admin; detalle desde cada proyecto. | F13/F14; plantilla oficial D06 y snapshot consistente. No habilitar exportación sin esas bases. |

## Trabajo ágil: ficha mínima y entregas verticales

Antes de crear una superficie se añade o amplía su ficha aquí. Se usan IDs estables
para enlazar historias y evitar otra matriz de permisos. Una historia debe entregar
un recorrido verificable, por ejemplo: Admin abre Usuarios → desactiva una cuenta →
se conserva el historial → el backend rechaza un nuevo acceso de esa cuenta.

Plantilla breve para cada nuevo módulo o ampliación:

```text
ID y nombre:
Ubicación / componente, vista o diálogo:
Necesidad del usuario y responsabilidad (1–2 frases):
Roles y acciones permitidas:
Funcionalidades esperadas / fuera de alcance:
Historia: Como [rol], quiero [acción], para [resultado].
Criterios de aceptación: Dado [contexto], cuando [acción], entonces [resultado].
Estados: carga, vacío, éxito, error y acceso denegado, según apliquen.
Contratos y dependencias: enlaces existentes; decisiones abiertas.
Situación de la historia: pendiente / en_curso / terminada; impedimento si existe. Evidencia: implementación, pruebas y límites nativos por separado.
```

**Listo para desarrollo (DoR):** propósito, ubicación, rol, alcance, criterios de
aceptación y contratos definidos; dependencias bloqueantes resueltas. No inventar
campos o permisos para completar una pantalla.

**Terminado (DoD):** recorrido implementado, pruebas relevantes y regresiones,
estados de error y permisos comprobados; npm test y Gate 0 aprobados; ficha y
evidencia actualizadas. Validación nativa identificada por separado: un mock IPC
no acredita permisos backend ni una prueba de escritorio.

Los módulos pueden contener varias historias pequeñas; no se exige implementar
el módulo completo en un sprint ni asignar fechas sin estimación. El backlog de
ejecución referencia estas fichas y los Fxx existentes, sin duplicar sus estados.
Añadir una entrada de menú exige una responsabilidad distinta y una ficha propia;
una acción, filtro o exportación puede vivir dentro de un módulo existente.

## NAV-01 / CFG-01 / ADM-01 · Historia activa: navegación contextual

Como usuario quiero abrir el menú sin perder mi captura y acceder a las funciones
existentes por su responsabilidad. Top Nav conserva menú, identidad, fecha y sesión;
el lateral superpuesto incluye Inicio, Proyectos (solo Supervisor/Admin normales),
Problemas de línea previsto y Configuración al fondo. Los destinos pendientes no
se habilitan. Usuarios vive en Configuración → Administración del sistema, solo
Admin normal. Inicio es orientación, sin métricas inventadas (F09/D05 pendientes).

Aceptación: cierre por selección/exterior/Escape/✕; foco atrapado y restituido al
descartar, encabezado enfocado al navegar; contenido montado al abrir/cerrar y al
cambiar destino para preservar borradores. Sin cambio de contratos ni IPC/RBAC.
Carpeta conserva carga, error, cancelación y bloqueo con sesión; Proyectos y Usuarios
reutilizan sus estados existentes. Preferencias y catálogos permanecen previstos.
Dependencias: PLAN-014/015/016 y F03/F04/F11, solo reorganización del alcance existente.
DoD: pruebas DOM de navegación y roles, npm test, Gate 0; nativo por separado.

## CFG-03 · Contrato local de preferencias (F01/F03)

Historia: como usuario quiero conservar mis opciones de presentación en este equipo,
sin mezclarlas con otra cuenta o espacio y sin volver a configurar la carpeta.
Entrega activa: contrato y pruebas de validación; no incorpora controles UI, comandos
IPC ni persistencia. Ubicación futura: Configuración → Preferencias, sesión normal
para cualquiera de los tres roles. Tema y tamaño solamente; filtros pendientes de
necesidad concreta, sin campos abiertos ni estructuras arbitrarias.

Aceptación del contrato: admite versión 1, espacio/usuario válidos, tema y tamaño
conocidos; rechaza propiedades extra, datos de autorización, rutas y versiones no
soportadas. Define defaults compatibles con la UI actual y recuperación local sin
tocar referencia, llave o datos compartidos. Carga/guardado/error/restablecimiento
quedan especificados para la siguiente entrega, no implementados ni validados.
Autoridad: contracts/v1/user_preferences.schema.json y arquitectura/preferencias.md.
Dependencias: subalcance F01/F03; no resuelve recuperación D04 ni cierra F03 completo.

