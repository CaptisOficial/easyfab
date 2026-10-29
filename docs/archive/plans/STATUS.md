# Status de Planes de Desarrollo - EasyFAB

PLAN-016: Navegación y catálogo funcional — `complete`, 2026-10-29.
[Plan](PLAN_016_NAVIGATION_CATALOG.md). Estándar documental y fichas ágiles; sin cambios de código.
npm test (25 frontend + 29 Rust), Gate 0 con PowerShell 7 y enlaces aprobados.

PLAN-015: Configuración en navegación superior — `complete`, 2026-10-29. [Plan](PLAN_015_TOPNAV_SETTINGS.md). Tuerca/panel, nombre/rol, fecha y salida con puerta. Gate 0 (25 frontend + 29 Rust y PowerShell), build release y comprobación nativa de barra/panel aprobados. Sin cambios de datos/permisos ni publicación del portable compartido.

PLAN-014: Alta y consulta mínima de proyectos — `complete`, 2026-10-28.
[Plan](PLAN_014_PROJECT_REGISTRATION.md). Flujo confirmado: cuatro cuentas, un ejecutable; Admin administra cuentas, Supervisor registra proyectos. Sin modo especial ni migración; Gate 0 aprobado (18 frontend + 29 Rust y PowerShell); build release aprobado y candidato local preparado; aceptación nativa pendiente. Avances y cierres siguen pendientes; no cierra F01/F03/F04.

Última actualización: 2026-10-29 (America/Mexico_City)

---

## Registro histórico de planes

Entrada vigente: [Plan maestro](../../product/plan-maestro.md). Este índice conserva estados reportados en cada fecha; no es una cola activa ni acredita aceptación actual. Los pendientes antiguos (incluido PLAN-001 in_progress) no deben ejecutarse automáticamente. complete se refiere al alcance histórico y puede conservar límites nativos pendientes explícitos.

PLAN-013: Carpetas personales — `complete`, 2026-10-28. [Plan](PLAN_013_PROFILE_FOLDERS.md). 7 frontend + 24 Rust, Gate 0 con suite de cambio/rollback y release aprobados. Layout 2 aplicado al espacio activo; 2 perfiles y team.json preservados por huella. Portable/contratos publicados y pantalla nativa de acceso comprobada. Reingreso manual tras cambio pendiente; evidence vacía, subida de adjuntos/F02 completo pendientes.

PLAN-012: Primer acceso y prueba de perfiles — `complete`, 2026-10-28. [Plan](PLAN_012_FIRST_ACCESS.md). 7 frontend + 23 Rust, Gate 0, prueba de preparación aislada y build release aprobados. Portable publicado, usuarios de prueba respaldados/retirados; pantalla nativa Crear administrador inicial comprobada. Recorrido manual completo por Alan pendiente; no acredita concurrencia ni F02/evidencias.

PLAN-011: Propuesta F01/D03 — `complete`, 2026-10-28. [Plan](PLAN_011_D03_PROPOSAL.md), [propuesta pendiente de Alan](../../product/execution/f01/propuesta-d03.md). Base revalidada: 21 Rust + 4 frontend y Gate 0 aprobados. Cierre documental; F01, D03 y F02 permanecen pendientes de aceptación/implementación.

PLAN-010: Consolidación del plan maestro — `complete`, 2026-10-28. [Plan](PLAN_010_MASTER_PLAN.md). DAG válido, diagramas generados, revisión independiente, 25 pruebas y Gate 0 aprobados. El cierre de esta documentación no equivale a completar el sistema.

PLAN-009: Configuración local y datos compartidos — `complete`, 2026-10-28. [Plan](PLAN_009_LOCAL_PREFERENCES.md). Decisión documentada; Gate 0 y npm test aprobados (21 Rust + 4 frontend). Preferencias pendientes de implementación.

PLAN-008: Autoridad de la carpeta compartida configurada — `complete`, 2026-10-28. [Plan](PLAN_008_CONFIGURED_ROOT.md). Documentación alineada; Gate 0 y npm test aprobados (21 Rust + 4 frontend).

PLAN-007: Base de pruebas desde el inicio — `complete`, 2026-10-28. Gate 0 y npm test aprobados: 21 pruebas Rust y 4 frontend. [Plan](PLAN_007_TESTING.md).

| ID | Plan | Estado | Fecha de Inicio | Fecha de Cierre | Evidencia |
|---|---|:---:|:---:|:---:|---|
| **PLAN-001** | Inicialización, Detección de OneDrive y Gobernanza Captis | `in_progress` | 2026-10-28 | En curso | Scaffolding en `C:\Dev\easyfab`, frontend compilando, backend descargando crates. |
| **PLAN-002** | Acceso, RBAC y recuperación | `complete` | 2026-10-28 | 2026-10-28 | [Plan y evidencia](PLAN_002_AUTH.md): Gate 0, build frontend y 9 pruebas Rust aprobados. Altas/bajas de usuarios siguen en fase 3. |
| **PLAN-003** | Vistas UI de Roles (Engineer, Supervisor, Admin) y Timeline | `pending` | - | - | Componentes base y diseño Kawasaki listos. |
| **PLAN-004** | Motor de Exportación KMX-FW Excel | `pending` | - | - | Integración con plantilla maestra. |
| **PLAN-005** | Empaquetado, Compilación Release e Instalador BAT | `pending` | - | - | Generación de `easyfab.exe` y script de escritorio. |
| **PLAN-003A** | Directorio administrativo | `complete` | 2026-10-28 | 2026-10-28 | [Plan](PLAN_003A_USERS.md): Gate 0, build y 13 pruebas PASS. Prueba nativa de altas pendiente. |
| **PLAN-003B** | Acceso independiente de Windows | `complete` | 2026-10-28 | 2026-10-28 | [Plan](PLAN_003B_PORTABLE_LOGIN.md): contraseña/perfil Admin preservados y vínculo Windows retirado. |
| **PLAN-006** | Espacio canónico configurable y portable | `complete` | 2026-10-28 | 2026-10-28 | [Plan](PLAN_006_WORKSPACE.md): Gate 0, 21 Rust + 4 frontend PASS, portable 0.1.0 publicado y arranque nativo verificado. |
