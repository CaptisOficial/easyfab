import { BILINGUAL_SEPARATOR, pickBilingual, type Lang } from "./bilingual";

/**
 * Extracts a clean error message from unknown thrown values (Tauri string
 * rejections, JS Error instances, `{ message }` / `{ error }` objects, etc.).
 */
export function extractErrorMessage(err: unknown): string {
  if (err === null || err === undefined) return "";
  if (typeof err === "string") return err.trim();
  if (err instanceof Error) return err.message.trim();
  if (typeof err === "object") {
    const record = err as Record<string, unknown>;
    if (typeof record.message === "string") return record.message.trim();
    if (typeof record.error === "string") return record.error.trim();
  }
  return String(err).trim();
}

const BACKEND_ES_NORMALIZE: Record<string, string> = {
  "Perfil invalido.": "Perfil inválido.",
  "Credencial invalida.": "Credencial inválida.",
  "Temporal invalida.": "Temporal inválida.",
  "Sesion revocada.": "Sesión revocada.",
  "Sesion revocada. Ingresa otra vez.": "Sesión revocada. Ingresa otra vez.",
  "Se requiere sesion normal de administrador.": "Se requiere sesión normal de administrador.",
  "Falta la llave de confianza. Solicita provision al administrador.":
    "Falta la llave de confianza. Solicita provisión al administrador.",
  "Llave de confianza invalida.": "Llave de confianza inválida.",
  "Directorio invalido.": "Directorio inválido.",
  "Version o fecha de directorio invalida.": "Versión o fecha de directorio inválida.",
  "Directorio invalido o IDs duplicados.": "Directorio inválido o IDs duplicados.",
  "No se pudo leer perfil": "No se pudo leer perfil.",
};

