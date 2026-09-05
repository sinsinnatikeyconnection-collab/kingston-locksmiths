export interface SubPrice {
  name: string;
  low: number;
  high: number;
}

export interface PillarPrice {
  id: string;
  label: string;
  diagnostic: [number, number];
  sub: SubPrice[];
}

// Representative LABOR ranges (USD). Parts, programming credits, and shipping are
// billed separately and quoted after physical inspection — these ranges give a
// customer a realistic expectation before they book.
export const PRICING: PillarPrice[] = [
  {
    id: "locksmithing",
    label: "Locksmithing & Security",
    diagnostic: [75, 150],
    sub: [
      { name: "Complete Key Generation (All Keys Lost)", low: 350, high: 650 },
      { name: "Immobilizer (IMMO) Systems & Anti-Theft Lockouts", low: 200, high: 450 },
      { name: "Module Cloning & Virginizing", low: 250, high: 550 },
      { name: "EEPROM & MCU Microchip Programming", low: 300, high: 700 },
      { name: "ESL / ELV Steering Lock Emulation & Repair", low: 180, high: 400 },
      { name: "Smart Keys, Proximity Fobs & Transponders", low: 120, high: 300 },
    ],
  },
  {
    id: "electrical",
    label: "Electrical & Data Networks",
    diagnostic: [100, 200],
    sub: [
      { name: "J2534 Pass-Thru Programming", low: 150, high: 400 },
      { name: "CAN, LIN & FlexRay Diagnostics", low: 150, high: 350 },
      { name: "Parasitic Draw & Short-to-Ground Tracing", low: 120, high: 300 },
      { name: "Custom Wiring Harness Repair", low: 200, high: 600 },
      { name: "ADAS Recalibration", low: 200, high: 500 },
      { name: "SRS / Airbag Systems", low: 180, high: 500 },
    ],
  },
  {
    id: "performance",
    label: "Performance Tuning",
    diagnostic: [100, 250],
    sub: [
      { name: "ECU Remapping & Flashing", low: 350, high: 900 },
      { name: "Stand-Alone Engine Management", low: 800, high: 2000 },
      { name: "TCU (Transmission Control) Tuning", low: 300, high: 700 },
      { name: "Deletes & Bypasses (off-road / track)", low: 250, high: 600 },
      { name: "Datalogging & Wideband Integration", low: 150, high: 400 },
    ],
  },
  {
    id: "mechanical",
    label: "Mechanical & Powertrain",
    diagnostic: [100, 250],
    sub: [
      { name: "Engine Swaps & Complete Rebuilds", low: 1800, high: 4500 },
      { name: "Cylinder Head & Valvetrain", low: 700, high: 1800 },
      { name: "Transmission & Drivetrain", low: 900, high: 2500 },
      { name: "Forced Induction Plumbing", low: 800, high: 2200 },
      { name: "Suspension, Steering & Braking", low: 400, high: 1200 },
      { name: "Fuel & Cooling Systems", low: 250, high: 800 },
    ],
  },
];

export type UrgencyId = "emergency" | "standard" | "mailin";

export interface UrgencyOption {
  id: UrgencyId;
  label: string;
  note: string;
  // signed additive on the final range
  addLow: number;
  addHigh: number;
  // multiplicative modifier on labor
  multiplier: number;
}

export const URGENCIES: UrgencyOption[] = [
  { id: "standard", label: "Shop Drop-off / Standard", note: "Standard appointment at our Cincinnati facility.", addLow: 0, addHigh: 0, multiplier: 1 },
  { id: "emergency", label: "Emergency / Mobile Service", note: "Mobile dispatch to your location.", addLow: 150, addHigh: 300, multiplier: 1 },
  { id: "mailin", label: "Mail-In Service", note: "Ship the module; shipping billed separately.", addLow: -50, addHigh: -50, multiplier: 0.9 },
];

const LUXURY_MAKES = [
  "bmw", "mercedes", "mercedes-benz", "audi", "porsche", "jaguar",
  "land rover", "rover", "volkswagen", "vw", "volvo", "lexus",
  "infiniti", "acura", "tesla", "alfa", "maserati", "mini", "bentley",
];

export interface VehicleFactors {
  year: number;
  make: string;
}

export function vehicleMultiplier({ year, make }: VehicleFactors): number {
  let m = 1;
  const y = Number(year);
  if (Number.isFinite(y) && y > 1900 && y < 2000) m += 0.2; // pre-OBD2 / legacy silicon
  const mk = (make || "").toLowerCase();
  if (LUXURY_MAKES.some((l) => mk.includes(l))) m += 0.25;
  return m;
}

export function estimate(
  pillarId: string,
  subName: string,
  urgencyId: UrgencyId,
  vehicle: VehicleFactors,
): { low: number; high: number; includesDiagnostic: boolean } {
  const pillar = PRICING.find((p) => p.id === pillarId);
  const urgency = URGENCIES.find((u) => u.id === urgencyId) || URGENCIES[0];
  const sub = pillar?.sub.find((s) => s.name === subName);
  const baseLow = sub ? sub.low : (pillar?.diagnostic[0] || 75);
  const baseHigh = sub ? sub.high : (pillar?.diagnostic[1] || 200);
  const vm = vehicleMultiplier(vehicle);
  const low = Math.max(0, Math.round((baseLow * vm * urgency.multiplier + urgency.addLow) ));
  const high = Math.max(low + 25, Math.round((baseHigh * vm * urgency.multiplier + urgency.addHigh) ));
  return { low, high, includesDiagnostic: !sub };
}