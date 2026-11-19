# Observaciones del piloto del 2026-11-19

Protocolo: [recorrido R7b](results-pilot-runbook.md). Estado de desarrollo:
[plan maestro](../plan-maestro.md). Esta evidencia distingue borrador, guardado
y sincronización; no acredita acciones que aún no se hayan observado.

## Preparación observada

Alan autorizó usar el espacio habitual y designó a Alexa y Brenda como
participantes. La referencia local y el manifiesto coinciden en el ID
`0642043f97af0bebd802c61385d0cf7a`. El ejecutable local y su hash se registraron
en la [comprobación previa](results-flow-acceptance.md#comprobación-del-2026-11-19).

Se copiaron manifiesto y datos/evidencias a
`src-tauri/target/r7b-backup-e6deea5d22184a929b5b87caf2f30ca4`.
Los 108 archivos coinciden por SHA-256 entre origen, copia y segunda lectura del
origen; el conteo no cambió. El archivo local `sha256.json` registra las huellas.
La copia no incluye `master.key`. Es un respaldo local; no se ensayó restauración
del espacio habitual ni se acreditó una pausa global del sincronizador.

## Interacción local

| Operación | Observación directa | Límite |
|---|---|---|
| Alta Supervisor | Modal Registrar proyecto abierto en WebView | La captura inmediata del controlador puede mostrar el estado anterior |
| Borrador | Título `QA-R7b-2026-11-19 · Estación de prueba`, objetivo sintético y área LTC comprobados | No equivale a persistencia |
| Asignación | Alexa y Brenda marcadas; Antonio y Martin sin marcar | No acredita lectura desde sus sesiones |
| Entregables | Dos filas con títulos y criterios sintéticos ingresados y recuperados en accesibilidad | Fechas y responsables por fila se delegaron al operador |
| Campos requeridos | Un intento involuntario de envío con fecha vacía mostró «Rellena este campo» en fecha de inicio | No hubo confirmación de creación |
| Calendario | El controlador rechazó el clic: `point ... is over msedgewebview2.exe "Chrome Legacy Window", not target window easyfab.exe "EasyFAB"` | Fallo de automatización; no se clasifica como defecto del producto |

Se pidió al operador completar fechas (proyecto 19–26/11/2026, instalación
19–20/11, desempeño/transferencia 20–26/11), elegir Alexa/Brenda por fila,
desmarcar evidencia solo en instalación y guardar. El operador confirmó el
guardado. La lectura posterior de `projects.json` y revisiones del proyecto,
y su presencia en el listado WebView, acreditan el alta local:

- Proyecto WBS 21, ID `PRJ-d11c66a5f4456fd18143265ec6c162643aca0a32faf6570e04e807a4dbee9497`.
- Compromiso `52727d14d16c601a4f4b5425aaf64e18cf5e2bb849d61a1cdcef217fbb133193`,
  registrado el 2026-11-19 a las 08:44:27 America/Mexico_City.
- Fechas efectivamente guardadas: proyecto 19/11–04/12; instalación
  19–30/11, Alexa; desempeño/transferencia 30/11–03/12, Brenda.
- Ambos criterios requieren evidencia. Son los valores ingresados por el
  operador, distintos del ejemplo propuesto; se conservaron sin corregirlos.
- Instalación se guardó `in_progress`, 0 %, sin horas; transferencia
  `not_started`, 0 %, sin horas. Ambas revisiones tienen autor Supervisor.

El operador aclaró después que ingresó con Alexa **en el mismo equipo**.
Su «Sí» anterior no acredita segundo equipo ni sincronización. Se comprobó una
nueva revisión de instalación con autor `Alexa`, creador original `alan`,
estado `done`, avance 100 %, horas nulas y nota «Avances para registro de estacion».
Revisión: `6a01e13f871ed4a8e1ead1e6cd40062038264c0b28f2bf4157055e5acd744f63`,
registrada el 2026-11-19 a las 08:46:47 America/Mexico_City. La captura real
es distinta del ejemplo solicitado (25 %, 0.5 horas); se registra tal como ocurrió.

WebView confirma «Avance guardado. No requiere aprobación», instalación al 100 %,
transferencia al 0 % y proyecto **En curso**. Las revisiones inspeccionadas solo
contienen activación y escrituras de actividades: no hay solicitud, decisión de
aceptación ni cierre. Terminar la actividad no cerró el proyecto.

Hallazgo de presentación: el encabezado dice «ENTREGABLES: 1 / 2 cumplidos» y
«AVANCE GENERAL DEL PROYECTO: 50 %». `ResultsWork.tsx` calcula esos valores con
actividades terminadas, sin comprobar criterios/evidencias ni evaluación de cierre.
El catálogo separa esas condiciones y no define una fórmula de avance por conteo.
La discrepancia requiere corregir o aclarar la presentación sin convertir el 100 %
de actividad en aceptación. No se modificó código durante esta comprobación.

No hay observaciones de segundo equipo, comprensión humana, tiempos,
evidencias adjuntas ni aceptación/cierre. La duración de las
acciones del agente no mide el tiempo de captura de los participantes.

Durante el recorrido aparecieron cambios ajenos en Login, Projects, sus pruebas
y estilos. Se conservaron sin editarlos. El resultado del piloto se refiere al
binario abierto, no acredita modificaciones posteriores del árbol de trabajo.
