import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Check,
  ChevronDown,
  CircleHelp,
  CreditCard,
  Download,
  FileDown,
  Flag,
  LayoutDashboard,
  Menu,
  MoreHorizontal,
  Plus,
  Receipt,
  Search,
  Settings2,
  Sparkles,
  Target,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { loadFinanceState, reloadFinanceState } from "@/application/finance-service";
import { createExpense, createIncome, createTransfer } from "@/application/commands";
import { createRecurringRule, occurrenceBucket } from "@/application/planned-service";
import { accountBalance, deriveMetrics, liabilities, spendingInPeriod } from "@/domain/ledger";
import { moneyFromMajorUnits, moneyToMajorUnits } from "@/domain/money";
import type { ExpenseClassification, PlannedOccurrence, RecurringRule, Transaction as CanonicalTransaction } from "@/domain/entities";
import { defaultPeriodSettings, nextPeriod, periodContaining, periodLabel, previousComparablePeriod, type DateRange } from "@/domain/periods";
import { savePeriodSettings } from "@/persistence/db";
import type { LegacyTransaction, PersistedState } from "@/persistence/db";

type Section = "Resumen" | "Movimientos" | "Plan" | "Reportes";
type EntryKind = "Gasto" | "Ingreso" | "Transferencia";

type MovementFormEntry = {
  title: string;
  amount: number;
  kind: EntryKind;
  accountId: string;
  destinationAccountId?: string;
  categoryId?: string;
  classification?: ExpenseClassification;
};

type Transaction = {
  id: string;
  title: string;
  category: string;
  account: string;
  date: string;
  amount: number;
  kind: EntryKind;
  icon: string;
  tone: string;
};

const navItems: { label: Section; icon: typeof LayoutDashboard }[] = [
  { label: "Resumen", icon: LayoutDashboard },
  { label: "Movimientos", icon: Receipt },
  { label: "Plan", icon: Target },
  { label: "Reportes", icon: BarChart3 },
];

const initialTransactions: Transaction[] = [
  { id: "tx-1", title: "Supermercado Nacional", category: "Alimentación", account: "Qik", date: "Hoy, 10:42", amount: -1840, kind: "Gasto", icon: "SN", tone: "coral" },
  { id: "tx-2", title: "Nómina · Septiembre", category: "Ingreso", account: "APAP", date: "Ayer, 08:00", amount: 52000, kind: "Ingreso", icon: "N", tone: "mint" },
  { id: "tx-3", title: "Uber", category: "Transporte", account: "Efectivo", date: "Ayer, 19:18", amount: -420, kind: "Gasto", icon: "U", tone: "lavender" },
  { id: "tx-4", title: "Pago tarjeta Visa", category: "Pago de deuda", account: "Qik → Visa", date: "23 sep, 11:15", amount: -8500, kind: "Transferencia", icon: "↗", tone: "sky" },
];

const chartBars = [
  { label: "May", value: 42 },
  { label: "Jun", value: 58 },
  { label: "Jul", value: 46 },
  { label: "Ago", value: 71 },
  { label: "Sep", value: 54, active: true },
];

const budgetRows = [
  { label: "Vivienda", value: 11200, total: 16000, color: "#ea6959" },
  { label: "Alimentación", value: 6840, total: 9000, color: "#84b6a7" },
  { label: "Transporte", value: 2850, total: 4500, color: "#8a84b6" },
];

const emptyFinanceState: PersistedState = { accounts: [], categories: [], transactions: [], budgets: [], goals: [], recurringRules: [], plannedOccurrences: [], periodSettings: defaultPeriodSettings };

const legacySeed: LegacyTransaction[] = initialTransactions.map((transaction) => ({
  id: transaction.id,
  title: transaction.title,
  category: transaction.category,
  account: transaction.account,
  date: transaction.date,
  amount: transaction.amount,
  kind: transaction.kind,
}));

