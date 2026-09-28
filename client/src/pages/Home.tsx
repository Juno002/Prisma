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
import { migrateLegacyLocalStorage } from "@/persistence/db";

type Section = "Resumen" | "Movimientos" | "Plan" | "Reportes";
type EntryKind = "Gasto" | "Ingreso" | "Transferencia";

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
  {
    id: "tx-1",
    title: "Supermercado Nacional",
    category: "Alimentación",
    account: "Qik",
    date: "Hoy, 10:42",
    amount: -1840,
    kind: "Gasto",
    icon: "SN",
    tone: "coral",
  },
  {
    id: "tx-2",
    title: "Nómina · Septiembre",
    category: "Ingreso",
    account: "APAP",
    date: "Ayer, 08:00",
    amount: 52000,
    kind: "Ingreso",
    icon: "N",
    tone: "mint",
  },
  {
    id: "tx-3",
    title: "Uber",
    category: "Transporte",
    account: "Efectivo",
    date: "Ayer, 19:18",
    amount: -420,
    kind: "Gasto",
    icon: "U",
    tone: "lavender",
  },
  {
    id: "tx-4",
    title: "Pago tarjeta Visa",
    category: "Pago de deuda",
    account: "Qik → Visa",
    date: "23 sep, 11:15",
    amount: -8500,
    kind: "Transferencia",
    icon: "↗",
    tone: "sky",
  },
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

function formatCurrency(value: number, compact = false) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 0,
    notation: compact ? "compact" : "standard",
  }).format(Math.abs(value));
}

function formatSignedCurrency(value: number) {
  return `${value >= 0 ? "+" : "−"}${formatCurrency(value)}`;
}

function IconBubble({ transaction }: { transaction: Transaction }) {
  return (
    <div className={`transaction-icon ${transaction.tone}`} aria-hidden="true">
      {transaction.icon}
    </div>
  );
}

function LogoMark() {
  return (
    <div className="logo-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="heading-description">{description}</p>
      </div>
      {action}
    </div>
  );
}

