# CASE-004 — Unicidad WBS coherente entre alta y lectura

Fecha: 2026-10-28 · Detectado durante revisión de PLAN-014, antes de publicación.

Causa: comparar WBS solo con eq_ignore_ascii_case en alta y con to_lowercase en
lectura permitiría guardar FÁB-01/fáb-01 y luego rechazar el documento por duplicado.
Corrección: alta y lectura comparan texto recortado convertido con to_lowercase.
Regresión: el recorrido Rust aislado registra FÁB-01 y rechaza fáb-01, conservando
el documento legible y los proyectos previos. No se modificaron datos reales.