export const BACKEND_ERRORS: Record<string, string> = {
  // Bootstrap / App / Auth commands
  "No se encontró la carpeta local de instalación.": "Local installation folder was not found.",
  "Estado no disponible.": "Application state is unavailable.",
  "Cierra tu sesión antes de cambiar el espacio.": "Sign out before changing the workspace.",
  "Configura el espacio EasyFAB primero.": "Configure the EasyFAB workspace first.",
  "Configura el espacio primero.": "Configure the workspace first.",
  "Espera 30 segundos antes de intentar de nuevo.": "Wait 30 seconds before trying again.",
  "No se pudo verificar el acceso.": "Could not verify access.",
  "Intento de acceso cancelado.": "Sign-in attempt was canceled.",
  "Ingresa primero.": "Sign in first.",
  "Cierra sesión antes del alta inicial.": "Sign out before initial administrator setup.",
  "LOCALAPPDATA no disponible.": "LOCALAPPDATA is unavailable.",
  "Abre la aplicación de escritorio para configurar el espacio compartido.":
    "Open the desktop application to configure the shared workspace.",

  // Workspace / Layout / Data store
  "El layout contiene una ruta no relativa.": "The layout contains a non-relative path.",
  "Versión de layout no compatible.": "Incompatible layout version.",
  "Versión o identidad del espacio incompatible.": "Incompatible workspace version or identity.",
  "Espacio en mantenimiento. No se permite acceder.": "Workspace is under maintenance. Access is not allowed.",
  "ID de proyecto inválido.": "Invalid project ID.",
  "Espacio inválido.": "Invalid workspace.",
  "Hay datos de resultados sin su versión activa. Restaura el manifiesto; no se usará el historial como alternativa.":
    "Results data exists without its active version. Restore the manifest; history will not be used as a fallback.",
  "Identidad del espacio distinta.": "Workspace identity does not match.",
  "ID de perfil inválido.": "Invalid profile ID.",
  "Perfil fuera del espacio validado.": "Profile is outside the validated workspace.",
  "Perfil en una ubicación incompatible. Requiere mantenimiento explícito.":
    "Profile is in an incompatible location. Explicit maintenance is required.",
  "Ruta de perfil inválida.": "Invalid profile path.",
  "Evidencia fuera del perfil.": "Evidence is outside the profile.",
  "Elige una carpeta compartida existente con ruta absoluta.":
    "Choose an existing shared folder with an absolute path.",
  "La identidad del espacio no coincide. Selecciona explícitamente el espacio correcto.":
    "Workspace identity does not match. Explicitly select the correct workspace.",
  "Hay datos EasyFAB previos en Management/Data. Trasládalos antes de crear el espacio para conservar una sola fuente de datos.":
    "Previous EasyFAB data exists in Management/Data. Move it before creating the workspace to keep a single data source.",
  "Referencia de instalación inválida.": "Invalid installation reference.",
  "No se permiten enlaces en la ruta de datos.": "Links are not allowed in the data path.",
  "Ruta fuera del directorio autorizado.": "Path is outside the authorized directory.",
  "Los datos cambiaron. Actualiza antes de reintentar.": "Data changed. Refresh before retrying.",
  "Acceso rechazado.": "Access denied.",

  // Auth credentials / directory / users (including pre-N4 unaccented & post-N4 normalized)
  "No se pudo leer perfil.": "Could not read profile.",
  "No se pudo leer perfil": "Could not read profile.",
  "No se pudo leer el perfil.": "Could not read profile.",
  "Perfil invalido.": "Invalid profile.",
  "Perfil inválido.": "Invalid profile.",
  "Credencial invalida.": "Invalid credential.",
  "Credencial inválida.": "Invalid credential.",
  "Credencial alterada.": "Tampered credential.",
  "Temporal invalida.": "Invalid temporary credential.",
  "Temporal inválida.": "Invalid temporary credential.",
  "Contraseña temporal vencida. Solicita otra al administrador.":
    "Temporary password expired. Request a new one from the administrator.",
  "Sesion revocada.": "Session revoked.",
  "Sesión revocada.": "Session revoked.",
  "Sesion revocada. Ingresa otra vez.": "Session revoked. Sign in again.",
  "Sesión revocada. Ingresa otra vez.": "Session revoked. Sign in again.",
  "Elige una contraseña diferente a la anterior.": "Choose a password different from the previous one.",
  "Perfil no corresponde al usuario.": "Profile does not match the user.",
  "Se requiere sesion normal de administrador.": "A normal administrator session is required.",
  "Se requiere sesión normal de administrador.": "A normal administrator session is required.",
  "Usuario activo no encontrado.": "Active user not found.",
  "Rol alterado.": "Role was altered.",
  "La contraseña debe tener exactamente 8 caracteres.": "Password must be exactly 8 characters long.",
  "No se pudo proteger la credencial.": "Could not protect the credential.",
  "Falta la llave de confianza. Solicita provision al administrador.":
    "Trust key is missing. Request provisioning from the administrator.",
  "Falta la llave de confianza. Solicita provisión al administrador.":
    "Trust key is missing. Request provisioning from the administrator.",
  "Llave de confianza invalida.": "Invalid trust key.",
  "Llave de confianza inválida.": "Invalid trust key.",
  "No se pudo leer team.json.": "Could not read team.json.",
  "Directorio invalido.": "Invalid directory.",
  "Directorio inválido.": "Invalid directory.",
  "Version o fecha de directorio invalida.": "Invalid directory version or date.",
  "Versión o fecha de directorio inválida.": "Invalid directory version or date.",
  "Directorio invalido o IDs duplicados.": "Invalid directory or duplicate IDs.",
  "Directorio inválido o IDs duplicados.": "Invalid directory or duplicate IDs.",
  "Identificador de perfil inválido.": "Invalid profile identifier.",
  "Este identificador está reservado; elige otro usuario.":
    "This identifier is reserved; choose another user ID.",
  "El directorio contiene roles alterados. Requiere revisión administrativa.":
    "The directory contains altered roles. Administrative review is required.",
  "ID: usa hasta 64 letras sin acentos, números, guion o guion bajo.":
    "ID: use up to 64 unaccented letters, numbers, hyphens, or underscores.",
  "Escribe un nombre de hasta 100 caracteres.": "Enter a name up to 100 characters long.",
  "Elige ingeniero o supervisor.": "Choose engineer or supervisor.",
  "El ID ya está registrado, incluso en cuentas inactivas.":
    "This ID is already registered, including inactive accounts.",
  "Usuario no encontrado.": "User not found.",
  "El administrador no se modifica desde este directorio.":
    "The administrator cannot be modified from this directory.",
  "La cuenta ya tiene ese estado.": "The account already has that status.",
  "El administrador inicial ya existe. Ingresa o solicita recuperación.":
    "The initial administrator already exists. Sign in or request recovery.",
  "El directorio cambió; vuelve a abrir el acceso.": "The directory changed; reopen sign-in.",
  "Se requiere sesión normal de Supervisor o Admin.": "A normal Supervisor or Admin session is required.",
  "Se requiere sesión normal de Supervisor o Administrador.":
    "A normal Supervisor or Administrator session is required.",
  "Directorio con roles alterados.": "Directory contains altered roles.",
  "El registro corresponde a la única cuenta Supervisor activa del equipo.":
    "Project registration is reserved for the team's single active Supervisor account.",

  // Projects / Models / Storage
  "Datos fuera del espacio activo.": "Data is outside the active workspace.",
  "Las horas objetivo deben ser mayores que cero.": "Target hours must be greater than zero.",
  "Proyecto no encontrado.": "Project not found.",
  "El objetivo cambió. Actualiza el proyecto.": "Target hours changed. Refresh the project.",
  "Se requiere sesión normal.": "A normal session is required.",
  "Proyecto no autorizado o inexistente.": "Project is unauthorized or does not exist.",
  "Se requiere sesión normal de Engineer.": "A normal Engineer session is required.",
  "Se requiere sesión normal de Ingeniero.": "A normal Engineer session is required.",
  "Se requiere sesión normal de ingeniero.": "A normal Engineer session is required.",
  "Selecciona ingenieros activos del equipo.": "Select active engineers from the team.",
  "La WBS ya está registrada.": "This WBS is already registered.",
  "Un ingeniero asignado ya no está activo.": "An assigned engineer is no longer active.",
  "La lista de proyectos para reordenar no coincide con el total de proyectos.":
    "The project list to reorder does not match the total number of projects.",
  "Lista de proyectos contiene identificadores duplicados.":
    "The project list contains duplicate identifiers.",
  "Faltan proyectos existentes en el reordenamiento.":
    "Existing projects are missing from the reorder list.",
  "Asignación ausente o ambigua en el proyecto.": "Missing or ambiguous assignment in the project.",
  "Usa fechas válidas con formato AAAA-MM-DD.": "Use valid dates in YYYY-MM-DD format.",
  "La fecha objetivo no puede ser anterior al inicio.": "Target date cannot be earlier than the start date.",
  "Selecciona ingenieros sin duplicados para el proyecto.":
    "Select engineers without duplicates for the project.",
  "La prioridad del proyecto debe ser mayor que cero.": "Project priority must be greater than zero.",
  "Objetivo de horas de proyecto inválido.": "Invalid project target hours.",
  "Proyecto inválido: revisa campos obligatorios y estado.":
    "Invalid project: check required fields and status.",
  "No se pudo leer projects.json.": "Could not read projects.json.",
  "projects.json está fuera del espacio activo.": "projects.json is outside the active workspace.",
  "projects.json inválido; requiere revisión, no se reinicializó.":
    "Invalid projects.json; review required, it was not reset.",
  "Versión de proyectos incompatible.": "Incompatible projects version.",
  "Proyectos con identidad o WBS duplicados; requiere revisión.":
    "Projects with duplicate identity or WBS; review required.",
  "Los proyectos cambiaron. Actualiza antes de reintentar.": "Projects changed. Refresh before retrying.",
  "Completa el cambio de contraseña primero.": "Complete the password change first.",

  // Legacy activities & evidence
  "Perfil inválido; no se reinicializó.": "Invalid profile; it was not reset.",
  "Perfil de otro propietario.": "Profile belongs to another owner.",
  "Faltan actividades del perfil.": "Profile activities are missing.",
  "Actividades inválidas.": "Invalid activities.",
  "Registro de inicio inválido.": "Invalid start record.",
  "Actividades duplicadas.": "Duplicate activities.",
  "Registro de inicio inválido; no se reinicializó.": "Invalid start record; it was not reset.",
  "El tiempo invertido debe ser un número de horas no negativo.":
    "Time spent must be a non-negative number of hours.",
  "Revisa título, WBS, estado e hito de la actividad.":
    "Check the activity title, WBS, status, and milestone.",
  "Revisión inválida.": "Invalid review.",
  "Revisión alterada.": "Altered review.",
  "Hay versiones concurrentes o relaciones de planificación pendientes. Resuélvelas antes de consolidar el reporte.":
    "There are concurrent versions or pending planning relationships. Resolve them before consolidating the report.",
  "Este proyecto usa entregables. Actualiza desde su tabla de actividades; el historial anterior es de solo lectura.":
    "This project uses deliverables. Update from its activity table; previous history is read-only.",
  "Avance general inválido.": "Invalid overall progress.",
  "Solo un ingeniero asignado declara su avance válido.":
    "Only an assigned engineer can declare valid progress.",
  "El avance general cambió. Actualiza el proyecto.": "Overall progress changed. Refresh the project.",
  "Avances generales inválidos; no se reinicializaron.":
    "Invalid overall progress values; they were not reset.",
  "Solo Engineer o Supervisor pueden registrar actividades.":
    "Only an Engineer or Supervisor can record activities.",
  "Solo Ingeniero o Supervisor pueden registrar actividades.":
    "Only an Engineer or Supervisor can record activities.",
  "Actividad propia no encontrada.": "Own activity not found.",
  "La actividad cambió. Actualiza antes de guardar.": "The activity changed. Refresh before saving.",
  "Una actividad nueva no tiene revisión anterior.": "A new activity has no previous revision.",
  "El archivo debe contener datos y no superar 20 MB.": "The file must contain data and not exceed 20 MB.",
  "Solo PDF, PNG o JPG con contenido válido.": "Only PDF, PNG, or JPG files with valid content are allowed.",
  "Solo Engineer adjunta evidencia propia.": "Only an Engineer can attach their own evidence.",
  "Solo Ingeniero adjunta evidencia propia.": "Only an Engineer can attach their own evidence.",
  "Nombre de archivo inválido.": "Invalid file name.",
  "La actividad cambió. Actualiza antes de adjuntar.": "The activity changed. Refresh before attaching.",
  "Los adjuntos requieren el cambio explícito a carpetas personales layout 2.":
    "Attachments require an explicit upgrade to layout 2 personal folders.",
  "Actividad no autorizada.": "Unauthorized activity.",
  "Evidencia no encontrada.": "Evidence not found.",
  "Referencia de evidencia inválida.": "Invalid evidence reference.",
  "Evidencia no disponible. Comprueba la sincronización.": "Evidence unavailable. Check synchronization.",
  "Evidencia supera el límite.": "Evidence exceeds size limit.",
  "Evidencia incompleta o alterada.": "Incomplete or altered evidence.",
  "Actividad no encontrada.": "Activity not found.",
  "La revisión cambió o no solicita cierre al 100%.": "The revision changed or does not request 100% closure.",
  "Indica el motivo de devolución.": "Provide the return reason.",
  "El cierre requiere evidencia.": "Closure requires evidence.",
  "La revisión cambió antes de guardar.": "The revision changed before saving.",

  // Results-based planning / results_store
  "Fecha inválida.": "Invalid date.",
  "Formato de fecha inválido.": "Invalid date format.",
  "Compromiso inválido o duplicado.": "Invalid or duplicate commitment.",
  "El inicio supera la fecha compromiso.": "Start date is after the commitment date.",
  "Entregable sin criterios válidos o fuera del compromiso.":
    "Deliverable lacks valid criteria or is outside the commitment range.",
  "Actividades inválidas o duplicadas.": "Invalid or duplicate activities.",
  "Actividad sin referencia, responsable o avance válido.":
    "Activity lacks a valid deliverable reference, owner, or progress.",
  "Una actividad con trabajo no puede estar sin iniciar.":
    "An activity with recorded work cannot remain not started.",
  "Terminar requiere 100 %.": "Completing requires 100%.",
  "100 % corresponde a actividad terminada, sin aprobación.":
    "100% corresponds to a completed activity, without approval.",
  "Previsión de fechas invertida.": "Inverted forecast dates.",
  "Dependencia inexistente.": "Dependency does not exist.",
  "Dependencia propia o previsión anterior al fin de su dependencia.":
    "Self-dependency or forecast start earlier than its dependency's due date.",
  "Dependencias circulares.": "Circular dependencies.",
  "Solicitud sobre un compromiso distinto o inválido.": "Submission targets a different or invalid commitment.",
  "Entregable inexistente.": "Deliverable does not exist.",
  "La solicitud debe cubrir cada criterio una sola vez.":
    "The submission must cover each criterion exactly once.",
  "Falta un criterio de aceptación.": "An acceptance criterion is missing.",
  "Criterio incumplido o evidencia no verificada.": "Unmet criterion or unverified evidence.",
  "Decisión inválida, sin motivo o ligada a otra revisión.":
    "Invalid decision, missing reason, or linked to another revision.",
  "Falta comprobar el estado final y los entregables al cierre.":
    "Final outcome and deliverables must be verified at closure.",
  "Revisiones duplicadas en el cierre.": "Duplicate reviews in closure.",
  "Hay entregables sin aceptación.": "There are unaccepted deliverables.",
  "Bloqueo sin actividad, impedimento o ayuda requerida.":
    "Blocker lacks activity, impediment, or help needed.",
  "Fecha de bloqueo inválida.": "Invalid blocker date.",
  "Seguimiento de bloqueo inconsistente.": "Inconsistent blocker tracking.",
  "Operación no autorizada.": "Unauthorized operation.",
  "Transición inválida o falta motivo de devolución.": "Invalid transition or missing return reason.",
  "Entidad con ID inválido.": "Entity has an invalid ID.",
  "Revisión de proyecto inválida o alterada.": "Invalid or altered project revision.",
  "Acción incompatible con la revisión de proyecto.": "Action incompatible with project revision.",
  "Revisión con autoridad inválida.": "Revision has invalid authority.",
  "Revisión de compromiso inconsistente.": "Inconsistent commitment revision.",
  "Decisión de cierre alterada.": "Altered closure decision.",
  "Proyecto por resultados incompleto; requiere restauración.":
    "Results-based project is incomplete; restoration required.",
  "Revisión JSON inválida; no se reinicializó.": "Invalid revision JSON; it was not reset.",
  "Identidad de revisión duplicada o renombrada.": "Duplicate or renamed revision identity.",
  "Referencia de compromiso inválida.": "Invalid commitment reference.",
  "Sincronización incompleta: falta el compromiso de la revisión.":
    "Incomplete sync: the revision's commitment is missing.",
  "La referencia de compromiso apunta a otra entidad.":
    "The commitment reference points to another entity.",
  "La revisión no identifica el compromiso evaluado.":
    "The revision does not identify the evaluated commitment.",
  "Relación de revisiones inválida.": "Invalid revision relationship.",
  "Sincronización incompleta: falta una revisión anterior.":
    "Incomplete sync: a previous revision is missing.",
  "La revisión anterior pertenece a otra entidad.": "The previous revision belongs to another entity.",
  "Relaciones circulares entre revisiones.": "Circular relationships between revisions.",
  "Falta compromiso de la actividad.": "Activity commitment is missing.",
  "Revisión de entregable inexistente.": "Deliverable review does not exist.",
  "Revisión sin solicitud inmutable.": "Review lacks an immutable submission.",
  "Entregable aceptado sin decisión verificable.":
    "Deliverable accepted without a verifiable decision.",
  "Hay revisiones concurrentes; el Supervisor debe resolverlas.":
    "There are concurrent revisions; the Supervisor must resolve them.",
  "La información cambió. Actualiza antes de guardar.": "Information changed. Refresh before saving.",
  "Compromiso inválido.": "Invalid commitment.",
  "El Supervisor debe definir el DoD del proyecto.": "The Supervisor must define the project's DoD.",
  "Reabre el proyecto antes de modificarlo.": "Reopen the project before modifying it.",
  "Compromiso en conflicto; el Supervisor debe resolverlo.":
    "Commitment is in conflict; the Supervisor must resolve it.",
  "Operación no autorizada para esta sesión.": "Operation is not authorized for this session.",
  "El compromiso cambió antes de publicar; actualiza el proyecto.":
    "The commitment changed before publishing; refresh the project.",
  "La información cambió antes de publicarse.": "Information changed before publishing.",
  "El compromiso cambió antes de publicar la revisión.":
    "The commitment changed before publishing the revision.",
  "Archivo histórico inválido.": "Invalid legacy history file.",
  "Activación incompleta; restaura el proyecto.": "Incomplete activation; restore the project.",
  "Falta manifiesto del proyecto por resultados.": "Results project manifest is missing.",
  "Manifiesto del proyecto inválido.": "Invalid project manifest.",
  "Versión o firma del almacenamiento incompatible.": "Incompatible storage version or signature.",
  "Falta archivo histórico del proyecto.": "Project legacy history file is missing.",
  "El archivo histórico cambió; requiere restauración.":
    "The legacy history file changed; restoration required.",
  "Selecciona ingenieros activos y autorizados.": "Select active and authorized engineers.",
  "Evidencia todavía no disponible.": "Evidence not yet available.",
  "La evidencia cambió o está incompleta.": "The evidence changed or is incomplete.",
  "Evidencia todavía no disponible; espera la sincronización o restaura la copia.":
    "Evidence not yet available; wait for sync or restore the copy.",
  "Identidad de evidencia duplicada con contenido distinto.":
    "Duplicate evidence identity with different content.",
  "Evidencia no autorizada o inexistente para este proyecto.":
    "Evidence is unauthorized or does not exist for this project.",
  "Resuelve los conflictos antes de cerrar.": "Resolve conflicts before closing.",
  "El cierre corresponde a otro compromiso.": "Closure corresponds to another commitment.",
  "Selecciona explícitamente el entregable que recibirá las actividades históricas antes de activar.":
    "Explicitly select the deliverable that will receive historic activities before activating.",
  "El proyecto ya fue activado o requiere restauración.":
    "The project was already activated or requires restoration.",
  "Ruta inválida.": "Invalid path.",
  "Actividades históricas con IDs duplicados; integra antes de migrar.":
    "Historic activities have duplicate IDs; reconcile before migrating.",
  "Falta entregable de migración.": "Migration deliverable is missing.",
  "Evidencia histórica inválida.": "Invalid historic evidence.",
  "Evidencia histórica duplicada con contenido diferente.":
    "Duplicate historic evidence with different content.",
  "Otra activación se publicó; actualiza el proyecto.": "Another activation was published; refresh the project.",
  "Describe el motivo del compromiso.": "Describe the reason for the commitment.",
  "Un compromiso nuevo no tiene revisión anterior.": "A new commitment has no previous revision.",
  "Describe el motivo del cambio de compromiso.": "Describe the reason for changing the commitment.",
  "Falta compromiso.": "Commitment is missing.",
  "Resuelve la dependencia en conflicto antes de planear esta actividad.":
    "Resolve the conflicting dependency before planning this activity.",
  "Actividad inválida.": "Invalid activity.",
  "Un bloqueo nuevo no tiene revisión anterior.": "A new blocker has no previous revision.",
  "Selecciona el bloqueo.": "Select the blocker.",
  "Bloqueo inexistente.": "Blocker does not exist.",
  "Bloqueo inválido.": "Invalid blocker.",
  "El bloqueo ya está resuelto.": "The blocker is already resolved.",
  "Describe la atención o resolución del bloqueo.": "Describe the attention or resolution of the blocker.",
  "Acción de bloqueo inválida.": "Invalid blocker action.",
  "Falta solicitud de revisión.": "Review submission is missing.",
  "Describe el motivo de reapertura del entregable.": "Describe the reason for reopening the deliverable.",
  "El proyecto está cerrado. Reábrelo para solicitar revisiones.":
    "The project is closed. Reopen it to request revisions.",
  "Describe el motivo de la revisión solicitada.": "Describe the reason for the requested revision.",
  "Actividad inexistente.": "Activity does not exist.",
  "Solo puedes solicitar revisión de actividades marcadas como finalizadas.":
    "You can only request a revision for activities marked as completed.",
  "El proyecto ya tiene ese estado de cierre.": "The project already has that closure state.",
  "Confirma que se cumple el estado final acordado.": "Confirm that the agreed final outcome is met.",
  "Describe el motivo de reapertura del proyecto.": "Describe the reason for reopening the project.",
  "Describe cómo se resolvió el conflicto.": "Describe how the conflict was resolved.",
  "Conflicto inexistente.": "Conflict does not exist.",
  "El conflicto cambió; revisa todas las alternativas actuales.":
    "The conflict changed; review all current alternatives.",
  "Nombre de evidencia inválido.": "Invalid evidence file name.",
  "ID de evidencia inválido.": "Invalid evidence ID.",
  "Identidad de evidencia ambigua.": "Ambiguous evidence identity.",
  "Evidencia no autorizada o inexistente.": "Evidence is unauthorized or does not exist.",

  // Plant catalogs
  "Versión de catálogos incompatible.": "Incompatible catalogs version.",
  "Catálogo con nombres vacíos o duplicados.": "Catalog contains empty or duplicate names.",
  "Solo los equipos tienen una referencia de línea.": "Only equipment entries can reference a production line.",
  "Un equipo activo requiere una línea activa y existente.":
    "Active equipment requires an existing active production line.",
  "Catálogos inválidos; no se reinicializaron.": "Invalid catalogs; they were not reset.",
  "Solo Admin mantiene los catálogos.": "Only Admin can maintain catalogs.",
  "Solo Administrador mantiene los catálogos.": "Only Administrator can maintain catalogs.",
  "El catálogo cambió. Actualiza antes de guardar.": "The catalog changed. Refresh before saving.",
  "No se eliminan entradas: desactívalas para conservar referencias.":
    "Entries cannot be deleted: deactivate them to preserve references.",

  // Incidents
  "Revisa descripción, equipo, impacto, paro y estado.":
    "Check description, equipment, impact, downtime, and status.",
  "Evento de incidencia inválido.": "Invalid incident event.",
  "Evento alterado o duplicado; revisa la sincronización.":
    "Altered or duplicate event; check synchronization.",
  "Historial incompleto; espera la sincronización del evento inicial.":
    "Incomplete history; wait for the initial event to sync.",
  "Falta un evento anterior. Comprueba la sincronización.":
    "A previous event is missing. Check synchronization.",
  "Historial de incidencia inconsistente.": "Inconsistent incident history.",
  "issues.json inválido; no se reinicializó.": "Invalid issues.json; it was not reset.",
  "Incidencias legacy incompatibles.": "Incompatible legacy incidents.",
  "Identificador de solicitud inválido.": "Invalid request identifier.",
  "La solicitud ya existe con otro contenido.": "The request already exists with different content.",
  "Incidencia no encontrada.": "Incident not found.",
  "Solo el reportante o Supervisor corrige esta incidencia.":
    "Only the reporter or Supervisor can correct this incident.",
  "La incidencia cambió. Actualiza e integra todas las versiones antes de corregir.":
    "The incident changed. Refresh and reconcile all versions before correcting.",
  "Una incidencia nueva no corrige eventos anteriores.":
    "A new incident cannot supersede previous events.",
  "Selecciona un equipo activo del catálogo.": "Select active equipment from the catalog.",
  "Selecciona un tipo de falla activo.": "Select an active failure type.",

  // Preferences
  "Preferencias incompatibles o de otro propietario.": "Incompatible preferences or owned by another user.",
  "Identidad de preferencias inválida.": "Invalid preferences identity.",
  "Restablece explícitamente el archivo inválido antes de guardar.":
    "Explicitly reset the invalid file before saving.",
  "Las preferencias cambiaron. Vuelve a abrir Configuración.": "Preferences changed. Reopen Settings.",
  "Las preferencias cambiaron. Actualiza antes de guardar.": "Preferences changed. Refresh before saving.",
  "Preferencias inválidas. Se usan valores predeterminados; restablece para guardar de nuevo.":
    "Invalid preferences. Default values are in use; reset to save again.",

  // Weekly reporting & Ok(...) user-facing payload messages
  "El reporte del área corresponde a Supervisor o Admin.": "Area reporting is restricted to Supervisor or Admin.",
  "El reporte requiere convertir explícitamente las incidencias anteriores a eventos antes de consolidar.":
    "The report requires explicitly converting legacy incidents into events before consolidating.",
  "Integra las versiones concurrentes de incidencias antes de exportar.":
    "Reconcile concurrent incident versions before exporting.",
  "Los datos cambiaron durante la lectura. Actualiza el reporte.":
    "Data changed while reading. Refresh the report.",
  "La estructura del reporte exportado no coincide con el snapshot.":
    "The exported report structure does not match the snapshot.",
  "El Supervisor registra los proyectos. Admin administra las cuentas y consulta los proyectos.":
    "The Supervisor registers projects. Admin manages accounts and views projects.",
  "Consulta los proyectos donde estás asignado.": "View the projects assigned to you.",
  "Registra el proyecto y selecciona a los ingenieros responsables.":
    "Register the project and select the responsible engineers.",
  "El cierre recibido corresponde a un compromiso anterior. El Supervisor debe reabrir y validar el compromiso vigente.":
    "The recorded closure corresponds to a previous commitment. The Supervisor must reopen and validate the current commitment.",
};

