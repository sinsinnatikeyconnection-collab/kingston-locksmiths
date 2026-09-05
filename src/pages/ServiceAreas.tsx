import React, { useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Navigation, ChevronRight, Locate } from "lucide-react";
import PageShell from "@/components/apex/PageShell";
import ServiceMap, { type FocusTarget } from "@/components/apex/ServiceMap";
import { SERVICE_REGIONS } from "@/lib/serviceAreas";

export default function ServiceAreas() {
  const [focus, setFocus] = useState<FocusTarget | null>(null);
  const trigger = (lat: number, lng: number, zoom: number) =>
    setFocus((f) => ({ lat, lng, zoom, nonce: (f?.nonce ?? 0) + 1 }));

  return (
    <PageShell title="Service Areas" tagline="// Coverage Grid">
      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16">
        <p className="font-body text-sm text-muted-foreground max-w-2xl mb-8">
          Sinsinnati Key Connection covers the Greater Cincinnati tri-state area.
          Tap a region or city to center the map — if you're within these pins and
          you're locked out, keyless, or dead-on-the-road, we'll reach you.
        </p>

        <ServiceMap regions={SERVICE_REGIONS} focusTarget={focus} />

        <div className="grid md:grid-cols-2 gap-px bg-cyan/10 border border-cyan/10 mt-10">
          {SERVICE_REGIONS.map((r) => (
            <div key={r.name} className="bg-titanium p-6">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-cyan" />
                <button
                  onClick={() => trigger(r.center[0], r.center[1], 10)}
                  className="group flex items-center gap-1.5 text-left"
                >
                  <h2 className="font-heading text-lg uppercase text-data group-hover:text-cyan transition-colors">{r.name}</h2>
                  <Locate className="w-3.5 h-3.5 text-cyan/50 group-hover:text-cyan transition-colors" />
                </button>
              </div>
              <p className="font-body text-sm text-muted-foreground mb-4">{r.note}</p>
              <div className="flex flex-wrap gap-2">
                {r.cities.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => trigger(c.lat, c.lng, 13)}
                    className="font-mono text-[10px] uppercase tracking-wider border border-cyan/20 px-2 py-1 text-data/80 hover:border-cyan/60 hover:text-cyan transition-colors"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* geo strip for local SEO */}
        <div className="mt-10 border border-cyan/10 bg-blueprint/30 px-6 py-5 flex items-center gap-3 flex-wrap">
          <Navigation className="w-5 h-5 text-cyan" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Grid: 39.1271° N, 84.5144° W — Cincinnati Automotive Locksmith • Northern KY • Dayton • Tri-State
          </span>
        </div>

        <div className="mt-8 text-center">
          <Link to="/#intake" className="inline-flex items-center gap-2 bg-cyan text-titanium px-6 py-3.5 font-mono text-sm uppercase tracking-wider hover:glow-cyan transition-all">
            Book Mobile Service <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </PageShell>
  );
}