function SummaryView({
  transactions,
  onNewMovement,
  onSeeAll,
}: {
  transactions: Transaction[];
  onNewMovement: () => void;
  onSeeAll: () => void;
}) {
  const spending = useMemo(
    () => transactions.filter((item) => item.amount < 0).reduce((sum, item) => sum + Math.abs(item.amount), 0),
    [transactions],
  );

  return (
    <>
      <div className="hero-intro animate-in">
        <div>
          <div className="status-pill"><span className="status-dot" /> Todo está en orden</div>
          <h1>Buenos días, Alex<span className="accent-period">.</span></h1>
          <p>Tu panorama financiero al <strong>26 de septiembre, 2026</strong>.</p>
        </div>
        <div className="hero-actions">
          <button className="icon-button quiet" aria-label="Ayuda"><CircleHelp size={18} /></button>
          <button className="icon-button quiet notification-button" aria-label="Notificaciones"><Bell size={18} /><span /></button>
          <button className="primary-button desktop-add" onClick={onNewMovement}><Plus size={17} /> Nuevo movimiento</button>
        </div>
      </div>

      <div className="metric-grid animate-in delay-1">
        <article className="metric-card featured-card">
          <div className="metric-card-top"><span>Disponible líquido</span><WalletCards size={19} /></div>
          <div className="metric-value">RD$ 82,450<span className="metric-decimal">.00</span></div>
          <div className="metric-foot"><span className="positive-trend"><ArrowUpRight size={15} /> 8.4%</span><span>vs. mes anterior</span></div>
          <div className="sparkline" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div>
        </article>
        <article className="metric-card">
          <div className="metric-card-top"><span>Patrimonio neto</span><TrendingUp size={19} /></div>
          <div className="metric-value">RD$ 126,820<span className="metric-decimal">.00</span></div>
          <div className="metric-foot"><span className="positive-trend"><ArrowUpRight size={15} /> 3.1%</span><span>vs. mes anterior</span></div>
          <div className="mini-progress"><span style={{ width: "68%" }} /></div>
        </article>
        <article className="metric-card warm-card">
          <div className="metric-card-top"><span>Deuda total</span><CreditCard size={19} /></div>
          <div className="metric-value">RD$ 18,370<span className="metric-decimal">.00</span></div>
          <div className="metric-foot"><span className="negative-trend"><ArrowDownRight size={15} /> 12.6%</span><span>este período</span></div>
          <div className="debt-label"><span className="debt-dot" /> Visa terminada en 2048 <strong>RD$ 8,370</strong></div>
        </article>
      </div>

      <div className="dashboard-grid animate-in delay-2">
        <section className="panel spending-panel">
          <div className="panel-header"><div><p className="eyebrow">Seguimiento</p><h2>Gasto este mes</h2></div><button className="select-button">Septiembre <ChevronDown size={15} /></button></div>
          <div className="spending-overview"><div><strong>{formatCurrency(spending)}</strong><span>de RD$ 30,000 presupuestados</span></div><div className="remaining-badge">Te quedan RD$ {Math.max(0, 30000 - spending).toLocaleString("es-DO")}</div></div>
          <div className="budget-progress"><span style={{ width: `${Math.min(100, (spending / 30000) * 100)}%` }} /></div>
          <div className="budget-legend"><span><i className="legend-dot coral-dot" /> Gastado <strong>{formatCurrency(spending)}</strong></span><span><i className="legend-dot pale-dot" /> Restante <strong>{formatCurrency(Math.max(0, 30000 - spending))}</strong></span></div>
          <div className="category-list">{budgetRows.map((row) => <div className="category-row" key={row.label}><div className="category-row-name"><span className="category-color" style={{ background: row.color }} />{row.label}<span>{formatCurrency(row.value)} <em>/ {formatCurrency(row.total)}</em></span></div><div className="category-progress"><span style={{ width: `${(row.value / row.total) * 100}%`, background: row.color }} /></div></div>)}</div>
        </section>

        <section className="panel upcoming-panel">
          <div className="panel-header"><div><p className="eyebrow">Lo que viene</p><h2>Próximos pagos</h2></div><button className="text-button" onClick={() => toast.info("La vista completa de planificados estará disponible en la Fase 7.")}>Ver todos <ArrowUpRight size={15} /></button></div>
          <div className="upcoming-list">
            <div className="upcoming-item"><div className="calendar-tile"><strong>28</strong><span>SEP</span></div><div className="upcoming-copy"><strong>Internet hogar</strong><span>Planificado · vence en 2 días</span></div><b>RD$ 1,500</b></div>
            <div className="upcoming-item"><div className="calendar-tile mint-calendar"><strong>01</strong><span>OCT</span></div><div className="upcoming-copy"><strong>Alquiler</strong><span>Planificado · vence en 5 días</span></div><b>RD$ 16,000</b></div>
            <div className="upcoming-item"><div className="calendar-tile lavender-calendar"><strong>03</strong><span>OCT</span></div><div className="upcoming-copy"><strong>Netflix</strong><span>Planificado · vence en 7 días</span></div><b>RD$ 450</b></div>
          </div>
          <div className="upcoming-footer"><Sparkles size={16} /><span>Sin pagos atrasados. Tu próximo compromiso es en 2 días.</span></div>
        </section>
      </div>

      <div className="bottom-grid animate-in delay-3">
        <section className="panel activity-panel"><div className="panel-header"><div><p className="eyebrow">Actividad real</p><h2>Movimientos recientes</h2></div><button className="text-button" onClick={onSeeAll}>Ver todos <ArrowUpRight size={15} /></button></div><div className="transaction-list">{transactions.slice(0, 4).map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} />)}</div></section>
        <section className="panel accounts-panel"><div className="panel-header"><div><p className="eyebrow">Dónde está tu dinero</p><h2>Cuentas</h2></div><button className="more-button" aria-label="Más opciones"><MoreHorizontal size={18} /></button></div><div className="account-list"><AccountRow icon="Q" name="Qik" kind="Cuenta corriente" value="24,350" color="coral" /><AccountRow icon="A" name="APAP" kind="Cuenta de ahorro" value="50,000" color="mint" /><AccountRow icon="₱" name="Efectivo" kind="Billetera" value="8,100" color="lavender" /></div><button className="add-account-button" onClick={() => toast.info("La gestión de cuentas llegará después del núcleo financiero.")}><Plus size={16} /> Añadir cuenta</button></section>
      </div>
    </>
  );
}

