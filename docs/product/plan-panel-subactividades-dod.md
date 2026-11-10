# Plan: Jerarquía de registro de proyectos, Subactividades y Definición de cierre (DoD)

## Diagnóstico y decisiones de diseño

1. **Revisión de las dos columnas**:
   - La partición anterior en 2 columnas paralelas (`grid-cols-2`) en la ventana modal reducía el ancho disponible a menos de 400px por lado, rompiendo la jerarquía visual y colapsando la tabla en inputs de texto minúsculos e inusables.
   - **Solución implementada**: Flujo secuencial estructurado a ancho completo en 3 secciones jerárquicas con encabezados numerados:
     - **Sección 1: Datos generales del proyecto** (Título, Área de proceso con selector, Fechas inicio/objetivo, Ingenieros responsables con checkboxes).
     - **Sección 2: Definición de cierre · DoD** (Resultado final esperado, Alcance, Entregables y criterios de aceptación con checkers de evidencia requerida).
     - **Sección 3: Subactividades de trabajo** (Numeración autogenerada, selectores de entregable y estado, checkers de riesgo y fechas nativas).

2. **Eliminación del campo `responsible_id` en las subactividades**:
   - Como los ingenieros responsables se definen colectivamente en la Sección 1, las subactividades se distribuyen equitativamente entre ellos de forma automática (round-robin).
   - Se elimina por completo la columna y captura de `responsible_id` en la rejilla de subactividades.

3. **Minimización de entradas manuales (Selectores y Checkers)**:
   - Se reemplazaron inputs manuales de texto crudo (`"not_started"`, `"false"`, `"0"`) por controles interactivos alineados con el catálogo de diseño (`captis-interface-design-intelligence`):
     - Selector `<select>` para Entregable asociado.
     - Selector `<select>` para Estado inicial ("Sin iniciar", "En curso").
     - Checker `<input type="checkbox">` para "¿En riesgo?".
     - Fechas nativas `<input type="date">`.

4. **Generación automática del número de subactividad**:
   - El código/número de subactividad (WBS) es 100% autogenerado (ej. `1.1`, `1.2` al asociar con Entregable, o `#1`, `#2` correlativo).
   - El usuario no escribe manualmente números ni WBS.
   - Al importar filas desde Excel (TSV), el sistema autodetecta título y fechas, asignando la numeración automáticamente.

5. **Consolidación de "Resultado esperado" y "Alcance"**:
   - Para el rol de supervisor de planta se simplifica la captura eliminando la duplicidad conceptual entre resultado final y alcance.
   - Se consolida en un único campo: **"Resultado esperado y alcance"**. Internamente se sincronizan `final_outcome` y `scope` garantizando compatibilidad total con los contratos v1 y el backend Rust sin duplicar entradas ni romper validaciones.

6. **Rejilla tabular de Entregables y Criterios (análoga a Subactividades)**:
   - Se eliminaron las tarjetas y `fieldset` anidados redundantes en la Sección 2.
   - Se rediseñó la captura de entregables como una tabla ágil (`#`, `Nombre del entregable`, `Criterio de aceptación`, `Fecha límite`, `Evidencia requerida`, `Acción`), con numeración correlativa inmediata, inputs compactos en línea y soporte para criterios secundarios sin romper la alineación tabular.

## Archivos y pruebas verificadas

- `src/features/projects/CommitmentEditor.tsx`: Rediseño con campo consolidado de resultado/alcance y rejilla tabular de entregables/criterios.
- `src/features/projects/CommitmentEditor.test.tsx`: 6 pruebas unitarias específicas para sincronización, tabla, criterios y validación.
- `src/features/projects/ActivityGrid.tsx`: Componente con numeración automática, selectores, checkers, sin campo de responsable.
- `src/features/projects/ActivityGrid.test.tsx`: Pruebas de comportamiento (numeración, ausencia de responsable, selectores/checkers y pegado TSV).
- `src/features/projects/Projects.tsx`: Flujo secuencial en 3 secciones jerárquicas y distribución de responsables al guardar.
- `src/features/projects/Projects.test.tsx`: 10 pruebas unitarias aprobadas.
- `src/features/projects/ResultsWork.tsx`: Visualización limpia sin textos redundantes cuando resultado y alcance son coincidentes.
- `src/features/projects/ResultsWork.test.tsx`: 17 pruebas unitarias aprobadas.
- `src/components/Login.test.tsx`: 11 pruebas de recorrido de acceso aprobadas.
- Suite frontend general: 99 pruebas en 15 archivos aprobadas, `tsc -b --noEmit` aprobado.
