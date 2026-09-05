import React, { useState, useEffect, Suspense, lazy } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import PageShell from "@/components/apex/PageShell";
import { Link } from "react-router-dom";
import { Loader2, Cpu, Truck, Award, Wrench, Receipt, ShieldCheck, ChevronRight, User, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import type { ServiceBooking, Certificate, MailInRequest, Invoice } from "@/lib/types";
import { validateEmail } from "@/lib/validation";
import { safeInvoke } from "@/lib/safeInvoke";
import ReconnectingBoundary from "@/components/apex/ReconnectingBoundary";
import SecureCheckoutBadge from "@/components/apex/SecureCheckoutBadge";

const ShopStatusBoard = lazy(() => import("@/components/apex/ShopStatusBoard"));
const DigitalTwin = lazy(() => import("@/components/apex/DigitalTwin"));

type TabId = "bookings" | "certs" | "mailin" | "invoices" | "bench" | "twin" | "settings";

interface TabDef {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabDef[] = [
  { id: "bookings", label: "My Bookings", icon: Wrench },
  { id: "certs", label: "Certificates", icon: Award },
  { id: "mailin", label: "Mail-Ins", icon: Truck },
  { id: "invoices", label: "Invoices", icon: Receipt },
  { id: "bench", label: "Shop Bench", icon: Cpu },
  { id: "twin", label: "Digital Twin", icon: ShieldCheck },
  { id: "settings", label: "Account", icon: User },
];

interface TransferState {
  certId: string | null;
  email: string;
  busy: boolean;
}

interface TransferResult {
  data?: { status?: string; error?: string };
}

export default function Portal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<TabId>("bookings");
  const [loading, setLoading] = useState<boolean>(true);
  const [bookings, setBookings] = useState<ServiceBooking[]>([]);
  const [certs, setCerts] = useState<Certificate[]>([]);
  const [mailin, setMailin] = useState<MailInRequest[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [transfer, setTransfer] = useState<TransferState>({ certId: null, email: "", busy: false });
  const [deleting, setDeleting] = useState<boolean>(false);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);

  const load = async () => {
    setLoading(true);
    try {
      const [b, c, m, i] = await Promise.all([
        base44.entities.ServiceBooking.list("-created_date", 100).catch(() => []),
        base44.entities.Certificate.list("-created_date", 100).catch(() => []),
        base44.entities.MailInRequest.list("-created_date", 100).catch(() => []),
        base44.entities.Invoice.list("-created_date", 100).catch(() => []),
      ]);
      setBookings(Array.isArray(b) ? (b as ServiceBooking[]) : ((b as { data?: ServiceBooking[] })?.data || []));
      setCerts(Array.isArray(c) ? (c as Certificate[]) : ((c as { data?: Certificate[] })?.data || []));
      setMailin(Array.isArray(m) ? (m as MailInRequest[]) : ((m as { data?: MailInRequest[] })?.data || []));
      setInvoices(Array.isArray(i) ? (i as Invoice[]) : ((i as { data?: Invoice[] })?.data || []));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <PageShell title="Customer Portal" tagline="// Your Garage in the Cloud">
      <div className="max-w-[1100px] mx-auto px-6 lg:px-10 py-10">
        <div className="flex flex-wrap gap-1.5 mb-8 border-b border-cyan/10 pb-3">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider px-3 py-2 border transition-all ${
                  tab === t.id ? "border-cyan text-cyan bg-cyan/5" : "border-transparent text-muted-foreground hover:text-cyan"
                }`}
              >
                <Icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            );
          })}
        </div>

        {loading && <div className="flex items-center gap-2 text-cyan font-mono text-xs py-16"><Loader2 className="w-4 h-4 animate-spin" /> syncing account…</div>}

        {!loading && tab === "bookings" && (
          <div className="space-y-2">
            {bookings.length === 0 ? <Empty label="No bookings yet" cta={<Link to="/#intake" className="text-cyan underline">Book a service →</Link>} /> : bookings.map((b) => (
              <Row key={b.id} title={`${b.year} ${b.make} ${b.model}`} sub={b.problem_category} status={b.status} extra={`VIN ${b.vin} • ${b.urgency}`} />
            ))}
          </div>
        )}
        {!loading && tab === "certs" && (
          <div className="space-y-3">
            {certs.length === 0 ? <Empty label="No certificates yet" text="We issue an immutable digital certificate after every ECU clone, cluster calibration, or engine swap." /> : certs.map((c) => (
              <div key={c.id} className="border border-cyan/20 bg-blueprint/30 px-5 py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-mono text-sm text-data">{c.service_type}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{c.vehicle} • VIN {c.vin}</div>
                    <div className="font-mono text-[10px] text-muted-foreground/60 mt-1">Code: {c.certificate_code} • {c.technician_name} • {c.performed_date}</div>
                  </div>
                  <span className="font-mono text-[10px] uppercase px-2 py-1 border border-cyan text-cyan shrink-0">CERTIFIED</span>
                </div>
                {transfer.certId === c.id ? (
                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <input value={transfer.email} onChange={(e) => setTransfer({ ...transfer, email: e.target.value })} placeholder="new buyer's email" className="flex-1 bg-titanium border border-cyan/20 px-3 py-2 font-body text-sm text-data focus:border-cyan focus:outline-none" />
                    <button
                      onClick={async () => {
                        const emailR = validateEmail(transfer.email);
                        if (!emailR.ok) { toast({ title: "Invalid email", description: emailR.error, variant: "destructive" }); return; }
                        setTransfer({ ...transfer, busy: true });
                        try {
                          const result = await safeInvoke(() => base44.functions.invoke("transferCertificate", { certificateId: c.id, currentOwnerEmail: user?.email, newOwnerEmail: transfer.email }));
                          const data = result.ok ? result.value?.data : undefined;
                          if (result.ok && data?.status === "transferred") { toast({ title: "Certificate transferred", description: "Ownership moved to " + transfer.email }); setTransfer({ certId: null, email: "", busy: false }); load(); }
                          else if (!result.ok) toast({ title: result.retryable ? "Network interrupted" : "Transfer failed", description: result.error, variant: "destructive" });
                          else toast({ title: "Transfer failed", description: data?.error || "Try again.", variant: "destructive" });
                        } catch (e) { toast({ title: "Transfer failed", description: (e as Error).message, variant: "destructive" }); }
                        setTransfer((t) => ({ ...t, busy: false }));
                      }}
                      disabled={transfer.busy}
                      className="font-mono text-xs uppercase bg-cyan text-titanium px-4 py-2 hover:glow-cyan disabled:opacity-50"
                    >{transfer.busy ? "Transferring…" : "Confirm Transfer"}</button>
                    <button onClick={() => setTransfer({ certId: null, email: "", busy: false })} className="font-mono text-xs text-muted-foreground px-3 py-2">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setTransfer({ certId: c.id, email: "", busy: false })} className="mt-3 font-mono text-[11px] uppercase text-cyan hover:underline">Transfer to new buyer →</button>
                )}
                {c.notes && <div className="mt-3 font-mono text-[10px] text-muted-foreground/50 border-t border-cyan/10 pt-2">{c.notes}</div>}
              </div>
            ))}
          </div>
        )}
        {!loading && tab === "mailin" && (
          <div className="space-y-2">
            {mailin.length === 0 ? <Empty label="No mail-in requests" cta={<Link to="/mail-in" className="text-cyan underline">Ship a module →</Link>} /> : mailin.map((m) => (
              <Row key={m.id} title={`${m.item_type} — ${m.vehicle}`} sub={m.problem} status={m.status?.replace(/_/g, " ")} extra={m.tracking_number ? `Tracking: ${m.tracking_number}` : "Label pending"} />
            ))}
          </div>
        )}
        {!loading && tab === "invoices" && (
          <div className="space-y-2">
            {invoices.length === 0 ? <Empty label="No invoices" /> : invoices.map((inv) => (
              <div key={inv.id} className="border border-cyan/20 bg-blueprint/30">
                <div className="flex items-center justify-between px-5 py-4">
                <div>
                  <div className="font-mono text-sm text-data">{inv.invoice_code} — {inv.description}</div>
                  <div className="font-mono text-[11px] text-muted-foreground">${Number(inv.amount || 0).toFixed(2)} • due {inv.due_date || "—"}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`font-mono text-[10px] uppercase px-2 py-1 border ${inv.status === "paid" ? "border-cyan text-cyan" : "border-heat text-heat"}`}>
                    {inv.status}
                  </span>
                  {inv.status !== "paid" && (
                    <button
                      onClick={async () => {
                        const result = await safeInvoke(() => base44.functions.invoke("create-checkout", { invoiceId: inv.id }));
                        const data = result.ok ? result.value?.data : undefined;
                        if (result.ok && data?.redirectUrl) { window.location.href = data.redirectUrl; return; }
                        if (!result.ok) { toast({ title: result.retryable ? "Network interrupted" : "Checkout failed", description: result.error, variant: "destructive" }); return; }
                        toast({ title: "Checkout failed", description: data?.error || "No checkout URL returned.", variant: "destructive" });
                      }}
                      className="font-mono text-[10px] uppercase tracking-wider bg-cyan text-titanium px-3 py-1.5 hover:glow-cyan transition-all"
                    >
                      Pay Now
                    </button>
                  )}
                </div>
                </div>
                {inv.status !== "paid" && <SecureCheckoutBadge />}
              </div>
            ))}
          </div>
        )}
        {!loading && tab === "bench" && <ReconnectingBoundary component="Shop Bench Live"><Suspense fallback={<SectionFallback />}><ShopStatusBoard /></Suspense></ReconnectingBoundary>}
        {!loading && tab === "twin" && <ReconnectingBoundary component="Digital Twin"><Suspense fallback={<SectionFallback />}><DigitalTwin /></Suspense></ReconnectingBoundary>}

        {!loading && tab === "settings" && (
          <div className="max-w-xl space-y-6">
            <div className="border border-cyan/20 bg-blueprint/30 px-5 py-4">
              <div className="font-mono text-[10px] uppercase tracking-widest text-cyan mb-1">// Signed in as</div>
              <div className="font-mono text-sm text-data">{user?.email || "—"}</div>
              <div className="font-mono text-[11px] text-muted-foreground mt-1">{user?.full_name || "Registered customer"}</div>
            </div>

            <div className="border border-heat/30 bg-heat/5 px-5 py-5">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="w-4 h-4 text-heat" />
                <span className="font-mono text-xs uppercase tracking-widest text-heat">// Danger Zone</span>
              </div>
              <p className="font-body text-sm text-muted-foreground mb-4">
                Deleting your account permanently removes your customer profile and signs you out. Invoice & certificate history tied to this login will no longer be accessible.
              </p>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider border border-heat/50 text-heat px-5 py-2.5 hover:glow-heat transition-all"
                >
                  <Trash2 className="w-4 h-4" /> Delete Account
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    disabled={deleting}
                    onClick={async () => {
                      setDeleting(true);
                      try {
                        const me = await base44.auth.me();
                        if (me?.id) {
                          await base44.entities.User.delete(me.id);
                        }
                        toast({ title: "Account deleted", description: "Your profile has been removed." });
                        await base44.auth.logout();
                        window.location.href = "/login";
                      } catch (e) {
                        toast({ title: "Could not delete account", description: (e as Error).message || "Please contact us to remove your account.", variant: "destructive" });
                      } finally {
                        setDeleting(false);
                      }
                    }}
                    className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider bg-heat text-titanium px-5 py-2.5 hover:glow-heat disabled:opacity-50"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    {deleting ? "Deleting…" : "Confirm Delete"}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                    className="font-mono text-xs text-muted-foreground px-4 py-2.5 hover:text-cyan"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function SectionFallback() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-cyan/20 border-t-cyan rounded-full animate-spin" />
    </div>
  );
}

interface RowProps {
  title: string;
  sub?: string;
  status?: string;
  extra?: string;
}
function Row({ title, sub, status, extra }: RowProps) {
  return (
    <div className="flex items-start justify-between border border-cyan/20 bg-blueprint/30 px-5 py-4">
      <div>
        <div className="font-mono text-sm text-data">{title}</div>
        <div className="font-mono text-[11px] text-muted-foreground">{sub}</div>
        {extra && <div className="font-mono text-[10px] text-muted-foreground/60 mt-1">{extra}</div>}
      </div>
      <span className="font-mono text-[10px] uppercase px-2 py-1 border border-cyan/30 text-cyan shrink-0">{status}</span>
    </div>
  );
}

interface EmptyProps {
  label: string;
  text?: string;
  cta?: React.ReactNode;
}
function Empty({ label, text, cta }: EmptyProps) {
  return (
    <div className="text-center py-16 border border-dashed border-cyan/20">
      <div className="font-mono text-sm text-muted-foreground mb-2">{label}</div>
      <div className="font-mono text-[11px] text-muted-foreground/60 mb-4 max-w-sm mx-auto">{text || ""}</div>
      {cta}
    </div>
  );
}