import React from "react";
import { Link } from "react-router-dom";
import { MapPin, Navigation, ChevronRight } from "lucide-react";
import PageShell from "@/components/apex/PageShell";

interface Region { name: string; note: string; cities: string[] }

const REGIONS: Region[] = [
  {
    name: "Cincinnati, OH",
    note: "Home base — full mobile + shop service across the city and metro.",
    cities: ["Downtown Cincinnati", "Clifton", "Hyde Park", "Oakley", "Mount Adams", "West Side", "Northern Hills"],
  },
  {
    name: "Northern Kentucky",
    note: "Rapid mobile dispatch across the river for keys, lockouts & diagnostics.",
    cities: ["Covington", "Newport", "Florence", "Fort Thomas", "Erlanger", "Highland Heights", "Burlington"],
  },
  {
    name: "Dayton, OH",
    note: "Scheduled and emergency service for the Dayton corridor.",
    cities: ["Dayton", "Kettering", "Beavercreek", "Centerville", "Huber Heights", "Miamisburg"],
  },
  {
    name: "Tri-State Outskirts",
    note: "Broader tri-state coverage for mobile emergency and heavy jobs.",
    cities: ["Hamilton", "Middletown", "Lebanon", "Mason", "West Chester", "Fairfield", "Lawrenceburg, IN"],
  },
];

export default function ServiceAreas() {
  return (
    <PageShell title="Service Areas" tagline="// Coverage Grid">
      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16">
        <p className="font-body text-sm text-muted-foreground max-w-2xl mb-10">
          Sinsinnati Key Connection covers the Greater Cincinnati tri-state area.
          If you're within these regions and you're locked out, keyless, or
          dead-on-the-road, we'll reach you.
        </p>

        <div className="grid md:grid-cols-2 gap-px bg-cyan/10 border border-cyan/10">
          {REGIONS.map((r) => (
            <div key={r.name} className="bg-titanium p-6">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-cyan" />
                <h2 className="font-heading text-lg uppercase text-data">{r.name}</h2>
              </div>
              <p className="font-body text-sm text-muted-foreground mb-4">{r.note}</p>
              <div className="flex flex-wrap gap-2">
                {r.cities.map((c) => (
                  <span key={c} className="font-mono text-[10px] uppercase tracking-wider border border-cyan/20 px-2 py-1 text-data/80">
                    {c}
                  </span>
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