import React from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, Cpu, Wrench, Gauge, ArrowRight } from "lucide-react";
import type { ProblemCategory } from "@/lib/types";

// Renders a structured AI diagnostic result inside the assistant chat:
// category + confidence badge, likely cause, plain-English meaning, and a
// "book this service" CTA routed to the intake section.

export interface DiagnosticResult {
  cause: string;
  confidence: "low" | "medium" | "high";
  category: ProblemCategory;
  summary: string;
  book_cta: string;
}

type IconType = React.ComponentType<{ className?: string }>;

const CAT_ICON: Record<ProblemCategory, IconType> = {
  "Lost Keys / Security & Lockout": KeyRound,
  "Electrical & Diagnostics": Cpu,
  "Mechanical Repair": Wrench,
  "Performance & Tuning": Gauge,
};

const CONF_COLOR: Record<DiagnosticResult["confidence"], string> = {
  low: "text-yellow-400 border-yellow-400/40",
  medium: "text-cyan border-cyan/40",
  high: "text-green-400 border-green-400/40",
};

export default function DiagnosticCard({ d }: { d: DiagnosticResult }) {
  const navigate = useNavigate();
  const Icon = (d.category && CAT_ICON[d.category]) || Cpu;
  const conf = CONF_COLOR[d.confidence] || CONF_COLOR.medium;

  return (
    <div className="border border-cyan/30 bg-blueprint/70 p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-cyan shrink-0" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-cyan/80 truncate">{d.category}</span>
        <span className={`ml-auto font-mono text-[9px] uppercase px-2 py-0.5 border shrink-0 ${conf}`}>{d.confidence} confidence</span>
      </div>
      <div>
        <div className="font-mono text-[9px] uppercase tracking-widest text-cyan/60 mb-1">// Likely cause</div>
        <p className="font-body text-xs text-data leading-relaxed">{d.cause}</p>
      </div>
      <div>
        <div className="font-mono text-[9px] uppercase tracking-widest text-cyan/60 mb-1">// What it means for you</div>
        <p className="font-body text-xs text-muted-foreground leading-relaxed">{d.summary}</p>
      </div>
      <button
        onClick={() => navigate("/#intake")}
        className="inline-flex items-center gap-1.5 bg-cyan text-titanium font-mono text-[10px] uppercase tracking-wider px-3 py-2 hover:glow-cyan transition-all"
      >
        {d.book_cta || "Book this service"} <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}