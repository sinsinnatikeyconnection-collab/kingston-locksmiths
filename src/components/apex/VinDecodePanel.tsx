import React, { useMemo, useState } from "react";
import { Loader2, ShieldAlert, ExternalLink, Cpu, Info, Star, AlertOctagon, MessageSquareWarning, CalendarClock } from "lucide-react";
import type { VinDecodeResult } from "@/hooks/useVinDecode";
import type { ProblemCategory } from "@/lib/types";
import { buildMaintenance } from "@/lib/maintenance";
import ScheduleButton from "@/components/apex/ScheduleButton";

interface Props {
  data: VinDecodeResult | null;
  loading: boolean;
  error: string;
}

function Stars({ rating }: { rating: string }) {
  const n = parseInt(rating, 10);
  if (Number.isNaN(n)) return <span className="font-mono text-[11px] text-muted-foreground">{rating || "—"}</span>;
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className="w-3 h-3"
          style={{ color: i < n ? "#FF3E00" : "rgba(240,240,240,0.18)" }}
          fill={i < n ? "#FF3E00" : "transparent"}
        />
      ))}
      <span className="font-mono text-[10px] text-data/80 ml-1">{n}/5</span>
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex gap-2">
      <span className="font-mono text-[10px] uppercase text-cyan/60 w-28 shrink-0">{label}</span>
      <span className="font-mono text-[11px] text-data/90">{value}</span>
    </div>
  );
}

function recallCategory(comp: string): ProblemCategory {
  const c = (comp || "").toLowerCase();
  if (/(electri|wiring|battery|air ?bag|srs|ignit|sensor|module)/.test(c)) return "Electrical & Diagnostics";
  return "Mechanical Repair";
}

