# Prisma — Arquitectura UX y sistema de diseño

## Áreas principales

La aplicación mantiene cuatro destinos de primer nivel: **Resumen**, **Movimientos**, **Plan** y **Reportes**. La navegación móvil conserva exactamente esos cuatro destinos y la acción global `Nuevo movimiento` se mantiene disponible desde cualquier área mediante el CTA de cabecera y el FAB móvil.

## Plan

Plan separa tres contextos con tabs: **Presupuestos**, **Metas** y **Planificados**. Las vistas de Plan también distinguen:

- **Ver:** consulta de solo lectura, con etiquetas explícitas.
- **Gestionar:** acciones de creación y administración visibles cuando corresponden.

Los estados de ocurrencias planificadas usan texto e iconografía además del color: Pendiente, Confirmado, Omitido y Atrasado.

## Sistema visual

- Tokens de espaciado y superficies compartidos.
- Focus rings visibles para teclado en botones, inputs y selects.
- Estados de interacción con contraste semántico y texto de respaldo.
- Respeto de `prefers-reduced-motion`.
- Tabs y modos con roles ARIA y navegación actual marcada con `aria-current`.

## Regla de evolución

Las nuevas pantallas deben reutilizar `SectionHeading`, `panel`, `plan-tabs`, `mode-toggle`, `status-label` y el compositor global antes de introducir patrones nuevos.

## Correcciones de cierre 7.5

- El resumen consume ocurrencias persistidas para Próximos pagos; no muestra compromisos de demostración como si fueran datos reales.
- La fecha del saludo se deriva del día actual.
- Quick Add comienza con tipo, monto, descripción, cuenta y categoría; la clasificación avanzada se revela bajo “Más opciones”.
- El enlace “Gestionar” de pagos planificados lleva a Plan, no a Movimientos.
