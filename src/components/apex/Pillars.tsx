import React, { useState } from "react";
import { Image } from "@/components/ui/image";
import { ChevronRight } from "lucide-react";

type Accent = "cyan" | "heat" | "data";

interface Pillar {
  id: string;
  num: string;
  title: string;
  tag: string;
  img: string;
  accent: Accent;
  intro: string;
  points: string[];
}

const PILLARS: Pillar[] = [
  {
    id: "locksmithing",
    num: "01",
    title: "Locksmithing & Security",
    tag: "Digital Immunity",
    img: "https://media.base44.com/images/public/6a6890ed0920bc884c73a76a/c9180e468_generated_46057bd3.png",
    accent: "cyan",
    intro: "When it comes to vehicle security, we manipulate the core data — not just the door lock.",
    points: [
      "Complete Key Generation (All Keys Lost) — precision laser cutting & programming from zero keys",
      "Immobilizer (IMMO) Systems & Anti-Theft Lockouts — bypass, reset, reprogram deadlocked systems",
      "Module Cloning & Virginizing — extract hex data from fried ECU/BCM, write to used modules or wipe to factory state",
      "EEPROM & MCU Microchip Programming — desolder chips, read raw board data, modify & flash back",
      "ESL/ELV Steering Lock Emulation & Repair — bypass failed electronic steering column locks",
      "Smart Keys, Proximity Fobs & Transponders — match rolling codes for push-to-start systems",
    ],
  },
  {
    id: "electrical",
    num: "02",
    title: "Electrical & Data Networks",
    tag: "Rolling Server Room",
    img: "https://media.base44.com/images/public/6a6890ed0920bc884c73a76a/f69670e3c_generated_d8453c26.png",
    accent: "cyan",
    intro: "While others guess, we use data, oscilloscopes, and factory software to pinpoint the exact failure in copper and code.",
    points: [
      "J2534 Pass-Thru Programming — flash factory calibrations (Ford FJDS, GM SPS, Techstream)",
      "CAN Bus, LIN Bus & FlexRay Diagnostics — trace network failures with oscilloscope signal analysis",
      "Parasitic Draw & Short-to-Ground Tracing — isolate phantom drains via fuse voltage-drop testing",
      "Custom Wiring Harness Repair — repin connectors, rebuild melted harnesses, OEM weather-pack & Tesa tape",
      "ADAS Recalibration — calibrate radar cruise, lane-departure cameras, blind-spot monitors",
      "Complete SRS/Airbag Systems — crash-data diagnosis, clock spring & impact sensor replacement, module reset",
    ],
  },
  {
    id: "performance",
    num: "03",
    title: "Performance Tuning",
    tag: "Horsepower Fluent",
    img: "https://media.base44.com/images/public/6a6890ed0920bc884c73a76a/8d0087281_generated_6e7ee0c8.png",
    accent: "heat",
    intro: "We don't just fix cars — we make them faster and optimize how they run. For those who speak the language of horsepower.",
    points: [
      "ECU Remapping & Flashing — modify fuel maps, ignition timing, boost parameters for max power & efficiency",
      "Stand-Alone Engine Management — wire & configure Holley, Haltech, Megasquirt for swaps and custom builds",
      "TCU (Transmission Control Unit) Tuning — adjust shift points, line pressures, torque limiters for firmer shifts",
      "Deletes & Bypasses — program out speed/rev limiters, bypass factory sensors for track-built cars (off-road use)",
      "Datalogging & Wideband Integration — read real-time data under load to dial in air/fuel ratio, prevent knock",
    ],
  },
  {
    id: "mechanical",
    num: "04",
    title: "Mechanical & Powertrain",
    tag: "Heavy Metal Grit",
    img: "https://media.base44.com/images/public/6a6890ed0920bc884c73a76a/aae62aaf0_generated_51d34c82.png",
    accent: "data",
    intro: "We aren't just a laptop guy. We have the heavy tools and the grit to rip a car to bare chassis and build it back up.",
    points: [
      "Engine Swaps & Complete Rebuilds — drop subframes, replace piston rings, main bearings, upgraded camshafts",
      "Cylinder Head & Valvetrain Repair — head gaskets, bent valves, timing chains, tensioners, precise cam timing",
      "Transmission & Drivetrain — swap autos/manuals, rebuild clutch packs, install LSDs, heavy-duty axles & driveshafts",
      "Forced Induction Plumbing — install turbo/superchargers, tap oil pans, mount intercoolers",
      "Suspension, Steering & Braking — coilovers, polyurethane bushings, steering racks, big brake kits, stainless lines",
      "Fuel & Cooling Systems — high-flow pumps & injectors, water pumps, heater cores, mechanical overheating diagnosis",
    ],
  },
];

