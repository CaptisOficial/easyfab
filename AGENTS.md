# AGENTS.md - Manifiesto Rector de Gobernanza: EasyFAB

> Marco canónico de ingeniería, invariantes y gobernanza operacional bajo estándar Captis para EasyFAB.

---

## 1. Misión y Objetivo General del Sistema

**EasyFAB** es un Sistema Operativo de Ingeniería de Escritorio Nativo (**Tauri v2 + Rust + React 19 + TypeScript**) concebido para el área de **Fabrication (10.FAB)** de **Kawasaki Motores de México**.

### Objetivo General:
Automatizar, blindar y simplificar la captura, consolidación y reporte de avances de proyectos de ingeniería, actividades diarias, incidencias de piso (downtime y scrap) y balance de capacidad del equipo, **eliminando la fragmentación y el llenado manual de hojas Excel descentralizadas**, garantizando una arquitectura **100% Local-First sobre OneDrive Corporativo (Zero External Cloud)** y respetando la identidad y estándares de clase mundial de Kawasaki Motors.

---

## 2. Invariantes Canónicos de EasyFAB (Reglas No Negociables)

1. **Local-First sobre OneDrive Corporativo:**
   - La raíz compartida corporativa es configurable; valor inicial: `%USERPROFILE%\OneDrive - Kawasaki Motores de México S.A. de C.V\ENGINEERING FILES - 10.FAB\`.
   - La carpeta compartida seleccionada y validada en Configuración es la autoridad de ubicación, cualquiera que sea su nombre o ruta absoluta accesible y autorizada por la empresa. La ruta inicial de OneDrive es solo una propuesta; no es obligatoria ni sustituye una configuración guardada. Todos los módulos deben resolver sus rutas desde ese mismo espacio activo. Si no está disponible, se bloquea el acceso sin recurrir a otra carpeta.
   - Todo el espacio del sistema reside en `<raíz>/easy-fab/`, con datos en `data/`, documentación en `docs/`, contratos publicados en `contracts/v1/` y portable en `software/easyfab.exe`. Nombres relativos canónicos: `contracts/v1/workspace.layout.json`.
   - En `%LOCALAPPDATA%/EasyFAB` residen la referencia de ubicación (`installation.json`), la llave de confianza (`master.key`) y las preferencias locales de aplicación y usuario. Las preferencias personales se separan por ID de espacio e ID de usuario EasyFAB; nunca determinan identidad ni permisos. Usuarios, roles, credenciales protegidas, configuración general, datos y avances permanecen en la carpeta compartida configurada. Nunca sincronizar la llave ni guardar contraseñas en claro. La persistencia de preferencias es una decisión de arquitectura pendiente de implementación y contrato canónico.
   - Cero fuga de datos a nubes públicas no autorizadas.
2. **Partición de Escritura Anti-Conflictos (Zero Sync Conflicts):**
   - Cada cuenta escribe exclusivamente en su partición: layout 2 `engineers/<id-easyfab>/profile.json` y `engineers/<id-easyfab>/evidence/`. Espacios anteriores conservan layout 1 `engineers/<id-easyfab>.json` hasta mantenimiento explícito. El manifiesto selecciona una sola versión; nunca buscar el otro perfil como fallback. Supervisor/Admin tampoco escriben perfiles ajenos en operación normal.
   - Supervisor/Admin gestiona `projects.json`; solo Admin gestiona `team.json`.
   - Incidencias se añaden en modo *append-only* en `issues.json`.
3. **Seguridad y RBAC de 3 Niveles:**
   - Contraseñas protegidas mediante hash criptográfico **Argon2id**.
   - Privilegios sellados con firma digital **HMAC-SHA256** para evitar manipulación manual de roles en JSON.
4. **Single Source of Truth (SSOT) en Contratos:**
   - Todos los esquemas JSON canónicos de datos residen en `contracts/v1/`. Ninguna capa inventa campos en runtime.
5. **Gate 0 de Calidad y Cero Fricción:**
   - Distribución mediante binario portable único en `<raíz>/easy-fab/software/easyfab.exe`. La carpeta se resuelve desde el portable o la referencia local; no requiere instalar Node/Rust.
   - Verificación automatizada de paridad de contratos mediante `scripts/verify_contracts.ps1`.

---

## 3. Estructura de Gobernanza en el Repositorio (`C:\Dev\easyfab`)

```text
C:\Dev\easyfab/
├── AGENTS.md                          # Este manifiesto rector y mapa de autoridad
├── contracts/                         # Esquemas JSON v1 canónicos (SSOT)
│   └── v1/
│       ├── team.schema.json
│       ├── projects.schema.json
│       ├── engineer_tasks.schema.json
│       ├── issues.schema.json
│       └── config_plant.schema.json
├── docs/
│   ├── architecture/                  # Glosario, invariantes y decisiones técnicas
│   │   ├── glosario-canonico.md
│   │   └── invariantes-arquitectura.md
│   ├── archive/plans/                 # Histórico y planes de ejecución FSM/DAG
│   │   └── STATUS.md                  # Matriz de estado de planes
│   └── product/                       # Objetivos, KPIs y matriz de capacidades
│       └── capabilities-matrix.md
├── scripts/
│   └── verify_contracts.ps1           # Verificación Gate 0
├── src/                               # Frontend React 19 + TypeScript + Tailwind CSS v4
└── src-tauri/                         # Backend Rust + Tauri v2
```

---

## 4. Mapa de Autoridades y Roles de Agentes / Ingenieros

| Rol | Autoridad Principal | Archivos Autorizados |
|---|---|---|
| **Admin (Alan)** | Gobernanza de contratos, directorio de usuarios, catálogos maestros y llaves HMAC. | `team.json`, `config_plant.json`, `contracts/v1/*` |
| **Supervisor (FAB)** | Creación y balance de Macro Proyectos, compuertas DoD 100%, exportación KMX-FW. | `projects.json`, reportes ejecutivos |
| **Engineer (Alexa/Antonio)** | Subtareas, hitos (0%-100%), reporte de paros/scrap de piso. | Partición `engineers/<id>/` (layout 2; `<id>.json` solo legacy 1), `issues.json` (append) |

## 5. Pruebas desde la primera implementación

- Toda lógica nueva o modificada debe incorporar pruebas de comportamiento relevantes en la misma entrega. Toda corrección de bug debe incluir una regresión.
- Rust usa `cargo test` y `#[test]`, con módulos `#[cfg(test)]` próximos al código. No exponer API privada solo para probarla.
- Frontend usa Vitest con archivos `src/**/*.test.ts` o `.test.tsx`. Probar reglas, errores y contratos IPC; para componentes usar un entorno DOM cuando se incorpore esa suite.
- Ejecutar `npm test` y `scripts/verify_contracts.ps1` antes de cerrar una entrega. Gate 0 debe fallar si falla cualquier suite.
- Usar datos sintéticos y directorios temporales aislados; las pruebas nunca escriben datos corporativos en OneDrive ni usan credenciales reales.
- Distinguir pruebas unitarias, integración y validación nativa. Un mock IPC no verifica RBAC del backend ni sustituye una prueba nativa.
- Organización, límites y comandos canónicos: [docs/architecture/testing.md](docs/architecture/testing.md).

## Espacio e instanciación

Arquitectura canónica: [espacio de trabajo](docs/architecture/espacio-de-trabajo.md). Antes del acceso se selecciona y valida el espacio. Una ubicación guardada no disponible falla explícitamente; no crear fuentes de datos alternativas. El usuario EasyFAB es independiente de Windows. Las escrituras se particionan por la sesión autenticada. Cambiar raíz exige cerrar sesión y no migra datos implícitamente.