function TransactionRow({ transaction }: { transaction: Transaction }) {
  return <div className="transaction-row"><IconBubble transaction={transaction} /><div className="transaction-copy"><strong>{transaction.title}</strong><span>{transaction.category} · {transaction.account}</span></div><div className={`transaction-amount ${transaction.amount > 0 ? "income" : "expense"}`}><strong>{formatSignedCurrency(transaction.amount)}</strong><span>{transaction.date}</span></div><button className="row-more" aria-label={`Más opciones para ${transaction.title}`}><MoreHorizontal size={17} /></button></div>;
}

function AccountRow({ icon, name, kind, value, color }: { icon: string; name: string; kind: string; value: string; color: string }) {
  return <div className="account-row"><div className={`account-icon ${color}`}>{icon}</div><div className="account-copy"><strong>{name}</strong><span>{kind}</span></div><strong className="account-value">RD$ {value}</strong></div>;
}

function TransactionsView({ transactions, onNewMovement }: { transactions: Transaction[]; onNewMovement: () => void }) {
  return <><SectionHeading eyebrow="Actividad real" title="Movimientos" description="Todo lo que ha ocurrido con tu dinero, en un solo lugar." action={<button className="primary-button" onClick={onNewMovement}><Plus size={17} /> Nuevo movimiento</button>} /><div className="filter-bar"><div className="search-field"><Search size={16} /><input placeholder="Buscar movimientos" /></div><button className="filter-button">Este mes <ChevronDown size={15} /></button><button className="filter-button">Todos <ChevronDown size={15} /></button><button className="icon-button filter-more" aria-label="Más filtros"><Settings2 size={17} /></button></div><section className="panel transactions-page-panel"><div className="table-head"><span>Movimiento</span><span>Cuenta</span><span>Fecha</span><span className="align-right">Importe</span></div>{transactions.map((transaction) => <div className="transaction-table-row" key={transaction.id}><div className="table-movement"><IconBubble transaction={transaction} /><div><strong>{transaction.title}</strong><span>{transaction.category}</span></div></div><span className="table-muted">{transaction.account}</span><span className="table-muted">{transaction.date}</span><strong className={`align-right ${transaction.amount > 0 ? "income-text" : "expense-text"}`}>{formatSignedCurrency(transaction.amount)}</strong></div>)}</section></>;
}

function PlanView({ onNewMovement }: { onNewMovement: () => void }) {
  return <><SectionHeading eyebrow="Planificación" title="Plan" description="Decide qué quieres hacer con tu dinero antes de que llegue el momento." action={<button className="primary-button" onClick={() => toast.info("Los presupuestos detallados se habilitarán en la Fase 2.")}><Plus size={17} /> Nuevo presupuesto</button>} /><div className="plan-summary-grid"><div className="plan-summary accent"><span>Disponible para planificar</span><strong>RD$ 28,400</strong><small>Después de compromisos y reservas</small></div><div className="plan-summary"><span>Presupuestos activos</span><strong>3</strong><small>RD$ 11,520 restantes</small></div><div className="plan-summary"><span>Metas en curso</span><strong>2</strong><small>RD$ 34,000 asignados</small></div></div><div className="plan-content-grid"><section className="panel"><div className="panel-header"><div><p className="eyebrow">Este período</p><h2>Presupuestos</h2></div><button className="text-button">Gestionar <ArrowUpRight size={15} /></button></div><div className="plan-budget-list">{budgetRows.map((row) => <div className="plan-budget-row" key={row.label}><div className="plan-budget-top"><span><i className="category-color" style={{ background: row.color }} />{row.label}</span><strong>{formatCurrency(row.total - row.value)} <em>restante</em></strong></div><div className="category-progress"><span style={{ width: `${(row.value / row.total) * 100}%`, background: row.color }} /></div><span className="plan-budget-meta">{formatCurrency(row.value)} gastado de {formatCurrency(row.total)}</span></div>)}</div></section><section className="panel"><div className="panel-header"><div><p className="eyebrow">Intenciones futuras</p><h2>Planificados</h2></div><button className="text-button">Ver todos <ArrowUpRight size={15} /></button></div><div className="planned-card"><div className="calendar-tile"><strong>28</strong><span>SEP</span></div><div><strong>Internet hogar</strong><span>Pending · en 2 días</span></div><b>RD$ 1,500</b></div><div className="planned-card"><div className="calendar-tile mint-calendar"><strong>01</strong><span>OCT</span></div><div><strong>Alquiler</strong><span>Pending · en 5 días</span></div><b>RD$ 16,000</b></div><button className="wide-secondary" onClick={onNewMovement}><Plus size={15} /> Añadir planificado</button></section></div></>;
}

