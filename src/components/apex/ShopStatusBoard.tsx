import React from "react";

// Static professional tool-bench list. No simulated "live" connection indicators
// or randomized status cycling — just the real equipment we use.
interface Equipment { name: string; model: string }

const EQUIPMENT: Equipment[] = [
  { name: "J2534 Pass-Thru Gateway", model: "OP2.0 / VCI" },
  { name: "EEPROM/MCU Programmer", model: "X-Prog M / UPA" },
  { name: "CAN/LIN Bus Analyzer", model: "PicoScope 4425A" },
  { name: "ECU Cloning Bench", model: "KTAG / KESS3" },
  { name: "Laser Key Cutter", model: "XH XP / Triton" },
  { name: "ADAS Calibration Target", model: "Dynamic + Static" },
];

export default function ShopStatusBoard() {
  return (
    <div className="border border-cyan/20 bg-blueprint/30">
      <div className="flex items-center justify-between px-5 py-3 border-b border-cyan/20 bg-titanium">
        <span className="font-mono text-xs uppercase tracking-widest text-cyan">// Tool Bench</span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">In-House Equipment</span>
      </div>
      <div className="divide-y divide-cyan/10">
        {EQUIPMENT.map((e) => (
          <div key={e.name} className="flex items-center justify-between px-5 py-3.5">
            <div>
              <div className="font-mono text-xs text-data">{e.name}</div>
              <div className="font-mono text-[10px] text-muted-foreground">{e.model}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan" />
              <span className="font-mono text-[10px] uppercase tracking-wider text-cyan">Available</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}