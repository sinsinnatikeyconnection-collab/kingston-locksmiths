import db from "@/api/apiClient";

import React, { useState, useEffect, useCallback } from "react";

import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { validateEmail } from "@/lib/validation";
import type { ProblemCategory, BookingUrgency } from "@/lib/types";
import {
  KeyRound, Cpu, Wrench, Gauge, Zap, Calendar, Truck, ChevronLeft, ChevronRight,
  Check, Loader2, Upload, QrCode, ImageIcon,
} from "lucide-react";

// Smart Booking System 2.0 — a 5-step visual wizard:
// Vehicle → Problem → Urgency & Timing → Upload & Contact → Confirm (QR + reference).
// Cascading Year/Make/Model (models fetched live from the NHTSA VPIC API),
// icon-led problem categories, photo upload, instant price-estimate range,
// and a QR-code booking confirmation tied to a generated reference code.

type IconType = React.ComponentType<{ className?: string }>;

const YEARS: string[] = Array.from({ length: 2026 - 1980 + 1 }, (_, i) => String(2026 - i));

const MAKES: string[] = [
  "Acura", "Audi", "BMW", "Buick", "Cadillac", "Chevrolet", "Chrysler", "Dodge",
  "Ford", "GMC", "Honda", "Hyundai", "Infiniti", "Jeep", "Kia", "Land Rover",
  "Lexus", "Lincoln", "Mazda", "Mercedes-Benz", "Mercury", "MINI", "Mitsubishi",
  "Nissan", "Pontiac", "Porsche", "Ram", "Subaru", "Tesla", "Toyota",
  "Volkswagen", "Volvo",
];

const CATEGORIES: { id: ProblemCategory; icon: IconType; emoji: string }[] = [
  { id: "Lost Keys / Security & Lockout", icon: KeyRound, emoji: "01" },
  { id: "Electrical & Diagnostics", icon: Cpu, emoji: "02" },
  { id: "Mechanical Repair", icon: Wrench, emoji: "03" },
  { id: "Performance & Tuning", icon: Gauge, emoji: "04" },
];

const URGENCIES: { id: BookingUrgency; icon: IconType; sub: string }[] = [
  { id: "Emergency / Mobile Service", icon: Zap, sub: "We come to you — 24/7 dispatch" },
  { id: "Shop Drop-off / Standard Appointment", icon: Calendar, sub: "Drop off at the Cincinnati shop" },
  { id: "Mail-In Service", icon: Truck, sub: "Ship us the module / cluster" },
];

// Base price bands per service category (USD), scaled by urgency.
const PRICE_BASE: Record<ProblemCategory, [number, number]> = {
  "Lost Keys / Security & Lockout": [150, 600],
  "Electrical & Diagnostics": [120, 900],
  "Mechanical Repair": [300, 2500],
  "Performance & Tuning": [400, 3000],
};

const URGENCY_MULT: Record<BookingUrgency, number> = {
  "Emergency / Mobile Service": 1.4,
  "Shop Drop-off / Standard Appointment": 1.0,
  "Mail-In Service": 0.8,
};

function estimate(cat: ProblemCategory, urg: BookingUrgency): [number, number] {
  const [lo, hi] = PRICE_BASE[cat];
  const m = URGENCY_MULT[urg];
  return [Math.round((lo * m) / 10) * 10, Math.round((hi * m) / 10) * 10];
}

function priceLabel(b: [number, number]): string {
  return `$${b[0]}–$${b[1]} est.`;
}

interface WizardState {
  year: string; make: string; model: string; engine_size: string; vin: string;
  problem_category: ProblemCategory | "";
  problem_detail: string; problem_location: string;
  urgency: BookingUrgency | "";
  scheduled_date: string;
  customer_name: string; customer_email: string; customer_phone: string;
}

const STEPS = ["Vehicle", "Problem", "Timing", "Details", "Confirm"] as const;
type StepIdx = 0 | 1 | 2 | 3 | 4;

interface PhotoPending { file: File; url: string }
interface CreatedBooking { id: string; reference_code?: string }