function ReportsView() {
  return <><SectionHeading eyebrow="Análisis" title="Reportes" description="Entiende tus tendencias sin perder de vista lo importante." action={<button className="filter-button">Septiembre 2026 <ChevronDown size={15} /></button>} /><div className="report-highlight"><div><p className="eyebrow">Gasto mensual</p><strong>RD$ 11,520</strong><span><span className="positive-trend"><ArrowDownRight size={14} /> 6.8%</span> vs. promedio mensual</span></div><div className="report-chart">{chartBars.map((bar) => <div className="chart-column" key={bar.label}><div className={`chart-bar ${bar.active ? "active" : ""}`} style={{ height: `${bar.value}%` }} /><span>{bar.label}</span></div>)}</div></div><div className="report-grid"><section className="panel"><div className="panel-header"><div><p className="eyebrow">Distribución</p><h2>Por categoría</h2></div><button className="more-button"><MoreHorizontal size={18} /></button></div><div className="donut-layout"><div className="donut-chart"><div><strong>RD$ 11.5k</strong><span>total</span></div></div><div className="donut-legend"><span><i style={{ background: "#ea6959" }} /> Vivienda <b>43%</b></span><span><i style={{ background: "#84b6a7" }} /> Alimentación <b>27%</b></span><span><i style={{ background: "#8a84b6" }} /> Transporte <b>16%</b></span><span><i style={{ background: "#e3c27a" }} /> Otros <b>14%</b></span></div></div></section><section className="panel insight-panel"><div className="insight-kicker"><Sparkles size={16} /> Lectura rápida</div><h2>Vas en buen ritmo</h2><p>Tu gasto está un <strong>6.8% por debajo</strong> de tu promedio de los últimos 3 meses. Alimentación es la categoría con más movimiento esta semana.</p><button className="wide-secondary" onClick={() => toast.info("Los reportes comparativos serán parte de la Fase 2.")}>Explorar reportes <ArrowUpRight size={15} /></button></section></div></>;
}

function NewMovementModal({ onClose, onSave }: { onClose: () => void; onSave: (entry: { title: string; amount: number; kind: EntryKind }) => void }) {
  const [kind, setKind] = useState<EntryKind>("Gasto");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const canSave = title.trim().length > 0 && Number(amount) > 0;
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="movement-modal" role="dialog" aria-modal="true" aria-labelledby="movement-title"><div className="modal-header"><div><p className="eyebrow">Acción global</p><h2 id="movement-title">Nuevo movimiento</h2></div><button className="icon-button quiet" onClick={onClose} aria-label="Cerrar"><X size={18} /></button></div><div className="kind-toggle" role="tablist" aria-label="Tipo de movimiento">{(["Gasto", "Ingreso", "Transferencia"] as EntryKind[]).map((item) => <button key={item} className={kind === item ? "active" : ""} onClick={() => setKind(item)} role="tab" aria-selected={kind === item}>{item}</button>)}</div><label className="form-label">Monto<input autoFocus value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" inputMode="decimal" /></label><label className="form-label">Descripción<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={kind === "Transferencia" ? "Cuenta de origen → destino" : "¿Qué ocurrió?"} /></label><div className="form-grid"><label className="form-label">Cuenta<select defaultValue="qik"><option value="qik">Qik</option><option value="apap">APAP</option><option value="cash">Efectivo</option></select></label><label className="form-label">Categoría<select defaultValue="food"><option value="food">Alimentación</option><option value="home">Vivienda</option><option value="transport">Transporte</option><option value="other">Otros</option></select></label></div><button className="primary-button modal-save" disabled={!canSave} onClick={() => onSave({ title: title.trim(), amount: Number(amount), kind })}><Check size={17} /> Guardar movimiento</button><p className="modal-note">Guardado localmente en este dispositivo.</p></div></div>;
}