export interface BackendErrorPattern {
  pattern: RegExp;
  format: (match: RegExpMatchArray, lang: Lang) => string;
}

export const BACKEND_ERROR_PATTERNS: ReadonlyArray<BackendErrorPattern> = [
  // 1. Named file/profile read wrappers (MUST precede generic `leer (.+?):\s+`)
  {
    pattern: /^No se pudo leer el perfil:\s*(.+)$/,
    format: (m, lang) => (lang === "en" ? `Could not read profile: ${m[1]}` : m[0]),
  },
  {
    pattern: /^No se pudo leer el archivo:\s*(.+)$/,
    format: (m, lang) => (lang === "en" ? `Could not read file: ${m[1]}` : m[0]),
  },
  {
    pattern: /^No se pudo leer la carpeta:\s*(.+)$/,
    format: (m, lang) => (lang === "en" ? `Could not read folder: ${m[1]}` : m[0]),
  },

  // 2. Named write/create/JSON/operation wrappers
  {
    pattern: /^No se pudo escribir el archivo:\s*(.+)$/,
    format: (m, lang) => (lang === "en" ? `Could not write file: ${m[1]}` : m[0]),
  },
  {
    pattern: /^No se pudo guardar el archivo:\s*(.+)$/,
    format: (m, lang) => (lang === "en" ? `Could not save file: ${m[1]}` : m[0]),
  },
  {
    pattern: /^No se pudo crear el archivo:\s*(.+)$/,
    format: (m, lang) => (lang === "en" ? `Could not create file: ${m[1]}` : m[0]),
  },
  {
    pattern: /^No se pudo crear la carpeta:\s*(.+)$/,
    format: (m, lang) => (lang === "en" ? `Could not create folder: ${m[1]}` : m[0]),
  },
  {
    pattern: /^No se pudo procesar el archivo JSON:\s*(.+)$/,
    format: (m, lang) => (lang === "en" ? `Could not process JSON file: ${m[1]}` : m[0]),
  },
  {
    pattern: /^Error de formato JSON:\s*(.+)$/,
    format: (m, lang) => (lang === "en" ? `JSON format error: ${m[1]}` : m[0]),
  },
  {
    pattern: /^No se pudo completar la operación:\s*(.+)$/,
    format: (m, lang) =>
      lang === "en"
        ? `Could not complete the operation: ${formatBackendError(m[1], "en")}`
        : `No se pudo completar la operación: ${formatBackendError(m[1], "es")}`,
  },

  // 3. Generic path-capturing I/O wrappers (`:\s+` preserves Windows drive colons like `C:\...`)
  {
    pattern: /^No se puede acceder a la carpeta:\s*(.+)$/,
    format: (m, lang) => (lang === "en" ? `Cannot access folder: ${m[1]}` : m[0]),
  },
  {
    pattern: /^No se puede leer (.+?):\s+(.+)$/,
    format: (m, lang) => (lang === "en" ? `Cannot read ${m[1]}: ${m[2]}` : m[0]),
  },
  {
    pattern: /^No se pudo leer (.+?):\s+(.+)$/,
    format: (m, lang) => (lang === "en" ? `Could not read ${m[1]}: ${m[2]}` : m[0]),
  },
  {
    pattern: /^No se pudo escribir (.+?):\s+(.+)$/,
    format: (m, lang) => (lang === "en" ? `Could not write ${m[1]}: ${m[2]}` : m[0]),
  },
  {
    pattern: /^No se pudo crear (.+?):\s+(.+)$/,
    format: (m, lang) => (lang === "en" ? `Could not create ${m[1]}: ${m[2]}` : m[0]),
  },
  {
    pattern: /^Archivo de configuración inválido:\s*(.+)$/,
    format: (m, lang) => (lang === "en" ? `Invalid configuration file: ${m[1]}` : m[0]),
  },
  {
    pattern: /^El espacio está incompleto \((.+?)\)\. Restaura sus datos; no se creará otro directorio vacío\.$/,
    format: (m, lang) =>
      lang === "en"
        ? `The workspace is incomplete (${m[1]}). Restore its data; a new empty directory will not be created.`
        : m[0],
  },

  // 4. Domain action wrappers
  {
    pattern: /^No se pudo publicar el archivo:\s*(.+)$/,
    format: (m, lang) => (lang === "en" ? `Could not publish file: ${m[1]}` : m[0]),
  },
  {
    pattern: /^No se pudo abrir el documento adjunto:\s*(.+)$/,
    format: (m, lang) => (lang === "en" ? `Could not open attached document: ${m[1]}` : m[0]),
  },
  {
    pattern: /^No se pudo activar el proyecto:\s*(.+)$/,
    format: (m, lang) =>
      lang === "en"
        ? `Could not activate project: ${formatBackendError(m[1], "en")}`
        : `No se pudo activar el proyecto: ${formatBackendError(m[1], "es")}`,
  },
  {
    pattern: /^No se pudieron leer preferencias:\s*(.+)$/,
    format: (m, lang) => (lang === "en" ? `Could not read preferences: ${m[1]}` : m[0]),
  },
  {
    pattern: /^No se pudieron restablecer preferencias:\s*(.+)$/,
    format: (m, lang) => (lang === "en" ? `Could not reset preferences: ${m[1]}` : m[0]),
  },

  // 5. Excel reporting & `export_weekly.ps1`
  {
    pattern: /^No se pudo iniciar la exportación Excel:\s*(.+)$/,
    format: (m, lang) => (lang === "en" ? `Could not start Excel export: ${m[1]}` : m[0]),
  },
  {
    pattern: /^Excel devolvió errores de fórmula en (.+?)\.?$/,
    format: (m, lang) => (lang === "en" ? `Excel returned formula errors in ${m[1]}.` : m[0]),
  },
  {
    pattern: /^Excel no completó el reporte\. Revisa que Microsoft Excel esté instalado y disponible\.\s*([\s\S]*)$/,
    format: (m, lang) => {
      if (lang === "es") return m[0];
      const stderr = m[1]
        .trim()
        .replace(
          /La estructura del reporte exportado no coincide con el snapshot\./g,
          "The exported report structure does not match the snapshot.",
        )
        .replace(
          /Excel devolvió errores de fórmula en ([^\r\n]+)/g,
          "Excel returned formula errors in $1",
        );
      return `Excel did not complete the report. Check that Microsoft Excel is installed and available.${stderr ? ` ${stderr}` : ""}`;
    },
  },

  // 6. Tauri IPC argument rejection
  {
    pattern: /^invalid args\b[\s\S]*$/i,
    format: (_m, lang) =>
      lang === "en"
        ? "The submitted data does not have the expected format."
        : "Los datos enviados no tienen el formato esperado.",
  },
];

