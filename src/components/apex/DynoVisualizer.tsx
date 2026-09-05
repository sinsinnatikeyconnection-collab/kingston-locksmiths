import React, { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Gauge, Zap, TrendingUp, TrendingDown } from "lucide-react";

interface Stage {
  id: string;
  label: string;
  sub: string;
  peakHp: number;
  hpRpm: number;
  peakTq: number;
  tqRpm: number;
  color: string;
}

const STOCK: Stage = { id: "stock", label: "Stock", sub: "Factory ECU calibration", peakHp: 220, hpRpm: 5500, peakTq: 250, tqRpm: 3000, color: "#6b7280" };
const STAGES: Stage[] = [
  { id: "s1", label: "Stage 1", sub: "Custom dyno-tuned remap", peakHp: 265, hpRpm: 5800, peakTq: 295, tqRpm: 3200, color: "#00E5FF" },
  { id: "s2", label: "Stage 2", sub: "Remap + intake & full exhaust", peakHp: 305, hpRpm: 6000, peakTq: 335, tqRpm: 3500, color: "#3BE3A8" },
  { id: "s3", label: "Stage 3", sub: "Hybrid turbo + upgraded injectors", peakHp: 380, hpRpm: 6300, peakTq: 410, tqRpm: 4000, color: "#FF3E00" },
];

const RPMS = Array.from({ length: 25 }, (_, i) => 1000 + i * 250); // 1000 → 7000

// Smooth bell-curve torque profile, then HP = (TQ × RPM) / 5252.
function torqueAt(rpm: number, peak: number, peakRpm: number): number {
  const sigma = 2200;
  const bell = Math.exp(-((rpm - peakRpm) ** 2) / (2 * sigma * sigma));
  const floor = Math.max(0.5 - Math.abs(rpm - peakRpm) * 0.00003, 0.32);
  const spool = rpm < 1600 ? Math.max(0, (rpm - 850) / 750) : 1;
  return Math.max(0, peak * (floor + (1 - floor) * bell) * spool);
}

interface Datum { rpm: number; "Stock HP": number; "Stock TQ": number; hp: number; tq: number }

