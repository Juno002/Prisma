
## Fase 6 — motor de períodos

Los períodos se representan como rangos explícitos `{ start, end }`. `periodContaining` acepta un día de inicio configurable; `contains`, `previousComparablePeriod` y `nextPeriod` operan sobre rangos, no sobre claves `YYYY-MM`. Presupuestos y reportes filtran movimientos por estos rangos. Con inicio el día 25, el período esperado es del 25 de agosto al 24 de septiembre.
El motor normaliza timestamps ISO completos al día calendario antes de comparar, para que las migraciones históricas sigan entrando en el período correcto.
