# Evidencia parcial F01 — propuesta D03

> Evidencia o propuesta fechada. Sus pendientes y referencias de método describen ese momento; consultar el plan vigente desde el índice para continuar el desarrollo.

Fecha: 2026-10-28. Entrega documental completada; aceptación de Alan pendiente.

Actualización posterior: Alan autorizó descartar usuarios/datos de prueba y regenerar
el espacio si es necesario. Ya no se requiere migrar esos datos. La entrega de acceso
inicial y prueba de perfiles se registra separadamente en [first-access.md](first-access.md).
No es aceptación completa F00/F01 ni interfaz aceptada para consumidores del DAG.

Se leyeron AGENTS.md, plan maestro, estrategia, roadmap, contrato de misión,
baseline, domain-gaps, arquitectura de espacio/acceso/pruebas y STATUS.
Inspección adicional: engineer_tasks.schema.json, workspace.layout.json,
auth/directory.rs, auth/models.rs y script Gate 0. own_path confirma perfil por
ID en engineers/<id>.json; los contratos aún no modelan adjuntos múltiples.
El árbol tenía cambios previos y archivos sin seguimiento, conservados.

## Verificación ejecutada

| Comando | Resultado |
|---|---|
| npm.cmd test | PASS: 4 frontend, 21 Rust; 0 fallos |
| powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify_contracts.ps1 | PASS: JSON requeridos parseables, TypeScript, cargo check, 4 frontend y 21 Rust |

Cargo informó fallo de hard links en caché incremental y utilizó copias; no hubo
error de compilación. No se añadió lógica ejecutable, por lo que no se agregaron
pruebas nuevas. Los casos futuros están especificados en la propuesta.

Gate 0 actual comprueba existencia/parseo de contratos y compilación/suites; no
demuestra validación completa JSON Schema ni paridad exhaustiva de todos los campos.
Los mocks IPC y pruebas internas no acreditan recorrido nativo de otros roles,
concurrencia OneDrive o una migración que todavía no existe. Se mantiene pendiente
la aceptación nativa ya identificada; no se abrió la aplicación ni se inspeccionaron
credenciales, llave o datos corporativos. No hubo publicación de portable/documentos
en el espacio corporativo ni migración.

## Resultado y decisiones

[Propuesta D03](propuesta-d03.md): perfil preservado por cuenta, evidencia por actividad,
metadatos/identidad, tipos/límites/retención, mantenimiento compatible, checkpoints,
idempotencia y rollback antes/después de nuevas escrituras. Revisión documental:
rutas derivadas del espacio validado, credenciales preservadas, una sola autoridad
activa y dependencias D01/D02/D04/D05 explícitas.

Alan debe aceptar estructura/migración y política de adjuntos, o indicar ajustes.
Hasta entonces D03 sigue pending en roadmap; F01 no está completo. Contratos y
gobernanza vigentes permanecen sin cambios. La estrategia y diagramas no cambian
porque esta entrega no modifica dependencias ni inicia una época del ejecutor.
