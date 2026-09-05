import { useState, useEffect, useRef } from "react";

// Reusable shape of a decoded VIN — mirrors the `decodeVin` backend function's
// response so the intake form and the engine diagnostic use one source of truth.
export interface VinRecall {
  number: string;
  date: string;
  component: string;
  summary: string;
  consequence: string;
  remedy: string;
}

export interface VinDecoded {
  year: string;
  make: string;
  model: string;
  trim: string;
  engine_size: string;
  cylinders: string;
  engineModel: string;
  fuelType: string;
  driveType: string;
  transmission: string;
  bodyClass: string;
  plant: string;
  vehicleType: string;
}

export interface VinNetwork {
  diagnosticBus: string;
  notes: string;
}

export interface VinComplaintComponent { component: string; count: number }
export interface VinComplaintRecent {
  odiNumber: string;
  dateComplaintFiled: string;
  components: string;
  summary: string;
  crash: boolean;
  fire: boolean;
  injuries: number;
  deaths: number;
}
export interface VinComplaints {
  total: number;
  topComponents: VinComplaintComponent[];
  recent: VinComplaintRecent[];
  crashes: number;
  fire: number;
  injuries: number;
  deaths: number;
}
export interface VinSafetyRating {
  hasRating: boolean;
  variantCount: number;
  note?: string;
  vehicleDescription?: string;
  overallRating?: string;
  frontal?: { overall: string; driver: string; passenger: string; picture: string };
  side?: { overall: string; driver: string; passenger: string; pole: string; picture: string };
  rollover?: { rating: string; possibility: number | null; dynamicTip: string };
  adas?: { esc: string; forwardCollisionWarning: string; laneDepartureWarning: string };
  counts?: { complaints: number | null; recalls: number | null; investigations: number | null };
}
export interface VinOemResources {
  recallsUrl: string;
  complaintsUrl: string;
  vpicSource: string;
  tSBsAvailable: boolean;
  wiringDiagramsAvailable: boolean;
  investigationsAvailable: boolean;
  dataGap: string;
}
export interface VinDecodeResult {
  vin: string;
  decoded: VinDecoded;
  recalls: VinRecall[];
  recallError: string | null;
  complaints: VinComplaints;
  complaintError: string | null;
  safetyRating: VinSafetyRating;
  safetyError: string | null;
  network: VinNetwork;
  oemResources: VinOemResources;
  source: string;
}

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

/**
 * Calls the `decodeVin` backend function whenever `vin` is a valid 17-char VIN.
 * Debounced 350ms; suppresses duplicate calls for the same VIN.
 */
export function useVinDecode(vin: string) {
  const [data, setData] = useState<VinDecodeResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const lastCalled = useRef<string>("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const normalized = vin.toUpperCase().trim();

    // Invalid / partial VIN: clear the panel so stale decode data never shows.
    if (!VIN_RE.test(normalized)) {
      setData(null);
      setError("");
      setLoading(false);
      return;
    }
    // This exact VIN was already decoded — keep the cached result instead of
    // blanking the panel when the same VIN is re-entered.
    if (lastCalled.current === normalized) return;

    // New valid VIN: clear stale data and kick off a debounced decode.
    setData(null);
    setError("");
    setLoading(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const response = await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValuesExtended/${normalized}?format=json`);
        if (!response.ok) throw new Error("VIN service unavailable");
        const json = await response.json();
        const row = json.Results?.[0] || {};
        const payload = {
          vin: normalized,
          decoded: {
            year: row.ModelYear || "", make: row.Make || "", model: row.Model || "", trim: row.Trim || "",
            engine_size: row.DisplacementL || "", cylinders: row.EngineCylinders || "", engineModel: row.EngineModel || "",
            fuelType: row.FuelTypePrimary || "", driveType: row.DriveType || "", transmission: row.TransmissionStyle || "",
            bodyClass: row.BodyClass || "", plant: row.PlantCity || "", vehicleType: row.VehicleType || "",
          },
          recalls: [], recallError: null, complaints: { total: 0, topComponents: [], recent: [], crashes: 0, fire: 0, injuries: 0, deaths: 0 },
          complaintError: null, safetyRating: { hasRating: false, variantCount: 0 }, safetyError: null,
          network: { diagnosticBus: "OBD-II", notes: "Confirm module topology during diagnostic intake." },
          oemResources: { recallsUrl: `https://www.nhtsa.gov/recalls?vin=${normalized}`, complaintsUrl: `https://www.nhtsa.gov/vehicle/${normalized}`, vpicSource: "NHTSA VPIC", tSBsAvailable: false, wiringDiagramsAvailable: false, investigationsAvailable: false, dataGap: "Public VIN data is available. Technician-level OEM records require a paid inspection." },
          source: "NHTSA VPIC",
        } as VinDecodeResult;
        if (payload && payload.decoded) {
          lastCalled.current = normalized;
          setData(payload);
        } else {
          setError("No decode data returned.");
        }
      } catch (e) {
        setError((e as Error).message || "VIN decode failed");
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [vin]);

  return { data, loading, error };
}