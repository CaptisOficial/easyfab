# Contrato de preferencias · aceptación y checkpoint

> Evidencia o propuesta fechada. Sus pendientes y referencias de método describen ese momento; consultar el plan vigente desde el índice para continuar el desarrollo.

2026-10-29 · subalcance F01/F03 autorizado al continuar la historia recomendada.
Objetivo: contrato personal local verificable antes de consumidores; sin UI,
persistencia, IPC, publicación ni cambios a datos corporativos.

Secuencia: autoridades/baseline → ficha CFG-03 → esquema/política → tests → ce_gate
del incremento. Un coordinador, sin especialistas ni JSON de estrategia ceremonial.

## Resultado

- contracts/v1/user_preferences.schema.json: versión, pertenencia espacio/usuario,
  tema y tamaño cerrados; defaults conservan interfaz actual. Sin campos arbitrarios.
- docs/architecture/preferencias.md: ruta local por par, user_key hexadecimal,
  validación de propietario por sesión, defaults, errores y reset selectivo.
- scripts/test_preferences_contract.ps1: 48 casos sintéticos y defaults con Test-Json
  real de PowerShell 7; npm test y Gate 0 incluyen esa suite.
- Catálogo, plan maestro, espacio, AGENTS y testing enlazan la autoridad nueva.

SSOT: solo el esquema define valores/defaults. No hay tipos Rust/TypeScript ni
persistencia paralelos que certificar; los futuros consumidores deben demostrar
paridad. Versiones/propiedades desconocidas se rechazan estructuralmente. La
pertenencia a sesión/espacio es validación semántica futura, no garantía del esquema.

Regresión detectada al construir el contrato: ancla $ admite salto de línea final
en el validador. El contrato usa fin absoluto mediante negative lookahead; prueba
user_id con salto de línea exige rechazo. No se modifica auth.schema.json existente.

HSS: evita agregar preferencias a installation.json o datos operativos; no hay
campos recapturados ni ahorro medido, todavía no existe consumidor. Filtros quedan
fuera hasta definir necesidad concreta. Capacidad/manpower D05 intacta.
Diseño: sin cambio visual ni consulta nueva de catálogo; se mantiene el bloqueo de
hashes documentado en navigation-acceptance.md y no se aplican candidatos sin validar.

## Verificación

Baseline npm test: 30 frontend y 29 Rust aprobados. Suite nueva: 48 casos aprobados.
npm test final aprobado: 48 casos del contrato, 30 frontend y 29 Rust.
Gate 0 final con PowerShell 7 aprobado: contratos, TypeScript, cargo check,
48 casos del contrato, 30 frontend, 29 Rust y pruebas de layout/rollback. git diff --check aprobado.
No se acredita persistencia, aislamiento real, reset, IPC, apariencia ni WebView.

## Continuidad

Archivos: esquema, test PowerShell, package.json, verify_contracts.ps1; AGENTS,
espacio, preferencias, testing, catálogo, plan maestro y esta evidencia.
Cambios previos conservados; no se modifica roadmap/DAG ni se cierran F01/F03/D04.
Siguiente historia: persistencia Rust aislada y comandos delgados con pruebas reales
de sesión/espacio/recuperación según la política, antes de controles visuales.
Bloqueos de esta entrega: ninguno; falta el consumidor y su validación en la siguiente.
