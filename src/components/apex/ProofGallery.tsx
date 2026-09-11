import db from "@/api/apiClient";

import React, { useState, useEffect } from "react";
import { Image } from "@/components/ui/image";
import { ChevronRight } from "lucide-react";

interface CaseStudyItem {
  id?: string;
  image_url: string;
  side: "Digital" | "Physical";
  title: string;
  tag?: string;
  order?: number;
}

const FALLBACK: CaseStudyItem[] = [
  {
    image_url: "/automotive-service.svg",
    side: "Digital",
    title: "EEPROM desolder & read under microscope",
    tag: "IMMO_CLONE_SUCCESSFUL: 2023 BMW M4",
  },
  {
    image_url: "/automotive-service.svg",
    side: "Physical",
    title: "Engine pull & full powertrain teardown",
    tag: "ENGINE_SWAP_COMPLETE: 2019 FORD MUSTANG GT",
  },
  {
    image_url: "/automotive-service.svg",
    side: "Digital",
    title: "Laser-cut key fob matched at OBD2 port",
    tag: "KEY_GEN_SUCCESSFUL: 2021 MERCEDES E-CLASS",
  },
];

export default function ProofGallery() {
  const [items, setItems] = useState<CaseStudyItem[] | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await db.entities.CaseStudy.list("order", 50);
        if (active) setItems(list && list.length ? (list as CaseStudyItem[]) : FALLBACK);
      } catch {
        if (active) setItems(FALLBACK);
      }
    })();
    return () => { active = false; };
  }, []);

  const list = items || FALLBACK;

  return (
    <section id="proof" className="relative bg-titanium border-t border-cyan/10">
      <div className="relative max-w-[1400px] mx-auto px-6 lg:px-10 py-24">
        <div className="mb-14">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-cyan mb-3">
            // Proof of Life
          </div>
          <h2 className="font-heading text-4xl sm:text-5xl uppercase text-data leading-[0.95]">
            The Code <span className="text-cyan">&</span> The Component
          </h2>
          <p className="mt-4 font-body text-sm text-muted-foreground max-w-xl">
            Real-world validation. On one side, the digital — microscope shots
            of desoldered chips. On the other, the physical — engines on hoists,
            cars back to life.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-px bg-cyan/10 border border-cyan/10">
          {list.map((item, i) => (
            <div key={item.id || i} className="group relative bg-titanium overflow-hidden">
              <div className="relative aspect-[4/3] overflow-hidden">
                <Image
                  src={item.image_url}
                  alt={item.title}
                  fittingType="fill"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-titanium via-titanium/20 to-transparent" />
                <div className="absolute top-0 left-0 right-0 h-px scanline opacity-0 group-hover:opacity-100 group-hover:translate-y-full transition-all duration-1000" />
                <span
                  className={`absolute top-3 right-3 font-mono text-[10px] uppercase tracking-widest px-2 py-1 border ${
                    item.side === "Digital"
                      ? "text-cyan border-cyan/40 bg-titanium/70"
                      : "text-heat border-heat/40 bg-titanium/70"
                  }`}
                >
                  {item.side}
                </span>
              </div>
              <div className="p-5">
                <div className="font-body text-sm text-data mb-2">{item.title}</div>
                {item.tag && <div className="font-mono text-[10px] text-cyan/60 uppercase tracking-wider">{item.tag}</div>}
              </div>
            </div>
          ))}
        </div>

        <a
          href="#intake"
          className="mt-10 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-cyan hover:gap-3 transition-all"
        >
          Add your vehicle to the feed <ChevronRight className="w-4 h-4" />
        </a>
      </div>
    </section>
  );
}