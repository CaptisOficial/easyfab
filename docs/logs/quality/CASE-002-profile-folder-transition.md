# CASE-002 — Regresiones detectadas al preparar carpetas

Fecha: 2026-10-28. Detectadas y corregidas con fixtures antes de publicación.

El rollback eliminaba profile.json pero conservaba carpetas vacías por precedencia
de concatenación/coma en un array PowerShell. El siguiente upgrade rechazaba esas
carpetas. Se parentetizaron las expresiones y se agregó secuencia upgrade → rollback
repetido → upgrade en upgrade_profile_layout.Tests.ps1.

La preparación de evidence identificaba layout 2 por nombre de archivo. Una cuenta
legacy cuyo ID fuera profile también se llama profile.json, por lo que ese criterio
era ambiguo. Ahora compara el directorio completo con la partición de la cuenta.
workspace_tests::profile_layout_is_explicit_and_never_falls_back_to_another_profile
verifica que esa cuenta legacy no genere evidence compartida.

Sin cambios corporativos al detectar estos fallos. Pruebas sintéticas, sin cuentas
ni claves reales. Estado: corregido; evidencia final en PLAN-013.