function toViewTransactions(state: PersistedState): Transaction[] {
  const accountById = new Map(state.accounts.map((account) => [account.id, account.name]));
  const categoryById = new Map(state.categories.map((category) => [category.id, category.name]));
  return [...state.transactions]
    .sort((left, right) => right.date.localeCompare(left.date))
    .map((transaction) => {
      const isIncome = transaction.kind === "income";
      const isTransfer = transaction.kind === "transfer";
      const account = accountById.get(transaction.accountId ?? "") ?? "Sin cuenta";
      const destination = accountById.get(transaction.destinationAccountId ?? "");
      const title = transaction.note ?? categoryById.get(transaction.categoryId ?? "") ?? "Movimiento";
      return {
        id: transaction.id,
        title,
        category: categoryById.get(transaction.categoryId ?? "") ?? (isTransfer ? "Transferencia" : isIncome ? "Ingreso" : "Otros"),
        account: destination ? `${account} → ${destination}` : account,
        date: formatTransactionDate(transaction.date),
        amount: isIncome ? moneyToMajorUnits(transaction.amount) : -moneyToMajorUnits(transaction.amount),
        kind: isIncome ? "Ingreso" : isTransfer ? "Transferencia" : "Gasto",
        icon: isIncome ? "↗" : isTransfer ? "⇄" : "•",
        tone: isIncome ? "mint" : isTransfer ? "sky" : "coral",
      } satisfies Transaction;
    });
}

function formatCurrency(value: number, compact = false) {
  return new Intl.NumberFormat("es-DO", { style: "currency", currency: "DOP", maximumFractionDigits: 0, notation: compact ? "compact" : "standard" }).format(Math.abs(value));
}

function formatSignedCurrency(value: number) {
  return `${value >= 0 ? "+" : "−"}${formatCurrency(value)}`;
}

function formatAccountBalance(value: number) {
  return value < 0 ? `−${formatCurrency(value)}` : formatCurrency(value);
}

function formatTransactionDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("es-DO", { day: "2-digit", month: "short" }).format(parsed);
}

function periodAtOffset(current: DateRange, offset: number) {
  let period = current;
  const step = offset >= 0 ? nextPeriod : previousComparablePeriod;
  for (let index = 0; index < Math.abs(offset); index += 1) period = step(period);
  return period;
}

function IconBubble({ transaction }: { transaction: Transaction }) {
  return <div className={`transaction-icon ${transaction.tone}`} aria-hidden="true">{transaction.icon}</div>;
}

function LogoMark() {
  return <div className="logo-mark" aria-hidden="true"><span /><span /><span /></div>;
}

function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="section-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="heading-description">{description}</p></div>{action}</div>;
}

