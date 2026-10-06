# Prisma — Roadmap técnico ejecutable desde cero

> Documento derivado exclusivamente del roadmap proporcionado. No presupone un repositorio, framework ni implementación previa.

## 1. Producto y límites

Prisma será una aplicación financiera personal **local-first**, **offline-capable** y orientada a la privacidad.

### Objetivo

Permitir administrar localmente:

- cuentas y saldos;
- ingresos, gastos y transferencias;
- tarjetas y pasivos;
- presupuestos;
- pagos planificados y recurrencias;
- metas;
- inversiones;
- reportes y análisis.

### Límites obligatorios

No se debe implementar:

- cuentas de usuario;
- backend de aplicación;
- sincronización bancaria o cloud;
- IA remota;
- analítica, publicidad o telemetría financiera;
- APIs financieras remotas;
- cotizaciones o tipos de cambio automáticos desde Internet;
- Web Push dependiente de servidor;
- colaboración o cuentas compartidas.

La red puede utilizarse únicamente para distribuir archivos estáticos de la PWA, nunca para transmitir datos financieros.

---

## 2. Principios de arquitectura

```text
UI
  ↓
Application services / commands
  ↓
Domain calculations / selectors
  ↓
Dexie / local persistence
```

### Reglas de dependencia

- La UI no contiene reglas financieras.
- La UI no accede directamente a Dexie.
- Dexie no realiza cálculos financieros.
- El dominio no depende de React, navegador ni red.
- Los cálculos financieros deben ser funciones puras y testeables.
- Las migraciones de datos son explícitas y nunca deben resetear la base.
- El código debe evolucionar gradualmente; no se debe hacer un rewrite total.

### Estructura inicial sugerida

```text
src/
  domain/
    money.ts
    dates.ts
    ledger.ts
    accounts.ts
    liabilities.ts
    periods.ts
    budgets.ts
    goals.ts
    recurrence.ts
    investments.ts
    reports.ts
  application/
    commands/
    queries/
    services/
  persistence/
    db.ts
    migrations/
    repositories/
    backup.ts
  ui/
    components/
    screens/
    navigation/
  tests/
    domain/
    application/
    persistence/
```

Los nombres pueden cambiar; la separación de responsabilidades no.

---

## 3. Invariantes financieras canónicas

Estas reglas deben documentarse y probarse antes de ampliar funcionalidades.

| Operación | Efecto contable | Clasificación |
|---|---|---|
| Ingreso | Aumenta la cuenta | Ingreso |
| Gasto con efectivo/banco | Reduce la cuenta | Gasto |
| Compra con tarjeta | Aumenta el pasivo; no reduce efectivo | Gasto |
| Pago de tarjeta | Reduce cuenta y pasivo; no crea gasto | Pago de deuda |
| Transferencia | Reduce una cuenta y aumenta otra | Ni ingreso ni gasto |
| Presupuesto | No mueve dinero | Planificación |
| Pago planificado | No mueve dinero hasta confirmarse | Planificación |
| Meta | No altera patrimonio por sí sola | Reserva/seguimiento |
| Inversión desde una cuenta | Mueve patrimonio líquido a invertido | No es gasto |
| Rendimiento proyectado | Es estimación | No es patrimonio real automático |

Todos los importes monetarios almacenados deben ser enteros en unidades mínimas, actualmente centavos. No se almacenan importes monetarios como `float`.

---

## 4. Modelo conceptual mínimo

### Entidades principales

```ts
type Money = number // entero en centavos

type Account = {
  id: string
  name: string
  kind: 'cash' | 'bank' | 'credit'
  archived: boolean
}

type Category = {
  id: string
  name: string
  type: 'income' | 'expense' | 'both'
  icon?: string
  archived: boolean
}

type Transaction = {
  id: string
  date: string
  amount: Money
  kind: 'income' | 'expense' | 'transfer' | 'debt-payment' | 'investment'
  accountId?: string
  destinationAccountId?: string
  categoryId?: string
  liabilityId?: string
  note?: string
}

type RecurringRule = {
  id: string
  direction: 'income' | 'expense' | 'transfer' | 'debt-payment'
  title: string
  amount: Money
  categoryId?: string
  defaultAccountId?: string
  cadence: 'weekly' | 'biweekly' | 'monthly' | 'yearly'
  startDate: string
  endDate?: string
  active: boolean
}

type PlannedOccurrence = {
  id: string
  ruleId: string
  scheduledDate: string
  status: 'pending' | 'confirmed' | 'skipped'
  transactionId?: string
}
```

La combinación `ruleId + scheduledDate` debe ser única. Confirmar dos veces una ocurrencia debe ser imposible.

