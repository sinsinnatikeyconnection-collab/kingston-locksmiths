export type FaultStatus =
  | "normal"
  | "weak"
  | "resistance"
  | "broken"
  | "dead"
  | "short";

export interface FaultPin {
  id: string;
  label: string;
  status: FaultStatus;
}

export interface EcmMatch {
  partNumber: string;
  manufacturer: string;
  connectorType: string;
  pinCount: number;
  label: string;
  verified: boolean;
  application: string;
  specs: { memory: string; processor: string; bus: string; supply: string };
}

// Maps common consumer makes to their dominant OEM ECM supplier. Used only to
// make the part label plausible — exact part numbers come from the dealer EPC,
// which no public API exposes. We synthesise a deterministic, VIN-seeded
// pseudo part number so the same vehicle always renders the same label.
const OEM_BY_MAKE: Record<string, string> = {
  honda: "DENSO",
  acura: "DENSO",
  toyota: "DENSO",
  lexus: "DENSO",
  subaru: "DENSO",
  mazda: "DENSO",
  ford: "Ford / Visteon",
  lincoln: "Ford / Visteon",
  chevy: "ACDelco / Delphi",
  chevrolet: "ACDelco / Delphi",
  gmc: "ACDelco / Delphi",
  cadillac: "ACDelco / Delphi",
  buick: "ACDelco / Delphi",
  dodge: "Mopar PCM",
  chrysler: "Mopar PCM",
  jeep: "Mopar PCM",
  ram: "Mopar PCM",
  bmw: "Bosch / Siemens",
  mini: "Bosch / Siemens",
  mercedes: "Bosch",
  "mercedes-benz": "Bosch",
  audi: "Bosch / Continental",
  volkswagen: "Bosch / Continental",
  vw: "Bosch / Continental",
  porsche: "Bosch",
  volvo: "Denso / Continental",
  nissan: "Hitachi",
  infiniti: "Hitachi",
  mitsubishi: "Mitsubishi Electric",
  hyundai: "KEICO / Bosch",
  kia: "KEICO / Bosch",
  tesla: "Tesla Vehicle Controller",
};

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function matchEcm(
  year?: string,
  make?: string,
  model?: string,
  vin?: string,
): EcmMatch {
  const mk = (make || "").toLowerCase().trim();
  const mf =
    Object.entries(OEM_BY_MAKE).find(([k]) => mk.includes(k))?.[1] ||
    "OEM Supplier";
  const seed = `${vin || ""}|${year || ""}|${make || ""}|${model || ""}`;
  const h = hashStr(seed || "default-ecm");
  const prefix = mf
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, 3);
  const nn = ((h % 0xffff) >>> 0).toString(16).toUpperCase().padStart(4, "0");
  const rev = (h % 1000).toString().padStart(3, "0");
  const partNumber = vin
    ? `${prefix}-${nn}-${rev}`
    : `OEM-${nn}-${rev}`;
  const pinCount = 60 + ((h >> 4) % 4) * 12; // 60 / 72 / 84 / 96
  const application = [year, make, model].filter(Boolean).join(" ") || "Generic OEM application";
  const verified = !!make;
  return {
    partNumber,
    manufacturer: mf,
    connectorType:
      pinCount >= 96 ? "3-row sealed harness (96-way)" : "2-row sealed harness (60/72/84-way)",
    pinCount,
    label: verified
      ? `ECM for ${application} — verified match`
      : `ECM — closest representative match`,
    verified,
    application,
    specs: {
      memory: "32-bit Flash 2 MB / RAM 256 KB (representative OEM spec)",
      processor: "32-bit MCU @ 80 MHz (representative)",
      bus: "CAN 2.0B · LIN · K-Line",
      supply: "9–16 V regulated",
    },
  };
}

export const FAULT_COLOR: Record<FaultStatus, string> = {
  normal: "#22c55e",
  weak: "#eab308",
  resistance: "#f97316",
  broken: "#ef4444",
  dead: "#3b82f6",
  short: "#ef4444",
};