function resolveRawMessage(raw: string, lang: Lang): string | null {
  if (Object.prototype.hasOwnProperty.call(BACKEND_ERRORS, raw)) {
    if (lang === "es") {
      return BACKEND_ES_NORMALIZE[raw] ?? raw;
    }
    return BACKEND_ERRORS[raw];
  }

  for (const rule of BACKEND_ERROR_PATTERNS) {
    const match = raw.match(rule.pattern);
    if (match) {
      return rule.format(match, lang);
    }
  }

  return null;
}

/**
 * Formats a backend error, warning, or status message into the active language.
 */
export function formatBackendError(err: unknown, lang: Lang): string {
  const raw = extractErrorMessage(err);
  if (!raw) return "";

  const direct = resolveRawMessage(raw, lang);
  if (direct !== null) return direct;

  if (raw.startsWith("Error: ")) {
    const stripped = raw.slice(7).trim();
    const resolved = resolveRawMessage(stripped, lang);
    if (resolved !== null) return resolved;
  }

  return raw;
}

const REVISION_PREFIX_ES = "[Revisión solicitada]:";
const REVISION_PREFIX_EN = "[Revision requested]:";

/**
 * Translates an activity note (including the `[Revisión solicitada]:` prefix
 * persisted by `results_store.rs`) into the active language.
 */