function SummaryView({ transactions, metrics, state, period, periodOffset, onPeriodChange, onNewMovement, onSeeAll }: { transactions: Transaction[]; metrics: ReturnType<typeof deriveMetrics>; state: PersistedState; period: DateRange; periodOffset: number; onPeriodChange: (offset: number) => void; onNewMovement: () => void; onSeeAll: () => void }) {
  const spending = moneyToMajorUnits(spendingInPeriod(state.transactions, period));
  const liquidPosition = moneyToMajorUnits(metrics.liquidPosition);
  const netWorth = moneyToMajorUnits(metrics.netWorth);
  const debt = moneyToMajorUnits(liabilities(state));

  return <>
    <div className="hero-intro animate-in"><div><div className="status-pill"><span className="status-dot" /> Todo está en orden</div><h1>Buenos días, Alex<span className="accent-period">.</span></h1><p>Tu panorama financiero al <strong>26 de septiembre, 2026</strong>.</p></div><div className="hero-actions"><button className="icon-button quiet" aria-label="Ayuda"><CircleHelp size={18} /></button><button className="icon-button quiet notification-button" aria-label="Notificaciones"><Bell size={18} /><span /></button><button className="primary-button desktop-add" onClick={onNewMovement}><Plus size={17} /> Nuevo movimiento</button></div></div>
    <div className="metric-grid animate-in delay-1"><article className="metric-card featured-card"><div className="metric-card-top"><span>Disponible líquido</span><WalletCards size={19} /></div><div className="metric-value">{formatCurrency(liquidPosition)}<span className="metric-decimal">.00</span></div><div className="metric-foot"><span className="positive-trend"><ArrowUpRight size={15} /> 8.4%</span><span>vs. mes anterior</span></div><div className="sparkline" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></article><article className="metric-card"><div className="metric-card-top"><span>Patrimonio neto</span><TrendingUp size={19} /></div><div className="metric-value">{formatCurrency(netWorth)}<span className="metric-decimal">.00</span></div><div className="metric-foot"><span className="positive-trend"><ArrowUpRight size={15} /> 3.1%</span><span>vs. mes anterior</span></div><div className="mini-progress"><span style={{ width: "68%" }} /></div></article><article className="metric-card warm-card"><div className="metric-card-top"><span>Deuda total</span><CreditCard size={19} /></div><div className="metric-value">{formatCurrency(debt)}<span className="metric-decimal">.00</span></div><div className="metric-foot"><span className="negative-trend"><ArrowDownRight size={15} /> 12.6%</span><span>este período</span></div><div className="debt-label"><span className="debt-dot" /> {debt > 0 ? "Pasivos registrados" : "Sin pasivos registrados"} <strong>{formatCurrency(debt)}</strong></div></article></div>
    <div className="dashboard-grid animate-in delay-2"><section className="panel spending-panel"><div className="panel-header"><div><p className="eyebrow">Seguimiento</p><h2>Gasto del período</h2></div><div className="period-controls"><button className="icon-button quiet" onClick={() => onPeriodChange(periodOffset - 1)} aria-label="Período anterior"><ArrowLeftRight size={15} /></button><button className="select-button">{periodLabel(period)} <ChevronDown size={15} /></button><button className="icon-button quiet" onClick={() => onPeriodChange(periodOffset + 1)} aria-label="Período siguiente"><ArrowUpRight size={15} /></button></div></div><div className="period-context"><button className="text-button" onClick={() => onPeriodChange(0)} disabled={periodOffset === 0}>{periodOffset === 0 ? "Período actual" : "Volver al actual"}</button></div><div className="spending-overview"><div><strong>{formatCurrency(spending)}</strong><span>de RD$ 30,000 presupuestados</span></div><div className="remaining-badge">Te quedan RD$ {Math.max(0, 30000 - spending).toLocaleString("es-DO")}</div></div><div className="budget-progress"><span style={{ width: `${Math.min(100, (spending / 30000) * 100)}%` }} /></div><div className="budget-legend"><span><i className="legend-dot coral-dot" /> Gastado <strong>{formatCurrency(spending)}</strong></span><span><i className="legend-dot pale-dot" /> Restante <strong>{formatCurrency(Math.max(0, 30000 - spending))}</strong></span></div><div className="category-list">{budgetRows.map((row) => <div className="category-row" key={row.label}><div className="category-row-name"><span className="category-color" style={{ background: row.color }} />{row.label}<span>{formatCurrency(row.value)} <em>/ {formatCurrency(row.total)}</em></span></div><div className="category-progress"><span style={{ width: `${(row.value / row.total) * 100}%`, background: row.color }} /></div></div>)}</div></section><section className="panel upcoming-panel"><div className="panel-header"><div><p className="eyebrow">Lo que viene</p><h2>Próximos pagos</h2></div><button className="text-button" onClick={() => toast.info("La vista completa de planificados estará disponible en la Fase 7.")}>Ver todos <ArrowUpRight size={15} /></button></div><div className="upcoming-list"><div className="upcoming-item"><div className="calendar-tile"><strong>28</strong><span>SEP</span></div><div className="upcoming-copy"><strong>Internet hogar</strong><span>Planificado · vence en 2 días</span></div><b>RD$ 1,500</b></div><div className="upcoming-item"><div className="calendar-tile mint-calendar"><strong>01</strong><span>OCT</span></div><div className="upcoming-copy"><strong>Alquiler</strong><span>Planificado · vence en 5 días</span></div><b>RD$ 16,000</b></div><div className="upcoming-item"><div className="calendar-tile lavender-calendar"><strong>03</strong><span>OCT</span></div><div className="upcoming-copy"><strong>Netflix</strong><span>Planificado · vence en 7 días</span></div><b>RD$ 450</b></div></div><div className="upcoming-footer"><Sparkles size={16} /><span>Sin pagos atrasados. Tu próximo compromiso es en 2 días.</span></div></section></div>
    <div className="bottom-grid animate-in delay-3"><section className="panel activity-panel"><div className="panel-header"><div><p className="eyebrow">Actividad real</p><h2>Movimientos recientes</h2></div><button className="text-button" onClick={onSeeAll}>Ver todos <ArrowUpRight size={15} /></button></div><div className="transaction-list">{transactions.slice(0, 4).map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} />)}</div></section><section className="panel accounts-panel"><div className="panel-header"><div><p className="eyebrow">Dónde está tu dinero</p><h2>Cuentas</h2></div><button className="more-button" aria-label="Más opciones"><MoreHorizontal size={18} /></button></div><div className="account-list">{state.accounts.filter((account) => !account.archived && account.kind !== "credit").slice(0, 3).map((account, index) => <AccountRow key={account.id} icon={account.name.slice(0, 1)} name={account.name} kind={account.kind === "cash" ? "Billetera" : index === 0 ? "Cuenta corriente" : "Cuenta de ahorro"} value={formatAccountBalance(moneyToMajorUnits(accountBalance(account, state.transactions)))} color={index === 0 ? "coral" : index === 1 ? "mint" : "lavender"} />)}</div><button className="add-account-button" onClick={() => toast.info("La gestión de cuentas llegará después del núcleo financiero.")}><Plus size={16} /> Añadir cuenta</button></section></div>
  </>;
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
  return <div className="transaction-row"><IconBubble transaction={transaction} /><div className="transaction-copy"><strong>{transaction.title}</strong><span>{transaction.category} · {transaction.account}</span></div><div className={`transaction-amount ${transaction.amount > 0 ? "income" : "expense"}`}><strong>{formatSignedCurrency(transaction.amount)}</strong><span>{transaction.date}</span></div><button className="row-more" aria-label={`Más opciones para ${transaction.title}`}><MoreHorizontal size={17} /></button></div>;
}

