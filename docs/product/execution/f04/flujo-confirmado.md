# Flujo confirmado de EasyFAB

Alan, 2026-10-28: cuatro cuentas, un solo ejecutable, datos/perfiles en el espacio
compartido configurado. No hay modo piloto, cuentas de demostración corporativas,
binarios personalizados ni una migración de proyectos autorizada.

- Admin: administra cuentas y consulta proyectos.
- Supervisor: con su propia cuenta registra proyectos, consulta avances y valida cierres.
- Dos ingenieros: cada uno con su cuenta registra avances en su partición personal.

El recorrido actual termina al registrar y volver a consultar un proyecto después
de reiniciar. Avances y validación de cierres son los siguientes pasos de este mismo
flujo. No se incluyen reportes Excel, Gantt, capacidad, incidencias o nuevas nubes.
La personalización local en AppData solo se implementará cuando exista una necesidad
concreta; no se añade en este recorrido. La referencia y llave locales se conservan.

Autoridades: team.json (Admin), projects.json (Supervisor), perfil personal (titular).
El cierre autoritativo futuro se guardará en dominio Supervisor, nunca editando
el perfil de otro usuario ni confiando en un booleano escrito por el ingeniero.
Su contrato y pruebas se implementarán junto con ese recorrido.

La única cuenta Supervisor activa es la escritora operativa de projects.json.
El backend comprueba esa condición y rechaza altas de Admin/Engineer, sesiones
restringidas, revocadas o directorios con varios Supervisores activos. El mismo
portable funciona para todas las cuentas; no fija nombres ni equipos al compilar.
La composición de cuatro cuentas es el alcance del equipo, no un límite artificial
de licencias ni un borrado automático de cuentas existentes.

Operación prevista: una sesión de trabajo por cuenta. Abrir la misma cuenta para
escribir a la vez en distintos equipos no está cubierto; un mutex/rename local no
lo vuelve seguro en OneDrive. Completar sincronización antes de cambiar de equipo.
D01 general sigue abierta para escenarios fuera de este alcance; no se afirma
convergencia multiwriter ni revocación instantánea desconectado.

No se cambia el formato ni ubicación de proyectos, usuarios o perfiles. Se retira
la propuesta de archivos por proyecto y su migración. Ningún dato corporativo se
modifica como parte de las pruebas; publicar el portable sigue siendo independiente.
