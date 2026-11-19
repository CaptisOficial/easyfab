# Estándares de interfaz en EasyFAB (`src/`)

Al crear o modificar pantallas, tablas y modales en `src/`, aplica estas reglas de densidad y claridad:

- **Sin tarjetas anidadas ("caja dentro de caja")**: No envuelvas un único formulario, tabla o checkbox individual en otra tarjeta con borde (`.results-panel`, `div.border.rounded.shadow-sm`, etc.) si ya vive dentro de un `ResultsModal`, `.work-card` o `.project-schedule`. Envuelve tablas `.results-table` directamente con `.results-table-scroll`.
- **Barras de herramientas en una sola línea y sin texto de relleno**: Agrupa filtros, cambio de vista y acciones principales (`⟳`, `+ Nuevo proyecto`) en la misma barra superior. Evita subtítulos instructivos obvios (como avisos de alta cuando el usuario ya tiene permiso) y vistas duplicadas (`Ambos`) que muestran los mismos datos dos veces.
- **Columnas compactas con tooltips de referencia (`?`)**:
  - Usa íconos vectoriales de `lucide-react` para estados (`Clock` sin iniciar, `Hammer` en curso, `Check` completado, `Pause` en pausa) y acciones de fila (`Pencil`, `AlertTriangle`, `RotateCcw`, `Trash2`) en lugar de texto largo o símbolos Unicode ambiguos.
  - Muestra fechas cortas (`28 oct`) con las fechas ISO completas (`AAAA-MM-DD`) en `title`/`aria-label`.
  - Compacta responsables en iniciales (`toInitials`) y coloca las leyendas de referencia (símbolos de estado, iniciales de responsables, atajo de prioridad, leyenda del Gantt) en tooltips interactivos `?` en encabezados o barras, en lugar de recargar el pie de tabla.
  - En cronogramas mensuales, muestra solo el número de día (`1`–`31`) y sombrea sábados y domingos (`.schedule-weekend`) en lugar de escribir abreviaturas del día de la semana.
- **Divulgación progresiva y acciones seguras**:
  - Acciones secundarias de fila (como cambiar prioridad) van en modales contextuales (clic derecho en `#` con accesos rápidos + posición exacta) para mantener columnas estrechas.
  - Acciones destructivas (como eliminar proyecto para Supervisor) requieren modal de confirmación explícita y autorización validada en Rust.
  - En modales de contraste (p. ej. avance de actividad), omite la columna de *Condición anterior* cuando no existe contexto previo para aprovechar todo el ancho.
