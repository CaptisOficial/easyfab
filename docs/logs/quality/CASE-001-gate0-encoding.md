# CASE-001 — Gate 0 en Windows PowerShell

Estado: corregido, validación final pendiente.
Causa: script UTF-8 sin BOM con caracteres interpretados como Windows-1252 por Windows PowerShell 5.1; el parser no llegaba a ejecutar comprobaciones.
Corrección: conservar contenido y guardar UTF-8 con BOM.
Regresión: ejecutar exactamente `powershell -ExecutionPolicy Bypass -File scripts/verify_contracts.ps1`.
