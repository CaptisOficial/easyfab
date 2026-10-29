# Catálogo funcional de EasyFAB

Define las superficies, funciones y permisos esperados. El [plan](plan-maestro.md) indica qué está implementado y qué falta; la [navegación](../architecture/navegacion.md) define ubicación y comportamiento. Las fichas no acreditan implementación.

## Roles y acceso

- Todos ingresan con ID y contraseña EasyFAB, independientes de Windows. Detalle de cuentas y confianza: [auth](../architecture/auth.md).
- Admin administra usuarios y catálogos y consulta proyectos. No registra proyectos ni aprueba cierres.
- El único Supervisor activo registra proyectos y valida cierres. Engineer registra actividades/avances y solicita cierre en su partición.
- Reporte de incidencias previsto para los tres roles; seguimiento/correcciones se concretan antes de implementarse. Contratos y RBAC determinan las operaciones efectivas.

## Mapa funcional

| ID / superficie | Responsabilidad y funcionalidades esperadas | Roles y límites |
|---|---|---|
| NAV-01 · Top Nav y panel lateral | Identidad, fecha, navegación, sección activa y cierre de sesión. Panel superpuesto con cierre exterior y teclado. | Todos; destinos según permisos. |
| INI-01 · Inicio | Resumen de avances, próximos cierres, vencidos y pendientes de revisión. Abrir el registro de origen desde cada indicador. | Engineer: sus asignaciones; Supervisor/Admin: panorama general. |
| PRO-01 · Proyectos: listado y alta | Consultar, filtrar y abrir proyectos; Supervisor registra nombre, responsable y fechas conforme al contrato vigente. | Supervisor registra; Admin consulta. Engineer consulta sus proyectos autorizados. |
| PRO-02 · Detalle, actividades y avance | Consultar fechas y estado; registrar actividades propias, hitos y evidencias; solicitar cierre y consultar resultado. | Engineer escribe su partición; Supervisor valida cierres. Admin consulta. |
| LIN-01 · Problemas de línea: registro e historial | Registrar equipo/línea, descripción y fecha; paro y scrap cuando apliquen; consultar seguimiento hasta resolución. | Reporte previsto para los tres roles; responsables de seguimiento y correcciones por definir antes de implementar. |
| CFG-01 · Configuración | Punto de entrada a preferencias, carpeta de gestión y administración autorizada. | Todos; opciones filtradas por rol. |
| CFG-02 · Carpeta de gestión | Mostrar carpeta activa; tras cerrar sesión, seleccionar y validar otra raíz. Mostrar errores sin perder la referencia válida ni migrar datos. | Sin sesión activa; permisos de carpeta y confianza siguen aplicando. |
| CFG-03 · Preferencias | Personalizar tema, tamaño de interfaz y filtros por espacio/usuario. | Preferencias personales sin autoridad sobre identidad o permisos. |
| ADM-01 · Administración del sistema → Usuarios | Consultar directorio, dar de alta Engineer/Supervisor, desactivar/reactivar y recuperar acceso mediante contraseña temporal con cambio obligatorio. | Solo Admin con sesión normal. Baja lógica; sin eliminar historial, cambiar roles ni crear otro Admin. Un solo Supervisor escritor activo. |
| ADM-02 · Administración del sistema → Catálogos | Mantener catálogos FAB de equipos y configuración general para una captura consistente. | Admin edita; lectura según necesidad y contrato. |

## Funciones integradas

| ID / ubicación | Responsabilidad | Condición para implementar |
|---|---|---|
| CAR-01 · Proyectos → Carga del equipo | Comparar esfuerzo asignado con capacidad disponible y consultar calendario/Gantt. Supervisor/Admin. | F09/F12; D05: calendario, jornadas, esfuerzo y capacidad neta. No inferir carga del número de proyectos. |
| REP-01 · Inicio → Resumen y exportación KMX-FW | Seleccionar periodo, consultar consolidado y exportar formato oficial. Supervisor/Admin; detalle desde cada proyecto. | F13/F14; plantilla oficial D06 y snapshot consistente. No habilitar exportación sin esas bases. |


## Ampliar una función

Antes de añadir un módulo o destino, describir aquí su necesidad, ubicación, acciones permitidas por rol y límites. Una acción o filtro puede vivir en una superficie existente. La historia y su aceptación se registran en el plan; contratos y arquitectura conservan los detalles técnicos.

Comportamiento de menú, foco y preservación de captura: [navegación](../architecture/navegacion.md).

Preferencias incluye tema y tamaño; filtros se concretan ante una necesidad real. No modifica identidad, permisos, referencia del espacio ni llave. Estructura y defaults: contrato v1; ubicación y recuperación: arquitectura de preferencias.

## Objetivos de uso

- Captura diaria menor a 60 s y registro de incidencias menor a 30 s, medidos en piloto; no son tiempos ya acreditados.
- Objetivo de cero archivos en conflicto, comprobado en escenarios soportados. La partición no garantiza convergencia de archivos compartidos ni escritura simultánea de una cuenta en varios equipos.
- Reporte KMX-FW con paridad de datos y presentación respecto a la plantilla oficial elegida.
- Operación local sin servidores externos de aplicación; disponibilidad sujeta al equipo, permisos y carpeta corporativa.

## Términos de trabajo

Hito: avance de ingeniería en compuertas 0/25/50/75 y solicitud al 100; el Supervisor valida el cierre. Evidencia: soporte ligado a una actividad/revisión. Downtime: paro no programado en horas. Scrap: piezas desechadas. KMX-FW: formato semanal de reporte de Fabrication. Reglas de capacidad, pesos y desviación se concretan en D05 del plan; no asumir una fórmula definitiva a partir de estos nombres.