function AccountRow({ icon, name, kind, value, color }: { icon: string; name: string; kind: string; value: string; color: string }) {
  return <div className="account-row"><div className={`account-icon ${color}`}>{icon}</div><div className="account-copy"><strong>{name}</strong><span>{kind}</span></div><strong className="account-value">{value}</strong></div>;
}

function TransactionsView({ transactions, onNewMovement }: { transactions: Transaction[]; onNewMovement: () => void }) {
  return <><SectionHeading eyebrow="Actividad real" title="Movimientos" description="Todo lo que ha ocurrido con tu dinero, en un solo lugar." action={<button className="primary-button" onClick={onNewMovement}><Plus size={17} /> Nuevo movimiento</button>} /><div className="filter-bar"><div className="search-field"><Search size={16} /><input placeholder="Buscar movimientos" /></div><button className="filter-button">Este mes <ChevronDown size={15} /></button><button className="filter-button">Todos <ChevronDown size={15} /></button><button className="icon-button filter-more" aria-label="Más filtros"><Settings2 size={17} /></button></div><section className="panel transactions-page-panel"><div className="table-head"><span>Movimiento</span><span>Cuenta</span><span>Fecha</span><span className="align-right">Importe</span></div>{transactions.map((transaction) => <div className="transaction-table-row" key={transaction.id}><div className="table-movement"><IconBubble transaction={transaction} /><div><strong>{transaction.title}</strong><span>{transaction.category}</span></div></div><span className="table-muted">{transaction.account}</span><span className="table-muted">{transaction.date}</span><strong className={`align-right ${transaction.amount > 0 ? "income-text" : "expense-text"}`}>{formatSignedCurrency(transaction.amount)}</strong></div>)}</section></>;
}

