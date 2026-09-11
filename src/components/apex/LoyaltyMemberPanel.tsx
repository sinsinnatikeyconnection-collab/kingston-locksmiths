import db from "@/api/apiClient";

import React, { useState, useEffect } from "react";

import { Gift, Loader2, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import {
  TIERS,
  currentTier,
  nextTier,
  activeTierIndex,
  type LoyaltyAccount,
  type LoyaltyTransaction,
} from "@/lib/loyalty";

interface Props {
  email?: string;
}

export default function LoyaltyMemberPanel({ email }: Props) {
  const [loading, setLoading] = useState(true);
  const [acct, setAcct] = useState<LoyaltyAccount | null>(null);
  const [tx, setTx] = useState<LoyaltyTransaction[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!email) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const lower = email.trim().toLowerCase();
        const [aList, tList] = await Promise.all([
          db.entities.LoyaltyAccount.filter({}).catch(() => []),
          db.entities.LoyaltyTransaction.list("-created_date", 100).catch(() => []),
        ]);
        if (!alive) return;
        const accounts = (Array.isArray(aList) ? aList : (aList as { data?: LoyaltyAccount[] })?.data || []) as LoyaltyAccount[];
        const txs = (Array.isArray(tList) ? tList : (tList as { data?: LoyaltyTransaction[] })?.data || []) as LoyaltyTransaction[];
        const mine = accounts.find((a) => (a.owner_email_lower || "").toLowerCase() === lower || (a.owner_email || "").toLowerCase() === lower) || null;
        setAcct(mine);
        setTx(txs.filter((t) => (t.owner_email_lower || "").toLowerCase() === lower || (t.owner_email || "").toLowerCase() === lower));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [email]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-cyan font-mono text-xs py-16">
        <Loader2 className="w-4 h-4 animate-spin" /> syncing loyalty status…
      </div>
    );
  }

  if (!email) {
    return <div className="font-mono text-sm text-muted-foreground py-12">Sign in to view your loyalty rewards.</div>;
  }

  if (!acct) {
    return (
      <div className="text-center border border-dashed border-cyan/20 py-16">
        <Gift className="w-10 h-10 text-muted-foreground/40 mx-auto mb-4" />
        <div className="font-mono text-sm text-muted-foreground mb-2">You're not enrolled yet</div>
        <div className="font-mono text-[11px] text-muted-foreground/60 mb-4 max-w-sm mx-auto">
          Earn 1 point per $1 on completed services. Book a service to start accumulating rewards.
        </div>
        <Link to="/#intake" className="font-mono text-xs uppercase text-cyan underline">Book a service →</Link>
      </div>
    );
  }

  const pts = acct.points_balance || 0;
  const tier = currentTier(pts);
  const next = nextTier(pts);
  const idx = activeTierIndex(pts);
  const tierStart = TIERS[idx].min;
  const tierEnd = next ? next.min : tierStart;
  const progress = next ? Math.min(100, Math.round(((pts - tierStart) / (tierEnd - tierStart)) * 100)) : 100;
  const toNext = next ? next.min - pts : 0;

  return (
    <div className="space-y-6">
      {/* hero card */}
      <div className="border border-cyan/30 bg-blueprint/40 p-6 relative overflow-hidden">
        <div className="circuit-grid absolute inset-0 opacity-20 pointer-events-none" />
        <div className="relative flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-cyan mb-1">// Sinsinnati Loyalty</div>
            <div className="font-heading text-3xl uppercase text-data leading-none">{tier.label}</div>
            <div className="font-mono text-[11px] text-muted-foreground mt-2">{tier.perk}</div>
          </div>
          <div className="text-right">
            <div className="font-heading text-5xl text-cyan leading-none flex items-baseline gap-1">
              {pts}
              <span className="font-mono text-xs text-muted-foreground">pts</span>
            </div>
            <div className="font-mono text-[10px] text-muted-foreground/70 mt-1">lifetime {acct.lifetime_points || 0}</div>
          </div>
        </div>

        {/* progress to next tier */}
        <div className="relative mt-6">
          {next ? (
            <>
              <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground mb-1.5">
                <span>{tier.label}</span>
                <span>{toNext} pts to {next.label}</span>
              </div>
              <div className="h-2 bg-cyan/10 border border-cyan/20 overflow-hidden">
                <div className="h-full bg-cyan transition-all" style={{ width: `${progress}%` }} />
              </div>
              <div className="font-mono text-[10px] text-cyan/60 mt-1.5">{next.perk}</div>
            </>
          ) : (
            <div className="font-mono text-[11px] text-cyan/80">// Maximum tier reached — concierge dispatch unlocked.</div>
          )}
        </div>
      </div>

      {/* tier ladder */}
      <div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-cyan mb-3">
          <Sparkles className="w-3.5 h-3.5" /> // Reward Tiers
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {TIERS.map((t) => {
            const reached = pts >= t.min;
            const active = t.id === tier.id;
            return (
              <div
                key={t.id}
                className={`border p-3 ${active ? "border-cyan bg-cyan/10 glow-cyan" : reached ? "border-cyan/40 bg-blueprint/20" : "border-cyan/15 bg-titanium/40 opacity-60"}`}
              >
                <div className="font-mono text-[10px] uppercase tracking-widest text-cyan">{t.label}</div>
                <div className="font-heading text-lg text-data mt-1">{t.min}+</div>
                <div className="font-mono text-[9px] text-muted-foreground/70 mt-1">{t.perk}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* activity */}
      <div>
        <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-cyan mb-3">
          <Loader2 className="w-3.5 h-3.5 opacity-0" /> // Activity History
        </div>
        {tx.length === 0 ? (
          <div className="border border-dashed border-cyan/20 py-10 text-center font-mono text-[11px] text-muted-foreground">
            No activity yet. Points appear here after a completed service is credited.
          </div>
        ) : (
          <div className="space-y-1.5">
            {tx.map((t) => (
              <div key={t.id} className="border border-cyan/15 bg-blueprint/20 px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-[11px] text-data truncate">{t.reason}</div>
                  <div className="font-mono text-[10px] text-muted-foreground/70">
                    {t.created_date ? new Date(t.created_date).toLocaleDateString("en-US", { timeZone: "America/New_York" }) : "—"}
                    {t.reference ? ` · ${t.reference}` : ""}
                  </div>
                </div>
                <span className={`font-heading text-lg shrink-0 ${t.points >= 0 ? "text-cyan" : "text-heat"}`}>
                  {t.points >= 0 ? "+" : ""}{t.points}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}