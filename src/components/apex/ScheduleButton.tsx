import React from "react";
import { useNavigate } from "react-router-dom";
import { CalendarPlus } from "lucide-react";
import type { ProblemCategory } from "@/lib/types";

// Deep-links into the booking wizard with a pre-filled vehicle + problem,
// so "Schedule this service" buttons on recalls / maintenance items are
// one tap away from a real appointment.
export default function ScheduleButton({
  vin,
  category,
  detail,
  label = "Schedule this service",
}: {
  vin?: string;
  category?: ProblemCategory;
  detail?: string;
  label?: string;
}) {
  const navigate = useNavigate();
  const go = () => {
    const p = new URLSearchParams();
    if (vin) p.set("vin", vin.toUpperCase());
    if (category) p.set("category", category);
    if (detail) p.set("detail", detail);
    const qs = p.toString();
    navigate(qs ? `/?${qs}#intake` : "/#intake");
  };
  return (
    <button
      onClick={go}
      className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider text-cyan border border-cyan/30 px-2 py-1 hover:glow-cyan transition-all"
    >
      <CalendarPlus className="w-3 h-3" /> {label}
    </button>
  );
}