import db from "@/api/apiClient";

import React, { useState, useEffect, useCallback } from "react";

import { Gift, Loader2, Plus, Sparkles, TrendingUp } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { validateEmail } from "@/lib/validation";
import {
  TIERS,
  tierFor,
  type LoyaltyAccount,
  type LoyaltyTransaction,
  todayISO,
} from "@/lib/loyalty";

export default function LoyaltyAdminPanel() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<LoyaltyAccount[]>([]);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, t] = await Promise.all([
        db.entities.LoyaltyAccount.filter({}).catch(() => []),
        db.entities.LoyaltyTransaction.list("-created_date", 200).catch(() => []),
      ]);
      const acctArr = (Array.isArray(a) ? a : (a as { data?: LoyaltyAccount[] })?.data || []) as LoyaltyAccount[];
      const txArr = (Array.isArray(t) ? t : (t as { data?: LoyaltyTransaction[] })?.data || []) as LoyaltyTransaction[];
      acctArr.sort((x, y) => (y.points_balance || 0) - (x.points_balance || 0));
      setAccounts(acctArr);
      setTransactions(txArr);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const award = async () => {
    const eR = validateEmail(email);
    if (!eR.ok) {
      toast({ title: "Invalid email", description: eR.error, variant: "destructive" });
      return;
    }
    const pts = Math.round(Number(points));
    if (!Number.isFinite(pts) || pts === 0) {
      toast({ title: "Invalid points", description: "Enter a non-zero whole number (use negatives to redeem).", variant: "destructive" });
      return;
    }
    if (!reason.trim()) {
      toast({ title: "Reason required", description: "Add a short reason for this adjustment.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const lower = email.trim().toLowerCase();
      const existing = accounts.find((a) => (a.owner_email_lower || "").toLowerCase() === lower);
      if (existing) {
        const nb = Math.max(0, (existing.points_balance || 0) + pts);
        const lt = Math.max(0, (existing.lifetime_points || 0) + Math.max(0, pts));
        await db.entities.LoyaltyAccount.update(existing.id!, {
          points_balance: nb,
          lifetime_points: lt,
          tier: tierFor(nb),
          last_earned_date: todayISO(),
        });
        if (pts < 0 && (existing.points_balance || 0) + pts < 0) {
          toast({ title: "Clamped to zero", description: "Balance can't go below zero — clamped." });
        }
      } else {
        if (pts < 0) {
          toast({ title: "Cannot redeem", description: "No account exists for this customer yet — award positive points first.", variant: "destructive" });
          setBusy(false);
          return;
        }
        await db.entities.LoyaltyAccount.create({
          owner_email: email.trim(),
          owner_email_lower: lower,
          points_balance: pts,
          lifetime_points: pts,
          tier: tierFor(pts),
          last_earned_date: todayISO(),
        });
      }
      await db.entities.LoyaltyTransaction.create({
        owner_email: email.trim(),
        owner_email_lower: lower,
        points: pts,
        reason: reason.trim(),
        reference: "ADMIN",
      });
      toast({ title: pts > 0 ? "Points awarded" : "Points redeemed", description: `${pts > 0 ? "+" : ""}${pts} → ${email.trim()}` });
      setEmail("");
      setPoints("");
      setReason("");
      await load();
    } catch (e) {
      toast({ title: "Adjustment failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* award form */}
      <div className="border border-cyan/20 bg-blueprint/30 p-5 mb-8">
        <div className="flex items-center gap-1.5 font-mono text-xs uppercase tracking-widest text-cyan mb-4">
          <Sparkles className="w-3.5 h-3.5" /> // Award / Redeem Points
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Customer email"
            className="bg-titanium border border-cyan/20 px-3 py-2 font-body text-sm text-data focus:border-cyan focus:outline-none"
          />
          <input
            type="number"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            placeholder="Points (e.g. 100, or -50 to redeem)"
            className="bg-titanium border border-cyan/20 px-3 py-2 font-mono text-sm text-data focus:border-cyan focus:outline-none"
          />
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (e.g. completed key programming)"
            className="lg:col-span-2 bg-titanium border border-cyan/20 px-3 py-2 font-body text-sm text-data focus:border-cyan focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter") award();
            }}
          />
        </div>
        <button
          onClick={award}
          disabled={busy}
          className="inline-flex items-center gap-1.5 bg-cyan text-titanium font-mono text-xs uppercase px-4 py-2.5 hover:glow-cyan disabled:opacity-50 transition-all"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {busy ? "Processing…" : "Apply Points"}
        </button>
      </div>

      {/* tier legend */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-cyan/10 border border-cyan/10 mb-8">
        {TIERS.map((t) => {
          const count = accounts.filter((a) => a.tier === t.id).length;
          return (
            <div key={t.id} className="bg-titanium p-4">
              <div className="font-mono text-[10px] uppercase tracking-widest text-cyan">{t.label}</div>
              <div className="font-heading text-2xl text-data mt-1">{count}</div>
              <div className="font-mono text-[9px] text-muted-foreground/70 mt-1">{t.min}+ pts · {t.perk}</div>
            </div>
          );
        })}
      </div>

      {/* accounts */}
      {loading ? (
        <div className="flex items-center gap-2 text-cyan font-mono text-xs py-12">
          <Loader2 className="w-4 h-4 animate-spin" /> syncing loyalty roster…
        </div>
      ) : accounts.length === 0 ? (
        <div className="border border-dashed border-cyan/20 py-20 text-center">
          <Gift className="w-10 h-10 text-muted-foreground/40 mx-auto mb-4" />
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">No loyalty accounts yet. Award points above to enroll a customer.</div>
        </div>
      ) : (
        <div className="space-y-2 mb-10">
          {accounts.map((a) => (
            <div key={a.id} className="border border-cyan/15 bg-titanium px-5 py-4 flex items-center justify-between flex-wrap gap-3">
              <div className="min-w-0">
                <div className="font-mono text-sm text-data truncate">{a.owner_email}</div>
                <div className="font-mono text-[10px] text-muted-foreground">last earned {a.last_earned_date || "—"} · lifetime {a.lifetime_points || 0}</div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="font-mono text-[10px] uppercase tracking-wider px-2 py-1 border border-cyan/30 text-cyan">{a.tier}</span>
                <span className="font-heading text-xl text-cyan">{a.points_balance || 0}</span>
                <span className="font-mono text-[10px] text-muted-foreground">pts</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* recent transactions */}
      {!loading && transactions.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-cyan mb-3">
            <TrendingUp className="w-3.5 h-3.5" /> // Recent Activity
          </div>
          <div className="space-y-1.5">
            {transactions.slice(0, 30).map((t) => (
              <div key={t.id} className="border border-cyan/10 bg-titanium/60 px-4 py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-[11px] text-data truncate">{t.owner_email}</div>
                  <div className="font-mono text-[10px] text-muted-foreground truncate">{t.reason}</div>
                </div>
                <span className={`font-mono text-sm shrink-0 ${t.points >= 0 ? "text-green-400" : "text-heat"}`}>
                  {t.points >= 0 ? "+" : ""}{t.points}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}