Las entidades históricas deben archivarse, cerrarse o desactivarse en vez de eliminarse destructivamente cuando existan referencias.

---

## 5. Métricas que no deben confundirse

No utilizar una propiedad ambigua llamada simplemente `balance` para representar conceptos distintos.

### Liquid position

```text
cash + bank accounts
```

### Net worth

```text
assets - liabilities
```

### Spending

Compras y gastos realizados, incluidos los hechos con crédito.

### Cash flow

```text
cash income
- cash expenses
- debt payments
```

Las transferencias quedan fuera.

### Available to plan

```text
income/capacity
- commitments
- reserved budget
- goal allocations
```

No equivale al saldo bancario.

---

## 6. Roadmap por fases y puertas de control

### Fase 0 — Línea base segura

**Objetivo:** crear una base verificable antes de agregar funciones.

Entregables:

- commit o tag de la línea base;
- typecheck, lint, tests y build verdes;
- fixtures de bases antiguas;
- fixture compatible con backup JSON v4;
- prueba de round-trip: exportar, borrar la DB de prueba, importar y comparar datos y saldos derivados;
- documentación y pruebas de invariantes.

**Gate 0:** `npm run check`, build, restauración de backup v4 y equivalencia de saldos.

### Fase 1 — Eliminar IA y runtime remoto

**Objetivo:** convertir la aplicación en una PWA estática sin transmisión de datos financieros.

Tareas:

- eliminar rutas de IA y estados asociados;
- eliminar variables de entorno, prompts, llamadas, documentación y dependencias sin uso;
- evaluar `output: 'export'`;
- adaptar PWA y precache al output estático;
- eliminar dependencia de runtime Next de servidor cuando corresponda;
- auditar `fetch`, XHR, WebSocket, EventSource, `sendBeacon`, URLs remotas, analytics y SDKs;
- eliminar `remotePatterns` no utilizados;
- agregar un check de CI que bloquee endpoints, APIs o analytics accidentales.

**Gate 1:** crear, editar y borrar movimientos; crear cuentas, transferencias, presupuestos y metas; hacer backup y consultar reportes sin transmitir datos del usuario.

### Fase 2 — Núcleo financiero canónico

**Objetivo:** centralizar cálculos y evitar números contradictorios entre pantallas.

Tareas:

- implementar módulos puros de dinero, fechas, ledger, cuentas, pasivos, períodos, presupuestos, metas, recurrencias, inversiones y reportes;
- definir selectores para `liquidPosition`, `netWorth`, `spending`, `cashFlow` y `availableToPlan`;
- crear servicios de aplicación para comandos y consultas;
- mantener Dexie detrás de repositorios o servicios de persistencia.

**Gate:** las métricas principales se calculan desde una única fuente de dominio y tienen pruebas unitarias.

### Fase 3 — Corregir el ledger

**Objetivo:** aplicar las invariantes de forma uniforme.

Tareas:

- hacer que un ingreso afecte la cuenta seleccionada; Efectivo solo será el valor por defecto;
- enrutar toda creación, actualización y eliminación por comandos transaccionales comunes;
- separar `preventNegativeAccountBalance` de `budgetOverspendingBehavior`;
- soportar `allow`, `warn` y `block` para exceso presupuestario;
- archivar cuentas y categorías;
- cerrar tarjetas e inversiones;
- desactivar reglas recurrentes.

**Gate:** las mismas invariantes se mantienen desde todas las superficies de edición.

### Fase 4 — Categorías con identidad estable

**Objetivo:** proteger el historial frente a renombrados y archivados.

Tareas:

- migrar arrays de strings a entidades `Category`;
- preservar IDs existentes;
- cambiar el nombre sin cambiar el ID;
- migrar todas las referencias;
- conservar creación automática de defaults si resulta necesaria.

**Gate:** renombrar una categoría no cambia ni pierde categorización histórica.

### Fase 5 — Actual frente a planificado

**Objetivo:** separar hechos ocurridos de intenciones futuras.

Regla central:

```text
Expense = hecho real
RecurringRule = intención futura
```

Tareas:

- conservar `Fijo`, `Variable` y `Ocasional` solo como clasificación;
- impedir que `frequency` de una transacción genere gastos futuros;
- eliminar gradualmente `expenseForMonth()` como mecanismo de replicación del ledger.

### Fase 6 — Motor de períodos

**Objetivo:** reemplazar la dependencia de `date.slice(0, 7)` y `YYYY-MM`.

Implementar:

```ts
type DateRange = {
  start: string
  end: string
}

periodContaining(date, settings)
previousComparablePeriod(period)
nextPeriod(period)
contains(period, date)
```

Tareas:

