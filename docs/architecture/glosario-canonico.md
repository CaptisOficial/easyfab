# Glosario Canónico - EasyFAB

Fecha: 2026-10-28
Área: Fabrication Shop (10.FAB) - Kawasaki Motores de México

---

## Términos Operacionales y de Negocio

- **10.FAB (Fabrication Shop):** Taller de fabricación de chasis, componentes tubulares y partes estructurales de motocicletas y vehículos de recreación en Kawasaki Motores de México.
- **KMX-FW:** Kawasaki Motors México - Fabrication Weekly. Formato y estándar oficial de reporte semanal de avance de proyectos y seguimiento de planta.
- **DoD (Definition of Done):** Criterio explícito de aceptación que debe cumplirse para que una tarea o hito se declare completado. En EasyFAB se estructura en 5 compuertas (0%, 25%, 50%, 75%, 100%).
- **Gatekeeper (Compuerta DoD):** Proceso de validación formal en el que el Supervisor autoriza el cierre del hito al 100%, requiriendo típicamente la referencia a un estándar operativo liberado (OS / WI).
- **Variance (Varianza):** Diferencia matemática entre el avance real reportado y el avance planeado según el cronograma: $\text{Variance} = \text{Actual \%} - \text{Planned \%}$.
- **Downtime:** Tiempo de paro no programado en línea o celda de manufactura, registrado en horas con impacto trazable.
- **Scrap:** Piezas defectuosas desechadas en proceso de fabricación (piezas cortadas por láser, dobleces fuera de tolerancia, etc.).

## Términos de Arquitectura y Software

- **Local-First:** Patrón arquitectónico donde la aplicación ejecuta y almacena todos sus datos localmente de forma autónoma, sin depender de servidores o conexiones de red externas en tiempo real.
- **Anti-Tampering:** Mecanismos de seguridad criptográfica (Argon2id + HMAC-SHA256) diseñados para prevenir la falsificación de roles o credenciales mediante edición manual directa de archivos JSON.
- **Append-Only:** Modo de registro donde nuevos elementos son agregados con UUIDs únicos sin modificar ni sobrescribir registros previos, evitando colisiones de sincronización en OneDrive.
- **Gate 0:** Compuerta automatizada previa a cualquier entrega o compilación que valida integridad de tipos, paridad de contratos y salud de compilación.

- **Usuario EasyFAB:** Identidad propia del sistema (ID, nombre, rol y contraseña), independiente de Windows. El ID identifica también la partición engineers/<id-easyfab>.json.
