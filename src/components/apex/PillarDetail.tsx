import React from "react";
import { Link } from "react-router-dom";
import { Image } from "@/components/ui/image";
import { ChevronRight, ChevronLeft, Cpu, AlertTriangle, Workflow, Wrench } from "lucide-react";
import { PILLARS } from "@/lib/servicesData";

const accentColor = (a: string) => (a === "heat" ? "heat" : a === "data" ? "data" : "cyan");

// Shared deep-breakdown renderer used by the four dedicated pillar pages.
export default function PillarDetail({ id, afterCapabilities }: { id: string; afterCapabilities?: React.ReactNode }) {
  const p = PILLARS.find((x) => x.id === id);
  if (!p) return null;
  const ac = accentColor(p.accent);
  const idx = PILLARS.findIndex((x) => x.id === id);
  const next = PILLARS[(idx + 1) % PILLARS.length];
  const prev = PILLARS[(idx - 1 + PILLARS.length) % PILLARS.length];

  return (
    <div className="bg-titanium">
      {/* hero */}
      <section className="relative border-b border-cyan/10 overflow-hidden">
        <div className="circuit-grid absolute inset-0 opacity-30 pointer-events-none" />
        <div className="relative max-w-[1400px] mx-auto px-6 lg:px-10 py-16 pt-20">
          <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.3em] text-cyan mb-4">
            <Link to="/services" className="hover:underline flex items-center gap-1">
              <ChevronLeft className="w-4 h-4" /> Services
            </Link>
            <span className="text-cyan/40">/</span>
            <span>{p.num} · {p.tag}</span>
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl uppercase text-data leading-[0.95] max-w-3xl">
            {p.title.replace("& ", "")}
          </h1>
          <p className="mt-4 font-body text-sm text-muted-foreground max-w-2xl leading-relaxed">{p.long}</p>
        </div>
      </section>

      {/* image + capabilities summary */}
      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-14">
        <div className="grid lg:grid-cols-5 gap-px bg-cyan/10 border border-cyan/10">
          <div className="lg:col-span-2 bg-titanium relative aspect-[4/3] lg:aspect-auto min-h-[300px] overflow-hidden">
            <Image src={p.img} alt={p.title} fittingType="fill" className="w-full h-full object-cover grayscale-[0.2]" />
            <div className="absolute inset-0 bg-gradient-to-t from-titanium via-transparent to-transparent" />
            <span className={`absolute top-3 left-3 font-mono text-[10px] uppercase tracking-widest bg-titanium/70 px-2 py-1 border ${ac === "heat" ? "border-heat/40 text-heat" : "border-cyan/30 text-cyan"}`}>
              {p.num} / {p.tag}
            </span>
          </div>
          <div className="lg:col-span-3 bg-titanium p-6 lg:p-8">
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-4">
              // Capability Index
            </div>
            <ul className="grid sm:grid-cols-2 gap-x-6">
              {p.points.map((pt: string, i: number) => (
                <li key={i} className="flex gap-3 py-2 border-t border-cyan/10 first:border-t-0">
                  <span className="font-mono text-[10px] text-cyan/70 mt-1 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                  <span className="font-body text-sm text-data/90 leading-relaxed">{pt}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {afterCapabilities}

      {/* deep technical breakdown */}
      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Cpu className={`w-5 h-5 ${ac === "heat" ? "text-heat" : "text-cyan"}`} />
          <h2 className="font-heading text-2xl sm:text-3xl uppercase text-data leading-tight">Full Technical Breakdown</h2>
        </div>
        <div className="grid lg:grid-cols-2 gap-px bg-cyan/10 border border-cyan/10">
          {p.subservices.map((s: any, i: number) => (
            <article key={i} className="bg-titanium p-6 lg:p-8">
              <div className="flex items-start gap-3 mb-3">
                <span className={`font-mono text-[10px] mt-1 shrink-0 ${ac === "heat" ? "text-heat" : "text-cyan"}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="font-heading text-lg uppercase text-data leading-tight">{s.name}</h3>
                  <p className={`font-mono text-[10px] uppercase tracking-wider mt-1 ${ac === "heat" ? "text-heat/70" : "text-cyan/70"}`}>{s.summary}</p>
                </div>
              </div>
              <p className="font-body text-sm text-muted-foreground leading-relaxed mb-4 whitespace-pre-line">{s.detail}</p>
              <div className="font-mono text-[10px] uppercase tracking-widest text-cyan mb-2">// Toolchain</div>
              <div className="flex flex-wrap gap-1.5">
                {s.tools.map((t: string) => (
                  <span key={t} className="font-mono text-[10px] text-data/80 border border-cyan/20 px-2 py-1 bg-blueprint/40">{t}</span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* process + symptoms */}
      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-10">
        <div className="grid lg:grid-cols-2 gap-px bg-cyan/10 border border-cyan/10">
          <div className="bg-titanium p-6 lg:p-8">
            <div className="flex items-center gap-2 mb-5">
              <Workflow className="w-4 h-4 text-cyan" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-cyan">// Our Process</span>
            </div>
            <ol className="space-y-4">
              {p.process.map((st: any, i: number) => (
                <li key={i} className="flex gap-3">
                  <span className="font-mono text-cyan text-sm shrink-0">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <div className="font-mono text-sm text-data">{st.title}</div>
                    <div className="font-body text-xs text-muted-foreground leading-relaxed">{st.desc}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="bg-titanium p-6 lg:p-8">
            <div className="flex items-center gap-2 mb-5">
              <AlertTriangle className="w-4 h-4 text-heat" />
              <span className="font-mono text-[11px] uppercase tracking-widest text-heat">// When To Call Us</span>
            </div>
            <ul className="space-y-2.5">
              {p.symptoms.map((s: string, i: number) => (
                <li key={i} className="flex gap-3 font-body text-sm text-data/90 leading-relaxed">
                  <span className="font-mono text-heat text-xs mt-1 shrink-0">▸</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* faq */}
      <section className="max-w-[1100px] mx-auto px-6 lg:px-10 py-10">
        <div className="flex items-center gap-3 mb-6">
          <Wrench className="w-4 h-4 text-cyan" />
          <h2 className="font-mono text-xs uppercase tracking-[0.3em] text-cyan">// Common Questions</h2>
        </div>
        <div className="border border-cyan/10 divide-y divide-cyan/10">
          {p.faqs.map((f: any, i: number) => (
            <div key={i} className="bg-titanium px-5 py-4">
              <div className="font-mono text-sm text-data mb-1.5">{f.q}</div>
              <p className="font-body text-sm text-muted-foreground leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* cta + nav */}
      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-12 border-t border-cyan/10">
        <div className="border border-cyan/30 bg-cyan/5 p-8 text-center">
          <h3 className="font-heading text-2xl uppercase text-data mb-3">Book {p.title}</h3>
          <p className="font-body text-sm text-muted-foreground mb-5 max-w-md mx-auto">Start the intake and we'll pull diagrams, prepare the right tools and reach out within 2 hours.</p>
          <Link to="/#intake" className={`inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider px-6 py-3 ${ac === "heat" ? "bg-heat text-titanium hover:glow-heat" : "bg-cyan text-titanium hover:glow-cyan"}`}>
            Initialize Booking <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-6">
          <Link to={`/services/${prev.id}`} className="group border border-cyan/10 hover:border-cyan/30 p-4 flex items-center gap-3 transition-all">
            <ChevronLeft className="w-4 h-4 text-cyan/60 group-hover:text-cyan" />
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Previous pillar</div>
              <div className="font-mono text-sm text-data">{prev.title}</div>
            </div>
          </Link>
          <Link to={`/services/${next.id}`} className="group border border-cyan/10 hover:border-cyan/30 p-4 flex items-center justify-end gap-3 transition-all text-right">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Next pillar</div>
              <div className="font-mono text-sm text-data">{next.title}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-cyan/60 group-hover:text-cyan" />
          </Link>
        </div>
      </section>
    </div>
  );
}