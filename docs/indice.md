# EasyFAB: visión y referencias

EasyFAB ayuda al equipo de Fabrication (10.FAB) de Kawasaki Motores de México a registrar proyectos, actividades, avances e incidencias y consolidar reportes, sustituyendo hojas Excel descentralizadas. Es una aplicación de escritorio Tauri v2 + Rust + React 19 + TypeScript, local-first sobre la carpeta corporativa configurada, sin nubes públicas externas.

El recorrido objetivo es: crear proyecto → registrar trabajo diario → aportar evidencia → validar cierre → consultar el área y obtener el reporte semanal.

| Necesito conocer… | Consultar |
|---|---|
| Qué está construido, qué falta y qué sigue | [Plan e historias](product/plan-maestro.md) |
| Módulos, funciones y permisos esperados | [Catálogo funcional](product/catalogo-modulos.md) |
| Cómo trabajar, programar y entregar cambios | [Guía de desarrollo](desarrollo.md) |
| Restricciones técnicas generales | [Invariantes de arquitectura](architecture/invariantes-arquitectura.md) |
| Carpeta compartida, datos, layout y portable | [Espacio de trabajo](architecture/espacio-de-trabajo.md) |
| Cuentas, acceso, permisos y confianza | [Acceso y cuentas](architecture/auth.md) |
| Navegación y ventanas | [Navegación](architecture/navegacion.md) |
| Preferencias locales | [Preferencias](architecture/preferencias.md) |
| Estructuras de datos e IPC | [Contratos v1](../contracts/v1/) |
| Comandos, pruebas y límites de verificación | [Pruebas](architecture/testing.md) |

Para operar la aplicación, comienza por espacio de trabajo y acceso/cuentas; el catálogo describe las funciones y el plan indica su disponibilidad. Para contribuir, comienza por la guía de desarrollo y la historia solicitada en el plan.

Cada fuente mantiene su propio detalle: el índice orienta, el plan registra trabajo, el catálogo define funciones, arquitectura explica reglas y contratos define estructuras. La evidencia enlazada desde el plan conserva resultados fechados; no constituye otro backlog. El código y sus pruebas acreditan implementación, sin redefinir por sí solos los contratos. El archivo histórico queda fuera de la lectura habitual.
