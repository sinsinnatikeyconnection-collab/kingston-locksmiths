import React from "react";
import { Lock, ShieldCheck } from "lucide-react";

// White-labeled secure-checkout trust badge. No platform branding — reads as an
// official payment-security seal: lock glyph, encryption claim, and the major
// card-network marks a customer expects to see on a real checkout.
const BRANDS = ["VISA", "MC", "AMEX", "DISC"] as const;

export default function SecureCheckoutBadge() {
  return (
    <div className="border border-cyan/25 bg-titanium/70 backdrop-blur-md px-3 py-2 flex items-center gap-2.5 select-none">
      <span className="relative flex items-center justify-center w-7 h-7 border border-cyan/40 bg-cyan/5 shrink-0">
        <Lock className="w-3.5 h-3.5 text-cyan" />
        <span className="absolute -inset-1 border border-cyan/20 animate-pulse-ring rounded-full" />
      </span>

      <div className="flex flex-col min-w-0 leading-none">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan">Secure Checkout</span>
        <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground mt-1">256-bit SSL · PCI-DSS</span>
      </div>

      <span className="h-7 w-px bg-cyan/15 shrink-0" />

      <div className="flex items-center gap-1 shrink-0">
        {BRANDS.map((b) => (
          <span
            key={b}
            className="font-mono text-[8px] tracking-wider text-data/75 border border-cyan/15 bg-blueprint/40 px-1 py-[3px] leading-none"
          >
            {b}
          </span>
        ))}
      </div>

      <span className="ml-auto flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-cyan/70 shrink-0">
        <ShieldCheck className="w-3.5 h-3.5" /> Encrypted
      </span>
    </div>
  );
}