- usar rangos en presupuestos y reportes;
- dejar `Income.month` y `Expense.month` como campos derivados, no como fuente de verdad;
- soportar inicio del período configurable.

**Gate:** con inicio el día 25, el período sea del 25 de agosto al 24 de septiembre.

### Fase 7 — Planned Payments real

**Objetivo:** generar ocurrencias reales desde reglas recurrentes.

Tareas:

- implementar `RecurringRule` y `PlannedOccurrence`;
- generar vistas locales de Today, Tomorrow, Next 7 days y Later;
- calcular recurrencias semanales y quincenales desde intervalos reales de la fecha inicial;
- definir que los días 29–31 usan el último día válido del mes cuando no exista el día original;
- hacer única la pareja `ruleId + scheduledDate`;
- permitir estados pending, confirmed, skipped y overdue;
- vincular una ocurrencia confirmada con exactamente una transacción.

**Gate:** confirmar la misma ocurrencia dos veces es imposible y confirmar no duplica el movimiento.

### Fase 7.5 — UX Architecture & Design System

**Objetivo:** fijar patrones antes de Quick Add 2.0 y de nuevas pantallas.

Áreas principales, tanto en móvil como en escritorio:

1. Resumen
2. Movimientos
3. Plan
4. Reportes

Dentro de Plan:

- Presupuestos;
- Metas;
- Planificados.

Decisiones UX:

- Bottom navigation móvil con máximo cuatro destinos;
- acción global Nuevo Movimiento accesible desde cualquier área;
- en móvil, preferentemente como FAB;
- un compositor único para gasto, ingreso y transferencia;
- Resumen orientado a estado y acción;
- Reportes orientado a análisis y exploración;
- gráficos analíticos fuera de Home progresivamente;
- patrón común de pantalla de detalle;
- separar View Mode de Management Mode;
- estados de planificados con texto e iconografía, no solo color;
- Quick Add con divulgación progresiva y campos contextuales.

---

## 7. Contratos de comandos

Todas las mutaciones financieras deberían pasar por una superficie de aplicación equivalente a la siguiente:

```ts
createIncome(input)
createExpense(input)
createTransfer(input)
createDebtPayment(input)
updateTransaction(id, patch)
deleteTransaction(id)
createAccount(input)
archiveAccount(id)
createBudget(input)
createGoal(input)
confirmPlannedOccurrence(id)
skipPlannedOccurrence(id)
```

Cada comando debe:

1. validar entrada;
2. aplicar las invariantes de dominio;
3. ejecutar la mutación persistente dentro de una transacción Dexie cuando corresponda;
4. devolver un resultado verificable;
5. dejar intactas las referencias históricas.

---

## 8. Estrategia de migraciones y backup

### Reglas

- Cada cambio de esquema debe tener versión y migración explícita.
- Nunca borrar y recrear la base como estrategia de migración.
- Las migraciones deben ser idempotentes o detectar claramente si ya fueron aplicadas.
- Los campos antiguos pueden conservarse temporalmente si facilitan compatibilidad, pero deben dejar de ser fuente de verdad cuando exista un modelo canónico.
- El importador debe validar versión, estructura e importes antes de mutar la DB.
- La restauración debe poder probarse en una base temporal.

### Pruebas mínimas por versión

```text
fixture antiguo
  → migración
  → datos canónicos
  → export
  → import en DB vacía
  → mismos datos
  → mismos selectores derivados
```

Debe mantenerse compatibilidad con el backup JSON v4 indicado por el roadmap.

---

## 9. Matriz de pruebas mínima

| Área | Casos imprescindibles |
|---|---|
| Dinero | enteros, suma/resta, cero, valores negativos controlados |
| Ledger | ingreso, gasto, tarjeta, pago de tarjeta, transferencia |
| Métricas | liquidez, patrimonio neto, gasto, cash flow, available to plan |
| Cuentas | cuenta seleccionada para ingreso, archivado, saldo negativo |
| Categorías | rename conserva ID e historial; archivado conserva referencias |
| Períodos | mensual, semanal, anual, one-time, inicio día 25 |
| Recurrencia | semanal, quincenal, mensual, anual, días 29–31 |
| Ocurrencias | unicidad, pending, confirmed, skipped, overdue, doble confirmación |
| Backup | export/import, fixture v4, equivalencia de saldos derivados |
| Offline | carga, lectura, mutaciones y reportes sin red |
| Privacidad | operaciones financieras sin requests ni telemetría |
| UX | cuatro áreas, acción global, campos contextuales, estados no dependientes del color |

---

## 10. Primer backlog ejecutable

### Sprint 0 — Fundaciones

