# Matriz de Capacidades y Niveles - EasyFAB

Fecha: 2026-10-28
Área: Fabrication Engineering (10.FAB)

---

## Matriz de Capacidades por Rol

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
2. **Tasa de Conflictos de Sincronización:** **0% de archivos en conflicto** en OneDrive gracias a la partición por usuario.
3. **Integridad de Reportes:** **100% de paridad** en la exportación Excel contra la plantilla maestra oficial `KMX-FW`.
4. **Adopción y Disponibilidad:** Funcionamiento autónomo 24/7 sin dependencia de servidores centrales ni credenciales de red externas.
