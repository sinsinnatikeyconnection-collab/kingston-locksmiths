import React from "react";
import { ShieldCheck, Lock, BadgeCheck, Truck, Award, Cpu } from "lucide-react";

type IconType = React.ComponentType<{ className?: string }>;

interface Seal {
  icon: IconType;
  title: string;
  sub: string;
}

const SEALS: Seal[] = [
  { icon: Lock, title: "256-bit Encrypted", sub: "Site & intake secured" },
  { icon: ShieldCheck, title: "Bank-Grade Security", sub: "Encrypted data handling" },
  { icon: BadgeCheck, title: "Verified Local Business", sub: "Greater Cincinnati" },
  { icon: Truck, title: "Secure Mail-In", sub: "Tracked shipping hub" },
  { icon: Award, title: "Master-Certified Techs", sub: "EEPROM / MCU / J2534" },
  { icon: Cpu, title: "Factory-Level Tools", sub: "OEM pass-thru + cloning" },
];

export default function TrustSeals() {
  return (
    <section className="bg-titanium border-t border-cyan/10">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-cyan/10 border border-cyan/10">
          {SEALS.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="bg-titanium flex flex-col items-center text-center px-3 py-5 group">
                <Icon className="w-7 h-7 text-cyan mb-2 group-hover:drop-shadow-[0_0_8px_rgba(0,229,255,0.6)] transition-all" />
                <div className="font-mono text-[11px] uppercase tracking-wide text-data leading-tight">{s.title}</div>
                <div className="font-mono text-[9px] text-muted-foreground mt-0.5">{s.sub}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}