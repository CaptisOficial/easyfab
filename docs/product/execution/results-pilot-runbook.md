# Recorrido de aceptación del flujo por resultados

Preparado el 2026-11-19. El estado del trabajo se conserva únicamente en el
[plan maestro](../plan-maestro.md). Este protocolo no acredita una ejecución.
Reglas y límites: [evidencia de integración](results-flow-acceptance.md),
[pruebas nativas](../../architecture/testing.md#piloto-nativo-aislado-por-resultados),
[acceso entre equipos](../../architecture/auth.md#alta-inicial-y-confianza-entre-equipos).

## Preparación y registro de la sesión

Anotar fecha/hora con zona America/Mexico_City, versión y SHA-256 del ejecutable
realmente usado en cada equipo, resolución de pantalla, escala, tema e idioma.
Registrar participantes por rol y alias de prueba, sin contraseñas ni llaves.
La compilación completa se hace con `npm.cmd run tauri build`; obtener el hash con
`Get-FileHash -Algorithm SHA256 -LiteralPath .\src-tauri\target\release\easyfab.exe`.
No reutilizar como acreditación el hash de una compilación anterior.

Identificar la raíz configurada y el ID de espacio en ambos equipos: las rutas
absolutas pueden diferir, el ID debe coincidir. Confirmar confianza local
aprovisionada por Admin, mismo binario y sincronización inicial completa.
No incluir `master.key` en sincronización, capturas ni respaldos compartidos.
Mantener una sola sesión por cuenta y un único Supervisor activo escritor.

Si se usa el espacio habitual, como autorizó Alan para esta sesión, delimitar
proyecto y cuentas sintéticos con un identificador único `QA-R7b-<fecha>-<id>`.
Registrar los IDs creados y el respaldo previo de datos, manifiesto y evidencias.
Conservar usuarios y proyectos existentes: no ejecutar reinicializaciones,
`prepare_first_access.ps1 -ResetTestUsers` ni migrar proyectos reales para el piloto.
El respaldo debe corresponder a un conjunto sin escrituras en curso. Una restauración
requiere coordinar ambos equipos y preservar antes las capturas posteriores.

El arnés `results_pilot.exe` es otra opción para revisión local: solo acepta una
carpeta directa `src-tauri/target/results-pilot-<id>` y sus cuentas sintéticas.
No trasladarlo al espacio habitual ni usarlo como prueba entre dos equipos.
Su acceso preparado tampoco acredita el login/reingreso del producto.

## Caso sintético y recorrido

En el producto, Admin crea las cuentas de prueba necesarias; cada titular cambia
su temporal e ingresa de nuevo. Supervisor crea un proyecto asignado a dos
ingenieros, con estado final «Estación de prueba instalada y transferida» y dos
entregables: instalación comprobada y desempeño/transferencia comprobados. El
segundo exige evidencia. Elegir fechas coherentes con la sesión y registrar el
compromiso inicial; los datos no representan resultados operativos FAB.

| Paso | Acción y rol | Resultado observable que se debe registrar |
|---|---|---|
| 1 | Supervisor guarda compromiso; ingenieros abren el proyecto | Mismo alcance, dos entregables y criterios visibles; Admin consulta sin aceptar ni crear proyectos |
| 2 | Ingeniero planea actividades de ambos entregables y una dependencia válida | Tabla y Gantt muestran el mismo conjunto, fechas y responsable; guardar y reabrir conserva lo capturado |
| 3 | Ingeniero actualiza avance y horas; termina una actividad | Confirmación de guardado y autoría; terminar/100 % no solicita aceptación ni cierra proyecto |
| 4 | Ingeniero adjunta PNG/JPG y PDF sintéticos | Miniatura de imagen, apertura del original y PDF por nombre; reapertura conserva evidencia e historial |
| 5 | Ingeniero reporta bloqueo; Supervisor registra atención y después resolución | Reporte, primera atención y resolución diferenciados; la atención sola no resuelve |
| 6 | Ingeniero solicita aceptación con un criterio incumplido; Supervisor devuelve con motivo | Devolución visible e historial conservado; proyecto sigue abierto |
| 7 | Ingeniero corrige, aporta evidencia y vuelve a solicitar; Supervisor acepta | Decisiones ligadas a revisión y evidencia; una aceptación aislada no cierra todo el proyecto |
| 8 | Supervisor acepta el conjunto y declara cumplimiento final; después reabre con motivo | Cierre explícito, reapertura e historia recuperables; Engineer/Admin carecen de la acción de cierre |
| 9 | Cada cuenta sale y reingresa; segundo ingeniero abre desde el otro equipo | Asignaciones, autoría, decisiones y adjuntos recuperados sin volver a capturarlos |

En pasos 2–8 revisar también teclado: Tab/Shift+Tab, foco visible, entrada/salida
del modal y Escape. Probar ventana pequeña y maximizada, desplazamiento, acciones
de guardar/cerrar accesibles y borrador al cerrar/reabrir. Registrar dimensiones
y resultado por tema/idioma realmente observado; no inferir los restantes.

## Sincronización entre los dos equipos

Primero comprobar una escritura online y su lectura en el otro equipo tras
sincronizar, incluyendo el original de un adjunto. Registrar ID/revisión y
tiempos en ambos extremos. Después desconectar un equipo, guardar una captura
sintética, reconectar, esperar sincronización y comprobar recuperación en ambos.
Si la escritura desconectada falla, registrar el error y la conservación del
borrador, sin contabilizarla como captura guardada.

Con dos ingenieros distintos, editar una misma actividad desde la misma revisión
para observar rechazo obsoleto o conflicto según llegue el cambio. Registrar las
dos alternativas y la resolución explícita del Supervisor cuando corresponda;
verificar que ninguna captura se pierda o duplique y que no se elija por fecha.
Anotar archivos de conflicto del sincronizador y errores, sin borrarlos para
forzar un resultado favorable. No simular esta prueba copiando fixtures locales.

## Hoja de observaciones

Copiar las siguientes tablas a la evidencia fechada de la sesión y completar solo
lo observado. Vincular capturas sin datos sensibles y registrar pasos reproducibles
para cada fallo. No cambiar estados de desarrollo en este documento.

| Caso/paso | Equipo/rol | Hora y revisión | Esperado | Observado | Evidencia/error y siguiente acción |
|---|---|---|---|---|---|
| Por registrar | | | | | |

| Intento | Rol/equipo | Operación/actividad | Con adjunto | Inicio apertura | Confirmación | Segundos | Fallos/reintentos |
|---|---|---|---|---|---|---|---|
| Por registrar | | | | | | | |

Medir por separado el modal (actividad ya seleccionada → confirmación) y el
recorrido diario completo (inicio de búsqueda del proyecto → confirmación de
captura y evidencia requerida). Informar n, mediana y p90 por presencia de adjunto,
con método de percentil indicado; conservar fallos sin tratarlos como éxitos.
El objetivo <60 s corresponde al recorrido diario completo. Sin observaciones,
informar «sin datos»; con muestra pequeña, conservar intentos individuales.

Pedir a cada participante que explique qué falta para cerrar y qué diferencia
actualización, bloqueo y solicitud. Registrar sus palabras y la ayuda requerida,
sin deducir comprensión de un clic correcto. Supervisor registra ajustes y
decisión de uso al terminar; automatización, revisión local y dos equipos se
acreditan por separado. Actualizar únicamente el plan con lo que siga pendiente.
