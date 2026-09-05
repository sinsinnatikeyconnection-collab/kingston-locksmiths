import db from "@/api/base44Client";

import React, { useState, useEffect } from "react";

import { useToast } from "@/components/ui/use-toast";
import { useVinDecode } from "@/hooks/useVinDecode";
import VinDecodePanel from "@/components/apex/VinDecodePanel";
import {
  ChevronRight,
  ChevronLeft,
  Upload,
  X,
  Car,
  Cpu,
  Wrench,
  Gauge,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Loader2,
  MapPin,
} from "lucide-react";
import type { ProblemCategory, BookingUrgency, ServiceBooking } from "@/lib/types";
import { newIdempotencyKey, loadIdempotencyKey, persistIdempotencyKey, clearIdempotencyKey } from "@/lib/idempotency";
import { validateVin, validateEmail, validatePhone, validateNonEmpty } from "@/lib/validation";
import { safeInvoke } from "@/lib/safeInvoke";

type IconType = React.ComponentType<{ className?: string }>;

const STEPS = ["Vehicle ID", "Symptom Matrix", "Evidence", "Dispatch"] as const;

interface CategoryDef {
  id: ProblemCategory;
  label: string;
  icon: IconType;
  examples: string[];
  accent: "cyan" | "heat";
}

const CATEGORIES: CategoryDef[] = [
  {
    id: "Lost Keys / Security & Lockout",
    label: "Lost Keys / Security",
    icon: Cpu,
    examples: ["All keys lost", "Immobilizer locked", "Key fob won't program"],
    accent: "cyan",
  },
  {
    id: "Electrical & Diagnostics",
    label: "Electrical & Diagnostics",
    icon: Car,
    examples: ["Check engine light", "Battery keeps dying", "Won't start", "Modules not communicating"],
    accent: "cyan",
  },
  {
    id: "Mechanical Repair",
    label: "Mechanical Repair",
    icon: Wrench,
    examples: ["Engine knocking", "Transmission slipping", "Need an engine swap"],
    accent: "heat",
  },
  {
    id: "Performance & Tuning",
    label: "Performance & Tuning",
    icon: Gauge,
    examples: ["ECU remapping", "Installing aftermarket turbo"],
    accent: "heat",
  },
];

const CAR_ZONES = [
  { id: "Front / Engine Bay", label: "Front" },
  { id: "Dashboard / Interior", label: "Dash" },
  { id: "Wheels / Suspension", label: "Wheels" },
  { id: "Rear / Drivetrain", label: "Rear" },
] as const;

const TIME_SLOTS = ["09:00", "11:00", "13:00", "15:00"] as const;

interface VehicleState {
  year: string;
  make: string;
  model: string;
  engine_size: string;
  vin: string;
}
interface DetailState {
  description: string;
  zone: string;
}
interface DispatchState {
  urgency: BookingUrgency | "";
  scheduled_date: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
}

const EMPTY_VEHICLE: VehicleState = { year: "", make: "", model: "", engine_size: "", vin: "" };
const EMPTY_DETAIL: DetailState = { description: "", zone: "" };
const EMPTY_DISPATCH: DispatchState = {
  urgency: "",
  scheduled_date: "",
  customer_name: "",
  customer_email: "",
  customer_phone: "",
};

