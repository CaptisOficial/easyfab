# Contrato de misión del plan maestro

`mission_contract` vincula AGENTS.md, contracts/v1, docs/architecture, el plan maestro y las dos revisiones de planning/reviews. Al comenzar una ejecución se congelan sus hashes y revisión Git en un manifiesto; si cambian, DS revalida antes de programar consumidores.

`publication_authorization` vincula publication-authorization.json. Su estado inicial no autoriza despliegues. Un operador debe autorizar una raíz concreta, versión, respaldo y ventana de publicación antes de escrituras corporativas. El plan usa ámbitos del repositorio y staging; no concede acceso genérico a directorios externos.

## Programación y entrega

- Máximo tres expertos simultáneos y ámbitos de escritura disjuntos. Los archivos globales Rust tienen cadena de dependencias; las vistas React no registran rutas globales hasta F16.
- Excepción explícita de integración temprana: F07 entrega en src/features/pilot una vista mínima del recorrido proyecto → actividad → evidencia → aprobación, registrada en App.tsx y comprobada con datos sintéticos. F16 la integra/reemplaza con las vistas completas sin duplicar reglas del backend. Así M2 puede revisarse antes de completar analítica e incidencias.
- Las aristas F07→F08 y F14→F15 son restricciones de propiedad sobre el registro Rust, no dependencias funcionales. Si se extraen registros independientes, DS podrá revisar el DAG y paralelizar tras demostrar ámbitos disjuntos.
- Cada nodo publica su propia interfaz y referencias a artefactos con 3–5 decisiones relevantes. Solo consume interfaces de padres directos o entradas inmutables; no redistribuye logs o payloads de ancestros.
- DoR: padres aceptados, decisiones aplicables cerradas, contratos publicados y autorización vigente del alcance. DoD: pruebas relevantes, contratos en paridad, evidencia y revisión del propietario. F01 incluye contratos de preferencias locales y preparación de pruebas DOM antes de introducir componentes probados.
- El esquema de estrategia es declarativo e inmutable durante una época. No contiene estados de ejecución. Los eventos reales futuros se guardan aparte conforme a captis-strategy-run-v1; no se inventan eventos para el backlog.
- Los límites de 4 horas, 160000 tokens y tres revisiones son techos de una futura época de ejecución, no estimaciones del proyecto ni presupuesto de esta conversación. Si el trabajo requiere más, se divide y replanifica con checkpoints verificables.
- Al superar contexto útil (30000 tokens o doce turnos de herramientas), guardar checkpoint con artefactos, hashes, decisiones, entradas pendientes y próximo nodo; reanudar sin repetir mutaciones.
- Timeout, contrato inválido, dependencia rechazada, colisión de ámbitos y falta de autorización detienen la rama afectada. Dos intentos como máximo; errores deterministas vuelven a DS/propietario, sin bucles ni aprobación parcial de CE.
- CE es una única compuerta implícita tras todos los terminales. Requiere todas las pruebas, piloto nativo, Excel oficial y publicación autorizada. Fallos vuelven a DS; QA no modifica código fuera de su ámbito.

## Plantillas referidas, todavía no seleccionadas

En la biblioteca corporativa original, Weekly MTG/Eg. Alan/20261027, existen `KMX-FW-Weekly-Report-Template-EN.xlsx` y `KMX-FW-Weekly-Report-Template-EN-R2.xlsx`. Solo se verificó existencia/metadatos. F13 debe inspeccionar contenido y confirmar autoridad con FAB. El brief espera Master Gantt, Subactivity Details/tbl_Subactivities e Issues & Risks/tbl_Issues; esto no acredita la estructura real de ninguno de los archivos.

## Autoridad vigente

Append-only sobre un array compartido y UUID no resuelven por sí solos escrituras simultáneas de OneDrive. D01 debe demostrar el protocolo escogido antes del módulo de incidencias. El invariante vigente sigue siendo issues.json y engineers/<id>.json; las alternativas necesitan aprobación y actualización explícita de gobernanza.
