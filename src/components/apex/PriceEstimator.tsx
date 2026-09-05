import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Calculator, ChevronRight, Info } from "lucide-react";
import { PRICING, URGENCIES, estimate, type UrgencyId } from "@/lib/pricing";

export default function PriceEstimator() {
  const [pillarId, setPillarId] = useState(PRICING[0].id);
  const pillar = useMemo(() => PRICING.find((p) => p.id === pillarId)!, [pillarId]);
  const [subName, setSubName] = useState<string>(pillar.sub[0]?.name ?? "");
  const [urgencyId, setUrgencyId] = useState<UrgencyId>("standard");
  const [year, setYear] = useState<string>("");
  const [make, setMake] = useState<string>("");

  // keep subservice valid when pillar changes
  const safeSub = pillar.sub.some((s) => s.name === subName) ? subName : pillar.sub[0]?.name ?? "";
  const result = useMemo(
    () => estimate(pillarId, safeSub, urgencyId, { year: Number(year) || 0, make }),
    [pillarId, safeSub, urgencyId, year, make],
  );

  return (
    <div className="border border-cyan/20 bg-blueprint/30">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-cyan/15">
        <Calculator className="w-4 h-4 text-cyan" />
        <span className="font-mono text-xs uppercase tracking-widest text-cyan">// Instant Price Estimator</span>
      </div>

      <div className="grid lg:grid-cols-2 gap-px bg-cyan/10">
        {/* inputs */}
        <div className="bg-titanium p-5 space-y-4">
          <Field label="Service pillar">
            <select
              value={pillarId}
              onChange={(e) => {
                setPillarId(e.target.value);
                const p = PRICING.find((x) => x.id === e.target.value)!;
                setSubName(p.sub[0]?.name ?? "");
              }}
              className="w-full bg-titanium border border-cyan/20 px-3 py-2 font-body text-sm text-data focus:border-cyan focus:outline-none"
            >
              {PRICING.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Job type">
            <select
              value={safeSub}
              onChange={(e) => setSubName(e.target.value)}
              className="w-full bg-titanium border border-cyan/20 px-3 py-2 font-body text-sm text-data focus:border-cyan focus:outline-none"
            >
              <option value="">— Diagnostic only (${pillar.diagnostic[0]}–${pillar.diagnostic[1]}) —</option>
              {pillar.sub.map((s) => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          </Field>

          <Field label="Urgency">
            <div className="grid gap-1.5">
              {URGENCIES.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setUrgencyId(u.id)}
                  className={`text-left px-3 py-2 border font-mono text-[11px] uppercase tracking-wider transition-all ${urgencyId === u.id ? "border-cyan text-cyan bg-cyan/10" : "border-cyan/20 text-muted-foreground hover:border-cyan/50"}`}
                >
                  <div className="flex items-center justify-between">
                    <span>{u.label}</span>
                    {u.addHigh > 0 && <span className="text-heat text-[10px]">+premium</span>}
                    {u.addHigh < 0 && <span className="text-cyan text-[10px]">−labour</span>}
                  </div>
                  <span className="block font-body normal-case tracking-normal text-[10px] text-muted-foreground/70 mt-0.5">{u.note}</span>
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Year">
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g. 2014"
                className="w-full bg-titanium border border-cyan/20 px-3 py-2 font-mono text-sm text-data focus:border-cyan focus:outline-none"
              />
            </Field>
            <Field label="Make">
              <input
                value={make}
                onChange={(e) => setMake(e.target.value)}
                placeholder="e.g. Honda"
                className="w-full bg-titanium border border-cyan/20 px-3 py-2 font-body text-sm text-data focus:border-cyan focus:outline-none"
              />
            </Field>
          </div>
        </div>

        {/* result */}
        <div className="bg-titanium p-5 flex flex-col">
          <div className="font-mono text-[10px] uppercase tracking-widest text-cyan mb-2">// Estimated labour range</div>
          <div className="font-heading text-4xl sm:text-5xl text-data leading-none">
            ${result.low}
            <span className="text-muted-foreground mx-1">–</span>
            ${result.high}
          </div>
          <div className="font-mono text-[11px] text-muted-foreground mt-2">
            {result.includesDiagnostic ? "Diagnostic booking — final quote after inspection." : "Labour estimate for the selected job."}
          </div>

          <div className="mt-4 space-y-1.5 font-mono text-[10px] text-muted-foreground/80">
            <div className="flex justify-between"><span>Vehicle / model year</span><span className="text-data">{(Number(year) || 0) > 0 && Number(year) < 2000 ? "+20% legacy" : "—"}</span></div>
            <div className="flex justify-between"><span>Luxury / European make</span><span className="text-data">{/bmw|mercedes|audi|porsche|jaguar|rover|volkswagen|vw|volvo|lexus|infiniti|acura|tesla|maserati|mini|bentley/i.test(make) ? "+25%" : "—"}</span></div>
            <div className="flex justify-between"><span>Urgency modifier</span><span className="text-data">{urgencyId === "emergency" ? "mobile +$" : urgencyId === "mailin" ? "mail-in −10%" : "standard"}</span></div>
          </div>

          <div className="mt-auto pt-5">
            <div className="flex items-start gap-2 border border-cyan/10 px-3 py-2.5 mb-4">
              <Info className="w-3.5 h-3.5 text-cyan/60 shrink-0 mt-0.5" />
              <p className="font-body text-[11px] text-muted-foreground leading-relaxed">
                Indicative labour range only. Parts, programming credits, and shipping are quoted after inspection. A diagnostic fee may apply and is credited toward approved work.
              </p>
            </div>
            <Link
              to="/#intake"
              className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider bg-cyan text-titanium px-4 py-2.5 hover:glow-cyan transition-all"
            >
              Book this estimate <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-cyan/80 mb-1.5">{label}</div>
      {children}
    </div>
  );
}