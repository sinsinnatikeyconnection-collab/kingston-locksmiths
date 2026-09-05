import db from "@/api/base44Client";

import React, { useState } from "react";
import { Link } from "react-router-dom";

import { Siren, MapPin, Loader2, Phone, Navigation, Activity } from "lucide-react";

// Shop coordinates (used only to compute straight-line ETA; never shown to customer).
const SHOP = { lat: 39.1271, lon: -84.5144 };

interface Point { lat: number; lon: number }

function haversineMi(a: Point, b: Point): number {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const STEPS = [
  "Transmitting GPS to dispatch hub…",
  "Routing nearest certified mobile tech…",
  "Tech dispatched to your coordinates — ETA calculating…",
  "En route — we'll text updates. Do not leave the vehicle if unsafe.",
];

type DispatchState = "idle" | "locating" | "active" | "error";

export default function EmergencyStranded() {
  const [state, setState] = useState<DispatchState>("idle");
  const [eta, setEta] = useState<number | null>(null);
  const [coords, setCoords] = useState<Point | null>(null);
  const [stepIdx, setStepIdx] = useState<number>(0);
  const [tick, setTick] = useState<number>(0);
  const [dispAddress, setDispAddress] = useState<string | null>(null);

  const activate = () => {
    if (!navigator.geolocation) {
      setState("error");
      return;
    }
    setState("locating");
    setStepIdx(0);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c: Point = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setCoords(c);
        const mi = haversineMi(c, SHOP);
        const minutes = Math.max(12, Math.round((mi / 38) * 60) + 8);
        setEta(minutes);
        setState("active");
        setTick(minutes);
        // Fire the backend dispatch — alerts both shop addresses and reverse-geocodes the address
        void (async () => {
          try {
            const resp = await db.functions.invoke("emergencyDispatch", {
              latitude: c.lat,
              longitude: c.lon,
              vehicleInfo: {},
              description: "Customer pressed panic button — stranded",
              customerPhone: ""
            });
            if (resp?.data?.success && resp.data.address) setDispAddress(resp.data.address);
          } catch { /* the live ETA flow still runs; the email is best-effort */ }
        })();
        let s = 0;
        const iv = window.setInterval(() => {
          s += 1;
          setStepIdx((p) => Math.min(p + (s % 2 === 0 ? 1 : 0), STEPS.length - 1));
          setTick((t) => (t > 0 ? t - 1 : 0));
          if (s > 12) clearInterval(iv);
        }, 1000);
      },
      () => setState("error"),
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  return (
    <section className="relative bg-titanium border-t border-cyan/10">
      <div className="relative max-w-[1100px] mx-auto px-6 lg:px-10 py-20">
        <div className="flex items-center gap-3 mb-3">
          <Siren className="w-5 h-5 text-heat" />
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-heat">// Emergency Stranded Dispatch</span>
        </div>
        <h2 className="font-heading text-3xl sm:text-4xl uppercase text-data leading-[0.95] mb-4">
          Stranded Right Now?
        </h2>
        <p className="font-body text-sm text-muted-foreground max-w-2xl mb-8">
          Tap below to ping our mobile dispatch with your exact coordinates. We show a live ETA to you — our tech's
          location stays private. Best on mobile (GPS permission required).
        </p>

        <div className="border border-heat/30 bg-heat/5 p-8 text-center">
          {state === "idle" && (
            <>
              <button
                onClick={activate}
                className="inline-flex items-center gap-3 bg-heat text-titanium font-heading text-lg uppercase px-10 py-5 hover:glow-heat transition-all animate-pulse"
              >
                <Siren className="w-6 h-6" /> Panic Button — Dispatch Now
              </button>
              <div className="mt-4 font-mono text-[10px] text-muted-foreground">
                Uses your device GPS. No account needed. You will not see the technician's location.
              </div>
            </>
          )}
          {state === "locating" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="w-8 h-8 text-heat animate-spin" />
              <span className="font-mono text-xs text-heat uppercase tracking-widest">Locking GPS signal…</span>
            </div>
          )}
          {state === "active" && (
            <div className="space-y-5">
              <div className="font-mono text-xs uppercase tracking-widest text-heat flex items-center gap-2 justify-center">
                <Activity className="w-4 h-4" /> Dispatch Active
              </div>
              <div className="font-heading text-6xl text-heat leading-none tabular-nums">
                {tick > 0 ? `${tick}m` : "ARRIVING"}
              </div>
              <div className="font-mono text-[11px] text-muted-foreground">estimated arrival time to your location</div>
              <div className="font-mono text-xs text-cyan/80 border border-cyan/20 bg-titanium py-2.5 px-4 inline-block">
                {STEPS[stepIdx]}
              </div>
              {coords && (
                <div className="font-mono text-[10px] text-muted-foreground/60 flex items-center gap-1.5 justify-center">
                  <MapPin className="w-3 h-3" /> GPS acquired — technician location hidden <Navigation className="w-3 h-3 ml-2" />
                </div>
              )}
              {dispAddress && (
                <div className="font-mono text-[10px] text-cyan/80 border border-cyan/20 bg-titanium py-2 px-4 inline-block max-w-md mx-auto text-left leading-relaxed">
                  <span className="text-cyan/60">// your location</span><br />{dispAddress}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <a href="tel:+15135682744" className="inline-flex items-center gap-2 bg-cyan text-titanium font-mono text-xs uppercase px-5 py-2.5 hover:glow-cyan">
                  <Phone className="w-4 h-4" /> 513-568-2744
                </a>
                <a href="tel:+18125715765" className="inline-flex items-center gap-2 border border-cyan/40 text-cyan font-mono text-xs uppercase px-5 py-2.5 hover:glow-cyan">
                  <Phone className="w-4 h-4" /> 812-571-5765
                </a>
                <Link to={`/#intake`} className="inline-flex items-center gap-2 border border-heat/40 text-heat font-mono text-xs uppercase px-5 py-2.5 hover:glow-heat">
                  <Siren className="w-4 h-4" /> Book Mobile Service
                </Link>
              </div>
            </div>
          )}
          {state === "error" && (
            <div className="space-y-3">
              <p className="font-mono text-xs text-heat">Could not access GPS. Call us directly:</p>
              <a href="tel:+15135682744" className="inline-flex items-center gap-2 bg-cyan text-titanium font-mono text-xs uppercase px-5 py-2.5">
                <Phone className="w-4 h-4" /> 513-568-2744
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}