export function translateActivityNote(note: string, lang: Lang): string {
  const trimmed = note.trim();
  if (!trimmed) return "";

  const matchedPrefix = trimmed.startsWith(REVISION_PREFIX_ES)
    ? REVISION_PREFIX_ES
    : trimmed.startsWith(REVISION_PREFIX_EN)
      ? REVISION_PREFIX_EN
      : null;

  if (matchedPrefix) {
    const body = trimmed.slice(matchedPrefix.length).trim();
    const resolved = body ? pickBilingual(body, lang) : "";
    const prefix = lang === "en" ? REVISION_PREFIX_EN : REVISION_PREFIX_ES;
    return resolved ? `${prefix} ${resolved}` : prefix;
  }

  return pickBilingual(trimmed, lang);
}

const SUMMARY_TOKENS: Record<string, string> = {
  "Resuelto": "Resolved",
  "En atención": "Being addressed",
  "Sin atención": "Pending attention",
  "En preparación": "Preparing",
  "En revisión": "Under review",
  "Devuelto": "Returned",
  "Aceptado": "Accepted",
  "Solicitud retirada": "Withdrawn",
  "Sin decisión": "No decision",
  "Cierre del proyecto": "Project closure",
  "Reapertura del proyecto": "Project reopened",
};

const DELIVERABLE_DUE_RE = / \((\d{4}-\d{2}-\d{2})\): ?/g;
const DELIVERABLE_BLOCK_RE = /^([\s\S]*?) \((\d{4}-\d{2}-\d{2})\): ?([\s\S]*)$/;
const DELIVERABLE_DELIMITER = " || ";

