# Reportes — composición editorial premium

**Fecha:** 2026-10-06  
**Base:** Prisma `83290c4`  
**Referencia visual:** `Juno002/Glitchbudget-pro@6369dcf`, composición de Reportes

## Alcance

Se inicia la etapa editorial premium de Reportes sin cambiar el dominio, Dexie, el motor de períodos, los cálculos financieros ni el contrato de backups.

## Implementación

- Hero de gasto con jerarquía editorial, período, cantidad de movimientos y comparación con el período anterior.
- Gráfico de intensidad de gasto con seis columnas basadas en movimientos reales del período.
- Barras con entrada escalonada y énfasis visual en la ventana actual.
- Donut de categorías generado dinámicamente con `conic-gradient` según porcentajes reales.
- Panel de lectura local con copy contextual y métricas de movimientos, metas y promedio.
- Banda comparativa final para contextualizar el gasto actual contra el período anterior.
- Responsive móvil: hero apilado, evidencia en una columna y comparación adaptable.

## Microanimaciones

- Entrada escalonada de hero, evidencia y comparación entre 40 y 220 ms.
- Crecimiento vertical de barras con easing editorial `cubic-bezier(.23,1,.32,1)`.
- Hover sutil del donut mediante rotación y escala, sin animar layout.
- Decoración ambiental de bajo contraste en el hero y panel de lectura.
- `prefers-reduced-motion` conserva el bloqueo global existente de animaciones y transiciones.

## Revisión de riesgos

- No se introducen llamadas de red, dependencias ni datos ficticios.
- Las categorías sin gasto no se muestran en el donut.
- Cuando no existe un período anterior, la comparación muestra una base pendiente en lugar de inventar un porcentaje.
- La gráfica se limita al período activo y no modifica los selectores del ledger.
- Se conserva la legibilidad móvil y el contraste de los valores principales.

## Gate de validación

- `pnpm run check` ✅
- `pnpm run test` — 27 pruebas ✅
- `pnpm run audit:static` — 88 archivos ✅
- `pnpm run build` ✅
- `git diff --check` ✅
- Smoke visual en preview: escritorio y móvil ✅

Este checkpoint no cierra una nueva fase de motor; registra el inicio de la capa editorial premium posterior a la integración funcional.
