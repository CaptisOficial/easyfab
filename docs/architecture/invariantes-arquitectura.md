# Invariantes de Arquitectura - EasyFAB

> Reglas técnicas maestras que rigen el diseño y la implementación de EasyFAB.

---

## 1. Topología de Datos (Zero-Conflict OneDrive Synchronization)

Para eliminar colisiones causadas por el motor de sincronización de OneDrive:
1. **Dominio de Usuario Exclusivo:** Cada ingeniero escribe única y exclusivamente en `engineers/<username>.json`. Ningún usuario abre en modo de escritura el archivo de otro ingeniero.
2. **Append-Only de Incidencias:** El archivo `issues.json` se manipula mediante adiciones acíclicas con identificadores únicos (`ISS-YYYY-XXXX`).
3. **Ruta Absoluta Resuelta en Rust:** El frontend de React jamás calcula ni asume rutas de disco. La resolución de rutas vive en el backend de Rust mediante inspección de variables de entorno y claves del registro de Windows (`HKCU\Software\Microsoft\OneDrive`).

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
