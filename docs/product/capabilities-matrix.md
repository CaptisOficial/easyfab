# Matriz de Capacidades y Niveles - EasyFAB

Fecha: 2026-10-28
Área: Fabrication Engineering (10.FAB)

Traducción a módulos, componentes y ventanas: [catálogo funcional](catalogo-modulos.md).
Ubicación y comportamiento: [estándar de navegación](../architecture/navegacion.md).
La matriz conserva capacidades objetivo; para el flujo vigente prevalece AGENTS.md:
Admin administra usuarios y consulta proyectos; el único Supervisor activo registra
proyectos y posteriormente valida cierres. Las marcas históricas de creación y
aprobación para Admin no autorizan esos permisos en el flujo confirmado.

Traducción a módulos, componentes y ventanas: [catálogo funcional](catalogo-modulos.md).
Ubicación y comportamiento: [estándar de navegación](../architecture/navegacion.md).
La matriz conserva capacidades objetivo; para el flujo vigente prevalece AGENTS.md:
Admin administra usuarios y consulta proyectos; el único Supervisor activo registra
proyectos y posteriormente valida cierres. Las marcas históricas de creación y
aprobación para Admin no autorizan esos permisos en el flujo confirmado.

---

## Matriz de Capacidades por Rol

Esta matriz define permisos objetivo; las marcas no acreditan implementación. El alcance, dependencias y aceptación se encuentran en el [plan maestro](plan-maestro.md). Acceso/espacio y directorio Admin tienen base implementada; los módulos FAB siguen pendientes.

| Capacidad / Módulo | Engineer (Alexa / Antonio) | Supervisor (Supervisión FAB) | Admin (Alan) |
|---|:---:|:---:|:---:|
| **Autenticación con PIN (Argon2id)** | ✓ | ✓ | ✓ |
| **Visualización de Proyectos Asignados** | ✓ | ✓ (Todos) | ✓ (Todos) |
| **Gestión de Subtareas Propias** | ✓ | Lectura | Lectura |
| **Compuertas de Hitos (0%, 25%, 50%, 75%)** | ✓ | Lectura | Lectura |
| **Solicitud de Cierre de Hito (100% DoD)** | ✓ | Aprueba / Rechaza | Aprueba / Rechaza |
| **Reporte Rápido de Paro / Scrap de Piso** | ✓ | ✓ | ✓ |
| **Creación de Macro Proyectos** | ✗ | ✓ | ✓ |
| **Balance de Carga (Workload Advisor)** | ✗ | ✓ | ✓ |
| **Cálculo Automático de Varianza** | ✗ | ✓ | ✓ |
| **Exportación Oficial KMX-FW Excel** | ✗ | ✓ | ✓ |
| **Gestión de Usuarios y Firma HMAC** | ✗ | ✗ | ✓ |
| **Catálogo de Maquinaria y Equipos (LTC/Benders)** | Lectura | Lectura | ✓ (Edición) |

---

## Métricas Clave de Éxito del Sistema (KPIs)

1. **Tiempo de Reporte Diario:** Reducción de >15 min a **<60 segundos** por ingeniero para reportar avances o paros de piso.
2. **Tasa de Conflictos de Sincronización:** objetivo **0% de archivos en conflicto**, pendiente de validar con múltiples equipos. La partición por usuario no cubre archivos comunes ni la misma cuenta en varios equipos; ver D01 del plan maestro.
3. **Integridad de Reportes:** **100% de paridad** en la exportación Excel contra la plantilla maestra oficial `KMX-FW`.
4. **Adopción y Disponibilidad:** Funcionamiento autónomo 24/7 sin dependencia de servidores centrales ni credenciales de red externas.

## Directorio implementado (2026-10-28)

Admin con sesión normal: consultar directorio, crear engineer/supervisor, activar/desactivar y emitir temporales. Sin eliminación física, cambio de rol ni alta de otro Admin. Engineer/supervisor y sesiones con cambio obligatorio: sin acceso a comandos administrativos.

Actualización PLAN-003B: altas sin cuenta Windows; ID EasyFAB, nombre y rol. El acceso se realiza con contraseña EasyFAB desde equipos habilitados. Partición de escritura por ID EasyFAB.
