
## Fase 7 — reglas recurrentes y eventos planificados

Las `RecurringRule` generan `PlannedOccurrence` locales con pareja única `ruleId + scheduledDate`. Las ocurrencias pueden estar `pending`, `confirmed`, `skipped` u `overdue`; solo una ocurrencia confirmada puede enlazar una transacción, y confirmar de nuevo devuelve el mismo enlace sin duplicar el movimiento. Las frecuencias semanales y quincenales avanzan desde la fecha inicial real; las fechas 29–31 se ajustan al último día válido del mes sin perder el día ancla. El día de inicio del período se guarda en la tabla local de ajustes y se aplica al resumen.