export default function BookingWizard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState<StepIdx>(0);
  const [form, setForm] = useState<WizardState>({
    year: "", make: "", model: "", engine_size: "", vin: "",
    problem_category: "", problem_detail: "", problem_location: "",
    urgency: "", scheduled_date: "",
    customer_name: "", customer_email: "", customer_phone: "",
  });
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState<boolean>(false);
  const [modelsError, setModelsError] = useState<string>("");
  const [pendingPhotos, setPendingPhotos] = useState<PhotoPending[]>([]);
  const [uploading, setUploading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [created, setCreated] = useState<CreatedBooking | null>(null);
  const [referenceCode, setReferenceCode] = useState<string>("");

  const today = new Date().toISOString().slice(0, 10);

  const update = useCallback(<K extends keyof WizardState>(k: K, v: WizardState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  }, []);

  // Live model list from NHTSA VPIC when year + make selected.
  useEffect(() => {
    if (!form.year || !form.make) { setModels([]); return; }
    let cancelled = false;
    setModelsLoading(true);
    setModelsError("");
    fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(form.make)}/modelyear/${form.year}?format=json`)
      .then((r) => r.json())
      .then((d: { Results?: { Model_Name?: string }[] }) => {
        if (cancelled) return;
        const names = (d.Results || [])
          .map((x) => (x.Model_Name || "").trim())
          .filter(Boolean) as string[];
        setModels(Array.from(new Set(names)).sort());
      })
      .catch(() => {
        if (!cancelled) setModelsError("Couldn't load models — type it manually.");
        setModels([]);
      })
      .finally(() => { if (!cancelled) setModelsLoading(false); });
    return () => { cancelled = true; };
  }, [form.year, form.make]);

  // Deep-link prefill from "Schedule this service" buttons:
  // ?year=..&make=..&model=..&vin=..&category=..&detail=..&urgency=..
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const patch: Partial<WizardState> = {};
    const y = p.get("year"); if (y) patch.year = y;
    const mk = p.get("make"); if (mk) patch.make = mk;
    const md = p.get("model"); if (md) patch.model = md;
    const v = p.get("vin"); if (v) patch.vin = v.toUpperCase();
    const cat = p.get("category") as ProblemCategory | null; if (cat) patch.problem_category = cat;
    const det = p.get("detail"); if (det) patch.problem_detail = det;
    const urg = p.get("urgency") as BookingUrgency | null; if (urg) patch.urgency = urg;
    if (Object.keys(patch).length) setForm((f) => ({ ...f, ...patch }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    const next = Array.from(files).slice(0, 6).map((file) => ({ file, url: URL.createObjectURL(file) }));
    setPendingPhotos((p) => [...p, ...next].slice(0, 6));
  };

  const removePhoto = (idx: number) => {
    setPendingPhotos((p) => {
      const copy = [...p];
      URL.revokeObjectURL(copy[idx]?.url || "");
      copy.splice(idx, 1);
      return copy;
    });
  };

  // Step validation gates.
  const canAdvance = (): boolean => {
    if (step === 0) return Boolean(form.year && form.make && form.model && form.vin.trim().length >= 11);
    if (step === 1) return Boolean(form.problem_category && form.problem_detail.trim().length >= 4);
    if (step === 2) return Boolean(form.urgency);
    if (step === 3) {
      const emailOk = validateEmail(form.customer_email).ok;
      const phoneOk = form.customer_phone.replace(/\D/g, "").length >= 10;
      return Boolean(form.customer_name.trim() && emailOk && phoneOk);
    }
    return true;
  };

  const next = () => { setStep((s) => (s < 4 ? ((s + 1) as StepIdx) : s)); };
  const back = () => { setStep((s) => (s > 0 ? ((s - 1) as StepIdx) : s)); };

  const priceRange = form.problem_category && form.urgency
    ? estimate(form.problem_category as ProblemCategory, form.urgency as BookingUrgency)
    : null;

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Upload photos first.
      let photo_urls: string[] = [];
      if (pendingPhotos.length > 0) {
        setUploading(true);
        const urls: string[] = [];
        for (const p of pendingPhotos) {
          const { file_url } = await db.integrations.Core.UploadFile({ file: p.file });
          urls.push(file_url);
        }
        photo_urls = urls;
        setUploading(false);
      }

      const ref = `SKC-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1e4).toString().padStart(4, "0")}`;
      setReferenceCode(ref);

      const payload = {
        year: form.year,
        make: form.make,
        model: form.model,
        engine_size: form.engine_size,
        vin: form.vin.trim().toUpperCase(),
        problem_category: form.problem_category as ProblemCategory,
        problem_detail: form.problem_detail.trim(),
        problem_location: form.problem_location.trim(),
        urgency: form.urgency as BookingUrgency,
        scheduled_date: form.scheduled_date,
        customer_name: form.customer_name.trim(),
        customer_email: form.customer_email.trim(),
        customer_phone: form.customer_phone.trim(),
        photo_urls,
        reference_code: ref,
        price_estimate_low: priceRange?.[0] ?? undefined,
        price_estimate_high: priceRange?.[1] ?? undefined,
      };

      const idempotencyKey = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + Date.now().toString(36);
      const res = await db.functions.invoke("createBooking", { booking: payload, idempotencyKey });
      const bk = (res as { booking?: CreatedBooking })?.booking || { id: "", reference_code: ref };
      setCreated(bk);
      setStep(4);
      toast({ title: "Booking initialized", description: `Reference ${ref}` });
    } catch (e) {
      toast({ title: "Booking failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  const qrData = encodeURIComponent(
    referenceCode || created?.reference_code || ""
      ? `SKC BOOKING ${referenceCode || created?.reference_code}\n${form.year} ${form.make} ${form.model}\n${form.problem_category}\n${form.urgency}`
      : "SKC"
  );
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=6&data=${qrData}`;

  // Confirmation screen after a successful booking.
  if (created && step === 4) {
    const ref = referenceCode || created.reference_code || "SKC";
    return (
      <div className="border border-cyan/30 bg-blueprint/40 p-6 sm:p-8 text-center glow-cyan">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="w-10 h-10 rounded-full bg-cyan text-titanium flex items-center justify-center">
            <Check className="w-5 h-5" />
          </div>
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-cyan">// Booking Confirmed</span>
        </div>
        <h3 className="font-heading text-2xl sm:text-3xl uppercase text-data mb-2">
          {form.year} {form.make} {form.model}
        </h3>
        <p className="font-mono text-[11px] text-muted-foreground mb-6">
          {form.problem_category} • {form.urgency}{priceRange ? ` • ${priceLabel(priceRange)}` : ""}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-6">
          <img src={qrUrl} alt="Booking QR code" width={160} height={160} className="border border-cyan/30 bg-titanium p-2" />
          <div className="text-left">
            <div className="font-mono text-[10px] uppercase tracking-widest text-cyan mb-1">// Reference</div>
            <div className="font-mono text-lg text-data mb-3">{ref}</div>
            <div className="font-mono text-[10px] text-muted-foreground max-w-[14rem] leading-relaxed">
              Save this code. We texted/email confirmation — and you can track live progress in your portal.
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={() => navigate("/portal")}
            className="inline-flex items-center gap-2 bg-cyan text-titanium font-mono text-xs uppercase tracking-wider px-5 py-3 hover:glow-cyan transition-all"
          >
            Track in Portal <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setCreated(null);
              setReferenceCode("");
              setForm({ year: "", make: "", model: "", engine_size: "", vin: "", problem_category: "", problem_detail: "", problem_location: "", urgency: "", scheduled_date: "", customer_name: "", customer_email: "", customer_phone: "" });
              setPendingPhotos([]);
              setStep(0);
            }}
            className="font-mono text-xs uppercase tracking-wider text-muted-foreground border border-cyan/20 px-5 py-3 hover:text-cyan transition-all"
          >
            Book Another
          </button>
        </div>
      </div>
    );
  }

  const setCat = (c: ProblemCategory) => update("problem_category", c);
  const setUrg = (u: BookingUrgency) => update("urgency", u);

  const inputCls = "w-full bg-titanium border border-cyan/20 px-4 py-3 font-body text-sm text-data focus:border-cyan focus:outline-none";
  const labelCls = "font-mono text-[11px] uppercase tracking-wider text-cyan mb-2 block";

  return (
    <div className="border border-cyan/20 bg-blueprint/20 p-5 sm:p-7">
      {/* step indicator */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((s, i) => {
          const done = i < step;
          const active = i === step;
          return (
            <React.Fragment key={s}>
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <span className={`flex items-center justify-center w-9 h-9 rounded-full border text-xs font-mono transition-all ${done ? "bg-cyan text-titanium border-cyan" : active ? "border-cyan text-cyan glow-cyan" : "border-cyan/30 text-muted-foreground/50"}`}>
                  {done ? <Check className="w-4 h-4" /> : i + 1}
                </span>
                <span className={`font-mono text-[9px] uppercase tracking-wider ${active ? "text-cyan" : "text-muted-foreground/60"}`}>{s}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-px mx-1 ${i < step ? "bg-cyan" : "bg-cyan/15"}`} />}
            </React.Fragment>
          );
        })}
      </div>

      {/* STEP 1 — Vehicle */}
      {step === 0 && (
        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label className={labelCls}>Year</label>
            <select value={form.year} onChange={(e) => update("year", e.target.value)} className={inputCls}>
              <option value="">Select year</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Make</label>
            <select value={form.make} onChange={(e) => { update("make", e.target.value); update("model", ""); }} className={inputCls}>
              <option value="">Select make</option>
              {MAKES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Model</label>
            {form.make && form.year ? (
              <>
                <select value={form.model} onChange={(e) => update("model", e.target.value)} className={inputCls}>
                  <option value="">{modelsLoading ? "Loading…" : "Select model"}</option>
                  {models.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                {models.length === 0 && !modelsLoading && (
                  <input value={form.model} onChange={(e) => update("model", e.target.value)} placeholder="Type your model" className={`${inputCls} mt-2`} />
                )}
                {modelsError && <p className="font-mono text-[10px] text-heat mt-1">{modelsError}</p>}
              </>
            ) : (
              <input value={form.model} onChange={(e) => update("model", e.target.value)} placeholder={form.make ? "Pick a year to load models" : "Select a make first"} className={`${inputCls} disabled:opacity-50`} disabled={!form.make} />
            )}
          </div>
          <div>
            <label className={labelCls}>Engine (optional)</label>
            <input value={form.engine_size} onChange={(e) => update("engine_size", e.target.value)} placeholder="e.g. 3.5L V6" className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label className={labelCls}>VIN</label>
            <input value={form.vin} onChange={(e) => update("vin", e.target.value.toUpperCase())} placeholder="17-character VIN" className={`${inputCls} font-mono tracking-wider`} maxLength={17} />
            {form.vin && form.vin.trim().length < 11 && <p className="font-mono text-[10px] text-heat mt-1">VIN looks too short ({form.vin.trim().length}/11+).</p>}
          </div>
        </div>
      )}

      {/* STEP 2 — Problem */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <label className={labelCls}>Problem category</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {CATEGORIES.map((c) => {
                const Icon = c.icon;
                const on = form.problem_category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCat(c.id)}
                    className={`flex flex-col items-center gap-2 p-4 border text-center transition-all ${on ? "border-cyan bg-cyan/10 text-cyan glow-cyan" : "border-cyan/20 text-muted-foreground hover:border-cyan/50"}`}
                  >
                    <Icon className="w-6 h-6" />
                    <span className="font-mono text-[10px] uppercase tracking-wider leading-tight">{c.id}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className={labelCls}>What's happening?</label>
            <textarea value={form.problem_detail} onChange={(e) => update("problem_detail", e.target.value)} rows={4} placeholder="Describe the symptom in detail — when it happens, how often, any codes…" className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className={labelCls}>Where on the vehicle? (optional)</label>
            <input value={form.problem_location} onChange={(e) => update("problem_location", e.target.value)} placeholder="e.g. driver door lock, engine bay, dash cluster" className={inputCls} />
          </div>
        </div>
      )}

      {/* STEP 3 — Timing */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <label className={labelCls}>Service type</label>
            <div className="grid sm:grid-cols-3 gap-3">
              {URGENCIES.map((u) => {
                const Icon = u.icon;
                const on = form.urgency === u.id;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setUrg(u.id)}
                    className={`flex flex-col items-start gap-2 p-4 border text-left transition-all ${on ? "border-cyan bg-cyan/10 text-cyan glow-cyan" : "border-cyan/20 text-muted-foreground hover:border-cyan/50"}`}
                  >
                    <Icon className="w-6 h-6" />
                    <span className="font-mono text-[11px] uppercase tracking-wider leading-tight">{u.id}</span>
                    <span className="font-mono text-[9px] text-muted-foreground/70 leading-tight">{u.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className={labelCls}>Preferred date (optional)</label>
            <input type="date" value={form.scheduled_date} min={today} onChange={(e) => update("scheduled_date", e.target.value)} className={inputCls} />
          </div>
          {priceRange && (
            <div className="border border-cyan/30 bg-cyan/5 px-5 py-4 flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-widest text-cyan">// Estimated range</span>
              <span className="font-mono text-lg text-data">{priceLabel(priceRange)}</span>
            </div>
          )}
        </div>
      )}

      {/* STEP 4 — Details (uploaded as part of final submit at confirm step boundary) */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <label className={labelCls}>Upload photos (optional)</label>
            <label className="flex flex-col items-center justify-center gap-2 border border-dashed border-cyan/30 px-6 py-6 cursor-pointer hover:border-cyan/60 hover:bg-cyan/5 transition-all text-center">
              <Upload className="w-6 h-6 text-cyan/70" />
              <span className="font-mono text-[11px] text-muted-foreground">{pendingPhotos.length > 0 ? `${pendingPhotos.length} photo(s) selected` : "Choose up to 6 photos"}</span>
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
            </label>
            {pendingPhotos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-3">
                {pendingPhotos.map((p, i) => (
                  <div key={i} className="relative aspect-square border border-cyan/20 overflow-hidden group">
                    <img src={p.url} alt={`upload ${i + 1}`} className="w-full h-full object-cover" />
                    <button type="button" onClick={() => removePhoto(i)} className="absolute top-1 right-1 w-5 h-5 bg-titanium/80 border border-heat/40 text-heat text-[10px] flex items-center justify-center">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>Your name</label>
              <input value={form.customer_name} onChange={(e) => update("customer_name", e.target.value)} placeholder="First & last" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input value={form.customer_email} onChange={(e) => update("customer_email", e.target.value)} type="email" placeholder="you@email.com" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Phone</label>
            <input value={form.customer_phone} onChange={(e) => update("customer_phone", e.target.value)} type="tel" placeholder="(513) 555-0000" className={inputCls} />
          </div>
        </div>
      )}

      {/* STEP 5 — Confirm */}
      {step === 4 && (
        <div className="space-y-5">
          <div className="border border-cyan/20 bg-titanium/40 p-5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-cyan mb-3">// Review booking</div>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 font-mono text-sm">
              <div><dt className="text-muted-foreground text-[10px] uppercase">Vehicle</dt><dd className="text-data">{form.year} {form.make} {form.model}{form.engine_size ? ` • ${form.engine_size}` : ""}</dd></div>
              <div><dt className="text-muted-foreground text-[10px] uppercase">VIN</dt><dd className="text-data">{form.vin}</dd></div>
              <div><dt className="text-muted-foreground text-[10px] uppercase">Service</dt><dd className="text-data">{form.problem_category}</dd></div>
              <div><dt className="text-muted-foreground text-[10px] uppercase">Urgency</dt><dd className="text-data">{form.urgency}</dd></div>
              <div><dt className="text-muted-foreground text-[10px] uppercase">Date</dt><dd className="text-data">{form.scheduled_date || "To be scheduled"}</dd></div>
              <div><dt className="text-muted-foreground text-[10px] uppercase">Contact</dt><dd className="text-data">{form.customer_name} • {form.customer_phone}</dd></div>
              {priceRange && <div><dt className="text-muted-foreground text-[10px] uppercase">Estimate</dt><dd className="text-cyan">{priceLabel(priceRange)}</dd></div>}
            </dl>
            {form.problem_detail && <p className="font-body text-xs text-muted-foreground leading-relaxed mt-4 pt-3 border-t border-cyan/10">{form.problem_detail}</p>}
            {pendingPhotos.length > 0 && (
              <div className="mt-3 grid grid-cols-4 sm:grid-cols-6 gap-2">
                {pendingPhotos.map((p, i) => <img key={i} src={p.url} alt={`x ${i}`} className="aspect-square object-cover border border-cyan/20" />)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground/70">
            <QrCode className="w-3.5 h-3.5 text-cyan" /> A QR confirmation code is generated on submit.
          </div>
        </div>
      )}

      {/* nav */}
      <div className="flex items-center justify-between mt-8 pt-5 border-t border-cyan/10">
        <button
          type="button"
          onClick={back}
          disabled={step === 0 || submitting}
          className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-muted-foreground hover:text-cyan disabled:opacity-30 transition-all"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        {step < 4 ? (
          <button
            type="button"
            onClick={next}
            disabled={!canAdvance()}
            className="inline-flex items-center gap-1.5 bg-cyan text-titanium font-mono text-xs uppercase tracking-wider px-6 py-3 hover:glow-cyan disabled:opacity-40 transition-all"
          >
            Continue <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center gap-2 bg-cyan text-titanium font-mono text-xs uppercase tracking-wider px-6 py-3 hover:glow-cyan disabled:opacity-50 transition-all"
          >
            {uploading || submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> {uploading ? "Uploading photos…" : "Submitting…"}</> : <><ImageIcon className="w-4 h-4" /> Initialize Booking</>}
          </button>
        )}
      </div>
    </div>
  );
}