- [ ] Elegir stack de frontend y build estático.
- [ ] Crear estructura de capas.
- [ ] Definir versión inicial de Dexie y contrato de backup.
- [ ] Implementar representación `Money` basada en enteros.
- [ ] Crear harness de pruebas unitarias y de integración.
- [ ] Documentar invariantes.
- [ ] Implementar fixture y prueba de round-trip.
- [ ] Crear check de build, lint, typecheck y tests.

### Sprint 1 — Dominio canónico

- [ ] Implementar tipos de cuentas, categorías y transacciones.
- [ ] Implementar funciones puras de ledger.
- [ ] Implementar selectores de las cinco métricas.
- [ ] Implementar comandos de ingreso, gasto, transferencia y eliminación.
- [ ] Implementar repositorios Dexie mínimos.
- [ ] Probar que UI y dominio permanecen desacoplados.

### Sprint 2 — Privacidad y migraciones

- [ ] Auditar dependencias y llamadas de red.
- [ ] Eliminar cualquier runtime remoto no requerido.
- [ ] Añadir prueba que intercepte requests durante operaciones financieras.
- [ ] Implementar primera migración explícita.
- [ ] Probar importación del backup v4.
- [ ] Verificar operación offline desde una build estática.

### Sprint 3 — Ledger, categorías y períodos

- [ ] Corregir cuenta destino de ingresos.
- [ ] Separar saldo negativo de exceso presupuestario.
- [ ] Migrar categorías a IDs estables.
- [ ] Implementar `DateRange` y `periodContaining`.
- [ ] Migrar un reporte para usar rangos.
- [ ] Verificar Gate 4 y Gate 6.

### Sprint 4 — Recurrencias y UX base

- [ ] Implementar reglas y ocurrencias.
- [ ] Añadir confirmación idempotente.
- [ ] Implementar Upcoming local.
- [ ] Establecer las cuatro áreas principales.
- [ ] Crear compositor global de Nuevo Movimiento.
- [ ] Definir estados visuales de Planned Payments.

---

## 11. Riesgos arquitectónicos a vigilar

1. **Campos derivados convertidos en fuente de verdad:** `month` y conceptos similares pueden divergir de `date`.
2. **Duplicación del ledger:** mantener cálculos en UI y dominio producirá saldos inconsistentes.
3. **Borrado destructivo:** rompe referencias históricas, reportes y migraciones.
4. **Recurrencias mezcladas con hechos:** genera movimientos ficticios y doble conteo.
5. **Tarjetas tratadas como cuentas de efectivo:** distorsiona liquidez, gasto y patrimonio.
6. **Presupuesto confundido con dinero disponible:** puede inducir decisiones financieras incorrectas.
7. **Doble confirmación de planificados:** debe impedirse mediante unicidad e idempotencia.
8. **Dependencias de red accidentales:** una librería o SDK puede introducir transmisión no deseada.
9. **Diseño por feature sin arquitectura de navegación:** llevaría a más pestañas y superficies inconsistentes.
10. **Migraciones sin fixtures:** los datos reales antiguos son el principal caso de fallo.

---

## 12. Definición de terminado por fase

Una fase solo está terminada cuando:

- la implementación y sus tests fueron revisados antes de modificar la siguiente fase;
- typecheck, lint, tests y build están verdes;
- se probaron migraciones relevantes;
- backup e importación siguen siendo compatibles;
- la aplicación funciona offline;
- se verificó que no se transmiten datos financieros;
- los cálculos derivados coinciden antes y después de exportar/importar;
- se documentaron decisiones y riesgos arquitectónicos;
- se detuvo el trabajo para revisión antes de comenzar la fase siguiente.

> El roadmap exige explícitamente trabajar fase por fase y detenerse en cada gate. Este plan conserva esa restricción: no es una instrucción para implementar todo en una sola pasada.

## 13. Estado de implementación — 2026-10-05

- **Fases 0–7.5:** implementadas y verificadas con pruebas, build y auditoría estática de privacidad.
- **Fase 7.5 / UX móvil:** completada en la superficie actual: navegación inferior, FAB, menú lateral móvil, movimientos, presupuestos, metas, reglas y reportes conectados a Dexie.
- **Fase 8:** en progreso. Se añadió migración/validación explícita de backup v4 → v5, rechazo de contratos futuros o inválidos y regresiones de importación. Queda como siguiente gate formal la restauración en una base temporal aislada y la equivalencia de selectores derivados.
- **Referencia de motor:** `Juno002/Glitchbudget-pro@6369dcf` fue auditado. Sus capacidades se trasladarán por contratos y fases, no mediante una copia literal de su stack Next.js.
- **Regla de continuación:** no marcar Fase 8 como completa hasta validar migración versionada, restauración aislada y equivalencia de selectores derivados.
