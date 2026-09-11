import db from "@/api/apiClient";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Thermometer, Activity, Camera, Share2, Download,
  AlertTriangle, X, RefreshCw, Zap, Send, ChevronRight, Loader2,
} from "lucide-react";

import { useToast } from "@/components/ui/use-toast";
import { validateVin, validateEmail, validatePhone, validateNonEmpty, validateMinLength } from "@/lib/validation";

type BusStatus = "normal" | "weak" | "resistance" | "broken" | "dead" | "short";

interface BusLine {
  id: string;
  label: string;
  status: BusStatus;
  strength: number;
}

const STATUS_COLOR: Record<BusStatus, string> = {
  normal: "#22c55e",
  weak: "#eab308",
  resistance: "#f97316",
  broken: "#ef4444",
  dead: "#3b82f6",
  short: "#ef4444",
};
const STATUS_LABEL: Record<BusStatus, string> = {
  normal: "OK — signal flowing",
  weak: "Weak signal / resistance",
  resistance: "High resistance / intermittent",
  broken: "WIRE CUT — no signal",
  dead: "No power / dead line",
  short: "SHORT CIRCUIT — lines touching",
};
const STATUS_CODE: Record<BusStatus, string> = {
  normal: "—", weak: "U0121", resistance: "U0100", broken: "B1165", dead: "P0562", short: "U0073",
};

const LEGEND: { status: BusStatus; color: string; label: string }[] = [
  { status: "normal", color: STATUS_COLOR.normal, label: "Normal — signal flowing (green)" },
  { status: "weak", color: STATUS_COLOR.weak, label: "Weak signal / high resistance (yellow)" },
  { status: "resistance", color: STATUS_COLOR.resistance, label: "Intermittent / high resistance (orange)" },
  { status: "broken", color: STATUS_COLOR.broken, label: "Wire cut / no signal — ⚠ WIRE CUT (red)" },
  { status: "dead", color: STATUS_COLOR.dead, label: "No power / dead line — DEAD LINE (blue)" },
  { status: "short", color: STATUS_COLOR.short, label: "Short circuit — ⚠ SHORT CIRCUIT (flashing red)" },
];

const BASE_LINES = [
  { id: "canh", label: "CAN-High" },
  { id: "canl", label: "CAN-Low" },
  { id: "lin", label: "LIN Bus" },
  { id: "flex", label: "FlexRay" },
  { id: "pwr", label: "Power Feed" },
  { id: "gnd", label: "Ground" },
];
const Y_POSITIONS = [22, 34, 46, 58, 70, 82];
const LABELS = BASE_LINES.map((l, i) => ({ ...l, y: Y_POSITIONS[i] }));

// Iron thermal palette LUT (256 entries) — cold dark blue/purple → warm orange → hot red/white.
function buildThermalLUT(): Uint8ClampedArray {
  const stops: [number, [number, number, number]][] = [
    [0, [4, 0, 24]],
    [50, [30, 0, 90]],
    [95, [120, 10, 90]],
    [130, [190, 30, 40]],
    [160, [245, 80, 0]],
    [195, [255, 170, 0]],
    [220, [255, 230, 80]],
    [240, [255, 250, 200]],
    [255, [255, 255, 255]],
  ];
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    let a = stops[0], b = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (i >= stops[s][0] && i <= stops[s + 1][0]) { a = stops[s]; b = stops[s + 1]; break; }
    }
    const span = Math.max(1, b[0] - a[0]);
    const t = (i - a[0]) / span;
    lut[i * 3] = Math.round(a[1][0] + (b[1][0] - a[1][0]) * t);
    lut[i * 3 + 1] = Math.round(a[1][1] + (b[1][1] - a[1][1]) * t);
    lut[i * 3 + 2] = Math.round(a[1][2] + (b[1][2] - a[1][2]) * t);
  }
  return lut;
}
const THERMAL_LUT = buildThermalLUT();

type CamState = "idle" | "acquiring" | "live" | "error";

