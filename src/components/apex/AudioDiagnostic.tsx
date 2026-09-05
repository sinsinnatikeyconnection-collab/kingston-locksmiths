import db from "@/api/base44Client";

import React, { useState, useRef, useEffect, useCallback } from "react";

import { useToast } from "@/components/ui/use-toast";
import { Link } from "react-router-dom";
import {
  Mic,
  Square,
  Loader2,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Cpu,
  Gauge,
  Radio,
} from "lucide-react";

type IconType = React.ComponentType<{ className?: string }>;

const SYMPTOMS: { id: string; label: string; icon: IconType }[] = [
  { id: "knock", label: "Engine knock / ping", icon: Activity },
  { id: "tick", label: "Ticking / tapping", icon: Activity },
  { id: "grind", label: "Grinding (start / shift)", icon: Activity },
  { id: "squeal", label: "Squealing belt", icon: Activity },
  { id: "rattle", label: "Rattle at idle", icon: Activity },
  { id: "nocrank", label: "Click — no crank", icon: Cpu },
  { id: "cranknostart", label: "Cranks, won't start", icon: Cpu },
  { id: "misfire", label: "Rough idle / misfire", icon: Activity },
  { id: "whine", label: "Whine (boost / alternator)", icon: Activity },
  { id: "draw", label: "Battery drains overnight", icon: Cpu },
  { id: "lights", label: "Dash lit — multiple codes", icon: Cpu },
  { id: "exhaust", label: "Loud exhaust / leak", icon: Activity },
];

const CYL_OPTIONS = [4, 6, 8, 10];

interface Diagnosis {
  cause: string;
  confidence: "low" | "medium" | "high";
  category: string;
  summary: string;
  book_cta: string;
}

interface DiagResponse {
  data?: { result?: Diagnosis; error?: string };
}

interface LiveStats {
  peakHz: number;
  rpm: number;
  band: string;
  rms: number;
}

const CONF_COLOR: Record<Diagnosis["confidence"], string> = {
  low: "text-muted-foreground border-cyan/30",
  medium: "text-yellow-400 border-yellow-400/40",
  high: "text-heat border-heat/50",
};

const REC_MS = 4000;

// Map a frequency (Hz) to a diagnostic acoustic band label.
function classifyBand(hz: number): string {
  if (hz < 80) return "Rotational / crank mass";
  if (hz < 250) return "Firing fundamental (idle harmonic)";
  if (hz < 600) return "Combustion / idle band";
  if (hz < 1500) return "Mechanical knock / low tick";
  if (hz < 4000) return "Valve train / tap / rattle";
  if (hz < 10000) return "Whine / bearing / boost leak / squeal";
  return "Air leak / high-freq electrical whine";
}

