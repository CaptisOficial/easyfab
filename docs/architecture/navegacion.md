# Estándar de navegación de EasyFAB

Decisión de producto: 2026-10-29, Alan. Disponibilidad y evidencia: [plan](../product/plan-maestro.md).

## Estructura

- Top Nav fijo: botón de menú, logo EasyFAB, nombre de la página activa, fecha, usuario y cerrar sesión. El nombre del destino se muestra como encabezado en el Top Nav, sin repetirlo en el contenido.
- Panel lateral: Inicio, Proyectos y Problemas de línea; Usuarios y Catálogos para Admin con sesión normal; Configuración al fondo,
  separada de las opciones operativas. “Problemas de línea” es el nombre de trabajo;
  el término final con FAB queda pendiente. No cambia el contrato issues.
- Por decisión de producto del 2026-10-29, cada destino tiene una responsabilidad: Usuarios administra cuentas; Catálogos mantiene líneas, equipos y tipos de falla; Configuración contiene preferencias y carpeta de gestión. Sustituye la agrupación de administración dentro de Configuración.
- Sin sesión, el formulario de acceso se muestra en Inicio y se oculta al navegar a Configuración; vuelve a estar disponible al regresar a Inicio.
- El espacio de Proyectos utiliza todo el ancho disponible con márgenes de 12–16 px, sin el límite de ancho de las páginas de formularios. El cronograma conserva desplazamiento horizontal cuando sus columnas no caben.
- Inicio concentra el resumen general. Los avances se capturan dentro de Proyectos.
  Carga del equipo será una vista de Proyectos cuando sus reglas estén definidas.
  Resumen y reporte general se integran en Inicio; los detalles, en su proyecto.
  Capacidad, Reportes y Mis actividades no tienen entradas laterales independientes.

```text
┌─────────────────────────┬──────────────────────────────────────────┐
│ LOGO EasyFAB         ✕  │ ░ Fecha ░ Usuario ░ Cerrar sesión ░░░░░░ │
│                         │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ Inicio                  │ ░░░ Contenido principal debajo ░░░░░░░░ │
│ Proyectos               │ ░░░ Clic fuera cierra el menú ░░░░░░░░░ │
│ Usuarios / Catálogos     │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│                         │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ─────────────────────── │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│ ⚙ Configuración         │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└─────────────────────────┴──────────────────────────────────────────┘
```

## Comportamiento esperado

El panel ocupa todo el alto visible y se superpone al Top Nav y al contenido,
sin mover ni redimensionar el grid. Ancho de referencia de 280 px, limitado al
ancho disponible; si el contenido no cabe, el panel permite desplazamiento vertical.
La capa oscura exterior bloquea interacción con el contenido mientras está abierto.
Cierra con ✕, Escape, clic exterior o selección de destino. Abrir/cerrar por sí
solo conserva la captura y la posición del contenido.

Al abrir, el foco entra al panel y permanece dentro; al descartar, vuelve al botón
de menú. Al navegar, pasa al encabezado del destino en el Top Nav. El botón informa nombre y
estado expandido; la sección activa se identifica visual y semánticamente.
Los destinos se filtran por rol, pero la autorización efectiva sigue en Rust.
Proyectos está disponible para las sesiones normales de los tres roles; Engineer
consulta únicamente los proyectos de los que es responsable, según el contrato IPC.
Una funcionalidad prevista no se presenta como disponible hasta implementarla.

Los diálogos flotantes de alta y detalle de proyectos se montan sobre el documento,
con fondo sólido y altura limitada a la ventana visible menos sus márgenes.
El encabezado y el cierre permanecen visibles; solo el cuerpo tiene desplazamiento
vertical. En ventanas estrechas o de poca altura se reducen los márgenes. El alta usa hasta 800 px y distribuye campos en dos columnas cuando el cuerpo dispone de 560 px; el detalle usa hasta 1200 px y separa actividades y captura cuando dispone de 880 px. Con menos espacio se mantiene una sola columna.

Cambiar carpeta requiere cerrar sesión y validar explícitamente el nuevo espacio;
no migra datos ni recurre a otra raíz si la guardada falla. Ver
[espacio de trabajo](espacio-de-trabajo.md).

## Autoridad y evolución

El [catálogo funcional](../product/catalogo-modulos.md) define componentes, ventanas,
responsabilidades y alcance. Antes de añadir un módulo, ventana o destino se
actualiza su ficha; la historia se registra en el plan. Un documento describe
comportamiento esperado; no concede permisos ni sustituye contratos de datos.
Las pruebas de implementación cubrirán apertura/cierre, foco, teclado, grid estable,
captura conservada, destinos por rol y restricciones de carpeta.

## Trabajo por resultados dentro de Proyectos

El detalle reúne compromiso y criterios, entregables, tabla y Gantt de actividades,
bloqueos e historial. Tabla y Gantt son vistas del mismo conjunto. El cronograma
general de proyectos conserva su función de navegación; no sustituye este detalle.
El resumen actual de aceptación y bloqueos acompaña al nombre del proyecto. La
tabla/Gantt preceden a la lectura semanal para que los indicadores no desplacen
la captura diaria fuera de la primera pantalla. Las acciones de fila usan etiquetas
breves y nombres accesibles que identifican su actividad; las fechas no se parten
en varias líneas dentro de la columna de previsión.
El [catálogo](../product/catalogo-modulos.md#planeación-por-entregables-y-cierre-verificable)
define responsabilidades y el [contrato](../../contracts/v1/project_results.md)
define datos y transiciones.

«Actualizar actividad» abre un modal contextual sin aprobación del Supervisor.
Estado/avance están al frente; los datos de planeación pueden desplegarse sin
volver a capturarlos. Nota y evidencia son opcionales salvo la evidencia exigida
por criterios al solicitar aceptación. Un fallo al adjuntar conserva la actividad
ya guardada y permite reintentar el archivo sin crear otra actividad.

Los modales de trabajo contienen/restauran foco, responden a Escape y conservan
el borrador ante error. Durante el guardado se impiden cierre y envío duplicado,
incluido el diálogo exterior del proyecto. En ventanas estrechas, tabla y Gantt
se apilan con desplazamiento horizontal dentro de cada vista. Los colores siguen
los tokens y el tema seleccionado en preferencias, sin otro sistema de temas.

Las revisiones de entregables, los bloqueos y los conflictos se atienden desde
el proyecto. Las alternativas concurrentes permanecen visibles con sus datos;
solo el Supervisor puede seleccionar la base de integración y registrar motivo.
Las inconsistencias de fechas entre actividades muestran una advertencia que
permite corregirlas; no desaparece el proyecto ni se simula un cierre válido.

## Usuarios: alta y recuperación

«Nuevo usuario» se ubica arriba a la derecha del directorio, dentro del contenido y fuera del Top Nav. Abre un modal flotante sobre el directorio, con título, cierre fijo y cuerpo desplazable limitado a la ventana. El foco entra al ID, permanece en el diálogo y vuelve al botón al cerrar por Escape, cierre o clic exterior. Cerrar conserva el borrador durante la sesión del componente. Durante el envío se bloquean el cierre y envíos duplicados. El resultado y la contraseña temporal permanecen en el modal para su entrega; el directorio se actualiza tras crear.

«Recuperar contraseña» pertenece a una columna propia de la tabla, en la fila del usuario activo, separada de las acciones de activación/desactivación. Despliega la confirmación y el resultado junto a esa cuenta, sin selector global de destinatario. Mantiene las reglas de autorización y de temporal existentes.
