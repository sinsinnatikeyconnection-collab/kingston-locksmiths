import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Gauge, Zap, Thermometer, Battery, Activity, Bluetooth, AlertTriangle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Honest simulated digital-twin dashboard. Live dongle data requires a paired
// Wi-Fi/Bluetooth OBD2 adapter and a hardware protocol the browser can't reach
// reliably — so this view runs a realistic simulation and is clearly labeled.
interface Vitals { rpm: number; boost: number; coolant: number; voltage: number; gear: string }

interface GaugeVitalProps {
  icon: LucideIcon;
  label: string;
  value: number | string;
  unit: string;
  hot: boolean;
}

const INIT_VITALS: Vitals = { rpm: 0, boost: 0, coolant: 192, voltage: 12.4, gear: "P" };

export default function DigitalTwin() {
  const [live, setLive] = useState<boolean>(false);
  const [vitals, setVitals] = useState<Vitals>(INIT_VITALS);
  const [faults, setFaults] = useState<string[]>(["P0420 — Catalyst efficiency below threshold"]);
  const ivRef = useRef<number | null>(null);

  useEffect(() => {
    if (!live) return;
    ivRef.current = window.setInterval(() => {
      setVitals((v) => ({
        rpm: Math.round(700 + Math.random() * 4600),
        boost: +(Math.random() * 14).toFixed(1),
        coolant: Math.min(228, v.coolant + (Math.random() > 0.5 ? 1 : -1)),
        voltage: +(11.9 + Math.random() * 1.8).toFixed(1),
        gear: ["P", "R", "N", "D"][Math.floor(Math.random() * 4)],
      }));
      if (Math.random() > 0.85) {
        const pool = ["P0300 — Random misfire", "P0171 — System too lean", "P0420 — Catalyst efficiency", "P0128 — Thermostat below threshold", "P00B7 — Engine coolant flow low"];
        setFaults((f) => Array.from(new Set([pool[Math.floor(Math.random() * pool.length)], ...f])).slice(0, 4));
      }
    }, 1200);
    return () => { if (ivRef.current) clearInterval(ivRef.current); };
  }, [live]);

  return (
    <div className="border border-cyan/20 bg-blueprint/30 p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan" />
          <span className="font-mono text-xs uppercase tracking-widest text-cyan">// Digital Twin — Live Vitals</span>
        </div>
        <button
          onClick={async () => {
            if (live) { setLive(false); return; }
            try {
              if (navigator.bluetooth) {
                const dev = await navigator.bluetooth.requestDevice({ acceptAllDevices: true } as unknown as RequestDeviceOptions);
                if (dev && dev.gatt) { try { await dev.gatt.connect(); } catch { /* gatt connect failed */ } }
              }
            } catch { /* cancelled / unsupported — fall back to simulated stream */ }
            setLive(true);
          }}
          className={`flex items-center gap-2 font-mono text-xs uppercase px-3 py-1.5 border transition-all ${live ? "border-heat text-heat bg-heat/10" : "border-cyan/40 text-cyan hover:glow-cyan"}`}
        >
          <Bluetooth className="w-3.5 h-3.5" /> {live ? "Disconnect" : "Pair OBD2 Dongle"}
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <GaugeVital icon={Gauge} label="RPM" value={live ? vitals.rpm : "—"} unit="" hot={vitals.rpm > 5000} />
        <GaugeVital icon={Zap} label="Boost" value={live ? vitals.boost : "—"} unit="psi" hot={vitals.boost > 10} />
        <GaugeVital icon={Thermometer} label="Coolant" value={live ? Math.round(vitals.coolant) : "—"} unit="°F" hot={vitals.coolant > 220} />
        <GaugeVital icon={Battery} label="Voltage" value={live ? vitals.voltage : "—"} unit="V" hot={vitals.voltage < 12} />
      </div>

      <div className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground mb-2">// Live Fault Codes</div>
      <div className="space-y-1.5 mb-5 min-h-[64px]">
        {faults.length === 0 ? (
          <div className="font-mono text-xs text-cyan">No active codes.</div>
        ) : faults.map((f) => (
          <div key={f} className="flex items-center gap-2 font-mono text-xs text-heat border border-heat/20 bg-heat/5 px-3 py-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> {f}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-muted-foreground/60">SIMULATED — pair a Wi-Fi/Bluetooth OBD2 dongle for real live data</span>
        <Link to="/#intake" className="font-mono text-xs uppercase text-cyan hover:underline">Book remote diag →</Link>
      </div>
    </div>
  );
}

function GaugeVital({ icon: Icon, label, value, unit, hot }: GaugeVitalProps) {
  return (
    <div className={`border p-3 ${hot ? "border-heat/40 bg-heat/5" : "border-cyan/20 bg-titanium"}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3.5 h-3.5 ${hot ? "text-heat" : "text-cyan"}`} />
        <span className="font-mono text-[10px] uppercase text-muted-foreground">{label}</span>
      </div>
      <div className={`font-heading text-2xl tabular-nums ${hot ? "text-heat" : "text-data"}`}>
        {value}<span className="font-mono text-xs text-muted-foreground ml-1">{unit}</span>
      </div>
    </div>
  );
}