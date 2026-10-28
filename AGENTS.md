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
   - La base de datos y esquemas residen estrictamente en la carpeta compartida sincronizada:
     `%USERPROFILE%\OneDrive - Kawasaki Motores de México S.A. de C.V\ENGINEERING FILES - 10.FAB\Management\Data\`
   - Cero fuga de datos a nubes públicas no autorizadas.
2. **Partición de Escritura Anti-Conflictos (Zero Sync Conflicts):**
   - Ingenieros escriben exclusivamente en `engineers/<username>.json`.
   - Supervisor/Admin gestiona `projects.json` y `team.json`.
   - Incidencias se añaden en modo *append-only* en `issues.json`.
3. **Seguridad y RBAC de 3 Niveles:**
   - Contraseñas protegidas mediante hash criptográfico **Argon2id**.
   - Privilegios sellados con firma digital **HMAC-SHA256** para evitar manipulación manual de roles en JSON.
4. **Single Source of Truth (SSOT) en Contratos:**
   - Todos los esquemas JSON canónicos de datos residen en `contracts/v1/`. Ninguna capa inventa campos en runtime.
5. **Gate 0 de Calidad y Cero Fricción:**
   - Distribución mediante binario único liviano en `Management/Software/easyfab.exe` con instalador rápido `Instalar-EasyFAB.bat`.
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
| **Engineer (Alexa/Antonio)** | Subtareas, hitos (0%-100%), reporte de paros/scrap de piso. | `engineers/<user>.json`, `issues.json` (append) |