function randomStatus(): { status: BusStatus; strength: number } {
  const pool: BusStatus[] = ["normal", "normal", "normal", "weak", "resistance", "broken", "dead", "short"];
  const status = pool[Math.floor(Math.random() * pool.length)];
  const strength =
    status === "normal" ? 88 + Math.floor(Math.random() * 12)
    : status === "weak" ? 55 + Math.floor(Math.random() * 20)
    : status === "resistance" ? 30 + Math.floor(Math.random() * 25)
    : status === "short" ? 5 + Math.floor(Math.random() * 15)
    : 0;
  return { status, strength };
}

export default function ThermalScanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const workRef = useRef<HTMLCanvasElement | null>(null);
  const workCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const lastFrameRef = useRef<number>(0);
  const [camState, setCamState] = useState<CamState>("idle");
  const [thermalOn, setThermalOn] = useState<boolean>(false);
  const [simMode, setSimMode] = useState<boolean>(false);
  const acquireTimer = useRef<number | null>(null);
  const [err, setErr] = useState<string>("");
  const [lines, setLines] = useState<BusLine[]>(LABELS.map((l) => ({ id: l.id, label: l.label, status: "normal", strength: 100 })));
  const [snapUrl, setSnapUrl] = useState<string>("");
  const [sending, setSending] = useState<boolean>(false);
  const [showSend, setShowSend] = useState<boolean>(false);
  const { toast } = useToast();

  // send-to-shop form state
  const [authUser, setAuthUser] = useState<{ name: string; email: string } | null>(null);
  const [form, setForm] = useState({ year: "", make: "", model: "", vin: "", name: "", email: "", phone: "" });
  const [formErr, setFormErr] = useState<string>("");

  useEffect(() => {
    let active = true;
    db.auth.me().then((u: any) => {
      if (active && u) {
        setAuthUser({ name: u.full_name || "", email: u.email || "" });
        setForm((f) => ({ ...f, name: u.full_name || "", email: u.email || "" }));
      }
    }).catch(() => { /* not logged in — fine */ });
    return () => { active = false; };
  }, []);

  const runScan = useCallback(() => {
    setLines(LABELS.map((l) => {
      const s = randomStatus();
      return { id: l.id, label: l.label, status: s.status, strength: s.strength };
    }));
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (acquireTimer.current) window.clearTimeout(acquireTimer.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamState("idle");
    setThermalOn(false);
    setSimMode(false);
  }, []);

  const start = useCallback(async () => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCamState("error");
      setErr("Camera requires HTTPS. Please use the secure version of this site over HTTPS.");
      return;
    }
    setSimMode(false);
    setCamState("acquiring");
    setErr("");
    if (acquireTimer.current) window.clearTimeout(acquireTimer.current);
    acquireTimer.current = window.setTimeout(() => {
      setCamState("error");
      setErr("Camera didn't respond in time. Check permissions, or run a simulated scan instead.");
    }, 9000);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch (e1) {
        const n1 = (e1 as any)?.name || "";
        if (n1 === "NotAllowedError" || n1 === "SecurityError") throw e1;
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      if (acquireTimer.current) { window.clearTimeout(acquireTimer.current); acquireTimer.current = null; }
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = stream;
      setCamState("live");
      runScan();
    } catch (e) {
      if (acquireTimer.current) { window.clearTimeout(acquireTimer.current); acquireTimer.current = null; }
      const name = (e as any)?.name || "";
      setCamState("error");
      if (name === "NotAllowedError" || name === "SecurityError") setErr("Camera access denied. Please enable camera permissions in your browser settings.");
      else if (name === "NotFoundError") setErr("No camera detected. The thermal simulator needs a live camera feed.");
      else if (name === "NotReadableError") setErr("Camera in use by another app. Please close it and try again.");
      else setErr("Camera access was blocked or unavailable on this device.");
    }
  }, [runScan]);

  const startSim = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    setSimMode(true);
    setThermalOn(true);
    setCamState("live");
    runScan();
  }, [runScan]);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    if (acquireTimer.current) window.clearTimeout(acquireTimer.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
  }, []);

  // render loop — draws thermal-mapped video (when on) + animated CAN-bus wires
  const drawFrame = useCallback(() => {
    const cv = overlayRef.current;
    if (!cv) return;
    const video = videoRef.current;
    const parent = cv.parentElement;
    const cw = parent?.clientWidth || 600;
    const ch = parent?.clientHeight || 400;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) {
      cv.width = Math.max(1, Math.round(cw * dpr));
      cv.height = Math.max(1, Math.round(ch * dpr));
    }
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    if (simMode) {
      const bg = ctx.createLinearGradient(0, 0, 0, ch);
      bg.addColorStop(0, "#070718"); bg.addColorStop(1, "#1a0707");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
      const tms = performance.now() / 1000;
      ([ [0.26, 0.5, 0.16, 0.1], [0.56, 0.34, 0.12, 0.08], [0.44, 0.66, 0.1, 0.07] ] as [number, number, number, number][]).forEach(([fx, fy, fw, fh], i) => {
        const h = 0.55 + 0.35 * Math.sin(tms + i);
        ctx.fillStyle = `rgba(${Math.round(40 + 215 * h)},${Math.round(60 + 140 * (1 - h))},20,0.85)`;
        ctx.fillRect(fx * cw, fy * ch, fw * cw, fh * ch);
      });
      for (let gx = 0; gx < cw; gx += 40) { ctx.fillStyle = "rgba(255,255,255,0.04)"; ctx.fillRect(gx, 0, 1, ch); }
      const sy = (Math.sin(tms * 0.8) * 0.5 + 0.5) * ch;
      const g = ctx.createLinearGradient(0, sy - 30, 0, sy + 30);
      g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,0.45)"); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.fillRect(0, sy - 30, cw, 60);
    } else if (thermalOn && video?.videoWidth) {
      // working canvas at low res for pixel mapping
      const ww = 320;
      const wh = Math.max(1, Math.round((video.videoHeight / video.videoWidth) * ww) || 180);
      let work = workRef.current;
      let wctx = workCtxRef.current;
      if (!work || work.width !== ww || work.height !== wh) {
        work = document.createElement("canvas");
        work.width = ww; work.height = wh;
        wctx = work.getContext("2d", { willReadFrequently: true });
        workRef.current = work; workCtxRef.current = wctx;
      }
      if (wctx) {
        wctx.drawImage(video, 0, 0, ww, wh);
        try {
          const img = wctx.getImageData(0, 0, ww, wh);
          const d = img.data;
          for (let i = 0; i < d.length; i += 4) {
            const lum = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
            d[i] = THERMAL_LUT[lum * 3];
            d[i + 1] = THERMAL_LUT[lum * 3 + 1];
            d[i + 2] = THERMAL_LUT[lum * 3 + 2];
          }
          wctx.putImageData(img, 0, 0);
          ctx.drawImage(work, 0, 0, cw, ch);
        } catch {
          // taint fallback: draw raw video
          ctx.drawImage(video, 0, 0, cw, ch);
        }
      }
      // scanline
      const sy = (Math.sin(performance.now() / 600) * 0.5 + 0.5) * ch;
      const g = ctx.createLinearGradient(0, sy - 30, 0, sy + 30);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.5, "rgba(255,255,255,0.5)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, sy - 30, cw, 60);
    }

    // CAN-bus wires
    const scale = cw / 480;
    ctx.lineWidth = Math.max(2, 3 * scale);
    ctx.font = `${Math.max(10, 11 * scale)}px 'JetBrains Mono', monospace`;
    const blink = Math.floor(performance.now() / 300) % 2 === 0;
    LABELS.forEach((l, i) => {
      const line = lines[i];
      const color = STATUS_COLOR[line.status];
      const y = (l.y / 100) * ch;
      ctx.strokeStyle = color;
      ctx.globalAlpha = line.status === "short" || line.status === "broken" ? (blink ? 1 : 0.35) : 0.92;
      ctx.beginPath();
      if (line.status === "broken") {
        ctx.moveTo(0, y);
        ctx.lineTo(cw * 0.42, y);
        ctx.moveTo(cw * 0.5, y);
        ctx.lineTo(cw * 0.96, y);
      } else {
        const segs = 40;
        let prevX = 0, prevY = y;
        ctx.moveTo(prevX, prevY);
        for (let s = 1; s <= segs; s++) {
          const x = (s / segs) * cw;
          const wob = line.status === "resistance" ? Math.sin(s * 0.6 + performance.now() / 200) * 2 * scale : 0;
          ctx.lineTo(x, y + wob);
        }
        ctx.stroke();
        prevX = cw;
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
      // label + status text
      ctx.fillStyle = color;
      ctx.fillText(l.label, 8, y - 6 * scale);
      const statusText = line.status === "broken" ? "⚠ WIRE CUT" : line.status === "dead" ? "DEAD LINE" : line.status === "short" ? "⚠ SHORT" : STATUS_LABEL[line.status];
      ctx.fillText(statusText, cw - ctx.measureText(statusText).width - 8, y - 6 * scale);
    });

    // short-circuit contact markers between adjacent lines
    const shorts = LABELS.map((l, i) => ({ l, i, line: lines[i] })).filter((x) => x.line.status === "short");
    shorts.forEach((s, idx) => {
      const cx = cw * (0.32 + idx * 0.22);
      const y1 = (s.l.y / 100) * ch;
      const y2 = (LABELS[Math.min(LABELS.length - 1, s.i + 1)].y / 100) * ch;
      ctx.strokeStyle = "#ef4444";
      ctx.globalAlpha = blink ? 1 : 0.4;
      ctx.beginPath();
      ctx.moveTo(cx, y1);
      ctx.lineTo(cx, y2);
      ctx.stroke();
      ctx.fillStyle = "#ef4444";
      ctx.beginPath();
      ctx.arc(cx, (y1 + y2) / 2, 5 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#fff";
      ctx.fillText("SHORT CIRCUIT", cx + 8 * scale, (y1 + y2) / 2);
    });
  }, [lines, thermalOn, simMode]);

  useEffect(() => {
    if (camState !== "live") return;
    const loop = (now: number) => {
      rafRef.current = requestAnimationFrame(loop);
      if (now - lastFrameRef.current < 33) return; // ~30fps cap
      lastFrameRef.current = now;
      drawFrame();
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [camState, drawFrame]);

  // Attach the acquired stream to the <video> element once it has mounted
  // (camState transitions to "live" → <video> renders → this effect runs).
  // Skipped in simulated mode, which has no camera stream.
  useEffect(() => {
    if (camState !== "live") return;
    if (!simMode && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      const p = videoRef.current.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
  }, [camState, simMode]);

  // Build a full-resolution composite snapshot (video + thermal + wires).
  const snapshot = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const W = Math.max(320, video.videoWidth);
    const H = Math.max(180, video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (thermalOn) {
      const work = workRef.current;
      if (work) {
        try {
          const wctx = workCtxRef.current!;
          wctx.drawImage(video, 0, 0, work.width, work.height);
          const img = wctx.getImageData(0, 0, work.width, work.height);
          const d = img.data;
          for (let i = 0; i < d.length; i += 4) {
            const lum = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
            d[i] = THERMAL_LUT[lum * 3]; d[i + 1] = THERMAL_LUT[lum * 3 + 1]; d[i + 2] = THERMAL_LUT[lum * 3 + 2];
          }
          wctx.putImageData(img, 0, 0);
          ctx.drawImage(work, 0, 0, W, H);
        } catch {
          ctx.drawImage(video, 0, 0, W, H);
        }
      } else {
        ctx.drawImage(video, 0, 0, W, H);
      }
    } else {
      ctx.drawImage(video, 0, 0, W, H);
    }
    // wires
    ctx.lineWidth = Math.max(2, W / 280);
    ctx.font = `${Math.max(11, W / 56)}px 'JetBrains Mono', monospace`;
    LABELS.forEach((l, i) => {
      const line = lines[i];
      const color = STATUS_COLOR[line.status];
      const y = (l.y / 100) * H;
      ctx.strokeStyle = color; ctx.fillStyle = color;
      if (line.status === "broken") {
        ctx.beginPath();
        ctx.moveTo(0, y); ctx.lineTo(W * 0.42, y);
        ctx.moveTo(W * 0.5, y); ctx.lineTo(W * 0.96, y);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }
      ctx.fillText(l.label, 12, y - 8);
      const text = line.status === "broken" ? "WIRE CUT" : line.status === "dead" ? "DEAD LINE" : line.status === "short" ? "SHORT" : STATUS_LABEL[line.status];
      ctx.fillText(text, W - ctx.measureText(text).width - 12, y - 8);
    });
    ctx.fillStyle = "rgba(0,229,255,0.9)";
    ctx.font = `bold ${Math.max(14, W / 48)}px 'JetBrains Mono', monospace`;
    ctx.fillText("SINNINNATI KEY — THERMAL/CAN-BUS SIM", 12, H - 12);
    const url = canvas.toDataURL("image/png");
    setSnapUrl(url);
  }, [lines, thermalOn]);

  const downloadSnapshot = (url: string) => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `skc-thermal-scan-${Date.now()}.png`;
    a.click();
  };

  const shareSnapshot = async (url: string) => {
    if (!url) return;
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], `skc-thermal-scan-${Date.now()}.png`, { type: "image/png" });
      const nav = navigator as any;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: "Thermal / CAN-bus scan", text: "Thermal diagnostics from Sinsinnati Key Connection" });
        return;
      }
    } catch { /* fall through */ }
    downloadSnapshot(url);
  };

  // Send-to-shop: validate, upload snapshot, create ServiceBooking.
  const sendToShop = async () => {
    setFormErr("");
    const year = validateMinLength("Year", form.year, 3);
    const make = validateNonEmpty("Make", form.make);
    const vin = validateVin(form.vin);
    const name = validateNonEmpty("Name", form.name);
    const email = validateEmail(form.email);
    const phone = validatePhone(form.phone);
    const bad = [year, make, vin, name, email, phone].find((r) => !r.ok);
    if (bad && !bad.ok) { setFormErr(bad.error); return; }
    if (!snapUrl) { setFormErr("Run a scan and capture a diagnostic first."); return; }
    setSending(true);
    try {
      let photoUrl = "";
      try {
        const blob = await (await fetch(snapUrl)).blob();
        const file = new File([blob], `thermal-scan-${Date.now()}.png`, { type: "image/png" });
        const up: any = await db.integrations.Core.UploadFile({ file });
        photoUrl = up?.file_url || "";
      } catch {
        // upload failed — still allow booking without the photo
      }
      const issueCount = lines.filter((l) => l.status !== "normal").length;
      const detail = `Thermal/CAN-bus diagnostic snapshot (${issueCount} fault(s)). Bus lines: ${lines.map((l) => `${l.label}=${STATUS_LABEL[l.status]}(${l.strength}%)`).join("; ")}.`;
      const idempotencyKey = (crypto as any).randomUUID ? crypto.randomUUID() : `thm-${Date.now()}`;
      const refCode = `THM-${Date.now().toString(36).toUpperCase().slice(-6)}`;
      await db.entities.ServiceBooking.create({
        year: form.year.trim(),
        make: form.make.trim(),
        model: form.model.trim() || "—",
        vin: form.vin.trim().toUpperCase(),
        problem_category: "Electrical & Diagnostics",
        problem_detail: detail,
        urgency: "Shop Drop-off / Standard Appointment",
        customer_name: form.name.trim(),
        customer_email: form.email.trim(),
        customer_phone: form.phone.trim(),
        photo_urls: photoUrl ? [photoUrl] : [],
        reference_code: refCode,
        idempotency_key: idempotencyKey,
      } as any);
      toast({ title: "Diagnostic sent to the shop", description: `Reference ${refCode}. We'll reach out shortly.` });
      setShowSend(false);
    } catch (e: any) {
      setFormErr(e?.message || "Could not send. Please try again or call the shop.");
    } finally {
      setSending(false);
    }
  };

  const issueCount = lines.filter((l) => l.status !== "normal").length;
  const recommendation =
    issueCount === 0 ? "All bus lines nominal — no action required."
    : lines.some((l) => l.status === "short") ? "Short circuit detected: isolate the shorted harness and re-test before powering."
    : lines.some((l) => l.status === "broken") ? "Open/cut line detected: locate and repair the break, then re-flash the affected module."
    : lines.some((l) => l.status === "dead") ? "Dead/loss-of-power line: check fuses, grounds and battery supply before re-scan."
    : "Signal degradation detected: inspect connectors for corrosion and re-pin.";

  return (
    <section id="thermal" className="relative bg-titanium border-t border-cyan/10">
      <div className="circuit-grid absolute inset-0 opacity-20 pointer-events-none" />
      <div className="relative max-w-[1100px] mx-auto px-6 lg:px-10 py-24">
        <div className="flex items-center gap-3 mb-4">
          <Thermometer className="w-5 h-5 text-heat" />
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-heat">// Thermal / CAN-Bus — SIMULATOR</span>
        </div>
        <h2 className="font-heading text-4xl sm:text-5xl uppercase text-data leading-[0.95] mb-4">
          See the <span className="text-heat">Heat</span>. Read the <span className="text-cyan">Bus</span>.
        </h2>
        <p className="font-body text-sm text-muted-foreground max-w-2xl mb-3">
          A visual diagnostics <span className="text-cyan">simulator</span> — it pixel-maps the live camera feed into a
          thermal palette and overlays animated CAN-bus wire diagnostics so you can show us what a harness fault looks
          like. Point at a wiring bundle, run a simulated scan, capture it, and send it straight to the shop.
        </p>
        <p className="font-mono text-[10px] uppercase tracking-wider text-cyan/50 mb-8">
          // note: not a real thermal sensor — illustrative canvas overlay at ~30fps
        </p>

        <div className="relative bg-blueprint/40 border border-cyan/20 aspect-[4/3] sm:aspect-video overflow-hidden">
          {camState === "live" && (
            <>
              <video ref={videoRef} autoPlay playsInline muted className={`absolute inset-0 w-full h-full object-cover ${thermalOn ? "opacity-0" : ""}`} />
              <canvas ref={overlayRef} className="absolute inset-0 w-full h-full pointer-events-none" />
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                <button onClick={stop} className="flex items-center gap-1.5 bg-titanium/80 border border-heat/40 text-heat font-mono text-[10px] uppercase px-2.5 py-1.5 hover:bg-heat hover:text-titanium" aria-label="Stop camera">
                  <X className="w-3.5 h-3.5" /> Camera Off
                </button>
              </div>
              <button
                onClick={() => setThermalOn((t) => !t)}
                className={`absolute top-3 left-3 flex items-center gap-1.5 font-mono text-[10px] uppercase px-2.5 py-1.5 border ${thermalOn ? "bg-heat text-titanium border-heat" : "bg-titanium/80 text-heat border-heat/40"}`}
                aria-pressed={thermalOn}
              >
                <Thermometer className="w-3.5 h-3.5" /> {thermalOn ? "Thermal On" : "Thermal Off"}
              </button>
              <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2">
                <button onClick={runScan} className="flex items-center gap-1.5 bg-titanium/80 border border-cyan/40 text-cyan font-mono text-[10px] uppercase px-2.5 py-1.5">
                  <RefreshCw className="w-3.5 h-3.5" /> Run Scan
                </button>
                <button onClick={snapshot} className="flex items-center gap-1.5 bg-titanium/80 border border-cyan/40 text-cyan font-mono text-[10px] uppercase px-2.5 py-1.5">
                  <Camera className="w-3.5 h-3.5" /> Capture Diagnostic
                </button>
                <button onClick={() => downloadSnapshot(snapUrl)} disabled={!snapUrl} className="flex items-center gap-1.5 bg-titanium/80 border border-cyan/40 text-cyan font-mono text-[10px] uppercase px-2.5 py-1.5 disabled:opacity-40">
                  <Download className="w-3.5 h-3.5" /> Save
                </button>
                <button onClick={() => shareSnapshot(snapUrl)} disabled={!snapUrl} className="flex items-center gap-1.5 bg-titanium/80 border border-cyan/40 text-cyan font-mono text-[10px] uppercase px-2.5 py-1.5 disabled:opacity-40">
                  <Share2 className="w-3.5 h-3.5" /> Share
                </button>
                <button onClick={() => setShowSend((s) => !s)} className="flex items-center gap-1.5 bg-heat text-titanium font-mono text-[10px] uppercase px-2.5 py-1.5 hover:glow-heat">
                  <Send className="w-3.5 h-3.5" /> Send to Shop
                </button>
              </div>
              {thermalOn && <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[9px] uppercase tracking-widest text-white/60 pointer-events-none">THERMAL · {thermalOn ? "LIVE" : ""}</span>}
            </>
          )}

          {camState === "acquiring" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <div className="w-8 h-8 border-2 border-heat/20 border-t-heat rounded-full animate-spin" />
              <span className="font-mono text-xs uppercase tracking-wider text-heat/70">Requesting thermal scanner…</span>
            </div>
          )}

          {camState === "idle" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-6">
              <Thermometer className="w-10 h-10 text-heat/70" />
              <p className="font-mono text-xs text-muted-foreground max-w-xs">Grant camera access to launch the live thermal / CAN-bus simulator overlay.</p>
              <button onClick={start} className="inline-flex items-center gap-2 bg-heat text-titanium font-mono text-xs uppercase px-6 py-3 hover:glow-heat">
                <Thermometer className="w-4 h-4" /> Launch Thermal Scanner
              </button>
              <button onClick={startSim} className="font-mono text-[10px] uppercase tracking-wider text-cyan/80 border border-cyan/30 px-4 py-2 hover:text-cyan hover:border-cyan">
                Run Simulated Scan (no camera)
              </button>
            </div>
          )}

          {camState === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-6 bg-titanium/70 backdrop-blur-sm">
              <AlertTriangle className="w-9 h-9 text-heat" />
              <p className="font-mono text-xs text-heat max-w-sm leading-relaxed">{err}</p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button onClick={start} className="inline-flex items-center gap-2 border border-cyan/40 text-cyan font-mono text-xs uppercase px-5 py-3 hover:bg-cyan hover:text-titanium">
                  <RefreshCw className="w-3.5 h-3.5" /> Retry Camera
                </button>
                <button onClick={startSim} className="inline-flex items-center gap-2 bg-heat/20 border border-heat/40 text-heat font-mono text-xs uppercase px-5 py-3 hover:bg-heat hover:text-titanium">
                  <Thermometer className="w-3.5 h-3.5" /> Run Simulated
                </button>
              </div>
              <Link to="/contact" className="font-mono text-[10px] uppercase tracking-wider text-cyan/70 hover:text-cyan underline underline-offset-4">
                Talk to a technician instead
              </Link>
            </div>
          )}
        </div>

        {showSend && (
          <div className="mt-4 bg-blueprint/70 border border-heat/40 p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-xs uppercase tracking-wider text-heat">Send diagnostic to the shop</span>
              <button onClick={() => setShowSend(false)} className="text-muted-foreground hover:text-heat"><X className="w-4 h-4" /></button>
            </div>
            <p className="font-body text-[11px] text-muted-foreground mb-3">
              Fill in your vehicle + contact. We'll attach your last captured diagnostic snapshot to a new "Electrical & Diagnostics" booking.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <input value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="Year (e.g. 2019)" className="bg-titanium border border-cyan/20 px-3 py-2 font-mono text-sm text-data focus:border-cyan focus:outline-none" />
              <input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="Make (e.g. Dodge)" className="bg-titanium border border-cyan/20 px-3 py-2 font-mono text-sm text-data focus:border-cyan focus:outline-none" />
              <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Model (e.g. Charger)" className="bg-titanium border border-cyan/20 px-3 py-2 font-mono text-sm text-data focus:border-cyan focus:outline-none" />
              <input value={form.vin} onChange={(e) => setForm({ ...form, vin: e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17) })} placeholder="VIN (17 chars)" className="bg-titanium border border-cyan/20 px-3 py-2 font-mono text-sm text-data tracking-wider focus:border-cyan focus:outline-none" />
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your name" className="bg-titanium border border-cyan/20 px-3 py-2 font-body text-sm text-data focus:border-cyan focus:outline-none" />
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="bg-titanium border border-cyan/20 px-3 py-2 font-body text-sm text-data focus:border-cyan focus:outline-none" />
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="bg-titanium border border-cyan/20 px-3 py-2 font-body text-sm text-data focus:border-cyan focus:outline-none sm:col-span-2" />
            </div>
            {formErr && <p className="font-mono text-[11px] text-heat mt-3">{formErr}</p>}
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              <button onClick={sendToShop} disabled={sending} className="inline-flex items-center gap-2 bg-heat text-titanium font-mono text-xs uppercase px-4 py-2.5 hover:glow-heat disabled:opacity-50">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send to Shop
              </button>
              {!authUser && <Link to="/login" className="inline-flex items-center gap-1 font-mono text-[10px] uppercase text-cyan hover:gap-2">Sign in to prefill <ChevronRight className="w-3.5 h-3.5" /></Link>}
            </div>
          </div>
        )}

        {camState === "live" && (
          <div className="grid md:grid-cols-2 gap-4 mt-6">
            <div className="bg-blueprint/60 border border-cyan/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-cyan" />
                <span className="font-mono text-xs uppercase tracking-wider text-cyan">Diagnostic readout</span>
              </div>
              <ul className="space-y-2.5">
                {lines.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: STATUS_COLOR[l.status] }} />
                      <span className="font-mono text-data truncate">{l.label}</span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0">
                      <SignalBars strength={l.strength} color={STATUS_COLOR[l.status]} />
                      <span className="font-mono text-[10px] text-muted-foreground w-8 text-right">{l.strength}%</span>
                      <span className="font-mono text-[10px] w-32 text-right" style={{ color: STATUS_COLOR[l.status] }}>{STATUS_LABEL[l.status]}</span>
                      {STATUS_CODE[l.status] !== "—" && <span className="font-mono text-[9px] text-heat w-12">[{STATUS_CODE[l.status]}]</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 pt-3 border-t border-cyan/10">
                <span className="font-mono text-[10px] uppercase tracking-wider text-cyan/60">Recommended action</span>
                <p className="font-body text-xs text-data mt-1">{recommendation}</p>
              </div>
            </div>

            <div className="bg-blueprint/60 border border-cyan/30 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-cyan" />
                <span className="font-mono text-xs uppercase tracking-wider text-cyan">Legend</span>
              </div>
              <ul className="grid grid-cols-1 gap-1.5">
                {LEGEND.map((g) => (
                  <li key={g.status} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: g.color }} />
                    <span className="font-mono text-data/80">{g.label}</span>
                  </li>
                ))}
                <li className="flex items-center gap-2 text-xs pt-1 border-t border-cyan/10 mt-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-gradient-to-t from-indigo-700 via-amber-500 to-white" />
                  <span className="font-mono text-data/80">Thermal palette — cold (blue) → warm (orange) → hot (white)</span>
                </li>
              </ul>
              {snapUrl && (
                <div className="mt-4 pt-3 border-t border-cyan/10">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-cyan/60">Last capture</span>
                  <img src={snapUrl} alt="Thermal CAN-bus snapshot" className="mt-2 w-full border border-cyan/20" />
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => downloadSnapshot(snapUrl)} className="flex-1 flex items-center justify-center gap-1.5 border border-cyan/40 text-cyan font-mono text-[10px] uppercase py-2">
                      <Download className="w-3.5 h-3.5" /> Save
                    </button>
                    <button onClick={() => shareSnapshot(snapUrl)} className="flex-1 flex items-center justify-center gap-1.5 border border-cyan/40 text-cyan font-mono text-[10px] uppercase py-2">
                      <Share2 className="w-3.5 h-3.5" /> Share
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function SignalBars({ strength, color }: { strength: number; color: string }) {
  const filled = Math.round((strength / 100) * 5);
  return (
    <span className="flex items-end gap-0.5 h-3.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} style={{ height: `${(i + 1) * 20}%`, background: i < filled ? color : "rgba(120,130,140,0.25)" }} className="w-1" />
      ))}
    </span>
  );
}