function translateCriteriaList(criteriaRaw: string, lang: Lang): string {
  return criteriaRaw
    ? criteriaRaw
        .split("; ")
        .map(c => pickBilingual(c, lang))
        .join("; ")
    : "";
}

function findSeparatorIndices(text: string): number[] {
  const indices: number[] = [];
  let searchFrom = 0;
  while (true) {
    const idx = text.indexOf(BILINGUAL_SEPARATOR, searchFrom);
    if (idx === -1) break;
    indices.push(idx);
    searchFrom = idx + BILINGUAL_SEPARATOR.length;
  }
  return indices;
}

function translateDeliverablesSegment(segment: string, lang: Lang): string {
  if (segment.includes(DELIVERABLE_DELIMITER)) {
    return segment
      .split(DELIVERABLE_DELIMITER)
      .map(block => {
        const match = block.match(DELIVERABLE_BLOCK_RE);
        if (!match) return pickBilingual(block, lang);
        const [, title, date, criteriaRaw] = match;
        return `${pickBilingual(title, lang)} (${date}): ${translateCriteriaList(criteriaRaw, lang)}`;
      })
      .join(BILINGUAL_SEPARATOR);
  }

  const matches: Array<{ start: number; end: number; date: string }> = [];
  DELIVERABLE_DUE_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = DELIVERABLE_DUE_RE.exec(segment)) !== null) {
    matches.push({ start: m.index, end: m.index + m[0].length, date: m[1] });
  }
  if (matches.length === 0) return pickBilingual(segment, lang);

  const titleStarts = new Array<number>(matches.length).fill(0);
  const criteriaEnds = new Array<number>(matches.length).fill(segment.length);

  for (let k = 1; k < matches.length; k++) {
    const prevEnd = matches[k - 1].end;
    const prevTitle = segment.slice(titleStarts[k - 1], matches[k - 1].start);
    const between = segment.slice(prevEnd, matches[k].start);
    const allSepIndices = findSeparatorIndices(between);

    if (allSepIndices.length === 0) {
      criteriaEnds[k - 1] = matches[k].start;
      titleStarts[k] = matches[k].start;
      continue;
    }

    let chosenOffset: number;
    if (allSepIndices.length === 1) {
      chosenOffset = allSepIndices[0];
    } else {
      const lastSemi = between.lastIndexOf("; ");
      const tailStart = lastSemi === -1 ? 0 : lastSemi + 2;
      const tailSepIndices = lastSemi === -1
        ? allSepIndices
        : allSepIndices.filter(idx => idx >= tailStart);

      // Only narrow to after `; ` when at least 2 `" | "` tokens follow it;
      // otherwise `; ` may belong to the next deliverable's title.
      const activeIndices = lastSemi !== -1 && tailSepIndices.length >= 2
        ? tailSepIndices
        : allSepIndices;

      if (activeIndices.length === 2) {
        chosenOffset = prevTitle.includes(BILINGUAL_SEPARATOR)
          ? activeIndices[1]
          : activeIndices[0];
      } else {
        chosenOffset = activeIndices[Math.floor(activeIndices.length / 2)];
      }
    }

    const splitPos = prevEnd + chosenOffset;
    criteriaEnds[k - 1] = splitPos;
    titleStarts[k] = splitPos + BILINGUAL_SEPARATOR.length;
  }

  return matches
    .map((match, k) => {
      const title = segment.slice(titleStarts[k], match.start);
      const criteriaRaw = segment.slice(match.end, criteriaEnds[k]);
      return `${pickBilingual(title, lang)} (${match.date}): ${translateCriteriaList(criteriaRaw, lang)}`;
    })
    .join(BILINGUAL_SEPARATOR);
}