export default function VinDecodePanel({ data, loading, error }: Props) {
  const [mileage, setMileage] = useState<number | null>(null);
  const maint = useMemo(() => buildMaintenance(data?.decoded?.year || "", mileage ?? 0), [data?.decoded?.year, mileage]);

  if (loading) {
    return (
      <div className="mt-3 flex items-center gap-2 border border-cyan/20 bg-cyan/5 px-3 py-2">
        <Loader2 className="w-3.5 h-3.5 text-cyan animate-spin" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-cyan">
          Decoding VIN via NHTSA VPIC…
        </span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="mt-3 flex items-center gap-2 border border-heat/30 bg-heat/5 px-3 py-2">
        <ShieldAlert className="w-3.5 h-3.5 text-heat shrink-0" />
        <span className="font-mono text-[10px] uppercase tracking-wider text-heat">{error}</span>
      </div>
    );
  }
  if (!data) return null;
  const d = data.decoded;
  const { complaints, safetyRating } = data;
  const engParts = [d.engine_size && `${d.engine_size}L`, d.cylinders && `${d.cylinders} cyl`, d.fuelType]
    .filter(Boolean)
    .join(" • ");

  return (
    <div className="mt-3 border border-cyan/20 bg-blueprint/30 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Cpu className="w-3.5 h-3.5 text-cyan" />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan">
          // Auto-decoded — source: {data.source}
        </span>
      </div>

      <div className="space-y-1">
        <Row label="Vehicle" value={[d.year, d.make, d.model, d.trim].filter(Boolean).join(" ")} />
        <Row label="Engine" value={engParts} />
        <Row label="Drive" value={d.driveType} />
        <Row label="Body" value={d.bodyClass} />
        <Row label="Plant" value={d.plant} />
      </div>

      <div className="border-t border-cyan/10 pt-2">
        <div className="flex gap-2">
          <span className="font-mono text-[10px] uppercase text-cyan/60 w-28 shrink-0">Diag Bus</span>
          <span className="font-mono text-[11px] text-data/90">{data.network.diagnosticBus}</span>
        </div>
      </div>

      <div className="border-t border-cyan/10 pt-2">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[10px] uppercase text-cyan/60">
            NHTSA Recalls: {data.recalls.length}
          </span>
          {data.recallError && (
            <span className="font-mono text-[10px] text-heat">{data.recallError}</span>
          )}
          {data.oemResources.recallsUrl && (
            <a
              href={data.oemResources.recallsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[10px] uppercase text-cyan flex items-center gap-1 hover:underline"
            >
              View on NHTSA <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        {data.recalls.length === 0 ? (
          <p className="font-mono text-[10px] text-muted-foreground">No open safety campaigns on file.</p>
        ) : (
          <ul className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {data.recalls.map((r) => (
              <li key={r.number} className="border-l-2 border-heat/40 pl-2">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-3 h-3 text-heat shrink-0" />
                  <span className="font-mono text-[10px] text-heat">{r.number}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{r.date}</span>
                </div>
                <div className="font-mono text-[10px] text-data/90 mt-0.5">{r.component}</div>
                <p className="font-body text-[11px] text-muted-foreground leading-snug mt-0.5">{r.summary}</p>
                <div className="mt-1.5"><ScheduleButton vin={data.vin} detail={`Recall ${r.number}: ${r.component} — ${r.summary}`} category={recallCategory(r.component)} /></div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* complaints + investigations-on-file */}
      <div className="border-t border-cyan/10 pt-2">
        <div className="flex items-center gap-2 mb-2">
          <MessageSquareWarning className="w-3.5 h-3.5 text-heat" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan/60">
            // NHTSA Complaints: {complaints.total}
          </span>
          {data.complaintError && <span className="font-mono text-[10px] text-heat">{data.complaintError}</span>}
        </div>
        {complaints.total === 0 ? (
          <p className="font-mono text-[10px] text-muted-foreground">No consumer complaints on file for this exact model-year.</p>
        ) : (
          <div className="space-y-2">
            {(complaints.crashes > 0 || complaints.fire > 0 || complaints.injuries > 0 || complaints.deaths > 0) && (
              <p className="font-mono text-[10px] text-heat/90">
                Severity on file: {complaints.crashes} crash · {complaints.fire} fire · {complaints.injuries} injured · {complaints.deaths} dead
              </p>
            )}
            {complaints.topComponents.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {complaints.topComponents.map((c) => (
                  <span key={c.component} className="font-mono text-[9px] uppercase border border-heat/30 bg-heat/5 text-heat/90 px-1.5 py-0.5">
                    {c.component} ×{c.count}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* NCAP 5-star safety ratings */}
      <div className="border-t border-cyan/10 pt-2">
        <div className="flex items-center gap-2 mb-2">
          <Star className="w-3.5 h-3.5 text-heat" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan/60">// NCAP 5-Star Rating</span>
          {data.safetyError && <span className="font-mono text-[10px] text-heat">{data.safetyError}</span>}
        </div>
        {safetyRating.hasRating ? (
          <div className="space-y-2">
            {safetyRating.vehicleDescription && (
              <p className="font-mono text-[10px] text-data/80">{safetyRating.vehicleDescription}</p>
            )}
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-cyan/60 w-20 shrink-0">Overall</span>
              <Stars rating={safetyRating.overallRating || ""} />
            </div>
            {["frontal", "side", "rollover"].map((k) => {
              const block = (safetyRating as any)[k];
              if (!block) return null;
              const label = k.charAt(0).toUpperCase() + k.slice(1);
              const val = k === "rollover" ? block.rating : block.overall;
              return (
                <div key={k} className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-cyan/60 w-20 shrink-0">{label}</span>
                  <Stars rating={String(val || "")} />
                </div>
              );
            })}
            {safetyRating.adas && (
              <div className="font-mono text-[9px] text-muted-foreground leading-snug">
                ADAS: ESC {safetyRating.adas.esc || "—"} · FCW {safetyRating.adas.forwardCollisionWarning || "—"} · LDW {safetyRating.adas.laneDepartureWarning || "—"}
              </div>
            )}
            {safetyRating.counts && (
              <div className="font-mono text-[9px] text-muted-foreground/80">
                On file: {safetyRating.counts.complaints ?? "—"} complaints · {safetyRating.counts.recalls ?? "—"} recalls · {safetyRating.counts.investigations ?? "—"} investigations
              </div>
            )}
          </div>
        ) : (
          <p className="font-mono text-[10px] text-muted-foreground leading-snug">
            <AlertOctagon className="w-3 h-3 inline mr-1 text-muted-foreground/70" />
            {safetyRating.note || "No NCAP crash-test data for this model."}
          </p>
        )}
      </div>

      <div className="border-t border-cyan/10 pt-2">
        <div className="flex items-center gap-2 mb-2">
          <CalendarClock className="w-3.5 h-3.5 text-cyan" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan/60">// Maintenance Schedule</span>
          <span className="font-mono text-[9px] text-muted-foreground/70 ml-auto">vehicle age {maint.age} yr</span>
        </div>
        <div className="flex items-center gap-2 mb-2.5">
          <label className="font-mono text-[9px] uppercase text-cyan/60 shrink-0">Current mileage</label>
          <input
            type="number"
            min={0}
            value={mileage ?? ""}
            onChange={(e) => setMileage(e.target.value ? Math.max(0, parseInt(e.target.value, 10) || 0) : null)}
            placeholder="e.g. 84000"
            className="flex-1 max-w-[140px] bg-titanium border border-cyan/20 px-2 py-1.5 font-mono text-xs text-data focus:border-cyan focus:outline-none"
          />
        </div>
        <ul className="space-y-1.5">
          {maint.items.map((it) => {
            const stColor = it.status === "due_now" ? "border-heat/40 text-heat" : it.status === "due_soon" ? "border-yellow-400/40 text-yellow-400" : "border-cyan/20 text-muted-foreground";
            const stLabel = it.status === "due_now" ? "DUE NOW" : it.status === "due_soon" ? "DUE SOON" : "OK";
            return (
              <li key={it.key} className={`border ${stColor} bg-titanium/40 px-2 py-1.5 flex flex-wrap items-center gap-x-2 gap-y-1`}>
                <span className="font-mono text-[11px] text-data/90 flex-1 min-w-[120px]">{it.label}</span>
                <span className={`font-mono text-[9px] uppercase ${stColor} px-1.5 py-0.5 border`}>{stLabel}</span>
                {it.nextDueMiles != null && <span className="font-mono text-[9px] text-muted-foreground/70">next ~{it.nextDueMiles.toLocaleString()} mi</span>}
                {it.status !== "ok" && <ScheduleButton vin={data.vin} detail={`${it.label}${it.note ? " — " + it.note : ""}`} category={it.service} label="Schedule" />}
              </li>
            );
          })}
        </ul>
        <p className="font-mono text-[8px] text-muted-foreground/60 mt-1.5">Generic recommended intervals — confirm against your owner's manual.</p>
      </div>

      <div className="border-t border-cyan/10 pt-2 flex items-start gap-2">
        <Info className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
        <p className="font-mono text-[9px] text-muted-foreground/70 leading-snug">{data.oemResources.dataGap}</p>
      </div>
    </div>
  );
}