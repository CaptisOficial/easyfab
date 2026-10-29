# Pruebas de EasyFAB

Las pruebas se incorporan con cada comportamiento desde su implementación inicial.

## Equivalencia con CTest

`cargo test` compila, descubre y ejecuta las pruebas Rust mediante el harness integrado
`libtest`. Cumple el papel de ejecución de CTest sin registrar cada caso en CMake.
`#[test]` declara un caso; `#[cfg(test)] mod tests` mantiene el código de pruebas fuera
del binario de producción. No se requiere un framework adicional.

## Organización

| Capa | Ubicación | Ejecución |
|---|---|---|
| Rust: reglas, permisos, criptografía | Módulo `#[cfg(test)]` junto al código; archivos hermanos si crece | `npm run test:rust` |
| Rust: persistencia con fixtures locales | Módulos existentes de auth, bootstrap y workspace | `npm run test:rust` |
| Frontend: lógica y adaptador IPC | `src/**/*.test.ts` | `npm run test:frontend` |
| React: comportamiento de componentes, cuando se implementen | `src/**/*.test.tsx`, entorno DOM y Testing Library al necesitarlos | Vitest |
| Integración pública Rust, cuando exista API pública que verificar | `src-tauri/tests/*.rs` | `cargo test --manifest-path src-tauri/Cargo.toml` |

Los módulos Rust actuales son privados: conservar sus pruebas internas evita publicar
funciones únicamente para poder probarlas. Las pruebas de persistencia son integración
por alcance aunque estén alojadas en módulos internos.

## Comandos desde la raíz

```powershell
npm test
npm run test:watch
npm run test:rust -- auth
cargo test --manifest-path src-tauri/Cargo.toml -- --list
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify_contracts.ps1
```

`npm test` ejecuta contratos de preferencias (PowerShell 7), frontend y Rust, deteniéndose si una suite falla. Gate 0 verifica
contratos y compilación y después ejecuta ambas suites. Cargo debe estar en PATH
o en `%USERPROFILE%/.cargo/bin`; el script de pruebas admite ambas instalaciones.

## Reglas

- Verificar resultados observables, errores y límites de autorización; cada bug corregido lleva regresión.
- Usar rutas temporales únicas y datos sintéticos. Nunca escribir en OneDrive corporativo ni usar claves, cuentas o PIN reales.
- Aislar únicamente fronteras externas: IPC, reloj o sistema operativo cuando haga falta. No simular la lógica bajo prueba.
- Los mocks IPC comprueban el adaptador frontend; no demuestran autorización Rust ni ejecución nativa.
- Mantener los comandos Tauri delgados y probar la lógica en Rust sin abrir WebView.
- Añadir pruebas de IPC con runtime de prueba Tauri cuando se cambie el registro o comportamiento de comandos. PLAN-014 incorpora estas pruebas para proyectos; el resto de comandos mantiene su cobertura anterior.
- Una prueba nativa de extremo a extremo requiere la aplicación y WebView; se verifica por separado antes de distribuir.
- No declarar cobertura total ni un porcentaje mínimo sin medición. La prioridad son RBAC, integridad, persistencia y regresiones.

Referencias: [Cargo](https://doc.rust-lang.org/cargo/commands/cargo-test.html),
[organización Rust](https://doc.rust-lang.org/book/ch11-03-test-organization.html),
[pruebas Tauri](https://v2.tauri.app/develop/tests/),
[Vitest](https://vitest.dev/guide/).

## Recorrido inicial (PLAN-012)

`Login.test.tsx` usa jsdom y Testing Library: alta inicial, acceso restringido,
cambio de contraseña, directorio Admin, alta de ingeniero y reingreso personal;
también errores al leer directorio y guardar contraseña. Es una prueba UI con IPC
simulado, no una prueba nativa de permisos.

`auth/onboarding_tests.rs` ejecuta el recorrido real de almacenamiento y credenciales
en un proceso hijo con LOCALAPPDATA sintético. No cambia variables globales del
proceso padre. Incluye Admin, Engineer/Supervisor, denegación administrativa,
contraseña inválida, temporal reemplazada y preservación de perfiles/llave.
La suite cuenta el caso padre y el punto de entrada del proceso hijo como dos tests.

`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/prepare_first_access.Tests.ps1`
comprueba preparación de piloto, respaldo, retiro de perfiles de prueba, conservación
de referencia/llave/proyectos y rechazo de identidad incorrecta. Usa fixture descartable
en src-tauri/target. Este comando es adicional a npm test/Gate 0.

## Proyectos mínimos (PLAN-014)

`projects/tests.rs` prueba persistencia y RBAC reales con un proceso hijo aislado;
`Projects.test.tsx` y los casos adicionales de Login usan jsdom/IPC simulado.
`project_commands.rs` usa Tauri MockRuntime con el mismo registro que producción
para probar comandos y payload; no equivale a WebView nativo. El feature `test` de
Tauri es dependencia de desarrollo. El recorrido usa cuatro cuentas sintéticas y el comando real de alta Supervisor. Admin consulta, Engineer no opera proyectos y las sesiones restringidas son rechazadas. La UI también recorre Admin crea Supervisor, cambio obligatorio, alta y nuevo acceso. No hay autorización por equipo ni bypass privado para guardar. Ver [estado del recorrido](../product/execution/f04/acceptance.md).

## Barra superior y configuración (PLAN-015)

WorkspaceSetup.test.tsx usa jsdom e IPC simulado para comprobar panel flotante,
conservación de captura al abrirlo, cierre por Escape/clic exterior, foco, carpeta
activa frente a sugerencia, configuración inicial, error/cancelación y bloqueo
con sesión. Verifica usuario/salida en topnav contra el flujo real de Login
(manteniendo simulado el transporte IPC). TopNav.test.tsx comprueba la fecha de
America/Mexico_City y su actualización al pasar medianoche. Ninguno abre WebView
ni modifica la carpeta corporativa; backend y reglas de espacio no cambian.

## Navegación contextual

WorkspaceMenu.test.tsx prueba cierre, foco circular/restaurado, fondo inert,
selección y destino activo. WorkspaceSetup.test.tsx recorre Admin y Supervisor,
ubicación de Usuarios, foco al navegar y borrador real de alta de proyecto conservado
al visitar Configuración. Son pruebas DOM/IPC simulado; no acreditan WebView nativo.
Ver [evidencia del incremento](../product/execution/navigation-acceptance.md).

## Contrato de preferencias (F01/F03)

`npm run test:contracts` requiere `pwsh` (PowerShell 7) y usa Test-Json contra el
JSON Schema canónico: 48 documentos sintéticos válidos/inválidos y defaults.
Está integrado en npm test y Gate 0. No instala validadores ni toca archivos de
usuarios. Es validación estructural, no prueba de identidad, persistencia, IPC ni
autorización. Las pruebas de aislamiento/reset siguen pendientes del consumidor.
