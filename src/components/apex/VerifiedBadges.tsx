import React from "react";
import { Lock, ShieldCheck, CreditCard, BadgeCheck } from "lucide-react";

type IconType = React.ComponentType<{ className?: string }>;

// Silent trust verification: bank-level encryption UI + verified secure-payment
// badges. No claims we can't back — just visual proof of secure infrastructure.
interface Badge {
  icon: IconType;
  label: string;
}

const BADGES: Badge[] = [
  { icon: Lock, label: "TLS 1.3 Encrypted" },
  { icon: ShieldCheck, label: "Secure Checkout" },
  { icon: CreditCard, label: "Secure Payments" },
  { icon: BadgeCheck, label: "Verified Business" },
];

export default function VerifiedBadges() {
  return (
    <section className="bg-titanium border-t border-cyan/10">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-10">
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8">
          {BADGES.map((b) => {
            const Icon = b.icon;
            return (
              <div key={b.label} className="flex items-center gap-2.5 border border-cyan/15 bg-blueprint/30 px-4 py-2.5 backdrop-blur-sm">
                <Icon className="w-4 h-4 text-cyan drop-shadow-[0_0_6px_rgba(0,229,255,0.6)]" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{b.label}</span>
                <span className="w-1.5 h-1.5 bg-cyan rounded-full animate-pulse" />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}