export default function IntakeForm() {
  const { toast } = useToast();
  const [step, setStep] = useState<number>(0);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [done, setDone] = useState<boolean>(false);

  const [vehicle, setVehicle] = useState<VehicleState>(EMPTY_VEHICLE);
  const [category, setCategory] = useState<ProblemCategory | "">("");
  const [detail, setDetail] = useState<DetailState>(EMPTY_DETAIL);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [dispatch, setDispatch] = useState<DispatchState>(EMPTY_DISPATCH);

  // Auto-decode the VIN as soon as a valid 17-char VIN is entered, and auto-fill
  // Year/Make/Model/Engine from the NHTSA response (each only if non-empty, so an
  // already-typed value isn't blanked out).
  const vinDecode = useVinDecode(vehicle.vin);
  const [appliedDecodeVin, setAppliedDecodeVin] = useState<string>("");
  useEffect(() => {
    const d = vinDecode.data;
    if (!d || d.vin === appliedDecodeVin) return;
    setAppliedDecodeVin(d.vin);
    setVehicle((v) => ({
      ...v,
      year: d.decoded.year || v.year,
      make: d.decoded.make || v.make,
      model: d.decoded.model || v.model,
      engine_size: d.decoded.engine_size || v.engine_size,
    }));
  }, [vinDecode.data, appliedDecodeVin]);

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        const { file_url } = await db.integrations.Core.UploadFile({ file });
        uploaded.push(file_url);
      }
      setPhotos((prev) => [...prev, ...uploaded]);
    } catch (e) {
      toast({ title: "Upload failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const canNext = (): boolean => {
    // VIN is optional — Year/Make/Model still identify the car.
    if (step === 0) return !!(vehicle.year && vehicle.make && vehicle.model);
    if (step === 1) return !!category;
    if (step === 2) return detail.description.length > 5;
    if (step === 3)
      return (
        !!(dispatch.urgency &&
        dispatch.customer_name &&
        dispatch.customer_email &&
        dispatch.customer_phone &&
        (dispatch.urgency.includes("Emergency") || dispatch.scheduled_date))
      );
    return false;
  };

  const submit = async () => {
    // Malformed-input guards — reject before any network call.
    // VIN is optional — only validate its format when the customer provided one.
    if (vehicle.vin && vehicle.vin.trim()) {
      const vinR = validateVin(vehicle.vin);
      if (!vinR.ok) { toast({ title: "Invalid VIN", description: vinR.error, variant: "destructive" }); return; }
    }
    const nameR = validateNonEmpty("Name", dispatch.customer_name);
    if (!nameR.ok) { toast({ title: "Missing info", description: nameR.error, variant: "destructive" }); return; }
    const emailR = validateEmail(dispatch.customer_email);
    if (!emailR.ok) { toast({ title: "Invalid email", description: emailR.error, variant: "destructive" }); return; }
    const phoneR = validatePhone(dispatch.customer_phone);
    if (!phoneR.ok) { toast({ title: "Invalid phone", description: phoneR.error, variant: "destructive" }); return; }

    setSubmitting(true);
    try {
      // Idempotency: one key per intent, persisted across a dropped-connection
      // retry. createBooking (server-side) collapses a duplicate key to the same
      // single record, so rapid clicks / retried requests never create two.
      let key = loadIdempotencyKey("booking");
      if (!key) {
        key = newIdempotencyKey();
        persistIdempotencyKey("booking", key);
      }
      const result = await safeInvoke(() => db.functions.invoke("createBooking", {
        idempotencyKey: key,
        booking: {
          ...vehicle,
          problem_category: category as ProblemCategory,
          problem_detail: detail.description,
          problem_location: detail.zone,
          photo_urls: photos,
          ...dispatch,
        },
      }));
      if (!result.ok) {
        toast({
          title: result.retryable ? "Network interrupted" : "Submission failed",
          description: result.error,
          variant: "destructive",
        });
        return; // keep key — a retry reuses it and is collapsed server-side
      }
      if (!result.value?.data?.booking) {
        toast({ title: "Submission failed", description: "No booking returned.", variant: "destructive" });
        return;
      }
      clearIdempotencyKey("booking");
      setDone(true);
      toast({ title: "Booking initialized", description: "We'll respond within 2 hours." });
    } catch (e) {
      toast({ title: "Submission failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setStep(0);
    setDone(false);
    setVehicle(EMPTY_VEHICLE);
    setCategory("");
    setDetail(EMPTY_DETAIL);
    setPhotos([]);
    setDispatch(EMPTY_DISPATCH);
    clearIdempotencyKey("booking");
  };

  if (done) {
    return (
      <div className="bg-titanium border border-cyan/20 p-10 lg:p-16 text-center max-w-2xl mx-auto">
        <CheckCircle2 className="w-14 h-14 text-cyan mx-auto mb-6 drop-shadow-[0_0_12px_rgba(0,229,255,0.6)]" />
        <div className="font-mono text-xs uppercase tracking-[0.3em] text-cyan mb-3">
          // System Initialized
        </div>
        <h3 className="font-heading text-3xl uppercase text-data mb-4">
          Booking Received
        </h3>
        <p className="font-body text-sm text-muted-foreground mb-8">
          Your vehicle diagnostic request has been logged. With the VIN provided,
          we're already pulling wiring diagrams and checking immobilizer systems.
          A technician will reach out within 2 hours.
        </p>
        <div className="font-mono text-[11px] text-muted-foreground mb-8 space-y-1 text-left border border-cyan/10 p-4 max-w-sm mx-auto">
          <div>▸ VEHICLE: {vehicle.year} {vehicle.make} {vehicle.model}</div>
          <div>▸ CATEGORY: {category}</div>
          <div>▸ DISPATCH: {dispatch.urgency}</div>
          <div>▸ VIN: {vehicle.vin}</div>
        </div>
        <button
          onClick={reset}
          className="font-mono text-xs uppercase tracking-wider text-cyan border border-cyan/40 px-6 py-3 hover:glow-cyan transition-all"
        >
          New Submission
        </button>
      </div>
    );
  }

  return (
    <div className="bg-titanium border border-cyan/20 max-w-3xl mx-auto">
      {/* terminal header */}
      <div className="flex items-center justify-between border-b border-cyan/20 px-5 py-3 bg-blueprint/40">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-heat/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-cyan/80" />
          <span className="ml-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            apex_diagnostics.sh — intake
          </span>
        </div>
        <span className="font-mono text-[10px] text-cyan">
          STEP {String(step + 1).padStart(2, "0")}/04
        </span>
      </div>

      {/* progress */}
      <div className="flex border-b border-cyan/10">
        {STEPS.map((s, i) => (
          <div
            key={s}
            className={`flex-1 px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider transition-colors ${
              i === step
                ? "text-cyan bg-cyan/5"
                : i < step
                ? "text-cyan/50"
                : "text-muted-foreground/40"
            } ${i < STEPS.length - 1 ? "border-r border-cyan/10" : ""}`}
          >
            <span className={i < step ? "text-cyan" : ""}>✓ </span>
            {s}
          </div>
        ))}
      </div>

      <div className="p-6 lg:p-8 min-h-[340px]">
        {/* STEP 1: Vehicle ID */}
        {step === 0 && (
          <div>
            <SectionLabel num="01" title="Vehicle Identification" />
            <p className="font-body text-sm text-muted-foreground mb-6">
              Exact specs let us prepare the right software, scanners, and tools
              before we ever touch the car.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Year" value={vehicle.year} onChange={(v) => setVehicle({ ...vehicle, year: v })} placeholder="2021" />
              <Field label="Make" value={vehicle.make} onChange={(v) => setVehicle({ ...vehicle, make: v })} placeholder="Ford" />
              <Field label="Model" value={vehicle.model} onChange={(v) => setVehicle({ ...vehicle, model: v })} placeholder="F-150" />
              <Field label="Engine Size (optional)" value={vehicle.engine_size} onChange={(v) => setVehicle({ ...vehicle, engine_size: v })} placeholder="3.5L EcoBoost" />
            </div>
            <div className="mt-4">
              <label className="font-mono text-[11px] uppercase tracking-wider text-cyan flex items-center gap-2 mb-2">
                <span className="text-muted-foreground/50">(optional)</span> SYSTEM_VIN_INPUT
              </label>
              <input
                value={vehicle.vin}
                onChange={(e) => setVehicle({ ...vehicle, vin: e.target.value.toUpperCase() })}
                placeholder="17-character VIN"
                maxLength={17}
                className="w-full bg-titanium border border-cyan/20 px-4 py-3 font-mono text-sm text-data tracking-wider focus:border-cyan focus:glow-cyan focus:outline-none transition-all"
              />
              <p className="font-mono text-[10px] text-muted-foreground mt-2">
                ▸ VIN auto-decodes Year/Make/Model/Engine and pulls recalls, consumer complaints & NCAP crash ratings.
              </p>
              <VinDecodePanel data={vinDecode.data} loading={vinDecode.loading} error={vinDecode.error} />
            </div>
          </div>
        )}

        {/* STEP 2: Symptom Matrix */}
        {step === 1 && (
          <div>
            <SectionLabel num="02" title="Symptom Matrix" />
            <p className="font-body text-sm text-muted-foreground mb-6">
              Select the umbrella your nightmare falls under.
            </p>
            <div className="grid sm:grid-cols-2 gap-4">
              {CATEGORIES.map((c) => {
                const Icon = c.icon;
                const selected = category === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    className={`relative text-left p-5 border transition-all ${
                      selected
                        ? c.accent === "heat"
                          ? "border-heat bg-heat/5 glow-heat"
                          : "border-cyan bg-cyan/5 glow-cyan"
                        : "border-cyan/20 bg-titanium hover:border-cyan/50"
                    }`}
                  >
                    {selected && (
                      <span className={`absolute top-0 left-0 h-0.5 w-full animate-laser-wipe ${c.accent === "heat" ? "bg-heat" : "bg-cyan"}`} />
                    )}
                    <Icon className={`w-6 h-6 mb-3 ${selected ? (c.accent === "heat" ? "text-heat" : "text-cyan") : "text-muted-foreground"}`} />
                    <div className="font-heading text-sm uppercase text-data mb-2">{c.label}</div>
                    <ul className="space-y-0.5">
                      {c.examples.map((ex) => (
                        <li key={ex} className="font-mono text-[10px] text-muted-foreground">▸ {ex}</li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3: Evidence */}
        {step === 2 && (
          <div>
            <SectionLabel num="03" title="Visual Evidence" />
            <p className="font-body text-sm text-muted-foreground mb-6">
              Describe exactly what the car is doing (or not doing), then pin the
              problem area and attach photos.
            </p>
            <label className="font-mono text-[11px] uppercase tracking-wider text-cyan mb-2 block">
              Description
            </label>
            <textarea
              value={detail.description}
              onChange={(e) => setDetail({ ...detail, description: e.target.value })}
              rows={4}
              placeholder="Describe symptoms, error codes, when it happens..."
              className="w-full bg-titanium border border-cyan/20 px-4 py-3 font-body text-sm text-data focus:border-cyan focus:outline-none focus:glow-cyan transition-all resize-none"
            />

            {/* car zone pin */}
            <label className="font-mono text-[11px] uppercase tracking-wider text-cyan mt-6 mb-3 block">
              Pin Problem Area
            </label>
            <div className="grid grid-cols-4 gap-2 mb-6">
              {CAR_ZONES.map((z) => (
                <button
                  key={z.id}
                  onClick={() => setDetail({ ...detail, zone: detail.zone === z.id ? "" : z.id })}
                  className={`flex flex-col items-center gap-1.5 py-3 border transition-all ${
                    detail.zone === z.id
                      ? "border-cyan bg-cyan/5 text-cyan"
                      : "border-cyan/20 text-muted-foreground hover:border-cyan/50"
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                  <span className="font-mono text-[10px] uppercase">{z.label}</span>
                </button>
              ))}
            </div>

            {/* photo upload */}
            <label className="font-mono text-[11px] uppercase tracking-wider text-cyan mb-2 block">
              Attach Photos / Video Frames
            </label>
            <label className="flex flex-col items-center justify-center gap-2 border border-dashed border-cyan/30 py-8 cursor-pointer hover:border-cyan/60 hover:bg-cyan/5 transition-all">
              {uploading ? (
                <>
                  <Loader2 className="w-6 h-6 text-cyan animate-spin" />
                  <span className="font-mono text-[11px] text-cyan">Uploading...</span>
                </>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-muted-foreground" />
                  <span className="font-mono text-[11px] text-muted-foreground">
                    Drag & drop or click to upload
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground/60">
                    Error codes, melted harnesses, smashed dashes — save us an hour of guessing
                  </span>
                </>
              )}
              <input
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => handlePhotoUpload(e.target.files)}
              />
            </label>
            {photos.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mt-4">
                {photos.map((url, i) => (
                  <div key={i} className="relative aspect-square border border-cyan/20 overflow-hidden group">
                    <img src={url} alt={`evidence ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 bg-titanium/80 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3 text-heat" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* STEP 4: Dispatch */}
        {step === 3 && (
          <div>
            <SectionLabel num="04" title="Urgency & Dispatch" />
            <p className="font-body text-sm text-muted-foreground mb-6">
              Are you stranded, or booking a standard drop-off?
            </p>
            <div className="grid sm:grid-cols-2 gap-4 mb-6">
              <button
                onClick={() => setDispatch({ ...dispatch, urgency: "Emergency / Mobile Service" })}
                className={`text-left p-5 border transition-all ${
                  dispatch.urgency === "Emergency / Mobile Service"
                    ? "border-heat bg-heat/5 glow-heat"
                    : "border-cyan/20 hover:border-heat/50"
                }`}
              >
                <AlertTriangle className={`w-6 h-6 mb-2 ${dispatch.urgency === "Emergency / Mobile Service" ? "text-heat" : "text-muted-foreground"}`} />
                <div className="font-heading text-sm uppercase text-data mb-1">Emergency Dispatch</div>
                <div className="font-mono text-[10px] text-muted-foreground">Stranded? Mobile response. Premium dispatch fee applies.</div>
              </button>
              <button
                onClick={() => setDispatch({ ...dispatch, urgency: "Shop Drop-off / Standard Appointment" })}
                className={`text-left p-5 border transition-all ${
                  dispatch.urgency === "Shop Drop-off / Standard Appointment"
                    ? "border-cyan bg-cyan/5 glow-cyan"
                    : "border-cyan/20 hover:border-cyan/50"
                }`}
              >
                <Calendar className={`w-6 h-6 mb-2 ${dispatch.urgency === "Shop Drop-off / Standard Appointment" ? "text-cyan" : "text-muted-foreground"}`} />
                <div className="font-heading text-sm uppercase text-data mb-1">Standard Appointment</div>
                <div className="font-mono text-[10px] text-muted-foreground">Pick an available time block to drop off or have us come to you.</div>
              </button>
            </div>

            {dispatch.urgency === "Shop Drop-off / Standard Appointment" && (
              <div className="mb-6">
                <label className="font-mono text-[11px] uppercase tracking-wider text-cyan mb-2 block">
                  Available Time Blocks
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TIME_SLOTS.map((t) => (
                    <button
                      key={t}
                      onClick={() => setDispatch({ ...dispatch, scheduled_date: t })}
                      className={`py-2.5 border font-mono text-xs transition-all ${
                        dispatch.scheduled_date === t
                          ? "border-cyan bg-cyan/10 text-cyan glow-cyan"
                          : "border-cyan/20 text-muted-foreground hover:border-cyan/50"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-3 gap-4">
              <Field label="Name" value={dispatch.customer_name} onChange={(v) => setDispatch({ ...dispatch, customer_name: v })} placeholder="John Doe" />
              <Field label="Email" value={dispatch.customer_email} onChange={(v) => setDispatch({ ...dispatch, customer_email: v })} placeholder="john@email.com" type="email" />
              <Field label="Phone" value={dispatch.customer_phone} onChange={(v) => setDispatch({ ...dispatch, customer_phone: v })} placeholder="(555) 010-1990" />
            </div>
          </div>
        )}
      </div>

      {/* nav controls */}
      <div className="flex items-center justify-between border-t border-cyan/20 px-6 py-4 bg-blueprint/30">
        <button
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0}
          className={`flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider transition-all ${
            step === 0 ? "text-muted-foreground/30 cursor-not-allowed" : "text-muted-foreground hover:text-cyan"
          }`}
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>

        {step < 3 ? (
          <button
            onClick={() => canNext() && setStep(step + 1)}
            disabled={!canNext()}
            className={`flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider px-6 py-2.5 transition-all ${
              canNext()
                ? "bg-cyan text-titanium hover:glow-cyan"
                : "bg-blueprint text-muted-foreground/40 cursor-not-allowed"
            }`}
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={!canNext() || submitting}
            className={`flex items-center gap-2 font-mono text-xs uppercase tracking-wider px-6 py-2.5 transition-all ${
              canNext() && !submitting
                ? "bg-cyan text-titanium hover:glow-cyan"
                : "bg-blueprint text-muted-foreground/40 cursor-not-allowed"
            }`}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Transmitting...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" /> Initialize Booking
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

interface SectionLabelProps {
  num: string;
  title: string;
}
function SectionLabel({ num, title }: SectionLabelProps) {
  return (
    <div className="flex items-center gap-3 mb-1">
      <span className="font-mono text-[11px] text-cyan/60">{num}</span>
      <span className="font-heading text-lg uppercase text-data">{title}</span>
    </div>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "email";
}
function Field({ label, value, onChange, placeholder, type = "text" }: FieldProps) {
  return (
    <div>
      <label className="font-mono text-[11px] uppercase tracking-wider text-cyan mb-2 block">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-titanium border border-cyan/20 px-4 py-3 font-body text-sm text-data focus:border-cyan focus:outline-none focus:glow-cyan transition-all"
      />
    </div>
  );
}