export default function Home() {
  const [activeSection, setActiveSection] = useState<Section>("Resumen");
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const stored = localStorage.getItem("glitchbudget.transactions");
      return stored ? JSON.parse(stored) : initialTransactions;
    } catch {
      return initialTransactions;
    }
  });
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    localStorage.setItem("glitchbudget.transactions", JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    void migrateLegacyLocalStorage();
  }, [transactions]);

  const handleSave = ({ title, amount, kind }: { title: string; amount: number; kind: EntryKind }) => {
    const isIncome = kind === "Ingreso";
    const isTransfer = kind === "Transferencia";
    const newTransaction: Transaction = {
      id: `tx-${Date.now()}`,
      title,
      category: isIncome ? "Ingreso" : isTransfer ? "Transferencia" : "Otros",
      account: isTransfer ? "Qik → APAP" : "Qik",
      date: "Ahora",
      amount: isIncome ? amount : -amount,
      kind,
      icon: isIncome ? "↗" : isTransfer ? "⇄" : "•",
      tone: isIncome ? "mint" : isTransfer ? "sky" : "coral",
    };
    setTransactions((current) => [newTransaction, ...current]);
    setShowModal(false);
    toast.success("Movimiento guardado localmente", { description: `${title} · ${formatCurrency(amount)}` });
  };

  const goTo = (section: Section) => setActiveSection(section);

  return <div className="app-shell"><aside className="sidebar"><div className="brand"><LogoMark /><div><strong>Prisma</strong><span>PRIVADO / LOCAL</span></div></div><div className="sidebar-context"><span className="context-label">Espacio personal</span><button>Alex Rivera <ChevronDown size={14} /></button></div><nav className="primary-nav" aria-label="Navegación principal">{navItems.map(({ label, icon: Icon }) => <button key={label} className={activeSection === label ? "active" : ""} onClick={() => goTo(label)}><Icon size={18} /><span>{label}</span>{label === "Plan" && <i className="nav-badge">3</i>}</button>)}</nav><div className="sidebar-bottom"><div className="offline-card"><div className="offline-icon"><Check size={14} /></div><div><strong>Solo en tu dispositivo</strong><span>Datos privados y offline</span></div></div><button className="secondary-nav-button" onClick={() => toast.info("Ajustes estarán disponibles en una siguiente fase.")}><Settings2 size={17} /> Ajustes</button><button className="secondary-nav-button" onClick={() => toast.info("Tu backup local estará disponible al completar la Fase 0.")}><Download size={17} /> Backup</button><div className="user-profile"><div className="avatar">AR</div><div><strong>Alex Rivera</strong><span>Plan personal</span></div><MoreHorizontal size={18} /></div></div></aside><main className="main-content"><header className="mobile-header"><button className="mobile-menu icon-button quiet" aria-label="Abrir menú"><Menu size={20} /></button><div className="brand mobile-brand"><LogoMark /><strong>Prisma</strong></div><button className="icon-button quiet notification-button" aria-label="Notificaciones"><Bell size={18} /><span /></button></header><div className="content-wrap">{activeSection === "Resumen" && <SummaryView transactions={transactions} onNewMovement={() => setShowModal(true)} onSeeAll={() => goTo("Movimientos")} />}{activeSection === "Movimientos" && <TransactionsView transactions={transactions} onNewMovement={() => setShowModal(true)} />}{activeSection === "Plan" && <PlanView onNewMovement={() => setShowModal(true)} />}{activeSection === "Reportes" && <ReportsView />}</div></main><nav className="mobile-nav" aria-label="Navegación móvil">{navItems.map(({ label, icon: Icon }) => <button key={label} className={activeSection === label ? "active" : ""} onClick={() => goTo(label)}><Icon size={19} /><span>{label}</span></button>)}</nav>{showModal && <NewMovementModal onClose={() => setShowModal(false)} onSave={handleSave} />}<button className="mobile-fab" onClick={() => setShowModal(true)} aria-label="Nuevo movimiento"><Plus size={22} /></button></div>;
}
