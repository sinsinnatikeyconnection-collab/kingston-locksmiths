import React from "react";
import { Link } from "react-router-dom";
import { Star, Quote, ChevronRight } from "lucide-react";
import PageShell from "@/components/apex/PageShell";
import BeforeAfterGallery from "@/components/apex/BeforeAfterGallery";

type Accent = "cyan" | "heat";
interface Review {
  name: string;
  vehicle: string;
  service: string;
  text: string;
  rating: number;
  accent: Accent;
}

const REVIEWS: Review[] = [
  { name: "Marcus T.", vehicle: "2021 Ford F-150", service: "Lost Keys / Key Generation", rating: 5, accent: "cyan", text: "Lost my only key on a Sunday. Called and they came out, laser-cut a new one and programmed the transponder in my driveway. Running in under two hours. These guys are the real deal." },
  { name: "Brianna K.", vehicle: "2018 Dodge Charger", service: "Immobilizer Bypass", rating: 5, accent: "heat", text: "Car deadlocked after a battery swap — three other shops told me to tow it to the dealer. Sinsinnati read the BCM, bypassed the immo, and I drove it home same day." },
  { name: "Devin R.", vehicle: "2020 Audi RS5", service: "ECU Remap", rating: 5, accent: "cyan", text: "Got an honest, data-backed tune. They showed me the datalog before and after — real numbers, not a sales pitch. Car pulls like a freight train now." },
  { name: "Tasha M.", vehicle: "2019 Honda Civic Type-R", service: "CAN Bus Repair", rating: 4, accent: "cyan", text: "No-start nightmare nobody could figure out. They found a corroded CAN junction with an oscilloscope and rebuilt the section. Diagnosed what two other shops couldn't." },
  { name: "Greg H.", vehicle: "1995 Mustang GT", service: "Engine Swap & Wiring", rating: 5, accent: "heat", text: "Swapped to a built 5.0 with stand-alone management. Wiring was flawless and they tuned it for my boost setup. Not just a laptop guy — real wrench work too." },
  { name: "Alyssa P.", vehicle: "2024 Toyota RAV4", service: "ADAS Recalibration", rating: 5, accent: "cyan", text: "After a windshield replacement my lane-keep was throwing codes. Calibrated the camera and radar to factory spec. Clean, professional, fast." },
];

function Stars({ value, size = 12 }: { value: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={i <= Math.round(value) ? "fill-cyan text-cyan" : "text-muted-foreground/40"}
        />
      ))}
    </div>
  );
}

export default function Testimonials() {
  const avg = REVIEWS.reduce((s, r) => s + r.rating, 0) / REVIEWS.length;

  return (
    <PageShell title="Customer Reviews" tagline="// Social Proof">
      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16">
        {/* aggregate */}
        <div className="flex items-center gap-4 mb-10 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-heading text-3xl text-data">{avg.toFixed(1)}</span>
            <Stars value={avg} size={16} />
          </div>
          <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {REVIEWS.length} verified reviews · Trusted by tri-state drivers
          </span>
        </div>

        {/* reviews */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-cyan/10 border border-cyan/10">
          {REVIEWS.map((r, i) => (
            <div key={i} className="bg-titanium p-6 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <Quote className={`w-6 h-6 ${r.accent === "heat" ? "text-heat" : "text-cyan"}`} />
                <Stars value={r.rating} />
              </div>
              <p className="font-body text-sm text-data/90 leading-relaxed mb-5 flex-1">"{r.text}"</p>
              <div className="border-t border-cyan/10 pt-3">
                <div className="font-heading text-sm uppercase text-data">{r.name}</div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{r.vehicle}</div>
                <div className={`font-mono text-[10px] uppercase tracking-wider mt-1 ${r.accent === "heat" ? "text-heat" : "text-cyan"}`}>{r.service}</div>
              </div>
            </div>
          ))}
        </div>

        {/* before/after */}
        <BeforeAfterGallery />

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