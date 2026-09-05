import db from "@/api/base44Client";

import React, { useEffect, useState } from "react";

import BeforeAfterSlider from "@/components/apex/BeforeAfterSlider";

interface Case {
  id?: string;
  title: string;
  tag?: string;
  vehicle?: string;
  before_image_url: string;
  after_image_url: string;
  order?: number;
}

const FALLBACK: Case[] = [
  {
    title: "Engine bay rebuild after wiring-loom fire",
    vehicle: "2017 VW Golf GTI",
    tag: "WIRING_RESTORE_COMPLETE",
    before_image_url: "/automotive-service.svg",
    after_image_url: "/automotive-service.svg",
  },
  {
    title: "Corroded BCM rescued — no dealer tow needed",
    vehicle: "2019 Dodge Charger",
    tag: "BCM_BYPASS_SUCCESSFUL",
    before_image_url: "/automotive-service.svg",
    after_image_url: "/automotive-service.svg",
  },
  {
    title: "All-keys-lost → fresh cut & programmed fob",
    vehicle: "2021 Mercedes E-Class",
    tag: "KEY_GEN_SUCCESSFUL",
    before_image_url: "/automotive-service.svg",
    after_image_url: "/automotive-service.svg",
  },
];

export default function BeforeAfterGallery() {
  const [cases, setCases] = useState<Case[] | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const list = await db.entities.BeforeAfterCase.list("order", 20);
        if (active) setCases(list && list.length ? (list as Case[]) : FALLBACK);
      } catch {
        if (active) setCases(FALLBACK);
      }
    })();
    return () => { active = false; };
  }, []);

  const list = cases || FALLBACK;

  return (
    <div className="mt-16">
      <div className="mb-8">
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-cyan mb-2">// Before / After</div>
        <h2 className="font-heading text-3xl sm:text-4xl uppercase text-data leading-tight">
          Drag the Line. <span className="text-cyan">See the Turnaround.</span>
        </h2>
        <p className="mt-3 font-body text-sm text-muted-foreground max-w-xl">
          Real repairs, real results. Slide each frame to reveal the difference
          between how it arrived and how it left the shop.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-px bg-cyan/10 border border-cyan/10">
        {list.map((c, i) => (
          <figure key={c.id || i} className="bg-titanium p-4 flex flex-col gap-3">
            <BeforeAfterSlider before={c.before_image_url} after={c.after_image_url} alt={c.title} />
            <figcaption>
              <div className="font-body text-sm text-data leading-snug">{c.title}</div>
              <div className="flex items-center justify-between mt-1.5">
                {c.vehicle && <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{c.vehicle}</span>}
                {c.tag && <span className="font-mono text-[10px] uppercase tracking-wider text-cyan/70">{c.tag}</span>}
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}