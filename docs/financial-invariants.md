
## Fase 7 — reglas recurrentes y eventos planificados

Las `RecurringRule` generan `PlannedOccurrence` locales con pareja única `ruleId + scheduledDate`. Las ocurrencias pueden estar `pending`, `confirmed`, `skipped` u `overdue`; solo una ocurrencia confirmada puede enlazar una transacción, y confirmar de nuevo devuelve el mismo enlace sin duplicar el movimiento. Las frecuencias semanales y quincenales avanzan desde la fecha inicial real; las fechas 29–31 se ajustan al último día válido del mes sin perder el día ancla. El día de inicio del período se guarda en la tabla local de ajustes y se aplica al resumen.

## Fase 7 — acciones de eventos planificados

Las ocurrencias pendientes o atrasadas pueden confirmarse o omitirse desde Plan en modo Gestionar. Confirmar ejecuta `confirmOccurrence` dentro de una transacción Dexie y enlaza una única transacción mediante `transactionId`; repetir la acción es idempotente. Omitir ejecuta `skipOccurrence`, no crea movimientos y repetirla conserva el estado omitido.