export default function AudioDiagnostic() {
  const { toast } = useToast();
  const [state, setState] = useState<"idle" | "listening" | "ready" | "analyzing" | "done">("idle");
  const [cylinders, setCylinders] = useState<number>(8);
  const [symptoms, setSymptoms] = useState<Record<string, boolean>>({});
  const [note, setNote] = useState<string>("");
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [err, setErr] = useState<string>("");
  const [clipReady, setClipReady] = useState<boolean>(false);
  const [live, setLive] = useState<LiveStats | null>(null);
  // frozen signature at the moment we stop recording — fed to the AI
  const [signature, setSignature] = useState<LiveStats | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const clipUrlRef = useRef<string>("");
  const statsRef = useRef<LiveStats | null>(null);
  const hudIntervalRef = useRef<number | null>(null);
  const stopTimerRef = useRef<number | null>(null);

  const stopVisuals = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (hudIntervalRef.current) { clearInterval(hudIntervalRef.current); hudIntervalRef.current = null; }
    if (stopTimerRef.current) { clearTimeout(stopTimerRef.current); stopTimerRef.current = null; }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (ctxRef.current && ctxRef.current.state !== "closed") {
      const ctx = ctxRef.current;
      ctxRef.current = null;
      ctx.close().catch(() => {});
    }
    analyserRef.current = null;
    // Stop the recorder if still recording (handles unmount-mid-capture);
    // guarded so the normal onstop path (already inactive) is a no-op and the
    // async onstop callback's later stopVisuals() call won't recurse.
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch { /* tracks may already be stopped */ }
    }
    recorderRef.current = null;
  }, []);

  useEffect(() => () => { stopVisuals(); if (clipUrlRef.current) URL.revokeObjectURL(clipUrlRef.current); }, [stopVisuals]);

  const computeLiveStats = (analyser: AnalyserNode, sampleRate: number): LiveStats => {
    const bins = analyser.frequencyBinCount;
    const data = new Uint8Array(bins);
    analyser.getByteFrequencyData(data);
    // ignore DC / sub-20Hz noise floor
    const minBin = Math.max(1, Math.floor((20 / sampleRate) * analyser.fftSize));
    let peakBin = minBin;
    let peakVal = 0;
    let sumSq = 0;
    for (let i = minBin; i < bins; i++) {
      const v = data[i];
      sumSq += v * v;
      if (v > peakVal) { peakVal = v; peakBin = i; }
    }
    const peakHz = (peakBin * sampleRate) / analyser.fftSize;
    const rms = Math.sqrt(sumSq / (bins - minBin)) / 255;
    // heuristic crank RPM from dominant firing harmonic (4-stroke):
    // firingFreq = RPM/60 * (cyl/2)  =>  RPM = firingFreq * 120 / cyl
    const rpm = peakHz > 0 ? Math.round((peakHz * 120) / cylinders) : 0;
    return { peakHz: Math.round(peakHz), rpm, band: classifyBand(peakHz), rms };
  };

  const drawSpectrum = (analyser: AnalyserNode, sampleRate: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = (canvas.width = canvas.clientWidth);
    const H = (canvas.height = canvas.clientHeight);
    const bins = analyser.frequencyBinCount;
    const data = new Uint8Array(bins);
    const minBin = Math.max(1, Math.floor((20 / sampleRate) * analyser.fftSize));
    const render = () => {
      rafRef.current = requestAnimationFrame(render);
      analyser.getByteFrequencyData(data);
      ctx.fillStyle = "#080809";
      ctx.fillRect(0, 0, W, H);

      // log-spaced bars across the audible band
      const bars = 60;
      const usableBins = bins - minBin;
      for (let i = 0; i < bars; i++) {
        const t0 = i / bars;
        const t1 = (i + 1) / bars;
        const b0 = minBin + Math.floor(Math.pow(t0, 1.6) * usableBins);
        const b1 = minBin + Math.floor(Math.pow(t1, 1.6) * usableBins);
        let v = 0;
        for (let j = b0; j < b1; j++) v = Math.max(v, data[j]);
        const norm = v / 255;
        const bh = norm * H * 0.95;
        const x = (i / bars) * W;
        const bw = W / bars;
        ctx.fillStyle = norm > 0.72 ? "#FF3E00" : norm > 0.45 ? "#00E5FF" : "#0090a8";
        ctx.globalAlpha = 0.3 + norm * 0.7;
        ctx.fillRect(x + 1, H - bh, bw - 2, bh);
      }
      ctx.globalAlpha = 1;

      // peak-marker line
      const stats = computeLiveStats(analyser, sampleRate);
      statsRef.current = stats;
      const peakX = (stats.peakHz / (sampleRate / 2)) * W;
      if (peakX > 0 && peakX < W) {
        ctx.strokeStyle = "#FF3E00";
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.moveTo(peakX, 0);
        ctx.lineTo(peakX, H);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    };
    render();
  };

  const startCapture = async () => {
    setErr("");
    setDiagnosis(null);
    setSignature(null);
    setLive(null);
    setClipReady(false);
    if (clipUrlRef.current) { URL.revokeObjectURL(clipUrlRef.current); clipUrlRef.current = ""; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;
      const AC = window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const actx = new AC();
      ctxRef.current = actx;
      const source = actx.createMediaStreamSource(stream);
      const analyser = actx.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.82;
      source.connect(analyser);
      analyserRef.current = analyser;

      const chunks: BlobPart[] = [];
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
      rec.onstop = () => {
        const type = rec.mimeType || "audio/webm";
        const blob = new Blob(chunks, { type });
        clipUrlRef.current = URL.createObjectURL(blob);
        setClipReady(true);
        setSignature(statsRef.current);
        stopVisuals();
        setState("ready");
      };
      rec.start();
      setState("listening");
      drawSpectrum(analyser, actx.sampleRate);
      // live HUD sampler — 10 Hz, no per-frame re-renders
      hudIntervalRef.current = window.setInterval(() => {
        if (statsRef.current) setLive(statsRef.current);
      }, 100);
      stopTimerRef.current = window.setTimeout(() => { if (rec.state !== "inactive") rec.stop(); }, REC_MS);
    } catch (e) {
      setErr("Microphone access denied or unavailable. You can still run a symptom-only diagnosis below.");
      setState("idle");
      toast({ title: "Mic blocked", description: (e as Error).message, variant: "destructive" });
    }
  };

  const stopEarly = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
  };

  const toggleSymptom = (id: string) => setSymptoms((s) => ({ ...s, [id]: !s[id] }));

  const runDiagnosis = async () => {
    const picked = SYMPTOMS.filter((s) => symptoms[s.id]).map((s) => s.label);
    if (picked.length === 0 && !note.trim() && !signature) {
      toast({ title: "Add a symptom", description: "Check a symptom, describe the issue, or capture audio first.", variant: "destructive" });
      return;
    }
    setState("analyzing");
    setErr("");
    try {
      let fileUrls: string[] | undefined;
      if (clipUrlRef.current) {
        const blob = await fetch(clipUrlRef.current).then((r) => r.blob());
        const file = new File([blob], "engine-sample.webm", { type: blob.type || "audio/webm" });
        const { file_url } = await db.integrations.Core.UploadFile({ file });
        fileUrls = [file_url];
      }
      const sigText = signature
        ? `Measured acoustic signature (FFT analysis of 4s sample, ${cylinders}-cyl assumption): dominant resonance ${signature.peakHz} Hz, estimated crank RPM ${signature.rpm}, classified band "${signature.band}" (signal RMS ${(signature.rms * 100).toFixed(1)}%). Interpret the RPM estimate heuristically from the dominant firing harmonic.`
        : "";
      const symptomText = [
        picked.length ? `Reported symptoms: ${picked.join("; ")}.` : "",
        note.trim() ? `Customer note: ${note.trim().slice(0, 400)}` : "",
        sigText,
        fileUrls ? "An engine audio sample is attached; cross-check audible cues against the measured signature, but rely primarily on reported symptoms." : "",
      ].filter(Boolean).join(" ");

      const res = (await db.functions.invoke("aiService", { kind: "diagnostic", symptoms: symptomText, fileUrls })) as DiagResponse;
      if (res.data?.result) {
        setDiagnosis(res.data.result);
        setState("done");
      } else {
        setErr(res.data?.error || "Diagnosis failed. Try again or call us.");
        setState("ready");
      }
    } catch (e) {
      setErr((e as Error).message);
      setState("ready");
    }
  };

  const reset = () => {
    if (clipUrlRef.current) { URL.revokeObjectURL(clipUrlRef.current); clipUrlRef.current = ""; }
    setClipReady(false);
    setDiagnosis(null);
    setSymptoms({});
    setNote("");
    setErr("");
    setLive(null);
    setSignature(null);
    setState("idle");
  };

  return (
    <section className="relative bg-titanium border-t border-cyan/10">
      <div className="relative max-w-[1100px] mx-auto px-6 lg:px-10 py-24">
        <div className="flex items-center gap-3 mb-4">
          <Radio className="w-5 h-5 text-cyan" />
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-cyan">// FFT Acoustic Triage Engine</span>
        </div>
        <h2 className="font-heading text-4xl sm:text-5xl uppercase text-data leading-[0.95] mb-4">
          Sound <span className="text-cyan">Triage</span>
        </h2>
        <p className="font-body text-sm text-muted-foreground max-w-2xl mb-10">
          Your phone runs a live 4096-point FFT on a 4-second engine sample. We extract the dominant
          resonance, estimate crank RPM from the firing harmonic, classify the acoustic band, and feed
          that measured signature into the diagnostic AI alongside your symptoms.
        </p>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* capture + spectrum + live DSP readout */}
          <div className="border border-cyan/20 bg-blueprint/30 p-5">
            <div className="font-mono text-[11px] uppercase tracking-widest text-cyan mb-3">// Acoustic Capture · Real-time FFT</div>
            <div className="relative border border-cyan/20 bg-titanium overflow-hidden" style={{ height: 180 }}>
              <canvas ref={canvasRef} className="w-full h-full block" />
              {state === "idle" && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground/60">
                  <Mic className="w-8 h-8" />
                  <span className="font-mono text-[10px] uppercase tracking-wider">No signal — press record</span>
                </div>
              )}
              {state === "listening" && (
                <div className="absolute top-2 left-2 flex items-center gap-1.5 font-mono text-[10px] text-heat">
                  <span className="w-2 h-2 rounded-full bg-heat animate-ping" /> REC · FFT 4096
                </div>
              )}
            </div>

            {/* live DSP HUD */}
            <div className="grid grid-cols-3 gap-2 mt-4">
              <div className="border border-cyan/20 bg-titanium px-3 py-2.5">
                <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  <Gauge className="w-3 h-3" /> Est. RPM
                </div>
                <div className="font-mono text-xl text-cyan tabular-nums leading-tight mt-0.5">
                  {live ? live.rpm : "—"}
                </div>
              </div>
              <div className="border border-cyan/20 bg-titanium px-3 py-2.5">
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Peak Freq</div>
                <div className="font-mono text-xl text-cyan tabular-nums leading-tight mt-0.5">
                  {live ? `${live.peakHz}Hz` : "—"}
                </div>
              </div>
              <div className="border border-cyan/20 bg-titanium px-3 py-2.5">
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">Signal</div>
                <div className="font-mono text-xl text-cyan tabular-nums leading-tight mt-0.5">
                  {live ? `${(live.rms * 100).toFixed(0)}%` : "—"}
                </div>
              </div>
            </div>
            <div className="mt-2 px-1">
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                Band: <span className="text-cyan">{live ? live.band : "—"}</span>
              </div>
            </div>

            {/* engine config */}
            <div className="flex items-center gap-2 mt-3 mb-4">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Engine cyl:</span>
              {CYL_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCylinders(c)}
                  className={`font-mono text-[11px] px-2.5 py-1 border transition-all ${
                    cylinders === c ? "border-cyan bg-cyan/10 text-cyan" : "border-cyan/20 text-muted-foreground hover:border-cyan/50"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {state === "idle" && (
                <button onClick={startCapture} className="flex items-center gap-2 bg-cyan text-titanium font-mono text-xs uppercase px-5 py-3 hover:glow-cyan">
                  <Mic className="w-4 h-4" /> Record 4s sample
                </button>
              )}
              {state === "listening" && (
                <button onClick={stopEarly} className="flex items-center gap-2 bg-heat text-titanium font-mono text-xs uppercase px-5 py-3 hover:glow-heat">
                  <Square className="w-4 h-4" /> Stop
                </button>
              )}
              {clipReady && state !== "analyzing" && (
                <button onClick={startCapture} className="flex items-center gap-2 border border-cyan/40 text-cyan font-mono text-xs uppercase px-5 py-3 hover:glow-cyan">
                  <Mic className="w-4 h-4" /> Re-record
                </button>
              )}
              {clipReady && <audio src={clipUrlRef.current} controls className="flex-1 h-10 min-w-0" />}
              {state === "analyzing" && (
                <div className="flex items-center gap-2 font-mono text-xs text-cyan">
                  <Loader2 className="w-4 h-4 animate-spin" /> Analyzing waveform…
                </div>
              )}
            </div>
            {err && <p className="font-mono text-[11px] text-heat mt-3">{err}</p>}
          </div>

          {/* symptoms + run */}
          <div className="border border-cyan/20 bg-blueprint/30 p-5">
            <div className="font-mono text-[11px] uppercase tracking-widest text-cyan mb-3">// Symptom Matrix</div>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {SYMPTOMS.map((s) => {
                const Icon = s.icon;
                const on = !!symptoms[s.id];
                return (
                  <button
                    key={s.id}
                    onClick={() => toggleSymptom(s.id)}
                    className={`flex items-center gap-2 px-3 py-2.5 border font-mono text-[11px] text-left transition-all ${
                      on ? "border-cyan bg-cyan/10 text-cyan" : "border-cyan/15 text-muted-foreground hover:border-cyan/50"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="leading-tight">{s.label}</span>
                  </button>
                );
              })}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Optional: vehicle (year/make/model) + when it happens…"
              className="w-full bg-titanium border border-cyan/20 px-3 py-2.5 font-body text-sm text-data focus:border-cyan focus:outline-none resize-none mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={runDiagnosis}
                disabled={state === "analyzing"}
                className="flex-1 flex items-center justify-center gap-2 bg-cyan text-titanium font-mono text-xs uppercase px-5 py-3 hover:glow-cyan disabled:opacity-50"
              >
                {state === "analyzing" ? <><Loader2 className="w-4 h-4 animate-spin" /> Running…</> : <><Activity className="w-4 h-4" /> Run AI Diagnosis</>}
              </button>
              {(diagnosis || clipReady) && (
                <button onClick={reset} className="font-mono text-xs uppercase text-muted-foreground px-4 py-3 hover:text-heat">Reset</button>
              )}
            </div>
          </div>
        </div>

        {/* result */}
        {state === "done" && diagnosis && (
          <div className="mt-8 border border-cyan/30 bg-blueprint/30 p-6 max-w-3xl">
            <div className="flex items-center gap-2 mb-4">
              {diagnosis.confidence === "high" ? <AlertTriangle className="w-5 h-5 text-heat" /> : <CheckCircle2 className="w-5 h-5 text-cyan" />}
              <span className="font-mono text-xs uppercase tracking-widest text-cyan">// AI Diagnostic Output · cross-ref FFT signature</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className={`font-mono text-[10px] uppercase px-2 py-1 border ${CONF_COLOR[diagnosis.confidence]}`}>
                Confidence: {diagnosis.confidence}
              </span>
              <span className="font-mono text-[10px] uppercase px-2 py-1 border border-cyan/40 text-cyan">{diagnosis.category}</span>
            </div>
            <div className="font-heading text-xl uppercase text-data mb-2">{diagnosis.cause}</div>
            <p className="font-body text-sm text-muted-foreground mb-5">{diagnosis.summary}</p>
            <Link to="/#intake" className="inline-flex items-center gap-1.5 font-mono text-xs uppercase text-cyan hover:gap-3 transition-all">
              {diagnosis.book_cta || "Book this diagnostic"} <ChevronRight className="w-4 h-4" />
            </Link>
            <p className="font-mono text-[10px] text-muted-foreground/50 mt-4">
              ▸ AI estimate from FFT signature + reported symptoms — not a final diagnosis. A technician confirms on-site with live OBD2 & CAN bus scans.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}