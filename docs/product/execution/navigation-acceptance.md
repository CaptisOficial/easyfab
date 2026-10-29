# Navegación contextual · evidencia y checkpoint

Fecha: 2026-10-29. Alcance: NAV-01/CFG-01/ADM-01/PRO-01 existentes, enlazados al
plan maestro (F03/F04/F11). Sin contratos, datos corporativos, migración ni portable.

Secuencia lineal: discovery y baseline → ficha funcional → implementación →
pruebas e integración → ce_gate del incremento. Un coordinador, sin delegación
ni contrato JSON nuevo; no equivale al CE de aceptación del sistema completo.

## Decisiones e implementación

- Top Nav conserva identidad, fecha, usuario/salida; menú a la izquierda.
- Lateral de 280 px limitado al viewport, altura completa, portal, fondo oscuro
  e inert, sin mover el main; bloqueo de scroll, foco circular, Escape/✕/exterior.
- Selección cierra y enfoca encabezado. Configuración al fondo; Proyectos solo
  Admin/Supervisor normales. Problemas de línea se identifica previsto sin acción.
- Usuarios bajo Administración del sistema en Configuración. Componentes existentes
  montados al navegar: borradores conservados. Inicio orienta, sin métricas FAB.
- Preferencias/catálogos siguen pendientes; raíz y permisos efectivos en Rust intactos.

## HSS y SSOT

Dato raíz: ya existe en WorkspaceInfo; no se recaptura al consultar Configuración.
Usuario/rol: SessionUser autenticado; no se solicita de nuevo ni se persiste otra copia.
Proyectos/directorio: componentes y adaptadores existentes; no se duplica lógica de dominio.
Borradores: estado en memoria de sus componentes, sin nuevo contrato de persistencia.
Dos superficies operativas antes simultáneas para Admin (Usuarios/Proyectos) quedan
separadas por destino. No se ha medido ahorro de tiempo; abrir Configuración ahora
requiere dos acciones desde Inicio (menú → Configuración), frente a una anterior.
La mejora es ubicación consistente y conservación de captura, no menos clics declarados.

Manpower: DATO: navegación existente. FALTANTE: calendario, disponibilidad y esfuerzo
(D05). No se infiere capacidad ni productividad individual ni se publica indicador.

Derivas fuera del incremento: espacio-de-trabajo.md conserva tabla histórica que dice
Supervisor/Admin para escritura de proyectos; AGENTS y Rust vigentes limitan alta a
Supervisor. Plan maestro/matriz/AGENTS tienen bloques documentales duplicados previos.
No se usan como permisos nuevos ni se limpian cambios ajenos en esta entrega.

## Evidencia de diseño y marca

Se preservan KawasakiLogo.tsx y tokens de src/index.css. No se encontró manual oficial
Kawasaki entre los archivos del repositorio; el comentario de tokens remite a un prompt.
No se certifica su oficialidad. Sin marca Captis ni dirección cinematográfica arbitraria;
epic-ui se limita a jerarquía, composición y ausencia de movimiento distractor.
El panel no introduce animación, por lo que reduced-motion conserva la misma información.

Catálogo captis-interface-design-intelligence: validate_catalog.py falló por hashes
ux-guidelines.csv, typography.csv y charts.csv distintos del manifiesto. doctor con
instancia explícita C:/Users/AlanSantacruz/.codex/skills/captis-interface-design-intelligence
informó docs inactiva (0 documentos/0 chunks). No se aplicaron candidatos ni fallback:
la skill exige reparar catálogo antes de continuar. Se usa la decisión de navegación
ya autorizada; la instalación externa de la skill no se modifica.

## Verificación y continuidad

Baseline: 25 frontend, 29 Rust; Gate 0 aprobado con PowerShell 7. Windows PowerShell 5
falló al interpretar UTF-8 del script existente. Se conserva el script y se usa pwsh.
Pruebas nuevas: teclado/foco, bloqueo del fondo, todos los cierres, destino activo,
roles, borrador conservado y Admin → Configuración/Usuarios → Proyectos con IPC simulado.
Resultados finales: npm test aprobado (29 frontend en esa ejecución, 29 Rust);
Gate 0 final con pwsh aprobado: 30 frontend, 29 Rust, contratos, TypeScript,
cargo check y pruebas PowerShell de layout/rollback. git diff --check aprobado.
Revisión React: listeners/scroll/inert se restauran al cerrar; portal fuera del
fondo bloqueado, sin dependencias nuevas ni estado persistido de navegación.
No se abrió WebView nativo ni se acredita aceptación visual o sincronización OneDrive.

Archivos del incremento: WorkspaceMenu.tsx y su test, TopNav.tsx, WorkspaceSetup.tsx
y su test, Login.tsx; catálogo, navegación, plan maestro, testing y este checkpoint.
Cambios previos presentes en Git se conservan. Sin publicación.
Siguiente acción: validar recorrido visual/teclado en escritorio con datos sintéticos;
después seleccionar la siguiente historia con contratos/dependencias resueltos.

Build frontend: npm run build aprobado (Vite, 1589 módulos). No genera ni publica
un portable corporativo. ce_gate del incremento automatizado aprobado; aceptación
nativa y catálogo de diseño externo siguen pendientes con los límites anteriores.
