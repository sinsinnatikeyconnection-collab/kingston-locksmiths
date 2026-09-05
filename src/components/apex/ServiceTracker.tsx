import React, { Fragment } from "react";
import { Check, ClipboardList, Wrench, Calendar, User, ImageIcon } from "lucide-react";
import { Image } from "@/components/ui/image";
import type { ServiceBooking, BookingStage } from "@/lib/types";

// Real-time service tracker. Renders a 6-stage visual pipeline
// (Booked → Diagnosing → In Progress → Quality Check → Ready for Pickup → Complete),
// derived from booking.progress_stage with a fallback mapping off the legacy
// booking.status field so existing records render correctly before any admin
// stage updates exist.

const STAGES: { id: BookingStage; label: string }[] = [
  { id: "booked", label: "Booked" },
  { id: "diagnosing", label: "Diagnosing" },
  { id: "in_progress", label: "In Progress" },
  { id: "quality_check", label: "Quality Check" },
  { id: "ready_for_pickup", label: "Ready for Pickup" },
  { id: "complete", label: "Complete" },
];

const STATUS_TO_STAGE: Record<string, BookingStage> = {
  received: "booked",
  reviewing: "diagnosing",
  scheduled: "in_progress",
  completed: "complete",
};

function resolveStage(b: ServiceBooking): BookingStage {
  if (b.progress_stage && STAGES.some((s) => s.id === b.progress_stage)) {
    return b.progress_stage as BookingStage;
  }
  return STATUS_TO_STAGE[b.status] || "booked";
}

interface ServiceTrackerProps {
  booking: ServiceBooking;
}

export default function ServiceTracker({ booking }: ServiceTrackerProps) {
  const stage = resolveStage(booking);
  const current = STAGES.findIndex((s) => s.id === stage);
  const photos = (booking.progress_photos || []).filter(Boolean);
  const notes = (booking.technician_notes || []).filter(Boolean);

  return (
    <div className="border border-cyan/20 bg-blueprint/30">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4 border-b border-cyan/10">
        <div className="min-w-0">
          <div className="font-mono text-sm text-data">
            {booking.year} {booking.make} {booking.model}
          </div>
          <div className="font-mono text-[11px] text-muted-foreground">
            {booking.problem_category}
          </div>
          <div className="font-mono text-[10px] text-muted-foreground/60 mt-1">
            VIN {booking.vin}{booking.reference_code ? ` • Ref ${booking.reference_code}` : ""}
          </div>
        </div>
        {booking.scheduled_date && (
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-cyan shrink-0">
            <Calendar className="w-3 h-3" /> {booking.scheduled_date}
          </div>
        )}
      </div>

      {/* stage pipeline */}
      <div className="px-5 py-5 overflow-x-auto">
        <div className="flex items-start min-w-[560px]">
          {STAGES.map((s, i) => {
            const done = i < current;
            const active = i === current;
            return (
              <Fragment key={s.id}>
                <div className="flex flex-col items-center w-[88px] shrink-0">
                  <span
                    className={`flex items-center justify-center w-8 h-8 rounded-full border transition-all ${
                      done
                        ? "border-cyan bg-cyan text-titanium"
                        : active
                        ? "border-cyan bg-cyan/10 text-cyan glow-cyan"
                        : "border-cyan/30 text-muted-foreground/50"
                    }`}
                  >
                    {done ? <Check className="w-4 h-4" /> : <span className="font-mono text-[10px]">{String(i + 1).padStart(2, "0")}</span>}
                  </span>
                  <span
                    className={`mt-2 font-mono text-[9px] uppercase tracking-wider text-center leading-tight ${
                      active ? "text-cyan" : done ? "text-data/80" : "text-muted-foreground/60"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STAGES.length - 1 && (
                  <div className="flex-1 h-px mt-4 bg-cyan/10">
                    <div
                      className="h-full bg-cyan transition-all duration-500"
                      style={{ width: done ? "100%" : "0%" }}
                    />
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
      </div>

      {/* technician + price */}
      {(booking.technician_name || booking.price_estimate_low != null) && (
        <div className="flex flex-wrap items-center gap-4 px-5 py-3 border-t border-cyan/10">
          {booking.technician_name && (
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-data/80">
              <User className="w-3.5 h-3.5 text-cyan" /> Tech: {booking.technician_name}
            </span>
          )}
          {booking.price_estimate_low != null && booking.price_estimate_high != null && (
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-data/80">
              <ClipboardList className="w-3.5 h-3.5 text-cyan" /> Estimate ${booking.price_estimate_low}–${booking.price_estimate_high}
            </span>
          )}
        </div>
      )}

      {/* notes */}
      {notes.length > 0 && (
        <div className="px-5 py-4 border-t border-cyan/10">
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-cyan mb-3">
            <Wrench className="w-3.5 h-3.5" /> // Technician Notes
          </div>
          <ul className="space-y-2">
            {notes.map((n, i) => (
              <li key={i} className="font-body text-sm text-data/85 leading-relaxed flex gap-2">
                <span className="font-mono text-cyan/70 mt-0.5 shrink-0">▸</span>
                {n}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* progress photos */}
      {photos.length > 0 && (
        <div className="px-5 py-4 border-t border-cyan/10">
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-cyan mb-3">
            <ImageIcon className="w-3.5 h-3.5" /> // Progress Photos
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {photos.map((p, i) => (
              <div key={i} className="aspect-square border border-cyan/20 overflow-hidden">
                <Image src={p} fittingType="fill" className="w-full h-full" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* empty detail */}
      {notes.length === 0 && photos.length === 0 && !booking.technician_name && (
        <div className="px-5 py-3 border-t border-cyan/10 font-mono text-[10px] text-muted-foreground/50">
          // Your technician will post diagnostics & progress here as work advances.
        </div>
      )}
    </div>
  );
}