import React from "react";
import { Link } from "react-router-dom";
import { Star, Quote, ChevronRight } from "lucide-react";
import PageShell from "@/components/apex/PageShell";

type Accent = "cyan" | "heat";
interface Review {
  name: string;
  vehicle: string;
  service: string;
  text: string;
  accent: Accent;
}

const REVIEWS: Review[] = [
  {
    name: "Marcus T.",
    vehicle: "2021 Ford F-150",
    service: "Lost Keys / Key Generation",
    text: "Lost my only key on a Sunday. Called and they came out, laser-cut a new one and programmed the transponder in my driveway. Running in under two hours. These guys are the real deal.",
    accent: "cyan",
  },
  {
    name: "Brianna K.",
    vehicle: "2018 Dodge Charger",
    service: "Immobilizer Bypass",
    text: "Car deadlocked after a battery swap — three other shops told me to tow it to the dealer. Sinsinnati read the BCM, bypassed the immo, and I drove it home same day.",
    accent: "heat",
  },
  {
    name: "Devin R.",
    vehicle: "2020 Audi RS5",
    service: "ECU Remap",
    text: "Got an honest, data-backed tune. They showed me the datalog before and after — real numbers, not a sales pitch. Car pulls like a freight train now.",
    accent: "cyan",
  },
  {
    name: "Tasha M.",
    vehicle: "2019 Honda Civic Type-R",
    service: "CAN Bus Repair",
    text: "No-start nightmare nobody could figure out. They found a corroded CAN junction with an oscilloscope and rebuilt the section. Diagnosed what two other shops couldn't.",
    accent: "cyan",
  },
  {
    name: "Greg H.",
    vehicle: "1995 Mustang GT",
    service: "Engine Swap & Wiring",
    text: "Swapped to a built 5.0 with stand-alone management. Wiring was flawless and they tuned it for my boost setup. Not just a laptop guy — real wrench work too.",
    accent: "heat",
  },
  {
    name: "Alyssa P.",
    vehicle: "2024 Toyota RAV4",
    service: "ADAS Recalibration",
    text: "After a windshield replacement my lane-keep was throwing codes. Calibrated the camera and radar to factory spec. Clean, professional, fast.",
    accent: "cyan",
  },
];

export default function Testimonials() {
  return (
    <PageShell title="Customer Reviews" tagline="// Social Proof">
      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16">
        <div className="flex items-center gap-3 mb-10 flex-wrap">
          <div className="flex items-center gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} className="w-5 h-5 fill-cyan text-cyan" />
            ))}
          </div>
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Trusted by tri-state drivers — locks, codes & horsepower.
          </span>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-cyan/10 border border-cyan/10">
          {REVIEWS.map((r, i) => (
            <div key={i} className="bg-titanium p-6 flex flex-col">
              <Quote className={`w-6 h-6 mb-3 ${r.accent === "heat" ? "text-heat" : "text-cyan"}`} />
              <p className="font-body text-sm text-data/90 leading-relaxed mb-5 flex-1">"{r.text}"</p>
              <div className="border-t border-cyan/10 pt-3">
                <div className="font-heading text-sm uppercase text-data">{r.name}</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{r.vehicle}</div>
                <div className={`font-mono text-[10px] uppercase tracking-wider mt-1 ${r.accent === "heat" ? "text-heat" : "text-cyan"}`}>
                  {r.service}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <p className="font-body text-sm text-muted-foreground mb-4">Become the next success story.</p>
          <Link to="/#intake" className="inline-flex items-center gap-2 bg-cyan text-titanium px-6 py-3.5 font-mono text-sm uppercase tracking-wider hover:glow-cyan transition-all">
            Book Your Service <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </PageShell>
  );
}