function PlanView({ state, onNewRule }: { state: PersistedState; onNewRule: () => void }) {
  const rules = state.recurringRules.filter((rule) => rule.active);
  const upcoming = state.plannedOccurrences.filter((occurrence) => occurrence.status !== "confirmed").sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)).slice(0, 5);
  const ruleById = new Map(rules.map((rule) => [rule.id, rule]));
  return <><SectionHeading eyebrow="Planificación" title="Plan" description="Decide qué quieres hacer con tu dinero antes de que llegue el momento." action={<button className="primary-button" onClick={() => toast.info("Los presupuestos detallados se habilitarán en una siguiente fase.")}><Plus size={17} /> Nuevo presupuesto</button>} /><div className="plan-summary-grid"><div className="plan-summary accent"><span>Disponible para planificar</span><strong>RD$ 28,400</strong><small>Después de compromisos y reservas</small></div><div className="plan-summary"><span>Reglas activas</span><strong>{rules.length}</strong><small>No afectan tu saldo hasta confirmar</small></div><div className="plan-summary"><span>Eventos próximos</span><strong>{upcoming.length}</strong><small>Today · Tomorrow · Next 7 days · Later</small></div></div><div className="plan-content-grid"><section className="panel"><div className="panel-header"><div><p className="eyebrow">Este período</p><h2>Presupuestos</h2></div><button className="text-button">Gestionar <ArrowUpRight size={15} /></button></div><div className="plan-budget-list">{budgetRows.map((row) => <div className="plan-budget-row" key={row.label}><div className="plan-budget-top"><span><i className="category-color" style={{ background: row.color }} />{row.label}</span><strong>{formatCurrency(row.total - row.value)} <em>restante</em></strong></div><div className="category-progress"><span style={{ width: `${(row.value / row.total) * 100}%`, background: row.color }} /></div><span className="plan-budget-meta">{formatCurrency(row.value)} gastado de {formatCurrency(row.total)}</span></div>)}</div></section><section className="panel"><div className="panel-header"><div><p className="eyebrow">Eventos planificados</p><h2>Próximos pagos</h2></div><button className="text-button" onClick={onNewRule}><Plus size={15} /> Nueva regla</button></div>{upcoming.length === 0 ? <p className="modal-note">Aún no hay reglas recurrentes. Añade una para ver eventos aquí.</p> : upcoming.map((occurrence) => { const rule = ruleById.get(occurrence.ruleId); return <div className="planned-card" key={occurrence.id}><div className="calendar-tile"><strong>{occurrence.scheduledDate.slice(8)}</strong><span>{occurrence.scheduledDate.slice(5, 7)}</span></div><div><strong>{rule?.title ?? "Regla"}</strong><span>{occurrenceBucket(occurrence.scheduledDate)} · {occurrence.status}</span></div><b>{rule ? formatCurrency(moneyToMajorUnits(rule.amount)) : "—"}</b></div>; })}<button className="wide-secondary" onClick={onNewRule}><Plus size={15} /> Añadir regla recurrente</button></section></div></>;
}

function ReportsView({ transactions }: { transactions: CanonicalTransaction[] }) {
  const currentPeriod = periodContaining(new Date().toISOString().slice(0, 10));
  const periodSpending = moneyToMajorUnits(spendingInPeriod(transactions, currentPeriod));
  return <><SectionHeading eyebrow="Análisis" title="Reportes" description="Entiende tus tendencias sin perder de vista lo importante." action={<button className="filter-button">{periodLabel(currentPeriod)} <ChevronDown size={15} /></button>} /><div className="report-highlight"><div><p className="eyebrow">Gasto del período</p><strong>{formatCurrency(periodSpending)}</strong><span><span className="positive-trend"><ArrowDownRight size={14} /> 6.8%</span> vs. promedio mensual</span></div><div className="report-chart">{chartBars.map((bar) => <div className="chart-column" key={bar.label}><div className={`chart-bar ${bar.active ? "active" : ""}`} style={{ height: `${bar.value}%` }} /><span>{bar.label}</span></div>)}</div></div><div className="report-grid"><section className="panel"><div className="panel-header"><div><p className="eyebrow">Distribución</p><h2>Por categoría</h2></div><button className="more-button"><MoreHorizontal size={18} /></button></div><div className="donut-layout"><div className="donut-chart"><div><strong>RD$ 11.5k</strong><span>total</span></div></div><div className="donut-legend"><span><i style={{ background: "#ea6959" }} /> Vivienda <b>43%</b></span><span><i style={{ background: "#84b6a7" }} /> Alimentación <b>27%</b></span><span><i style={{ background: "#8a84b6" }} /> Transporte <b>16%</b></span><span><i style={{ background: "#e3c27a" }} /> Otros <b>14%</b></span></div></div></section><section className="panel insight-panel"><div className="insight-kicker"><Sparkles size={16} /> Lectura rápida</div><h2>Vas en buen ritmo</h2><p>Tu gasto está un <strong>6.8% por debajo</strong> de tu promedio de los últimos 3 meses. Alimentación es la categoría con más movimiento esta semana.</p><button className="wide-secondary" onClick={() => toast.info("Los reportes comparativos serán parte de la Fase 2.")}>Explorar reportes <ArrowUpRight size={15} /></button></section></div></>;
}

