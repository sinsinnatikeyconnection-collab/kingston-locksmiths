import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Award, Cpu, Wrench, Gauge, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import PageShell from "@/components/apex/PageShell";

interface Stat { n: string; l: string }
interface TrustProps { icon: LucideIcon; title: string; body: string }

const STATS: Stat[] = [
  { n: "15+", l: "Years in the Trade" },
  { n: "4", l: "Pillars of Mastery" },
  { n: "24/7", l: "Emergency Dispatch" },
  { n: "100%", l: "Data-First Diagnostics" },
];

const CERTS: string[] = [
  "J2534 Pass-Thru Certified Programming",
  "Automotive EEPROM / MCU Programming",
  "OEM-Level Scan & Coding Tools (Ford, GM, Toyota, Euro)",
  "Advanced CAN / LIN Bus Diagnostics",
  "ADAS Radar & Camera Recalibration",
  "Complete Engine & Powertrain Mechanical Service",
];

export default function About() {
  return (
    <PageShell title="About Us" tagline="// The Operator">
      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16 grid lg:grid-cols-2 gap-12">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-cyan mb-3">// Who we are</div>
          <p className="font-body text-base text-data/90 leading-relaxed mb-4">
            Sinsinnati Key Connection — also known as Kingston&rsquo;s Locksmiths —
            is Cincinnati&rsquo;s advanced automotive locksmith and mechanical
            service. We exist for the vehicles other shops send away: deadlocked
            immobilizers, fried computers, all-keys-lost, phantom electrical
            drains, and builds that demand both a soldering iron and an engine hoist.
          </p>
          <p className="font-body text-sm text-muted-foreground leading-relaxed mb-4">
            With over 15 years in the trade, we&rsquo;ve built our reputation on a
            simple principle: read the data, fix the root, never guess. Where a
            typical shop swaps parts until the problem goes away, we isolate the
            exact failure in copper and code — then repair it properly.
          </p>
          <p className="font-body text-sm text-muted-foreground leading-relaxed">
            From a single lost key to a full engine swap, every job is handled by
            an operator who understands the whole vehicle as one connected system.
          </p>

          <div className="grid grid-cols-4 gap-px bg-cyan/10 border border-cyan/10 mt-8">
            {STATS.map((s) => (
              <div key={s.l} className="bg-titanium p-4 text-center">
                <div className="font-heading text-2xl text-cyan">{s.n}</div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground mt-1 leading-tight">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-cyan mb-3">// Why trust us</div>
          <div className="space-y-px bg-cyan/10 border border-cyan/10 mb-6">
            <Trust icon={Cpu} title="Code-Level Access" body="We read and rewrite immobilizer, EEPROM and module data — not just the door." />
            <Trust icon={Wrench} title="Iron & Copper" body="Heavy tools and the grit for full mechanical teardowns, not just a laptop." />
            <Trust icon={Gauge} title="Data-First" body="Oscilloscopes, factory software, J2534 — we diagnose the real failure." />
            <Trust icon={ShieldCheck} title="Private & Secure" body="Your booking and vehicle data stay in a secured, admin-only system." />
          </div>

          <div className="font-mono text-[11px] uppercase tracking-widest text-cyan mb-3">// Certifications & Tools</div>
          <ul className="space-y-2">
            {CERTS.map((c) => (
              <li key={c} className="flex items-start gap-2 font-body text-sm text-data/90">
                <Award className="w-4 h-4 text-cyan shrink-0 mt-0.5" />
                {c}
              </li>
            ))}
          </ul>

          <Link to="/#intake" className="mt-8 inline-flex items-center gap-2 bg-cyan text-titanium px-6 py-3.5 font-mono text-sm uppercase tracking-wider hover:glow-cyan transition-all">
            Book a Service <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </PageShell>
  );
}

function Trust({ icon: Icon, title, body }: TrustProps) {
  return (
    <div className="bg-titanium p-4 flex gap-3">
      <Icon className="w-5 h-5 text-cyan shrink-0 mt-0.5" />
      <div>
        <div className="font-heading text-sm uppercase text-data">{title}</div>
        <div className="font-body text-xs text-muted-foreground">{body}</div>
      </div>
    </div>
  );
}