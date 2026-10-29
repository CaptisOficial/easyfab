# PLAN-016 · Navegación y catálogo funcional

Estado: complete · 2026-10-29. Alcance documental autorizado por Alan.

P0 Discovery: complete. Arquitectura, matriz, plan maestro y PLAN-015 revisados.
P1 Documentación: complete; depende de P0.
P2 Verificación y cierre: complete; depende de P1.

write_surfaces: este plan; STATUS.md; docs/architecture/navegacion.md;
docs/product/catalogo-modulos.md; docs/product/capabilities-matrix.md;
docs/product/plan-maestro.md; AGENTS.md.

No cambia código, contratos, permisos ni portable. Conserva cambios previos.
Validación: enlaces locales, npm test y Gate 0. No requiere nuevas pruebas de
comportamiento porque no introduce lógica ejecutable.

Resultado: estándar de navegación y catálogo publicados en el repositorio;
enlaces desde AGENTS, matriz y plan maestro. Implementación del lateral pendiente.
npm test aprobado: 25 frontend y 29 Rust. Gate 0 aprobado con PowerShell 7:
contratos, TypeScript, cargo check, ambas suites y pruebas PowerShell de layout.
Enlaces locales y git diff --check aprobados. El intento inicial con Windows
PowerShell 5 falló al interpretar UTF-8 del script existente; no se modificó el
script, la ejecución con PowerShell 7 terminó correctamente.
