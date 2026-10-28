"""Regenera las vistas documentales; no ejecuta el plan ni modifica datos FAB."""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROWS = [
('Base verificada','Arquitectura',[], 'Auditar código, contratos y evidencia nativa; distinguir pruebas de mocks.', 'execution/f00/**'),
('Decisiones y contratos','Arquitectura + Alan',[0], 'Resolver D01–D05; contratos versionados, pruebas y autorización de cambios de invariantes antes de consumidores.', 'contracts/v1/**'),
('Carpetas y migración','Rust almacenamiento',[1], 'D03 aprobada; migración reversible e idempotente, credenciales preservadas y una sola fuente activa.', 'src-tauri/src/storage/**'),
('Confianza, recuperación y preferencias','Rust acceso',[2,1], 'D04 aprobada; recuperación del único Admin, provisión de equipos y rotación; llave siempre local. Contraseña de 8 caracteres, temporal de 24 h y cambio obligatorio. Implementar preferencias locales por espacio/usuario, UI y pruebas; reset no modifica referencia, llave ni permisos.', 'src-tauri/src/auth/**'),
('Proyectos y catálogos','Rust dominio',[3,1], 'RBAC real, asignaciones válidas, fechas, líneas, máquinas, fallas y referencias consistentes.', 'src-tauri/src/projects/**'),
('Actividades e hitos','Rust dominio',[4,2,3,1], 'Escritura por sesión propietaria; hitos 0/25/50/75; 100 solicitado no equivale a aprobado.', 'src-tauri/src/tasks/**'),
('Evidencias','Rust archivos',[5,2,3,1], 'Adjuntos múltiples con ID/revisión, límites acordados, referencias relativas y rechazo de rutas fuera del espacio; recuperación de copia interrumpida.', 'src-tauri/src/evidence/**'),
('Aprobación y retrabajo','Rust dominio',[6,5,4,3,1], 'D02 aprobada; autoridad Supervisor/Admin separada del perfil del ingeniero, ligada a revisión y evidencia; rechazo, reapertura e historial.', 'src-tauri/src/approvals/**'),
('Incidencias de piso','Rust dominio',[7,4,3,2,1], 'D01 aprobada; append-only, deduplicación, correcciones como eventos, horas no negativas y scrap entero no negativo; prueba de reconexión.', 'src-tauri/src/incidents/**'),
('Lecturas y métricas','Rust analítica',[8,7,6,5,4,1], 'D05 aprobada; calendario, esfuerzo, capacidad neta, pesos y línea base explícitos; avance declarado/aprobado y datos faltantes diferenciados.', 'src-tauri/src/read_models/**'),
('Vista Engineer','React',[8,6,5,3,1], 'Proyectos asignados, captura diaria, hitos y adjuntos; objetivo de captura diaria <60 s e incidencia <30 s medido en piloto.', 'src/features/engineer/**'),
('Vistas Supervisor y Admin','React',[9,7,4,3,1], 'Asignar proyectos, mantener catálogos, revisar evidencias, aprobar/rechazar y consultar desviaciones; estados vacíos y errores accesibles.', 'src/features/supervisor/**'),
('Gantt y capacidad','React',[9,1], 'Ventana 21 días W-1/W0/W+1, zona America/Mexico_City; calendario FAB confirmado y capacidad basada en esfuerzo, no conteo de tareas.', 'src/features/planning/**'),
('Plantilla oficial Excel','Especialista Excel',[1], 'D06: Alan selecciona versión oficial; inspeccionar hojas, tablas, fórmulas, estilos e impresión y fijar fixture autorizado.', 'fixtures/kmx-fw/**'),
('Exportación KMX-FW','Rust reportes',[9,13,3,1], 'Snapshot consistente, plantilla oficial preservada y comparación de valores, tablas, fórmulas e impresión; salida en exports del espacio activo.', 'src-tauri/src/export/**'),
('Resiliencia y respaldo','Rust almacenamiento',[14,2,3,1], 'Respaldo de datos/evidencias/manifest sin master.key; restauración validada, compatibilidad de versiones, disco lleno y JSON inválido sin reinicializar datos.', 'src-tauri/src/backup/**'),
('Integración completa','Integrador',[10,11,12,14,15,9,1], 'Proyecto → actividad → evidencia → aprobación → reporte, roles reales y sesiones restringidas probados en backend y UI.', 'src/App.tsx'),
('Piloto y aceptación','QA + FAB',[16,1], 'Preparar portable de piloto con hash antes de pruebas nativas. Pruebas sintéticas aisladas, roles, dos equipos, desconexión/reconexión, ausencia de pérdida/duplicación, tiempos de captura y evidencia nativa separada de mocks.', 'tests/acceptance/**'),
('Candidato portable','Release',[17,16,1], 'Build reproducible, hash, documentos/contratos, compatibilidad y rollback; portable único sin Node/Rust ni instalador obligatorio.', 'release/**'),
('Publicación controlada','Operador + Alan',[18,17], 'Aprobación explícita futura, raíz resuelta y validada, backup, aceptación FAB y evidencia de publicación/rollback; sin migración implícita.', 'execution/f19/**'),
]
DECISIONS = [
('D01','Concurrencia OneDrive','Arquitectura + Alan','Elegir protocolo verificable para múltiples escritores de issues/projects/team y misma cuenta en dos equipos. Append-only y rename local no garantizan convergencia. Eventos inmutables/proyección o escritor único son alternativas, no cambios ya autorizados.'),
('D02','Autoridad de aprobación','Supervisor + Arquitectura','Elegir registro autoritativo separado del JSON propiedad del ingeniero, unido a revisión y huella de evidencias. Un booleano escrito por el ingeniero no concede aprobación.'),
('D03','Carpetas y evidencias','Alan + Arquitectura','Aprobar layout por usuario, contrato de adjuntos, tipos/tamaños/retención y migración con rollback antes de sustituir engineers/<id>.json.'),
('D04','Confianza y recuperación','Alan','Definir custodio, provisión, rotación y recuperación del único Admin. HMAC compartido con un verificador permite firmar; no sincronizar master.key ni prometer revocación instantánea sin conexión. Otro esquema criptográfico requiere cambio explícito de invariante.'),
('D05','Reglas FAB','Supervisor','Confirmar calendario, semanas, turnos, esfuerzo, capacidad, pesos, unidades y línea base para desviaciones. Datos insuficientes se muestran como desconocidos.'),
('D06','Excel oficial','Alan + Supervisor','Seleccionar e inspeccionar plantilla oficial EN o EN-R2; el sufijo R2 no acredita autoridad. Las hojas/tablas del brief siguen por verificar.'),
]