function NewMovementModal({ state, onClose, onSave }: { state: PersistedState; onClose: () => void; onSave: (entry: MovementFormEntry) => void }) {
  const [kind, setKind] = useState<EntryKind>("Gasto");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const activeAccounts = state.accounts.filter((account) => !account.archived);
  const activeCategories = state.categories.filter((category) => !category.archived);
  const [accountId, setAccountId] = useState(activeAccounts[0]?.id ?? "");
  const [destinationAccountId, setDestinationAccountId] = useState(activeAccounts[1]?.id ?? activeAccounts[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(activeCategories.find((category) => category.type !== "income")?.id ?? "");
  const [classification, setClassification] = useState<ExpenseClassification>("occasional");
  const canSave = title.trim().length > 0 && Number(amount) > 0;
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="movement-modal" role="dialog" aria-modal="true" aria-labelledby="movement-title"><div className="modal-header"><div><p className="eyebrow">Acción global</p><h2 id="movement-title">Nuevo movimiento real</h2></div><button className="icon-button quiet" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></div><div className="kind-toggle" role="tablist" aria-label="Tipo de movimiento">{(["Gasto", "Ingreso", "Transferencia"] as EntryKind[]).map((item) => <button key={item} className={kind === item ? "active" : ""} onClick={() => setKind(item)} role="tab" aria-selected={kind === item}>{item}</button>)}</div><label className="form-label">Monto<input autoFocus value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" inputMode="decimal" /></label><label className="form-label">Descripción<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={kind === "Transferencia" ? "Cuenta de origen → destino" : "¿Qué ocurrió?"} /></label><div className="form-grid"><label className="form-label">Cuenta<select value={accountId} onChange={(event) => setAccountId(event.target.value)}>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>{kind === "Transferencia" ? <label className="form-label">Destino<select value={destinationAccountId} onChange={(event) => setDestinationAccountId(event.target.value)}>{activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label> : <label className="form-label">Categoría<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>{activeCategories.filter((category) => category.type !== "income").map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>}</div>{kind === "Gasto" && <label className="form-label">Clasificación<select value={classification} onChange={(event) => setClassification(event.target.value as ExpenseClassification)}><option value="fixed">Fijo</option><option value="variable">Variable</option><option value="occasional">Ocasional</option></select></label>}{kind !== "Transferencia" && <p className="modal-note">Este formulario registra un hecho real; no crea movimientos futuros.</p>}<button className="primary-button modal-save" disabled={!canSave || !accountId} onClick={() => onSave({ title: title.trim(), amount: Number(amount), kind, accountId, destinationAccountId: kind === "Transferencia" ? destinationAccountId : undefined, categoryId: kind === "Ingreso" ? activeCategories.find((category) => category.type === "income")?.id ?? categoryId : categoryId, classification: kind === "Gasto" ? classification : undefined })}><Check size={17} /> Guardar movimiento</button><p className="modal-note">Guardado localmente en este dispositivo.</p></div></div>;
}

function SettingsModal({ initialDay, onClose, onSave }: { initialDay: number; onClose: () => void; onSave: (day: number) => void }) {
  const [day, setDay] = useState(String(initialDay));
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="movement-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div className="modal-header"><div><p className="eyebrow">Preferencias locales</p><h2 id="settings-title">Ajustes</h2></div><button className="icon-button quiet" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></div><label className="form-label">Día de inicio del período<select value={day} onChange={(event) => setDay(event.target.value)}>{Array.from({ length: 31 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label><p className="modal-note">Con día 25 cada período va del 25 al 24 del mes siguiente. Se guarda solo en este dispositivo.</p><button className="primary-button modal-save" onClick={() => onSave(Number(day))}><Check size={17} /> Guardar preferencias</button></div></div>;
}

function RecurringRuleModal({ state, onClose, onSaved }: { state: PersistedState; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<RecurringRule["frequency"]>("monthly");
  const [startsOn, setStartsOn] = useState(new Date().toISOString().slice(0, 10));
  const [accountId, setAccountId] = useState(state.accounts.find((account) => !account.archived)?.id ?? "");
  const [categoryId, setCategoryId] = useState(state.categories.find((category) => category.type !== "income" && !category.archived)?.id ?? "");
  const canSave = Boolean(title.trim() && Number(amount) > 0 && startsOn && accountId);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="movement-modal" role="dialog" aria-modal="true" aria-labelledby="rule-title"><div className="modal-header"><div><p className="eyebrow">Intención futura</p><h2 id="rule-title">Nueva regla recurrente</h2></div><button className="icon-button quiet" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></div><label className="form-label">Descripción<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Alquiler, nómina, internet…" /></label><label className="form-label">Monto<input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" inputMode="decimal" /></label><div className="form-grid"><label className="form-label">Frecuencia<select value={frequency} onChange={(event) => setFrequency(event.target.value as RecurringRule["frequency"])}><option value="weekly">Semanal</option><option value="biweekly">Quincenal</option><option value="monthly">Mensual</option><option value="yearly">Anual</option></select></label><label className="form-label">Primera fecha<input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} /></label></div><div className="form-grid"><label className="form-label">Cuenta<select value={accountId} onChange={(event) => setAccountId(event.target.value)}>{state.accounts.filter((account) => !account.archived).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label><label className="form-label">Categoría<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>{state.categories.filter((category) => category.type !== "income" && !category.archived).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label></div><p className="modal-note">La regla genera eventos pendientes; no modifica saldos hasta confirmar uno.</p><button className="primary-button modal-save" disabled={!canSave} onClick={async () => { try { await createRecurringRule({ title, amount: moneyFromMajorUnits(Number(amount)), kind: "expense", accountId, categoryId, classification: "fixed", frequency, startsOn, active: true }); onSaved(); } catch (error) { toast.error("No se pudo crear la regla", { description: error instanceof Error ? error.message : "Revisa los datos." }); } }}><Check size={17} /> Crear regla</button></div></div>;
}

export default function Home() {
  const [activeSection, setActiveSection] = useState<Section>("Resumen");
  const [state, setState] = useState<PersistedState | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [periodOffset, setPeriodOffset] = useState(0);

  useEffect(() => {
    let mounted = true;
    void loadFinanceState(legacySeed).then((loaded) => {
      if (mounted) setState(loaded);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleSave = async ({ title, amount, kind, accountId, destinationAccountId, categoryId, classification }: MovementFormEntry) => {
    try {
      const input = { id: `tx-${Date.now()}`, date: new Date().toISOString().slice(0, 10), amount, accountId, destinationAccountId, categoryId, classification, note: title };
      const result = kind === "Ingreso" ? await createIncome(input) : kind === "Transferencia" ? await createTransfer(input) : await createExpense(input);
      setState(await reloadFinanceState());
      setShowModal(false);
      toast.success("Movimiento guardado localmente", { description: `${title} · ${formatCurrency(amount)}` });
      result.warnings?.forEach((warning) => toast.warning(warning));
    } catch (error) {
      toast.error("No se pudo guardar el movimiento", { description: error instanceof Error ? error.message : "Revisa los datos e inténtalo de nuevo." });
    }
  };

  const goTo = (section: Section) => setActiveSection(section);
  const canonicalState = state ?? emptyFinanceState;
  const transactions = state ? toViewTransactions(state) : initialTransactions;
  const metrics = deriveMetrics(canonicalState);
  const currentPeriod = periodContaining(new Date().toISOString().slice(0, 10), canonicalState.periodSettings);
  const period = periodAtOffset(currentPeriod, periodOffset);
  const saveSettings = async (day: number) => {
    try {
      await savePeriodSettings({ startDay: day });
      setState(await reloadFinanceState());
      setPeriodOffset(0);
      setShowSettings(false);
      toast.success("Preferencias guardadas", { description: `El período comienza el día ${day}.` });
    } catch (error) {
      toast.error("No se pudieron guardar los ajustes", { description: error instanceof Error ? error.message : "Revisa el día seleccionado." });
    }
  };
  const refreshAfterRule = async () => {
    setState(await reloadFinanceState());
    setShowRuleModal(false);
    toast.success("Regla recurrente creada", { description: "Sus eventos quedaron planificados sin afectar el saldo." });
  };

  return <div className="app-shell"><aside className="sidebar"><div className="brand"><LogoMark /><div><strong>Prisma</strong><span>PRIVADO / LOCAL</span></div></div><div className="sidebar-context"><span className="context-label">Espacio personal</span><button>Alex Rivera <ChevronDown size={14} /></button></div><nav className="primary-nav" aria-label="Navegación principal">{navItems.map(({ label, icon: Icon }) => <button key={label} className={activeSection === label ? "active" : ""} onClick={() => goTo(label)}><Icon size={18} /><span>{label}</span>{label === "Plan" && <i className="nav-badge">3</i>}</button>)}</nav><div className="sidebar-bottom"><div className="offline-card"><div className="offline-icon"><Check size={14} /></div><div><strong>Solo en tu dispositivo</strong><span>Datos privados y offline</span></div></div><button className="secondary-nav-button" onClick={() => setShowSettings(true)}><Settings2 size={17} /> Ajustes</button><button className="secondary-nav-button" onClick={() => toast.info("Tu backup local estará disponible desde Ajustes.")}><Download size={17} /> Backup</button><div className="user-profile"><div className="avatar">AR</div><div><strong>Alex Rivera</strong><span>Plan personal</span></div><MoreHorizontal size={18} /></div></div></aside><main className="main-content"><header className="mobile-header"><button className="mobile-menu icon-button quiet" aria-label="Abrir menú"><Menu size={20} /></button><div className="brand mobile-brand"><LogoMark /><strong>Prisma</strong></div><button className="icon-button quiet notification-button" aria-label="Notificaciones"><Bell size={18} /><span /></button></header><div className="content-wrap">{activeSection === "Resumen" && <SummaryView transactions={transactions} metrics={metrics} state={canonicalState} period={period} periodOffset={periodOffset} onPeriodChange={setPeriodOffset} onNewMovement={() => setShowModal(true)} onSeeAll={() => goTo("Movimientos")} />}{activeSection === "Movimientos" && <TransactionsView transactions={transactions} onNewMovement={() => setShowModal(true)} />}{activeSection === "Plan" && <PlanView state={canonicalState} onNewRule={() => setShowRuleModal(true)} />}{activeSection === "Reportes" && <ReportsView transactions={canonicalState.transactions} />}</div></main><nav className="mobile-nav" aria-label="Navegación móvil">{navItems.map(({ label, icon: Icon }) => <button key={label} className={activeSection === label ? "active" : ""} onClick={() => goTo(label)}><Icon size={19} /><span>{label}</span></button>)}</nav>{showModal && state && <NewMovementModal state={state} onClose={() => setShowModal(false)} onSave={handleSave} />}{showSettings && <SettingsModal initialDay={canonicalState.periodSettings.startDay} onClose={() => setShowSettings(false)} onSave={saveSettings} />}{showRuleModal && state && <RecurringRuleModal state={state} onClose={() => setShowRuleModal(false)} onSaved={refreshAfterRule} />}<button className="mobile-fab" onClick={() => setShowModal(true)} aria-label="Nuevo movimiento"><Plus size={22} /></button></div>;
}
