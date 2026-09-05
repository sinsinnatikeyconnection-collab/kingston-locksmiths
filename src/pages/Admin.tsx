import db from "@/api/base44Client";

import React, { useState, useEffect } from "react";

import {
  ShieldAlert,
  Loader2,
  RefreshCw,
  Phone,
  Mail,
  Car,
  Cpu,
  Wrench,
  Gauge,
  ChevronRight,
  Power,
  DollarSign,
  FolderOpen,
  Plus,
  Trash2,
  X,
  Award,
  Upload,
  ImageIcon,
  ClipboardList,
  DollarSign as DollarIcon,
  Gift,
} from "lucide-react";
import LoyaltyAdminPanel from "@/components/apex/LoyaltyAdminPanel";
import type {
  AppUser,
  BookingStatus,
  BookingStage,
  Certificate,
  CertificateServiceType,
  CaseStudy,
  Invoice,
  ProblemCategory,
  ServiceBooking,
} from "@/lib/types";
import SystemHealthPanel, { type SystemHealthLog } from "@/components/apex/SystemHealthPanel";

type IconType = React.ComponentType<{ className?: string }>;

const CATEGORY_ICONS: Record<ProblemCategory, IconType> = {
  "Lost Keys / Security & Lockout": Cpu,
  "Electrical & Diagnostics": Car,
  "Mechanical Repair": Wrench,
  "Performance & Tuning": Gauge,
};

const ACCENT: Record<ProblemCategory, "cyan" | "heat"> = {
  "Lost Keys / Security & Lockout": "cyan",
  "Electrical & Diagnostics": "cyan",
  "Mechanical Repair": "heat",
  "Performance & Tuning": "heat",
};

type AdminTab = "bookings" | "revenue" | "cases" | "certs" | "loyalty" | "health";

const TABS: { id: AdminTab; label: string; icon: IconType }[] = [
  { id: "bookings", label: "Bookings", icon: Car },
  { id: "revenue", label: "Revenue", icon: DollarSign },
  { id: "cases", label: "Case Studies", icon: FolderOpen },
  { id: "certs", label: "Certificates", icon: Award },
  { id: "loyalty", label: "Loyalty", icon: Gift },
  { id: "health", label: "System Health", icon: ShieldAlert },
];

const STAT_FILTERS: (BookingStatus | "all")[] = ["all", "received", "reviewing", "scheduled", "completed"];

const STATUS_COLOR: Record<BookingStatus, string> = {
  received: "text-cyan border-cyan/40",
  reviewing: "text-yellow-400 border-yellow-400/40",
  scheduled: "text-data border-cyan/30",
  completed: "text-green-400 border-green-400/40",
};

const NEXT_STATUS: Partial<Record<BookingStatus, BookingStatus>> = {
  received: "reviewing",
  reviewing: "scheduled",
  scheduled: "completed",
};

const STAGE_ORDER: BookingStage[] = ["booked", "diagnosing", "in_progress", "quality_check", "ready_for_pickup", "complete"];

const STAGE_LABEL: Record<BookingStage, string> = {
  booked: "Booked",
  diagnosing: "Diagnosing",
  in_progress: "In Progress",
  quality_check: "Quality Check",
  ready_for_pickup: "Ready for Pickup",
  complete: "Complete",
};

const STAGE_TO_STATUS: Record<BookingStage, BookingStatus> = {
  booked: "received",
  diagnosing: "reviewing",
  in_progress: "scheduled",
  quality_check: "scheduled",
  ready_for_pickup: "scheduled",
  complete: "completed",
};

const STATUS_TO_STAGE_INV: Record<BookingStatus, BookingStage> = {
  received: "booked",
  reviewing: "diagnosing",
  scheduled: "in_progress",
  completed: "complete",
};

const SERVICE_TYPES: CertificateServiceType[] = ["ECU Clone", "Cluster Calibration", "Engine Swap", "Key Programming", "Module Programming", "Other"];

interface CaseForm {
  image_url: string;
  side: "Digital" | "Physical";
  title: string;
  tag: string;
  order: number | string;
}

