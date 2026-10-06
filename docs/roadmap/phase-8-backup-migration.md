# Fase 8 — Migración explícita de backups

**Fecha:** 2026-10-06  
**Base:** Prisma `4e88b79`  
**Referencia:** `Juno002/Glitchbudget-pro@6369dcf`

## Decisión

Glitchbudget Pro se adopta como referencia del motor, no como copia literal de su aplicación Next.js. Prisma conserva React/Vite, su modelo `Money` en centavos, Dexie y las entidades canónicas `Transaction`, `Budget`, `Goal`, `RecurringRule` y `PlannedOccurrence`.

La integración se hará por contratos y fases. No se importan directamente modelos incompatibles del repositorio de referencia como `Income`/`Expense` separados, `Plan` mensual, inversiones, deudas o automatizaciones hasta definir sus equivalencias en el roadmap de Prisma.

## Hallazgos de la referencia

Glitchbudget Pro aporta patrones que Prisma debe incorporar progresivamente:

- Validación Zod por versión de backup con migración explícita desde v3 hasta v14.
- Rechazo de backups de versiones futuras antes de tocar Dexie.
- Validación de enteros de centavos, fechas, relaciones y límites de metas.
- Reportes con rangos 7d/30d/3m/6m/1y/custom, comparación contra período comparable y tendencias de ventanas.
- Servicios separados para reglas locales, seguridad/app-lock, inversiones, deudas, categorías y backups.
- Documentación por fase con gates, pruebas y limitaciones conocidas.

## Implementado en esta intervención

- Nuevo `client/src/persistence/backup-migrations.ts`.
- Migración compatible de backup v4 al contrato v5 actual.
- Rechazo de versiones no soportadas y de contratos con moneda/unidad incorrecta.
- Validación de cuentas, categorías, transacciones, presupuestos, metas, reglas, ocurrencias y configuración de períodos.
- Rechazo de importaciones con montos no enteros, tipos desconocidos o metas asignadas por encima del objetivo.
- Integración del validador en `importBackup`, antes de reemplazar datos locales.
- Regresiones para v4, versión futura y datos monetarios inválidos.

## Gate

Validado con:

- `pnpm run check`
- `pnpm run test`
- `pnpm run audit:static`
- `pnpm run build`
- `git diff --check`

La fase no se marca como cerrada todavía. Falta probar restauración en una base temporal aislada y equivalencia de selectores derivados después de importar/exportar.

## Siguiente secuencia autorizada

1. Añadir fixture de backup v4 y round-trip completo en DB temporal.
2. Verificar que un backup inválido no altera el estado existente.
3. Documentar y probar la siguiente versión de esquema Dexie solo si se necesita un cambio persistente.
4. Después iniciar la extracción de capacidades del motor de referencia: reglas locales y reportes editoriales, en fases separadas.
