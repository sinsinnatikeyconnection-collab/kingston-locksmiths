import React from "react";
import { Link } from "react-router-dom";
import { Phone, Mail, Cpu, Clock, MapPin, ChevronRight } from "lucide-react";
import PageShell from "@/components/apex/PageShell";

interface PhoneLine { label: string; value: string; tel: string }
interface EmailLine { label: string; value: string }

const PHONES: PhoneLine[] = [
  { label: "Primary Line", value: "513-568-2744", tel: "+15135682744" },
  { label: "Secondary Line", value: "812-571-5765", tel: "+18125715765" },
];

const EMAILS: EmailLine[] = [
  { label: "General", value: "tcincy23@gmail.com" },
  { label: "Bookings", value: "sinsinnatikeyconnection@gmail.com" },
];

export default function Contact() {
  return (
    <PageShell title="Contact" tagline="// Contact & Dispatch">
      <section className="relative">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16 grid lg:grid-cols-2 gap-10">
          {/* left: identity */}
          <div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-cyan mb-2">
              // Operating Identity
            </div>
            <h2 className="font-heading text-3xl uppercase text-data leading-tight">
              Sinsinnati Key Connection
            </h2>
            <p className="font-mono text-xs text-muted-foreground mb-1">a.k.a Kingston&rsquo;s Locksmiths</p>
            <p className="font-body text-sm text-muted-foreground leading-relaxed mt-4 max-w-md">
              Cincinnati&rsquo;s advanced automotive locksmith and mechanical
              service. Reach us any time — lines are monitored for emergency
              mobile dispatch 24/7.
            </p>

            <div className="mt-8 space-y-px bg-cyan/10 border border-cyan/10">
              <div className="bg-titanium p-5 flex gap-4">
                <MapPin className="w-5 h-5 text-cyan shrink-0 mt-0.5" />
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Service Area</div>
                  <div className="font-mono text-sm text-data">Cincinnati, OH • Northern KY • Dayton — Tri-State</div>
                </div>
              </div>
              <div className="bg-titanium p-5 flex gap-4">
                <Clock className="w-5 h-5 text-cyan shrink-0 mt-0.5" />
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Hours</div>
                  <div className="font-mono text-sm text-data">24/7 Emergency Mobile Dispatch</div>
                </div>
              </div>
            </div>
          </div>

          {/* right: contact channels */}
          <div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-cyan mb-4">
              // Direct Channels
            </div>
            <div className="grid sm:grid-cols-2 gap-px bg-cyan/10 border border-cyan/10 mb-6">
              {PHONES.map((p) => (
                <a key={p.tel} href={`tel:${p.tel}`} className="bg-titanium p-5 group hover:bg-blueprint/50 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="w-4 h-4 text-cyan" />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{p.label}</span>
                  </div>
                  <div className="font-heading text-xl text-data group-hover:text-cyan transition-colors">{p.value}</div>
                  <div className="font-mono text-[9px] uppercase tracking-wider text-cyan mt-1">▸ Tap to call</div>
                </a>
              ))}
            </div>

            <div className="grid sm:grid-cols-2 gap-px bg-cyan/10 border border-cyan/10 mb-8">
              {EMAILS.map((e) => (
                <a key={e.value} href={`mailto:${e.value}`} className="bg-titanium p-5 group hover:bg-blueprint/50 transition-colors break-all">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="w-4 h-4 text-cyan" />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{e.label}</span>
                  </div>
                  <div className="font-mono text-xs text-data group-hover:text-cyan transition-colors break-all">{e.value}</div>
                </a>
              ))}
            </div>

            <Link
              to="/#intake"
              className="inline-flex items-center gap-2 bg-cyan text-titanium px-6 py-3.5 font-mono text-sm uppercase tracking-wider hover:glow-cyan transition-all"
            >
              Book a Service <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* emergency banner */}
      <section className="border-t border-heat/30 bg-heat/5">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8 flex items-center gap-4 flex-wrap">
          <Cpu className="w-6 h-6 text-heat animate-pulse" />
          <div className="flex-1 min-w-[200px]">
            <div className="font-heading text-lg uppercase text-data">Locked Out? All Keys Lost?</div>
            <div className="font-mono text-xs text-muted-foreground">Mobile emergency dispatch — we come to you, 24/7.</div>
          </div>
          <a href="tel:+15135682744" className="font-mono text-sm uppercase tracking-wider bg-heat text-titanium px-5 py-3 hover:glow-heat transition-all">
            Call 513-568-2744
          </a>
        </div>
      </section>
    </PageShell>
  );
}