interface CertForm {
  owner_email: string;
  vehicle: string;
  vin: string;
  service_type: CertificateServiceType;
  mileage_at_service: string;
  technician_name: string;
  performed_date: string;
  notes: string;
}

const EMPTY_CASE: CaseForm = { image_url: "", side: "Digital", title: "", tag: "", order: 0 };
const EMPTY_CERT: CertForm = { owner_email: "", vehicle: "", vin: "", service_type: "ECU Clone", mileage_at_service: "", technician_name: "", performed_date: "", notes: "" };

export default function Admin() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [filter, setFilter] = useState<BookingStatus | "all">("all");
  const [tab, setTab] = useState<AdminTab>("bookings");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [cases, setCases] = useState<CaseStudy[]>([]);
  const [caseForm, setCaseForm] = useState<CaseForm>(EMPTY_CASE);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [certForm, setCertForm] = useState<CertForm>(EMPTY_CERT);
  const [logs, setLogs] = useState<SystemHealthLog[]>([]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      try {
        const me = (await db.auth.me()) as AppUser;
        setUser(me);
        const list = (await db.entities.ServiceBooking.list("-created_date", 200)) as ServiceBooking[];
        setBookings(list);
        const [inv, cs, ct, lg] = await Promise.all([
          db.entities.Invoice.filter({}).catch(() => []),
          db.entities.CaseStudy.list("order", 200).catch(() => []),
          db.entities.Certificate.list("-created_date", 200).catch(() => []),
          db.entities.SystemHealthLog.list("-created_date", 200).catch(() => []),
        ]);
        setInvoices(inv as Invoice[]);
        setCases(cs as CaseStudy[]);
        setCerts(ct as Certificate[]);
        setLogs(lg as SystemHealthLog[]);
        unsub = db.entities.ServiceBooking.subscribe((event: { type: string; data?: ServiceBooking; id?: string }) => {
          setBookings((prev) => {
            if (event.type === "create" && event.data) return [event.data, ...prev];
            if (event.type === "update" && event.data) return prev.map((b) => (b.id === event.data!.id ? event.data! : b));
            if (event.type === "delete" && event.id) return prev.filter((b) => b.id !== event.id);
            return prev;
          });
        });
      } catch (_e) {
        // not authenticated
      } finally {
        setLoading(false);
      }
    })();
    return () => unsub && unsub();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-titanium flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan animate-spin" />
      </div>
    );
  }

  if (!user) {
    window.location.href = "/login?returnTo=/admin";
    return null;
  }

  if (user.role !== "admin") {
    return (
      <div className="min-h-screen bg-titanium flex flex-col items-center justify-center px-6 text-center">
        <ShieldAlert className="w-14 h-14 text-heat mb-5" />
        <h1 className="font-heading text-3xl uppercase text-data mb-3">Access Denied</h1>
        <p className="font-mono text-xs text-muted-foreground max-w-sm">
          // Insufficient privileges. This command center is restricted to the
          system administrator.
        </p>
      </div>
    );
  }

  const visible = filter === "all" ? bookings : bookings.filter((b) => b.status === filter);
  const counts: Record<BookingStatus, number> = {
    received: bookings.filter((b) => b.status === "received").length,
    reviewing: bookings.filter((b) => b.status === "reviewing").length,
    scheduled: bookings.filter((b) => b.status === "scheduled").length,
    completed: bookings.filter((b) => b.status === "completed").length,
  };

  const paidInvoices = invoices.filter((i) => i.status === "paid");
  const unpaidInvoices = invoices.filter((i) => i.status === "unpaid");
  const sum = (arr: Invoice[]): number => arr.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const revenuePaid = sum(paidInvoices);
  const revenueOutstanding = sum(unpaidInvoices);

  const resetCaseForm = () => {
    setCaseForm(EMPTY_CASE);
    setEditingId(null);
  };

  const reloadInvoices = async () => {
    try {
      const inv = (await db.entities.Invoice.filter({})) as Invoice[];
      setInvoices(inv || []);
    } catch (_e) { /* best-effort */ }
  };

  const saveCase = async () => {
    if (!caseForm.image_url || !caseForm.title) return;
    const payload: Omit<CaseStudy, "id" | "created_date" | "updated_date" | "created_by_id"> & { id?: string } = {
      ...caseForm,
      order: Number(caseForm.order) || 0,
    };
    if (editingId) await db.entities.CaseStudy.update(editingId, payload);
    else { await db.entities.CaseStudy.create(payload); db.functions.invoke("pingSearchEngines", {}).catch(() => {}); }
    setCases((await db.entities.CaseStudy.list("order", 200)) as CaseStudy[]);
    resetCaseForm();
  };

  const editCase = (c: CaseStudy) => {
    setEditingId(c.id);
    setCaseForm({ image_url: c.image_url || "", side: c.side || "Digital", title: c.title || "", tag: c.tag || "", order: c.order || 0 });
  };

  const deleteCase = async (id: string) => {
    await db.entities.CaseStudy.delete(id);
    setCases((prev) => prev.filter((c) => c.id !== id));
  };

  const saveCert = async () => {
    if (!certForm.owner_email || !certForm.vehicle || !certForm.service_type) return;
    const code = "SKC-" + Date.now().toString().slice(-6).toUpperCase();
    await db.entities.Certificate.create({ ...certForm, certificate_code: code });
    setCerts((await db.entities.Certificate.list("-created_date", 200)) as Certificate[]);
    setCertForm(EMPTY_CERT);
  };

  const deleteCert = async (id: string) => {
    await db.entities.Certificate.delete(id);
    setCerts((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="min-h-screen bg-titanium text-data pb-20">
      <header className="border-b border-cyan/20 bg-blueprint/40 px-6 lg:px-10 py-6 sticky top-0 z-30 backdrop-blur">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Power className="w-4 h-4 text-cyan animate-pulse" />
              <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-cyan">Command Center // Live</span>
            </div>
            <h1 className="font-heading text-2xl uppercase text-data leading-none">
              Sinsinnati Key <span className="text-cyan">Conn.</span>
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <a href="/" className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-cyan transition-colors">▸ View site</a>
            <button onClick={() => window.location.reload()} className="flex items-center gap-1.5 border border-cyan/30 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-cyan hover:glow-cyan transition-all">
              <RefreshCw className="w-3.5 h-3.5" /> Sync
            </button>
          </div>
        </div>

        {/* tab nav */}
        <div className="max-w-[1400px] mx-auto mt-5 flex items-center gap-2 flex-wrap">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider px-3 py-2 border transition-all ${tab === t.id ? "border-cyan bg-cyan/10 text-cyan glow-cyan" : "border-cyan/20 text-muted-foreground hover:border-cyan/50"}`}>
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8">
        {tab === "bookings" && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-cyan/10 border border-cyan/10 mb-8">
              {([
                { k: "received", label: "New Intakes", color: "text-cyan" },
                { k: "reviewing", label: "Reviewing", color: "text-yellow-400" },
                { k: "scheduled", label: "Scheduled", color: "text-data" },
                { k: "completed", label: "Completed", color: "text-green-400" },
              ] as { k: BookingStatus; label: string; color: string }[]).map((s) => (
                <div key={s.k} className="bg-titanium p-4">
                  <div className={`font-mono text-3xl font-bold ${s.color}`}>{counts[s.k]}</div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 mb-6 overflow-x-auto">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mr-1">Filter:</span>
              {STAT_FILTERS.map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={`font-mono text-[10px] uppercase tracking-wider px-3 py-1.5 border transition-all whitespace-nowrap ${filter === f ? "border-cyan bg-cyan/10 text-cyan glow-cyan" : "border-cyan/20 text-muted-foreground hover:border-cyan/50"}`}>
                  {f}
                </button>
              ))}
            </div>

            {visible.length === 0 ? (
              <div className="border border-dashed border-cyan/20 py-20 text-center">
                <Car className="w-10 h-10 text-muted-foreground/40 mx-auto mb-4" />
                <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">No bookings in this channel yet.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {visible.map((b) => (<BookingCard key={b.id} b={b} onReload={reloadInvoices} />))}
              </div>
            )}
          </>
        )}

        {tab === "revenue" && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-cyan/10 border border-cyan/10 mb-8">
              <div className="bg-titanium p-5">
                <div className="font-mono text-3xl font-bold text-green-400">${revenuePaid.toFixed(2)}</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Collected ({paidInvoices.length})</div>
              </div>
              <div className="bg-titanium p-5">
                <div className="font-mono text-3xl font-bold text-heat">${revenueOutstanding.toFixed(2)}</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Outstanding ({unpaidInvoices.length})</div>
              </div>
              <div className="bg-titanium p-5">
                <div className="font-mono text-3xl font-bold text-cyan">${(revenuePaid + revenueOutstanding).toFixed(2)}</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Total Issued ({invoices.length})</div>
              </div>
            </div>

            {invoices.length === 0 ? (
              <div className="border border-dashed border-cyan/20 py-20 text-center">
                <DollarSign className="w-10 h-10 text-muted-foreground/40 mx-auto mb-4" />
                <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">No invoices issued yet.</div>
              </div>
            ) : (
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <div key={inv.id} className="border border-cyan/15 bg-titanium px-5 py-4 flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <div className="font-mono text-sm text-data">{inv.invoice_code}</div>
                      <div className="font-mono text-[10px] text-muted-foreground truncate">{inv.owner_email} · {inv.description || "Service"}</div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-heading text-lg text-data">${Number(inv.amount || 0).toFixed(2)}</span>
                      <span className={`font-mono text-[10px] uppercase px-2 py-1 border ${inv.status === "paid" ? "text-green-400 border-green-400/40" : "text-heat border-heat/40"}`}>{inv.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "cases" && (
          <>
            <div className="border border-cyan/20 bg-blueprint/30 p-5 mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="font-mono text-xs uppercase tracking-widest text-cyan">{editingId ? "// Edit Case Study" : "// New Case Study"}</div>
                {editingId && <button onClick={resetCaseForm} className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-heat"><X className="w-3.5 h-3.5" /> Cancel</button>}
              </div>
              <div className="grid sm:grid-cols-2 gap-3 mb-3">
                <input value={caseForm.image_url} onChange={(e) => setCaseForm({ ...caseForm, image_url: e.target.value })} placeholder="Image URL" className="bg-titanium border border-cyan/20 px-3 py-2 font-body text-sm text-data focus:border-cyan focus:outline-none" />
                <select value={caseForm.side} onChange={(e) => setCaseForm({ ...caseForm, side: e.target.value as "Digital" | "Physical" })} className="bg-titanium border border-cyan/20 px-3 py-2 font-body text-sm text-data focus:border-cyan focus:outline-none">
                  <option value="Digital">Digital</option>
                  <option value="Physical">Physical</option>
                </select>
                <input value={caseForm.title} onChange={(e) => setCaseForm({ ...caseForm, title: e.target.value })} placeholder="Title" className="bg-titanium border border-cyan/20 px-3 py-2 font-body text-sm text-data focus:border-cyan focus:outline-none" />
                <input value={caseForm.tag} onChange={(e) => setCaseForm({ ...caseForm, tag: e.target.value })} placeholder="Tag (e.g. IMMO_CLONE_SUCCESSFUL: 2023 BMW M4)" className="bg-titanium border border-cyan/20 px-3 py-2 font-mono text-xs text-data focus:border-cyan focus:outline-none" />
                <input type="number" value={caseForm.order} onChange={(e) => setCaseForm({ ...caseForm, order: e.target.value })} placeholder="Order" className="bg-titanium border border-cyan/20 px-3 py-2 font-mono text-sm text-data focus:border-cyan focus:outline-none" />
              </div>
              <button onClick={saveCase} className="inline-flex items-center gap-1.5 bg-cyan text-titanium font-mono text-xs uppercase px-4 py-2.5 hover:glow-cyan">
                <Plus className="w-4 h-4" /> {editingId ? "Update" : "Publish"} Case Study
              </button>
            </div>

            {cases.length === 0 ? (
              <div className="border border-dashed border-cyan/20 py-20 text-center">
                <FolderOpen className="w-10 h-10 text-muted-foreground/40 mx-auto mb-4" />
                <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">No case studies published yet.</div>
              </div>
            ) : (
              <div className="space-y-2">
                {cases.map((c) => (
                  <div key={c.id} className="border border-cyan/15 bg-titanium px-4 py-3 flex items-center gap-4">
                    <img src={c.image_url} alt={c.title} className="w-16 h-12 object-cover border border-cyan/20 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-sm text-data truncate">{c.title}</div>
                      <div className="font-mono text-[10px] text-muted-foreground">{c.side} · {c.tag}</div>
                    </div>
                    <button onClick={() => editCase(c)} className="font-mono text-[11px] uppercase text-cyan hover:underline">Edit</button>
                    <button onClick={() => deleteCase(c.id)} className="text-heat hover:bg-heat/10 p-1.5"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {tab === "certs" && (
          <>
            <div className="border border-cyan/20 bg-blueprint/30 p-5 mb-8">
              <div className="font-mono text-xs uppercase tracking-widest text-cyan mb-4">// Issue Digital Certificate</div>
              <div className="grid sm:grid-cols-2 gap-3 mb-3">
                <input value={certForm.owner_email} onChange={(e) => setCertForm({ ...certForm, owner_email: e.target.value })} placeholder="Owner email" className="bg-titanium border border-cyan/20 px-3 py-2 font-body text-sm text-data focus:border-cyan focus:outline-none" />
                <input value={certForm.vehicle} onChange={(e) => setCertForm({ ...certForm, vehicle: e.target.value })} placeholder="Vehicle (year/make/model)" className="bg-titanium border border-cyan/20 px-3 py-2 font-body text-sm text-data focus:border-cyan focus:outline-none" />
                <input value={certForm.vin} onChange={(e) => setCertForm({ ...certForm, vin: e.target.value })} placeholder="VIN" className="bg-titanium border border-cyan/20 px-3 py-2 font-mono text-xs text-data focus:border-cyan focus:outline-none" />
                <select value={certForm.service_type} onChange={(e) => setCertForm({ ...certForm, service_type: e.target.value as CertificateServiceType })} className="bg-titanium border border-cyan/20 px-3 py-2 font-body text-sm text-data focus:border-cyan focus:outline-none">
                  {SERVICE_TYPES.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
                <input value={certForm.mileage_at_service} onChange={(e) => setCertForm({ ...certForm, mileage_at_service: e.target.value })} placeholder="Mileage at service" className="bg-titanium border border-cyan/20 px-3 py-2 font-body text-sm text-data focus:border-cyan focus:outline-none" />
                <input value={certForm.technician_name} onChange={(e) => setCertForm({ ...certForm, technician_name: e.target.value })} placeholder="Technician name" className="bg-titanium border border-cyan/20 px-3 py-2 font-body text-sm text-data focus:border-cyan focus:outline-none" />
                <input type="date" value={certForm.performed_date} onChange={(e) => setCertForm({ ...certForm, performed_date: e.target.value })} className="bg-titanium border border-cyan/20 px-3 py-2 font-mono text-sm text-data focus:border-cyan focus:outline-none" />
                <input value={certForm.notes} onChange={(e) => setCertForm({ ...certForm, notes: e.target.value })} placeholder="Notes" className="bg-titanium border border-cyan/20 px-3 py-2 font-body text-sm text-data focus:border-cyan focus:outline-none" />
              </div>
              <button onClick={saveCert} className="inline-flex items-center gap-1.5 bg-cyan text-titanium font-mono text-xs uppercase px-4 py-2.5 hover:glow-cyan">
                <Award className="w-4 h-4" /> Issue Certificate
              </button>
            </div>

            {certs.length === 0 ? (
              <div className="border border-dashed border-cyan/20 py-20 text-center">
                <Award className="w-10 h-10 text-muted-foreground/40 mx-auto mb-4" />
                <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">No certificates issued yet.</div>
              </div>
            ) : (
              <div className="space-y-2">
                {certs.map((c) => (
                  <div key={c.id} className="border border-cyan/15 bg-titanium px-4 py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-mono text-sm text-data truncate">{c.certificate_code} · {c.service_type}</div>
                      <div className="font-mono text-[10px] text-muted-foreground truncate">{c.vehicle} · {c.owner_email} · {c.performed_date || "—"}</div>
                    </div>
                    <button onClick={() => deleteCert(c.id)} className="text-heat hover:bg-heat/10 p-1.5"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "loyalty" && <LoyaltyAdminPanel />}

        {tab === "health" && (
          <SystemHealthPanel logs={logs} />
        )}
      </div>
    </div>
  );
}

interface BookingCardProps {
  b: ServiceBooking;
  onReload: () => void;
}
function BookingCard({ b, onReload }: BookingCardProps) {
  const [open, setOpen] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [noteDraft, setNoteDraft] = useState<string>("");
  const [techName, setTechName] = useState<string>(b.technician_name || "");
  const [invOpen, setInvOpen] = useState<boolean>(false);
  const [invAmount, setInvAmount] = useState<string>("");
  const [invDesc, setInvDesc] = useState<string>("");
  const Icon = (b.problem_category && CATEGORY_ICONS[b.problem_category]) || Car;
  const accent = (b.problem_category && ACCENT[b.problem_category]) || "cyan";
  const created = b.created_date ? new Date(b.created_date).toLocaleString("en-US", { timeZone: "America/New_York" }) : "";

  const stage: BookingStage =
    b.progress_stage && STAGE_ORDER.includes(b.progress_stage)
      ? b.progress_stage
      : STATUS_TO_STAGE_INV[b.status] || "booked";
  const stageIdx = STAGE_ORDER.indexOf(stage);

  const setStage = async (s: BookingStage) => {
    if (s === stage || busy) return;
    setBusy(true);
    try {
      await db.entities.ServiceBooking.update(b.id, { progress_stage: s, status: STAGE_TO_STATUS[s] });
    } catch (_e) { /* subscription will not fire; user can retry */ }
    finally { setBusy(false); }
  };

  const addNote = async () => {
    const text = noteDraft.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const notes = [...(b.technician_notes || []), text];
      const patch: Partial<ServiceBooking> = { technician_notes: notes };
      if (techName.trim()) patch.technician_name = techName.trim();
      await db.entities.ServiceBooking.update(b.id, patch);
      setNoteDraft("");
    } catch (_e) { /* ignore */ }
    finally { setBusy(false); }
  };

  const onProgressPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0 || busy) return;
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files).slice(0, 6)) {
        const { file_url } = await db.integrations.Core.UploadFile({ file: f });
        urls.push(file_url);
      }
      const photos = [...(b.progress_photos || []), ...urls].slice(0, 12);
      await db.entities.ServiceBooking.update(b.id, { progress_photos: photos });
    } catch (_e) { /* ignore */ }
    finally { setBusy(false); }
  };

  const removeProgressPhoto = async (idx: number) => {
    if (busy) return;
    setBusy(true);
    try {
      const photos = (b.progress_photos || []).filter((_, i) => i !== idx);
      await db.entities.ServiceBooking.update(b.id, { progress_photos: photos });
    } finally { setBusy(false); }
  };

  const issueInvoice = async () => {
    const amt = Number(invAmount);
    if (!amt || amt < 0.5 || !invDesc.trim() || busy) return;
    setBusy(true);
    try {
      const code = "SKC-INF-" + Date.now().toString().slice(-6).toUpperCase();
      await db.entities.Invoice.create({
        invoice_code: code,
        owner_email: b.customer_email,
        owner_email_lower: b.customer_email.toLowerCase(),
        description: invDesc.trim(),
        amount: amt,
        status: "unpaid",
      });
      setInvOpen(false);
      setInvAmount("");
      setInvDesc("");
      onReload();
    } catch (_e) { /* ignore */ }
    finally { setBusy(false); }
  };

  return (
    <div className="border border-cyan/15 bg-titanium">
      <button onClick={() => setOpen(!open)} className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-blueprint/30 transition-colors">
        <Icon className={`w-5 h-5 shrink-0 ${accent === "heat" ? "text-heat" : "text-cyan"}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-heading text-sm uppercase text-data">{b.year || ""} {b.make || ""} {b.model || ""}</span>
            <span className={`font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 border ${STATUS_COLOR[b.status] || ""}`}>{b.status}</span>
            <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 border border-cyan/30 text-cyan">{STAGE_LABEL[stage]}</span>
            {b.urgency?.includes("Emergency") && <span className="font-mono text-[9px] uppercase tracking-wider text-heat border border-heat/40 px-2 py-0.5">EMERGENCY</span>}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground mt-1 truncate">{b.problem_category} • {b.customer_name} • {created}</div>
        </div>
        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-cyan/15 px-5 py-5">
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <Row label="VIN" value={b.vin} mono />
              <Row label="Engine" value={b.engine_size} />
              <Row label="Category" value={b.problem_category} />
              <Row label="Problem area" value={b.problem_location} />
              <Row label="Urgency" value={b.urgency} />
              <Row label="Slot" value={b.scheduled_date} mono />
              <Row label="Detail" value={b.problem_detail} block />
              {b.reference_code && <Row label="Ref" value={b.reference_code} mono />}
            </div>
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-cyan mb-3">// Customer Contact</div>
              <a href={`tel:${(b.customer_phone || "").replace(/[^0-9]/g, "")}`} className="flex items-center gap-2 py-2 hover:text-cyan transition-colors">
                <Phone className="w-4 h-4 text-cyan" /><span className="font-mono text-sm">{b.customer_phone || "n/a"}</span>
              </a>
              <a href={`mailto:${b.customer_email}`} className="flex items-center gap-2 py-2 hover:text-cyan transition-colors break-all">
                <Mail className="w-4 h-4 text-cyan" /><span className="font-mono text-sm">{b.customer_email || "n/a"}</span>
              </a>
              <div className="font-mono text-sm py-2 text-data"><span className="text-muted-foreground">Name: </span>{b.customer_name || "n/a"}</div>
              {b.photo_urls && b.photo_urls.length > 0 && (
                <div className="mt-3">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-cyan mb-2">// Evidence</div>
                  <div className="grid grid-cols-3 gap-2">
                    {b.photo_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer" className="block aspect-square border border-cyan/20 overflow-hidden">
                        <img src={url} alt={`evidence ${i + 1}`} className="w-full h-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stage pipeline controls */}
          <div className="mt-6 border-t border-cyan/10 pt-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-cyan"><ClipboardList className="w-3.5 h-3.5" /> // Service Tracker Stage</div>
              <button onClick={() => setStage(STAGE_ORDER[stageIdx + 1] || stage)} disabled={busy || stageIdx >= STAGE_ORDER.length - 1} className="font-mono text-[10px] uppercase tracking-wider border border-cyan/40 text-cyan px-3 py-1.5 hover:glow-cyan disabled:opacity-40 transition-all">Advance →</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {STAGE_ORDER.map((s, i) => {
                const reached = i <= stageIdx;
                const active = i === stageIdx;
                return (
                  <button key={s} onClick={() => setStage(s)} disabled={busy} className={`font-mono text-[10px] uppercase tracking-wider px-2.5 py-1.5 border transition-all ${active ? "border-cyan bg-cyan/15 text-cyan glow-cyan" : reached ? "border-cyan/40 text-cyan/80" : "border-cyan/15 text-muted-foreground/60 hover:border-cyan/40"} disabled:opacity-50`}>
                    {STAGE_LABEL[s]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Technician notes */}
          <div className="mt-5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-cyan mb-3"> // Technician Notes</div>
            {b.technician_notes && b.technician_notes.length > 0 && (
              <ul className="space-y-1.5 mb-3">
                {b.technician_notes.map((n, i) => (
                  <li key={i} className="font-body text-sm text-data/85 leading-relaxed flex gap-2"><span className="font-mono text-cyan/70 shrink-0">▸</span>{n}</li>
                ))}
              </ul>
            )}
            <div className="grid sm:grid-cols-3 gap-2">
              <input value={techName} onChange={(e) => setTechName(e.target.value)} placeholder="Tech name" className="bg-titanium border border-cyan/20 px-3 py-2 font-mono text-xs text-data focus:border-cyan focus:outline-none" />
              <input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="New note…" className="sm:col-span-2 bg-titanium border border-cyan/20 px-3 py-2 font-body text-sm text-data focus:border-cyan focus:outline-none" onKeyDown={(e) => { if (e.key === "Enter") addNote(); }} />
            </div>
            <button onClick={addNote} disabled={busy || !noteDraft.trim()} className="mt-2 inline-flex items-center gap-1.5 bg-cyan/10 border border-cyan/40 text-cyan font-mono text-[11px] uppercase tracking-wider px-3 py-2 hover:glow-cyan disabled:opacity-40 transition-all"><Plus className="w-3.5 h-3.5" /> Add Note</button>
          </div>

          {/* Progress photos */}
          <div className="mt-5">
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-cyan mb-3"><ImageIcon className="w-3.5 h-3.5" /> // Progress Photos</div>
            {b.progress_photos && b.progress_photos.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-3">
                {b.progress_photos.map((url, i) => (
                  <div key={i} className="relative aspect-square border border-cyan/20 overflow-hidden group">
                    <img src={url} alt={`progress ${i + 1}`} className="w-full h-full object-cover" />
                    <button onClick={() => removeProgressPhoto(i)} disabled={busy} className="absolute top-1 right-1 w-5 h-5 bg-titanium/80 border border-heat/40 text-heat text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                  </div>
                ))}
              </div>
            )}
            <label className="inline-flex items-center gap-1.5 border border-dashed border-cyan/30 text-cyan/80 font-mono text-[11px] uppercase tracking-wider px-4 py-2.5 cursor-pointer hover:border-cyan/60 hover:bg-cyan/5 transition-all">
              <Upload className="w-3.5 h-3.5" /> Upload progress photos
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onProgressPhotos(e.target.files)} />
            </label>
            {busy && <span className="ml-3 font-mono text-[10px] text-cyan/60 inline-flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> working…</span>}
          </div>

          {/* Invoice generation */}
          <div className="mt-5 border-t border-cyan/10 pt-5">
            <button onClick={() => setInvOpen(!invOpen)} className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider border border-cyan/40 text-cyan px-3 py-2 hover:glow-cyan transition-all"><DollarSign className="w-3.5 h-3.5" /> Issue Invoice</button>
            {invOpen && (
              <div className="mt-3 grid sm:grid-cols-3 gap-2">
                <input type="number" min="0.5" step="0.01" value={invAmount} onChange={(e) => setInvAmount(e.target.value)} placeholder="Amount $" className="bg-titanium border border-cyan/20 px-3 py-2 font-mono text-sm text-data focus:border-cyan focus:outline-none" />
                <input value={invDesc} onChange={(e) => setInvDesc(e.target.value)} placeholder="Description" className="sm:col-span-2 bg-titanium border border-cyan/20 px-3 py-2 font-body text-sm text-data focus:border-cyan focus:outline-none" />
                <button onClick={issueInvoice} disabled={busy || !invAmount || !invDesc.trim()} className="sm:col-span-3 inline-flex items-center justify-center gap-1.5 bg-cyan text-titanium font-mono text-[11px] uppercase tracking-wider px-4 py-2.5 hover:glow-cyan disabled:opacity-40 transition-all"><Plus className="w-3.5 h-3.5" /> Create Invoice for {b.customer_email}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface RowProps {
  label: string;
  value?: string;
  mono?: boolean;
  block?: boolean;
}
function Row({ label, value, mono, block }: RowProps) {
  return (
    <div className={`py-1.5 ${block ? "" : "flex gap-3"}`}>
      <div className="font-mono text-[10px] uppercase tracking-wider text-cyan shrink-0 w-28 pt-0.5">{label}</div>
      <div className={`text-sm text-data/90 ${mono ? "font-mono text-xs" : ""}`}>{value || "n/a"}</div>
    </div>
  );
}