function translateSummarySegment(segment: string, lang: Lang): string {
  const trimmed = segment.trim();
  if (!trimmed) return "";

  if (Object.prototype.hasOwnProperty.call(SUMMARY_TOKENS, trimmed)) {
    return lang === "en" ? SUMMARY_TOKENS[trimmed] : trimmed;
  }

  const scopeMatch = trimmed.match(/^Alcance:\s*([\s\S]*)$/);
  if (scopeMatch) {
    return `${lang === "en" ? "Scope" : "Alcance"}: ${pickBilingual(scopeMatch[1], lang)}`;
  }

  const engineersMatch = trimmed.match(/^Ingenieros:\s*([\s\S]*)$/);
  if (engineersMatch) {
    return `${lang === "en" ? "Engineers" : "Ingenieros"}: ${engineersMatch[1]}`;
  }

  const ownerMatch = trimmed.match(/^Responsable:\s*([\s\S]*)$/);
  if (ownerMatch) {
    return `${lang === "en" ? "Owner" : "Responsable"}: ${ownerMatch[1]}`;
  }

  const noteMatch = trimmed.match(/^Nota:\s*([\s\S]*)$/);
  if (noteMatch) {
    const body = noteMatch[1].trim();
    const label = lang === "en" ? "Note" : "Nota";
    if (body === "Sin nota") {
      return `${label}: ${lang === "en" ? "No note" : "Sin nota"}`;
    }
    return `${label}: ${translateActivityNote(noteMatch[1], lang)}`;
  }

  const evidenceMatch = trimmed.match(/^Evidencias:\s*([\s\S]*)$/);
  if (evidenceMatch) {
    const body = evidenceMatch[1].trim();
    const label = lang === "en" ? "Evidence" : "Evidencias";
    if (body === "Sin adjuntos") {
      return `${label}: ${lang === "en" ? "No attachments" : "Sin adjuntos"}`;
    }
    return `${label}: ${evidenceMatch[1]}`;
  }

  const helpMatch = trimmed.match(/^Ayuda requerida:\s*([\s\S]*)$/);
  if (helpMatch) {
    return `${lang === "en" ? "Help needed" : "Ayuda requerida"}: ${pickBilingual(helpMatch[1], lang)}`;
  }

  if (/\(\d{4}-\d{2}-\d{2}\):/.test(trimmed)) {
    return translateDeliverablesSegment(trimmed, lang);
  }

  if (/^\d{4}-\d{2}-\d{2}\s*→\s*\d{4}-\d{2}-\d{2}$/.test(trimmed) || /^\d+\s*%$/.test(trimmed)) {
    return trimmed;
  }

  return pickBilingual(trimmed, lang);
}

/**
 * Translates structured `HistoryEntry.summary` and `ConflictVariant.summary`
 * strings emitted by `results_store.rs` while preserving multi-deliverable `" | "`
 * boundaries and resolving `"Español | English"` text inside individual fields.
 */
export function translateBackendSummary(summary: string, lang: Lang): string {
  if (!summary.trim()) return "";
  return summary
    .split(" · ")
    .map(seg => translateSummarySegment(seg, lang))
    .join(" · ");
}
