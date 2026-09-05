import React from "react";
import { Link } from "react-router-dom";
import { Image } from "@/components/ui/image";
import { ChevronRight } from "lucide-react";
import PageShell from "@/components/apex/PageShell";
import ArScan from "@/components/apex/ArScan";
import PriceEstimator from "@/components/apex/PriceEstimator";
import { PILLARS } from "@/lib/servicesData";
import ReconnectingBoundary from "@/components/apex/ReconnectingBoundary";

// Map each service pillar to the booking wizard's problem category so the
// "Book this service" button pre-selects it in the intake form.
const PILLAR_CATEGORY: Record<string, string> = {
  locksmithing: "Lost Keys / Security & Lockout",
  electrical: "Electrical & Diagnostics",
  performance: "Performance & Tuning",
  mechanical: "Mechanical Repair",
};

export default function Services() {
  return (
    <PageShell title="Service Breakdown" tagline="// Four Pillars of Mastery">
      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16">
        <p className="font-body text-sm text-muted-foreground max-w-2xl mb-12">
          From the deepest code in a microchip to the heaviest bolts in an
          engine block — every aspect of the modern vehicle, mastered under one
          roof. Tap any pillar to book.
        </p>

        <div className="space-y-px bg-cyan/10 border border-cyan/10">
          {PILLARS.map((p: any) => (
            <div key={p.id} className="bg-titanium">
              <div className="grid lg:grid-cols-5 gap-px">
                {/* image */}
                <div className="lg:col-span-2 relative aspect-[4/3] lg:aspect-auto min-h-[260px] overflow-hidden">
                  <Image src={p.img} alt={p.title} fittingType="fill" className="w-full h-full object-cover grayscale-[0.2]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-titanium via-transparent to-transparent" />
                  <span className="absolute top-3 left-3 font-mono text-[10px] uppercase tracking-widest text-cyan bg-titanium/70 px-2 py-1 border border-cyan/30">
                    {p.num} / {p.tag}
                  </span>
                </div>
                {/* content */}
                <div className="lg:col-span-3 p-6 lg:p-8">
                  <h2 className="font-heading text-2xl uppercase text-data leading-tight mb-3">
                    {p.title}
                  </h2>
                  <p className="font-body text-sm text-muted-foreground leading-relaxed mb-3">{p.intro}</p>
                  <p className="font-body text-sm text-data/80 leading-relaxed mb-5">{p.long}</p>

                  <div className="font-mono text-[10px] uppercase tracking-widest text-cyan mb-3">
                    // Capabilities
                  </div>
                  <ul className="grid sm:grid-cols-2 gap-x-6">
                    {p.points.map((pt: string, i: number) => (
                      <li key={i} className="flex gap-3 py-2 border-t border-cyan/10">
                        <span className="font-mono text-[10px] text-cyan/70 mt-1 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                        <span className="font-body text-sm text-data/90 leading-relaxed">{pt}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
                    <Link
                      to={`/services/${p.id}`}
                      className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-data border border-cyan/30 px-4 py-2 hover:border-cyan hover:bg-cyan/5 transition-all"
                    >
                      Read full breakdown <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                    <Link
                      to={`/?category=${encodeURIComponent(PILLAR_CATEGORY[p.id] || "")}#intake`}
                      className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-cyan hover:gap-3 transition-all"
                    >
                      Book this service <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-[1100px] mx-auto px-6 lg:px-10 py-16 border-t border-cyan/10">
        <div className="flex items-center gap-3 mb-2">
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-cyan">// Instant Quote</span>
        </div>
        <h2 className="font-heading text-3xl uppercase text-data mb-3 leading-[0.95]">
          Ballpark your <span className="text-cyan">budget</span>
        </h2>
        <p className="font-body text-sm text-muted-foreground max-w-2xl mb-8">
          Pick a service, urgency, and vehicle to get a realistic labor range before you book. No
          waiting on a callback for a ballpark — final quote lands after inspection.
        </p>
        <PriceEstimator />
      </section>

      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16 border-t border-cyan/10">
        <div className="flex items-center gap-3 mb-2">
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-cyan">// WebAR Module Locator</span>
        </div>
        <h2 className="font-heading text-3xl uppercase text-data mb-3 leading-[0.95]">
          Don't know where it lives? <span className="text-cyan">Find it</span>
        </h2>
        <p className="font-body text-sm text-muted-foreground max-w-2xl mb-8">
          Point your phone camera under the dash or under the hood and drop a holographic pin on
          the module you need to ship us — OBD2 port, ECU, BCM, or immobilizer. No app install.
        </p>
        <ReconnectingBoundary component="WebAR Module Scanner">
          <ArScan />
        </ReconnectingBoundary>
      </section>
    </PageShell>
  );
}