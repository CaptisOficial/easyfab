# Invariantes de Arquitectura - EasyFAB

> Reglas técnicas maestras que rigen el diseño y la implementación de EasyFAB.

---

## 1. Topología de Datos (Zero-Conflict OneDrive Synchronization)

Para eliminar colisiones causadas por el motor de sincronización de OneDrive:
1. **Dominio de Usuario Exclusivo:** Layout 2 usa `engineers/<id-easyfab>/profile.json` y prepara `evidence/` dentro de la misma partición. Layout 1 conserva `<id>.json` hasta cambio explícito. El manifiesto es la autoridad de versión, sin fallback por existencia de archivos. El propietario se determina por la sesión EasyFAB autenticada, independiente de Windows; ningún rol escribe perfiles ajenos en operación normal. La partición no elimina conflictos de una misma cuenta en varios equipos. PLAN-013 no habilita todavía subida de evidencias.
2. **Append-Only de Incidencias:** El archivo `issues.json` se manipula mediante adiciones acíclicas con identificadores únicos (`ISS-YYYY-XXXX`).
3. **Ruta Absoluta Resuelta en Rust:** El frontend de React jamás calcula ni asume rutas de disco. Rust resuelve todas las rutas desde la carpeta compartida configurada y el espacio activo validado. La referencia local guardada tiene prioridad sobre la ubicación del portable; la detección de OneDrive solo propone una carpeta cuando no hay configuración. Ningún módulo puede imponer una ruta corporativa fija ni reemplazar una configuración no disponible.

---

## 2. Seguridad y Firma Criptográfica (RBAC)

1. **Argon2id para Secretos:**
   - Todo PIN o credencial se procesa con `Argon2id` con salt criptográficamente seguro.
   - Prohibido almacenar contraseñas en texto claro en `team.json`.
2. **Firma Digital de Roles:**
   - `role_signature = HMAC_SHA256(user_id + ":" + role + ":" + status, admin_master_key)`.
   - Si un usuario edita manualmente su rol en el archivo `team.json`, la firma no coincidirá en el arranque y la sesión se degradará a modo no autenticado.

---

## 3. Contratos Canónicos y Tipado Estricto

1. **Validación de Esquema:** Los esquemas JSON en `contracts/v1/` definen el estándar de datos.
2. **Tipos en Frontend y Backend:** Las interfaces TypeScript y las estructuras de `serde` en Rust deben mapear 1:1 los esquemas canónicos.

## 4. Espacio configurable

Toda ruta de datos depende del espacio activo validado por ID, con layout canónico en contracts/v1/workspace.layout.json. Datos operativos: <raíz>/easy-fab/data. Portable: <raíz>/easy-fab/software/easyfab.exe. Referencia absoluta y llave solo en la instalación local. Ver [mapa y estados](espacio-de-trabajo.md). No reemplazar silenciosamente una referencia no disponible por otro directorio vacío.

## 5. Separación de configuración local y compartida

La referencia del espacio, la llave de confianza y las preferencias de aplicación/usuario pertenecen a `%LOCALAPPDATA%/EasyFAB`. Las preferencias personales se aíslan por ID de espacio e ID de usuario EasyFAB y no tienen autoridad sobre autenticación ni RBAC. La sesión permanece en memoria. Identidad, roles, credenciales protegidas, configuración general de planta, proyectos y avances pertenecen al espacio compartido configurado. Restablecer preferencias no modifica referencia, llave ni datos compartidos. La persistencia de preferencias requiere contrato canónico y pruebas antes de implementarse; ver [decisión y alcance](espacio-de-trabajo.md#decisión-configuración-local-y-datos-compartidos).
