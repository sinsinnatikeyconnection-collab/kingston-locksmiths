import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Workflow, ChevronRight, ChevronLeft, RotateCcw, CheckCircle2, Truck } from "lucide-react";

// Each node: q (question), options[].option.next = node id, or option.leaf = {category, summary}
interface Leaf { category: string; summary: string; mail?: boolean }
interface TreeOption { label: string; next?: string; leaf?: Leaf }
interface TreeNode { q: string; options: TreeOption[] }

const TREE: Record<string, TreeNode> = {
  start: {
    q: "What's the main symptom?",
    options: [
      { label: "I'm locked out / lost my keys", next: "keys" },
      { label: "Car won't start or run right", next: "nostart" },
      { label: "Electrical weirdness / lights / module", next: "elec" },
      { label: "Mechanical noise / performance / swap", next: "mech" },
    ],
  },
  keys: {
    q: "Is it all keys lost, or a damaged key?",
    options: [
      { label: "All keys lost — I have nothing", leaf: { category: "Lost Keys / Security & Lockout", summary: "Full all-keys-lost key generation: VIN decode, immobilizer/LKP reset, laser cut new key, program to the car." } },
      { label: "Key exists but won't program/damage", leaf: { category: "Lost Keys / Security & Lockout", summary: "Transponder/smart-key reprogramming + immobilizer sync." } },
      { label: "Need a spare/additional key", leaf: { category: "Lost Keys / Security & Lockout", summary: "Duplicate transponder/proximity fob with rolling-code match." } },
    ],
  },
  nostart: {
    q: "Does it crank but not fire, or no crank at all?",
    options: [
      { label: "Crank, no start", next: "elec" },
      { label: "No crank / dead / immobilizer locked", leaf: { category: "Lost Keys / Security & Lockout", summary: "Immobilizer anti-theft reset + key/IMMO resync." } },
      { label: "Clicks once then nothing", next: "elec" },
    ],
  },
  elec: {
    q: "What kind of electrical problem?",
    options: [
      { label: "Check-engine / codes / sensors", leaf: { category: "Electrical & Diagnostics", summary: "CAN-bus scan, live data, pinpoint failed sensor or circuit." } },
      { label: "Battery dies overnight (parasitic draw)", leaf: { category: "Electrical & Diagnostics", summary: "Fuse voltage-drop tracing to isolate the draw and repair the harness." } },
      { label: "Module won't communicate / fried", next: "module" },
      { label: "Dash cluster / mileage issue", leaf: { category: "Electrical & Diagnostics", summary: "Instrument cluster EEPROM/MCU read + mileage calibration + flash back." } },
    ],
  },
  module: {
    q: "Do you have the part, or need it cloned to a used module?",
    options: [
      { label: "Mail the module in for cloning", leaf: { category: "Electrical & Diagnostics", summary: "Mail-in ECU/BCM cloning + virginizing. We extract hex, write to donor, ship back.", mail: true } },
      { label: "I have a used module — need it programmed", leaf: { category: "Electrical & Diagnostics", summary: "Module virginize + J2534 pass-thru program / adaptation." } },
    ],
  },
  mech: {
    q: "Bigger picture — what's the goal?",
    options: [
      { label: "Engine knocking / needs rebuild or swap", leaf: { category: "Mechanical Repair", summary: "Engine swap or full rebuild: subframe drop, bearings, head, timing." } },
      { label: "Transmission slipping / drivetrain", leaf: { category: "Mechanical Repair", summary: "Transmission swap / clutch pack rebuild / driveline." } },
      { label: "I want more power (tune/boost/fuel)", leaf: { category: "Performance & Tuning", summary: "ECU remap + wideband dial-in, forced-induction plumbing, datalogging." } },
      { label: "Suspension / brakes / handling", leaf: { category: "Mechanical Repair", summary: "Coilovers, bushings, big-brake kit, stainless lines." } },
    ],
  },
};

export default function DiagnosticTree() {
  const [path, setPath] = useState<string[]>(["start"]);
  const [leaf, setLeaf] = useState<Leaf | null>(null);
  const current = path[path.length - 1];

  const choose = (opt: TreeOption) => {
    if (opt.leaf) setLeaf(opt.leaf);
    else if (opt.next) { const n = opt.next; setPath((p) => [...p, n]); }
  };
  const back = () => {
    if (path.length > 1) setPath((p) => p.slice(0, -1));
  };
  const reset = () => { setPath(["start"]); setLeaf(null); };

  return (
    <div className="border border-cyan/20 bg-blueprint/30">
      <div className="flex items-center justify-between px-5 py-3 border-b border-cyan/20 bg-titanium">
        <div className="flex items-center gap-2">
          <Workflow className="w-4 h-4 text-cyan" />
          <span className="font-mono text-xs uppercase tracking-widest text-cyan">// Diagnostic Decision Tree</span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground">NODE: {leaf ? "LEAF" : current.toUpperCase()}</span>
      </div>

      <div className="p-6 lg:p-8 min-h-[260px]">
        {!leaf && (
          <>
            <h3 className="font-heading text-xl uppercase text-data mb-5">{TREE[current].q}</h3>
            <div className="space-y-2.5">
              {TREE[current].options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => choose(opt)}
                  className="w-full text-left flex items-center justify-between border border-cyan/20 hover:border-cyan/60 hover:bg-cyan/5 px-5 py-4 transition-all group"
                >
                  <span className="font-body text-sm text-data group-hover:text-cyan transition-colors">{opt.label}</span>
                  <ChevronRight className="w-4 h-4 text-cyan/40 group-hover:text-cyan transition-colors" />
                </button>
              ))}
            </div>
          </>
        )}
        {leaf && (
          <div className="text-center py-4">
            <CheckCircle2 className="w-12 h-12 text-cyan mx-auto mb-4 drop-shadow-[0_0_12px_rgba(0,229,255,0.6)]" />
            <div className="font-mono text-[11px] uppercase tracking-widest text-cyan mb-2">Recommended Service</div>
            <h3 className="font-heading text-2xl uppercase text-data mb-3">{leaf.category}</h3>
            <p className="font-body text-sm text-muted-foreground max-w-md mx-auto mb-6 leading-relaxed">{leaf.summary}</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link to="/#intake" className="inline-flex items-center gap-2 bg-cyan text-titanium font-mono text-xs uppercase px-6 py-3 hover:glow-cyan">
                Book This Service <ChevronRight className="w-4 h-4" />
              </Link>
              {leaf.mail && (
                <Link to="/mail-in" className="inline-flex items-center gap-2 border border-cyan/40 text-cyan font-mono text-xs uppercase px-6 py-3 hover:glow-cyan">
                  <Truck className="w-4 h-4" /> Mail-In Portal
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-5 py-3 border-t border-cyan/20 bg-titanium">
        <button
          onClick={back}
          disabled={path.length <= 1 || !!leaf}
          className={`flex items-center gap-1.5 font-mono text-xs uppercase ${path.length <= 1 || leaf ? "text-muted-foreground/30 cursor-not-allowed" : "text-muted-foreground hover:text-cyan"}`}
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button onClick={reset} className="flex items-center gap-1.5 font-mono text-xs uppercase text-muted-foreground hover:text-cyan">
          <RotateCcw className="w-3.5 h-3.5" /> Restart
        </button>
      </div>
    </div>
  );
}