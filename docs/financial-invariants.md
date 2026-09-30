
## Fase 5 — actual frente a planificado

- Un `Transaction` representa un hecho ocurrido y puede tener clasificación `fixed`, `variable` u `occasional`.
- La clasificación no crea fechas futuras ni replica movimientos.
- Una `RecurringRule` representa una intención futura y no cambia saldos, gasto ni flujo de caja.
- No existe `frequency` dentro de una transacción real.
- La confirmación explícita de una intención será la operación que cree un movimiento real en una fase posterior.