function TooltipBox({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const get = (k: string) => payload.find((p: any) => p.dataKey === k)?.value as number | undefined;
  return (
    <div className="bg-titanium/95 border border-cyan/30 px-3 py-2 font-mono text-[10px] text-data backdrop-blur-sm">
      <div className="uppercase tracking-widest text-cyan mb-1">{label} RPM</div>
      <div>Stock: {get("Stock HP") ?? 0} hp / {get("Stock TQ") ?? 0} lb-ft</div>
      <div style={{ color: payload.find((p: any) => p.dataKey === "hp")?.stroke }}>{get("hp") ?? 0} hp / {get("tq") ?? 0} lb-ft</div>
    </div>
  );
}

export default function DynoVisualizer() {
  const [activeId, setActiveId] = useState<string>("s2");
  const active = STAGES.find((s) => s.id === activeId)!;

  const data = useMemo<Datum[]>(() => {
    return RPMS.map((rpm) => {
      const stkTq = Math.round(torqueAt(rpm, STOCK.peakTq, STOCK.tqRpm));
      const actTq = Math.round(torqueAt(rpm, active.peakTq, active.tqRpm));
      return {
        rpm,
        "Stock HP": Math.round((stkTq * rpm) / 5252),
        "Stock TQ": stkTq,
        hp: Math.round((actTq * rpm) / 5252),
        tq: actTq,
      };
    });
  }, [active]);

  const dHp = active.peakHp - STOCK.peakHp;
  const dTq = active.peakTq - STOCK.peakTq;

  return (
    <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-12">
      <div className="flex items-center gap-3 mb-6">
        <Gauge className="w-5 h-5 text-cyan" />
        <h2 className="font-heading text-2xl sm:text-3xl uppercase text-data leading-tight">Dyno Simulation Console</h2>
      </div>
      <p className="font-body text-sm text-muted-foreground max-w-2xl mb-6">
        Compare a baseline tune against SKC custom calibration stages. Curves are
        illustrative simulations — every real build is tuned live on our Mustang
        dyno against your exact platform and fuel.
      </p>

      {/* stage selector */}
      <div className="flex flex-wrap gap-2 mb-6">
        {STAGES.map((s) => {
          const on = s.id === activeId;
          return (
            <button
              key={s.id}
              onClick={() => setActiveId(s.id)}
              className={`px-4 py-2.5 border font-mono text-xs uppercase tracking-wider transition-all text-left ${on ? "bg-blueprint/60" : "bg-titanium hover:bg-blueprint/30"}`}
              style={on ? { borderColor: s.color, color: s.color, boxShadow: `0 0 14px ${s.color}33` } : { borderColor: "rgba(0,229,255,0.2)", color: "#9ca3af" }}
            >
              <div className="font-heading text-sm">{s.label}</div>
              <div className="text-[9px] normal-case tracking-wide opacity-70">{s.sub}</div>
            </button>
          );
        })}
      </div>

      {/* stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-cyan/10 border border-cyan/10 mb-6">
        <Stat icon={<Gauge className="w-3.5 h-3.5" />} label="Peak HP" value={`${active.peakHp}`} unit="hp" sub={`@ ${active.hpRpm} rpm`} accent={active.color} />
        <Stat icon={<Zap className="w-3.5 h-3.5" />} label="Peak Torque" value={`${active.peakTq}`} unit="lb-ft" sub={`@ ${active.tqRpm} rpm`} accent={active.color} />
        <Stat icon={<TrendingUp className="w-3.5 h-3.5" />} label="Δ Horsepower" value={`+${dHp}`} unit="hp" sub="vs. stock" accent="#3BE3A8" />
        <Stat icon={<TrendingUp className="w-3.5 h-3.5" />} label="Δ Torque" value={`+${dTq}`} unit="lb-ft" sub="vs. stock" accent="#3BE3A8" />
      </div>

      {/* chart */}
      <div className="bg-titanium border border-cyan/20 p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-cyan/70">// HP / TQ × RPM</span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">solid = {active.label} · dashed = Stock</span>
        </div>
        <div className="w-full h-[280px] sm:h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: -8 }}>
              <CartesianGrid stroke="rgba(0,229,255,0.08)" strokeDasharray="3 3" />
              <XAxis dataKey="rpm" stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 10, fontFamily: "JetBrains Mono" }} tickLine={{ stroke: "rgba(0,229,255,0.2)" }} domain={[1000, 7000]} label={{ value: "RPM", position: "insideBottomRight", fill: "#6b7280", fontSize: 10, offset: -2, dy: 10 }} />
              <YAxis stroke="#6b7280" tick={{ fill: "#9ca3af", fontSize: 10, fontFamily: "JetBrains Mono" }} tickLine={{ stroke: "rgba(0,229,255,0.2)" }} />
              <Tooltip content={<TooltipBox />} />
              <Legend wrapperStyle={{ fontFamily: "JetBrains Mono", fontSize: 11, color: "#9ca3af", paddingTop: 8 }} />
              <Line type="monotone" dataKey="Stock HP" stroke="#6b7280" strokeWidth={1.5} strokeDasharray="5 4" dot={false} name="Stock HP" />
              <Line type="monotone" dataKey="Stock TQ" stroke="#6b7280" strokeWidth={1.5} strokeDasharray="5 4" dot={false} name="Stock TQ" />
              <Line type="monotone" dataKey="hp" stroke={active.color} strokeWidth={2.5} dot={false} name={`${active.label} HP`} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="tq" stroke={active.color} strokeWidth={2.5} strokeDasharray="2 0" dot={false} name={`${active.label} TQ`} opacity={0.7} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

function Stat({ icon, label, value, unit, sub, accent }: { icon: React.ReactNode; label: string; value: string; unit: string; sub: string; accent: string }) {
  return (
    <div className="bg-titanium p-4">
      <div className="flex items-center gap-1.5 mb-1" style={{ color: accent }}>
        {icon}
        <span className="font-mono text-[9px] uppercase tracking-widest">{label}</span>
      </div>
      <div className="font-heading text-2xl text-data leading-none">
        {value}<span className="font-mono text-[11px] text-muted-foreground ml-1">{unit}</span>
      </div>
      <div className="font-mono text-[9px] text-muted-foreground mt-1">{sub}</div>
    </div>
  );
}