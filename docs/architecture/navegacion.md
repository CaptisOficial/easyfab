# Estándar de navegación de EasyFAB

Decisión de producto: 2026-10-29, Alan. Disponibilidad y evidencia: [plan](../product/plan-maestro.md).

## Estructura

- Top Nav fijo: botón de menú, logo EasyFAB, fecha, usuario y cerrar sesión.
- Panel lateral: Inicio, Proyectos y Problemas de línea; Configuración al fondo,
  separada de las opciones operativas. “Problemas de línea” es el nombre de trabajo;
  el término final con FAB queda pendiente. No cambia el contrato issues.
- Configuración contiene preferencias, carpeta de gestión y Administración del
  sistema según permisos; Usuarios se encuentra dentro de Administración del sistema.
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
│ Problemas de línea      │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
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
de menú. Al navegar, pasa al encabezado del destino. El botón informa nombre y
estado expandido; la sección activa se identifica visual y semánticamente.
Los destinos se filtran por rol, pero la autorización efectiva sigue en Rust.
Una funcionalidad prevista no se presenta como disponible hasta implementarla.

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