def write(name, value):
    (HERE/name).write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')

def main():
    nodes=[]; catalog=[]
    for i,(title,role,deps,dod,scope) in enumerate(ROWS):
        lid=f'le_f{i:02d}'
        writes=[scope, f'docs/product/execution/f{i:02d}/**']
        # Registro global Rust: una sola cadena de propietarios, nunca ramas simultáneas.
        if i in [2,3,4,5,6,7,8,9,14,15,16]:
            writes += ['src-tauri/src/lib.rs','src-tauri/Cargo.toml']
        if i==1: writes += ['package.json','package-lock.json','vitest.config.ts']
        if i==2: writes += ['src-tauri/src/auth/directory.rs','src-tauri/src/auth/credentials.rs','src-tauri/src/workspace.rs','src-tauri/src/bootstrap.rs']
        if i==3: writes += ['src-tauri/src/auth_commands.rs','src-tauri/src/user_commands.rs','src-tauri/src/preferences/**','src/features/preferences/**','src/components/auth/**','src/components/Login.tsx']
        if i==7: writes += ['src/features/pilot/**','src/App.tsx']
        if i==11: writes += ['src/features/admin/**']
        if i==16: writes += ['src/lib/api.ts','src/index.css']
        if i==17: writes += ['release/pilot/**']
        if i==18: writes += ['src-tauri/tauri.conf.json','scripts/release/**']
        nodes.append(dict(le_id=lid, role=role, goal=f'produce F{i:02d} deliverable: {title}', context_profile='evidence_v1' if i in [0,17] else 'integrator_v1' if i==16 else 'specialist_v1', depends_on=[f'le_f{x:02d}' for x in deps], scope=dict(mission_slice=title,writes=writes,inputs=['mission_contract']+[f'f{x:02d}_interface' for x in deps]+(['publication_authorization'] if i==19 else []), outputs=[f'f{i:02d}_interface']), execution_policy=dict(max_attempts=2,timeout_seconds=3600,idempotency_key=f'easyfab-f{i:02d}-v1')))
        catalog.append(dict(le_id=lid,title=title, baseline='Revisión documental disponible; revalidar al iniciar' if i==0 else 'Base parcial de acceso existente; ampliación pendiente' if i==3 else 'Pendiente de implementación/aceptación', ready='Dependencias aceptadas, decisiones aplicables resueltas y alcance de escritura aprobado', done=dod,evidence=f'docs/product/execution/f{i:02d}/acceptance.md'))
    strategy=dict(contract_version='captis-strategy-v2',strategy_id='easyfab-master-v1',mission_id='easyfab-complete-system',topology='dag_pipeline',max_concurrency=3,execution_limits=dict(max_strategy_revisions=3,max_total_duration_seconds=14400,max_total_tokens=160000),read_only_interfaces=['mission_contract','publication_authorization'],living_experts=nodes,execution_order=[n['le_id'] for n in nodes],evaluation_brief=dict(objective='Aceptar el sistema FAB completo con evidencia verificable',checks=[dict(id='contracts',criterion='Contratos, RBAC, persistencia, pruebas y paridad aprobados'),dict(id='native',criterion='Piloto nativo y concurrencia aceptados'),dict(id='release',criterion='Excel oficial, recuperación y publicación autorizada comprobados')],pass_condition='Todos los nodos aceptados, sin decisiones bloqueantes abiertas ni evidencia faltante',failure_feedback_route='DS'))
    write('easyfab.strategy.json',strategy)
    write('roadmap.json',dict(kind='project_planning_catalog_not_runtime_events',as_of='2026-10-28',nodes=catalog,decisions=[dict(id=x,title=y,owner=z,closure=w,status='pending') for x,y,z,w in DECISIONS]))
    write('publication-authorization.json',dict(status='not_authorized',scope='Planificación actual solamente; ejecución y publicación productiva requieren instrucción futura y raíz validada.'))
    out=['# Plan maestro de EasyFAB','', 'Fecha de corte: 2026-10-28 · Responsable de producto: Alan · Estado: planificación completa; ejecución del backlog pendiente.','',
    '## Objetivo y autoridad','', 'Sistema de escritorio Tauri v2, Rust y React para captura, consolidación y reporte FAB, local-first en la carpeta corporativa seleccionada. AGENTS.md y contracts/v1 son autoridad. La ruta inicial OneDrive es propuesta; todos los módulos usan el mismo espacio validado y fallan si no está disponible. Cambiar raíz cierra sesión y no migra datos.','',
    '## Base real','', 'Existen selección de espacio, acceso independiente de Windows, Argon2id/HMAC, contraseña de 8 caracteres, temporal con cambio obligatorio, directorio Admin y portable 0.1.0. Evidencia histórica: 21 pruebas Rust y 4 frontend; las pruebas IPC simuladas y el arranque de ventana no acreditan flujos nativos completos. Los módulos FAB y las preferencias locales persistentes siguen pendientes. Ver [revisión técnica](planning/reviews/baseline.md) y [brechas de dominio](planning/reviews/domain-gaps.md).','',
    '## Fuentes únicas del plan','', '- [DAG canónico](planning/easyfab.strategy.json): dependencias, interfaces, propietarios de escritura y límites.\n- [Catálogo de entregables](planning/roadmap.json): estado observado, DoR, DoD, evidencia y decisiones; no es un registro de ejecución.\n- [Contrato de misión](planning/mission-contract.md): reglas de ejecución y aceptación.\n- [DAG generado](planning/easyfab-dag.mmd) y [FSM de ejecución generada](planning/easyfab-fsm.mmd).\n- [Revisiones](planning/reviews/): evidencia de alcance y brechas.','',
    '## Entregas de producto','', '| Hito | Resultado aceptable | Entregables |','|---|---|---|','| M0 | Base existente revalidada | F00 |','| M1 | Contratos, carpetas y confianza | F01–F03 |','| M2 | Primer recorrido: proyecto → actividad → evidencia → aprobación | F04–F07, integración parcial controlada |','| M3 | Incidencias, métricas y vistas de roles/Gantt | F08–F12 |','| M4 | Excel oficial reproducible | F13–F14 |','| M5 | Recuperación, integración, piloto y distribución | F15–F19 |','',
    'Los hitos expresan resultados, no fechas ni porcentajes inventados. F13 puede avanzar junto con el backend; las vistas de roles pueden desarrollarse en paralelo cuando sus contratos estén aceptados. Las modificaciones del registro Rust se serializan explícitamente. Cada entrega mantiene funciones y archivos por responsabilidad.','',
    '## Decisiones de entrada','', '| ID | Decisión | Responsable | Cierre requerido |','|---|---|---|']
    out += [f'| {a} | {b} | {c} | {d} |' for a,b,c,d in DECISIONS]
    out += ['', '## Espacio y ciclo de datos','', 'Vigente: `<raíz>/easy-fab/data/engineers/<id-easyfab>.json`. Propuesta D03: `<raíz>/easy-fab/data/engineers/<id>/profile.json` y `evidence/<actividad-id>/<adjunto>`. Esta propuesta no modifica todavía layout, contratos ni datos. La migración debe preservar credenciales e historial, verificar antes/después y ofrecer rollback; nunca dejar dos perfiles activos.','',
    'Compartido: usuarios, roles, credenciales protegidas, configuración FAB, proyectos, avances y evidencias. Local: installation.json, master.key y futuras preferencias por espacio/usuario; preferencias no conceden permisos. Documentación en docs/, contratos en contracts/v1/, exportaciones en exports/, portable en software/easyfab.exe. Plantillas versionadas requieren aprobar su ubicación en el layout.','',
    'Estados de acceso: sin espacio → espacio validado → sin sesión → credencial temporal válida → sesión restringida → cambio obligatorio → sesión normal → cierre. Temporal vencida exige nueva temporal del Admin. Recuperar contraseña vuelve a restringir el acceso; ninguna operación FAB se permite antes del cambio. Cuenta deshabilitada o firma inválida bloquea acceso. Las reglas de recuperación del único Admin se cierran en D04.','',
    'Estados de actividad propuestos: borrador → en curso → revisión solicitada → aprobada; rechazo devuelve a retrabajo. Cambiar revisión o evidencia invalida/reabre la aprobación según D02. Llegar a 100 requiere autorización y documento OS/WI cuando aplique. Estos estados de negocio son distintos de la FSM del ejecutor del DAG.','',
    '## Desglose ejecutable','', '| ID | Entregable / responsable | Depende de | Criterio de aceptación |','|---|---|---|']
    for i,(row,node) in enumerate(zip(ROWS,nodes)):
        title,role,deps,dod,_=row
        out.append(f'| F{i:02d} | {title} · {role} | '+(', '.join(f'F{x:02d}' for x in deps) or 'Misión')+f' | {dod} |')
    out += ['', '## Cobertura del sistema','', '| Capacidad | Entregables |','|---|---|','| Espacio, identidad, usuarios, recuperación y preferencias locales | F01–F03, F15–F16 |','| Catálogos FAB y proyectos/asignación | F04, F11 |','| Actividades, hitos, avances y evidencia | F05–F07, F10 |','| Downtime, scrap e historial | F08, F10 |','| Calendario, carga, desviaciones y Gantt 21 días | F09, F11–F12 |','| Reporte KMX-FW y exportaciones | F13–F14 |','| Respaldo, restauración, portable, documentación y soporte | F15–F19 |','| Pruebas de contratos, unitarias, integración y nativas | Cada nodo + F17 |','',
    '## Control y próximo paso','', 'La solicitud actual autoriza estructurar el plan. No inicia automáticamente sus veinte entregables. El siguiente trabajo concreto es F01: resolver contratos y D03 para la carpeta de usuario/evidencias, manteniendo las otras decisiones que bloquean consumidores. Preferencias locales requieren contrato propio antes de persistirlas.','',
    'Cada cierre exige npm test y scripts/verify_contracts.ps1, más pruebas del comportamiento modificado. Los datos de prueba son sintéticos y aislados. El piloto de dos equipos se prepara con espacio de prueba autorizado y no usa producción. La aceptación final exige además resultados nativos, prueba de concurrencia, plantilla oficial y aprobación FAB. Ningún mock sustituye esa evidencia.','',
    'Los planes históricos son evidencia de entregas parciales; este documento es la entrada al alcance completo. Cambiar decisiones actualiza primero contratos/DAG y sus vistas, luego código. No se certifica hoy la ausencia de conflictos OneDrive.']
    (HERE.parent/'plan-maestro.md').write_text('\n'.join(out)+'\n',encoding='utf-8')

if __name__ == '__main__': main()
