import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";

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
        const res = await base44.functions.invoke("decodeVin", { vin: normalized });
        const payload = (res?.data ?? res) as VinDecodeResult & { error?: string };
        if (payload && payload.error) {
          setError(payload.error);
          setData(null);
        } else if (payload && payload.decoded) {
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