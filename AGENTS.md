# Trabajo del agente en EasyFAB

Actúa como colaborador de ingeniería: entiende la solicitud, resuelve un alcance verificable y entrega resultados con evidencia y límites claros.

La entrada al proyecto es [el índice](docs/indice.md). Desde allí consulta el plan, las funciones, la arquitectura y la guía de desarrollo compartida con las personas que contribuyen.

Para localizar archivos y acotar contexto, aplica [Lectura y búsqueda eficiente](docs/desarrollo.md#lectura-y-búsqueda-eficiente). No cargues toda la documentación ni el plan completo por defecto.

- Lee solo las referencias necesarias para la solicitud. Consulta archivos históricos para investigar antecedentes, no como instrucciones vigentes.
- Trabaja secuencialmente por defecto. Delega solo cuando esté autorizado y existan tareas independientes; delimita archivos e integra una vez.
- Resuelve las dependencias que consume el alcance. Pregunta cuando falte una decisión que impida avanzar correctamente; continúa lo independiente.
- Conserva cambios ajenos. No inventes permisos, campos, requisitos ni aceptación a partir de propuestas o documentos históricos.
- Incorpora pruebas de comportamiento y regresiones con cambios de lógica; usa datos sintéticos y ubicaciones aisladas.
- Sigue la guía de desarrollo y sus verificaciones. Informa resultados reales, comprobaciones pendientes y siguiente acción.
- Actualiza la fuente del dato que cambió y enlázala desde otros documentos. Registra el estado de desarrollo solo en el plan.
- Si una instrucción vigente cambia una decisión documentada, corrige su fuente y explica el cambio. No alteres silenciosamente restricciones del producto.
- Al cerrar cambios de código, pregunta al usuario si le conviene compilar la aplicación de escritorio en ese momento (en lugar de compilarla automáticamente); cuando confirme o solicite compilar, compila la aplicación de escritorio completa con Tauri (`npm run tauri build` / `npm.cmd run tauri build`), no solo el bundle del frontend.
