import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Lock, ShieldCheck, CreditCard, Cpu } from "lucide-react";
import SecureCheckoutBadge from "@/components/apex/SecureCheckoutBadge";

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

interface VinSection { key: string; title: string; body?: string; teaser?: string }
interface PremiumReport {
  reportId?: string;
  price: number;
  locked: boolean;
  sections: VinSection[];
  invoiceId?: string | null;
  error?: string;
}

export default function VinPremiumPanel({ vin }: { vin: string }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<PremiumReport | null>(null);
  const [email, setEmail] = useState(localStorage.getItem("vinUnlockEmail") || "");
  const [paying, setPaying] = useState(false);
  const [paidRetries, setPaidRetries] = useState(0);

  const load = async (em: string) => {
    setLoading(true);
    try {
      const res: any = await base44.functions.invoke("decodeVin", { vin, premium: true, email: em || undefined });
      const pr = res?.data?.premiumReport ?? res?.premiumReport;
      setReport(pr || null);
    } catch (e: any) {
      toast({ title: "Report failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (vin && VIN_RE.test(vin)) load(email);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vin]);

  // After a Wix checkout redirect (?paid=1), the order-approved webhook can lag
  // the buyer's return by a few seconds. If the report is still locked, poll a
  // few times so the unlock grants instead of showing a paid-but-locked screen.
  useEffect(() => {
    const paidJustNow = new URLSearchParams(window.location.search).get("paid") === "1";
    let t: ReturnType<typeof setTimeout> | undefined;
    if (paidJustNow && !loading && report && report.locked && paidRetries < 4) {
      t = setTimeout(() => {
        setPaidRetries((n) => n + 1);
        load(email);
      }, 2500);
    }
    return () => { if (t) clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, report, paidRetries]);

  const unlock = async () => {
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast({ title: "Valid email required", variant: "destructive" });
      return;
    }
    setPaying(true);
    try {
      localStorage.setItem("vinUnlockEmail", email);
      const invRes: any = await base44.functions.invoke("createVinUnlock", { vin, email });
      const invoiceId = invRes?.data?.invoiceId ?? invRes?.invoiceId;
      if (!invoiceId) {
        toast({ title: "Unlock setup failed", variant: "destructive" });
        setPaying(false);
        return;
      }
      const returnUrl = "/diagnostics?vin=" + vin + "&paid=1";
      const coRes: any = await base44.functions.invoke("create-checkout", { invoiceId, returnUrl });
      const redirectUrl = coRes?.data?.redirectUrl ?? coRes?.redirectUrl;
      if (redirectUrl) {
        window.location.href = redirectUrl;
        return;
      }
      toast({ title: "Checkout ready", description: "Payment session created." });
      setPaying(false);
    } catch (e: any) {
      toast({ title: "Unlock failed", description: e.message, variant: "destructive" });
      setPaying(false);
    }
  };

  return (
    <div className="border border-cyan/20 bg-blueprint/30 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Cpu className="w-4 h-4 text-cyan" />
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-cyan">
          // Deep OEM Diagnostic Report
        </span>
        {report && !report.locked && (
          <span className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] uppercase text-cyan border border-cyan/40 px-2 py-0.5">
            <ShieldCheck className="w-3 h-3" /> Unlocked
          </span>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-6">
          <Loader2 className="w-4 h-4 text-cyan animate-spin" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-cyan">
            Synthesizing OEM intelligence…
          </span>
        </div>
      )}

      {!loading && report?.error && (
        <p className="font-mono text-[10px] text-heat">{report.error}</p>
      )}

      {!loading && report && !report.locked && (
        <div className="space-y-3">
          {report.sections.map((s) => (
            <div key={s.key} className="border border-cyan/10 bg-titanium p-3">
              <div className="font-mono text-[11px] uppercase text-cyan/70 mb-1.5">{s.title}</div>
              <p className="font-body text-xs text-data/90 leading-relaxed whitespace-pre-wrap">{s.body}</p>
            </div>
          ))}
        </div>
      )}

      {!loading && report && report.locked && (
        <>
          <div className="space-y-2.5">
            {report.sections.map((s) => (
              <div key={s.key} className="border border-cyan/10 bg-titanium p-3 relative overflow-hidden">
                <div className="font-mono text-[11px] uppercase text-cyan/70 mb-1.5">{s.title}</div>
                <p className="font-mono text-[10px] text-muted-foreground blur-[6px] select-none leading-snug line-clamp-3">
                  {s.teaser || s.body || "Locked diagnostic content."}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 border border-cyan/30 bg-cyan/5 p-4 text-center">
            <Lock className="w-5 h-5 text-cyan mx-auto mb-2" />
            <div className="font-mono text-[11px] uppercase text-cyan mb-1">
              Unlock Full Report — ${report.price}
            </div>
            <p className="font-body text-[11px] text-muted-foreground mb-3 max-w-sm mx-auto">
              Reveals CAN/MOST topology, DTC library, TSBs,
              pinouts, schematics & step-by-step repair workflow revealed instantly after payment.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 max-w-sm mx-auto">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="flex-1 bg-titanium border border-cyan/20 px-3 py-2.5 font-body text-sm text-data focus:border-cyan focus:outline-none"
              />
              <button
                onClick={unlock}
                disabled={paying}
                className="inline-flex items-center justify-center gap-1.5 bg-cyan text-titanium font-mono text-xs uppercase px-5 py-2.5 hover:glow-cyan disabled:opacity-50"
              >
                {paying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
                Pay & Unlock
              </button>
            </div>
            <div className="max-w-sm mx-auto text-left">
              <SecureCheckoutBadge />
            </div>
          </div>
        </>
      )}
    </div>
  );
}