# Prisma — Invariantes financieras

## Dinero

- Todo importe persistido se almacena como un entero en centavos.
- La UI puede presentar unidades mayores, pero no cambia la unidad persistida.
- No se usa `float` como representación almacenada de dinero.

## Ledger

- Un ingreso aumenta la cuenta elegida y cuenta como ingreso.
- Un gasto con efectivo o banco reduce esa cuenta y cuenta como gasto.
- Una compra con tarjeta aumenta el gasto y el pasivo; no reduce efectivo.
- Un pago de tarjeta reduce una cuenta y un pasivo; no vuelve a contar como gasto.
- Una transferencia reduce una cuenta y aumenta otra; no es ingreso ni gasto y no cambia el patrimonio.
- Un presupuesto no mueve dinero.
- Un pago planificado no mueve dinero hasta confirmarse.
- Una meta es seguimiento o reserva; no cambia el patrimonio por sí sola.
- Una inversión financiada desde una cuenta mueve patrimonio líquido a patrimonio invertido; no es gasto.
- Un rendimiento proyectado es una estimación y no se convierte automáticamente en patrimonio real.

## Migraciones y backups

- Las migraciones son explícitas y versionadas.
- Nunca se borra la base para migrar.
- Los IDs históricos se conservan.
- Los backups v4 declaran `moneyUnit: "cents"`.
- Un round-trip válido es: exportar → borrar DB de prueba → importar → comparar datos y métricas derivadas.
- La primera transición desde la UI inicial conserva los movimientos de `localStorage` y convierte sus importes visibles a centavos.

## Métricas

- `liquidPosition`: cuentas de efectivo y banco.
- `netWorth`: activos menos pasivos.
- `spending`: gastos realizados, incluidos los hechos con crédito.
- `cashFlow`: ingresos en efectivo menos gastos en efectivo menos pagos de deuda.
- `availableToPlan`: concepto de planificación; no equivale al saldo bancario.

## Fase 3 — comandos y políticas

Las mutaciones financieras pasan por comandos explícitos (`createIncome`, `createExpense`, `createTransfer`, `createDebtPayment`, `updateTransaction` y `deleteTransaction`). La UI no escribe directamente en Dexie.

Las políticas son independientes:

- `preventNegativeAccountBalance`: puede bloquear una operación que deje una cuenta líquida por debajo de cero.
- `budgetOverspendingBehavior`: puede permitir, advertir o bloquear un gasto que supere el presupuesto vigente.

Una advertencia de presupuesto no altera el ledger ni convierte el gasto en una operación distinta; solo informa al usuario. Archivar cuentas y categorías conserva sus IDs y referencias históricas.
