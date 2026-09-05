import type { ProblemCategory } from "@/lib/types";

// Deterministic, free (no LLM credits) recommended maintenance schedule derived
// from the decoded model year and current odometer reading. Kept client-side so
// it never re-triggers a paid decode — the deep OEM TSB library stays in the
// gated premium report.

export interface MaintenanceItem {
  key: string;
  label: string;
  intervalMiles: number;
  intervalYears: number;
  nextDueMiles: number | null;
  status: "ok" | "due_soon" | "due_now";
  service: ProblemCategory;
  note?: string;
}

const CURRENT_YEAR = 2026;

const DEFS: { key: string; label: string; intervalMiles: number; intervalYears: number; service: ProblemCategory; note?: string }[] = [
  { key: "oil", label: "Engine Oil & Filter", intervalMiles: 5000, intervalYears: 1, service: "Mechanical Repair" },
  { key: "rotate", label: "Tire Rotation", intervalMiles: 5000, intervalYears: 0, service: "Mechanical Repair" },
  { key: "cabinFilter", label: "Cabin Air Filter", intervalMiles: 20000, intervalYears: 2, service: "Mechanical Repair" },
  { key: "airFilter", label: "Engine Air Filter", intervalMiles: 30000, intervalYears: 0, service: "Mechanical Repair" },
  { key: "brakeFluid", label: "Brake Fluid Flush", intervalMiles: 30000, intervalYears: 3, service: "Mechanical Repair" },
  { key: "coolant", label: "Coolant Service", intervalMiles: 60000, intervalYears: 5, service: "Mechanical Repair" },
  { key: "transFluid", label: "Transmission Fluid", intervalMiles: 60000, intervalYears: 0, service: "Mechanical Repair", note: "Sealed units still benefit from inspection." },
  { key: "sparkPlugs", label: "Spark Plugs", intervalMiles: 100000, intervalYears: 0, service: "Electrical & Diagnostics" },
  { key: "timingBelt", label: "Timing Belt / Chain", intervalMiles: 100000, intervalYears: 0, service: "Mechanical Repair", note: "Replace if belt-equipped; inspect if chain." },
  { key: "diffFluid", label: "Differential / AWD Fluid", intervalMiles: 60000, intervalYears: 0, service: "Mechanical Repair" },
];

export function buildMaintenance(year: string, mileage: number): { items: MaintenanceItem[]; age: number; mileageProvided: boolean } {
  const yr = parseInt(year, 10);
  const age = Number.isNaN(yr) ? 0 : Math.max(0, CURRENT_YEAR - yr);
  const M = Number.isFinite(mileage) && mileage > 0 ? Math.floor(mileage) : 0;

  const items: MaintenanceItem[] = DEFS.map((it) => {
    const nextDueMiles = it.intervalMiles ? Math.floor(M / it.intervalMiles) * it.intervalMiles + it.intervalMiles : null;
    const since = it.intervalMiles ? M % it.intervalMiles : 0;
    let status: MaintenanceItem["status"] = "ok";
    if (it.intervalYears && age >= it.intervalYears) status = "due_now";
    else if (M > 0 && it.intervalMiles && since >= it.intervalMiles * 0.85) status = "due_now";
    else if (M > 0 && it.intervalMiles && since >= it.intervalMiles * 0.7) status = "due_soon";
    return { key: it.key, label: it.label, intervalMiles: it.intervalMiles, intervalYears: it.intervalYears, nextDueMiles, status, service: it.service, note: it.note };
  });

  return { items, age, mileageProvided: M > 0 };
}