export default function Pillars() {
  const [active, setActive] = useState<string>("locksmithing");

  return (
    <section id="pillars" className="relative bg-titanium border-t border-cyan/10">
      <div className="circuit-grid absolute inset-0 opacity-30 pointer-events-none" />

      <div className="relative max-w-[1400px] mx-auto px-6 lg:px-10 py-24">
        {/* header */}
        <div className="flex items-end justify-between flex-wrap gap-6 mb-14">
          <div>
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-cyan mb-3">
              // Four Pillars of Mastery
            </div>
            <h2 className="font-heading text-4xl sm:text-5xl uppercase text-data leading-[0.95]">
              Absolute <span className="text-cyan">Control</span>
            </h2>
          </div>
          <p className="font-body text-sm text-muted-foreground max-w-sm">
            From the deepest code in a microchip to the heaviest bolts in an
            engine block — every aspect of the vehicle, mastered.
          </p>
        </div>

        {/* pillar selector tabs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-cyan/10 border border-cyan/10 mb-px">
          {PILLARS.map((p) => (
            <button
              key={p.id}
              onMouseEnter={() => setActive(p.id)}
              onClick={() => setActive(p.id)}
              className={`relative text-left px-5 py-5 transition-all ${
                active === p.id
                  ? "bg-blueprint"
                  : "bg-titanium hover:bg-blueprint/60"
              }`}
            >
              {active === p.id && (
                <span className="absolute top-0 left-0 h-0.5 w-full bg-cyan animate-laser-wipe" />
              )}
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-[10px] text-cyan">{p.num}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {p.tag}
                </span>
              </div>
              <div className="font-heading text-sm uppercase text-data leading-tight">
                {p.title}
              </div>
            </button>
          ))}
        </div>

        {/* active pillar detail */}
        <div className="grid lg:grid-cols-2 gap-px bg-cyan/10 border-x border-b border-cyan/10">
          {PILLARS.filter((p) => p.id === active).map((p) => (
            <div key={p.id} className="bg-titanium p-6 lg:p-8 flex flex-col">
              <div className="relative aspect-[4/3] overflow-hidden mb-6 border border-cyan/20">
                <Image
                  src={p.img}
                  alt={p.title}
                  fittingType="fill"
                  className="w-full h-full object-cover grayscale-[0.2]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-titanium via-transparent to-transparent" />
                <span className="absolute top-3 left-3 font-mono text-[10px] uppercase tracking-widest text-cyan bg-titanium/70 px-2 py-1 border border-cyan/30">
                  {p.tag}
                </span>
              </div>
              <p className="font-body text-sm text-muted-foreground leading-relaxed mb-5">
                {p.intro}
              </p>
              <a
                href="#intake"
                className="mt-auto inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-cyan hover:gap-3 transition-all w-fit"
              >
                Book this service <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          ))}

          {PILLARS.filter((p) => p.id === active).map((p) => (
            <div key={p.id} className="bg-titanium p-6 lg:p-8">
              <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-4">
                // Terminal Readout — Capabilities
              </div>
              <ul className="space-y-px">
                {p.points.map((pt, i) => (
                  <li
                    key={i}
                    className="group flex gap-3 py-3 border-t border-cyan/10 first:border-t-0"
                  >
                    <span className="font-mono text-[10px] text-cyan/70 mt-1 shrink-0">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="font-body text-sm text-data/90 leading-relaxed group-hover:text-cyan transition-colors">
                      {pt}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}