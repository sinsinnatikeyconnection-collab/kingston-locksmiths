import React, { useState, useRef, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Camera, CameraOff, ScanLine, Truck, RefreshCw, Zap, X, Download,
  Share2, SwitchCamera, AlertTriangle, ChevronRight, Info, Loader2,
  Monitor, Cpu, KeyRound, Workflow,
} from "lucide-react";
import ModuleViewer3D from "@/components/apex/ModuleViewer3D";
import { useVinDecode } from "@/hooks/useVinDecode";

// ===== vehicle data (mirrors the booking wizard) =====
const YEARS: string[] = Array.from({ length: 2026 - 1980 + 1 }, (_, i) => String(2026 - i));
const MAKES: string[] = [
  "Acura", "Audi", "BMW", "Buick", "Cadillac", "Chevrolet", "Chrysler", "Dodge",
  "Ford", "GMC", "Honda", "Hyundai", "Infiniti", "Jeep", "Kia", "Land Rover",
  "Lexus", "Lincoln", "Mazda", "Mercedes-Benz", "Mercury", "MINI", "Mitsubishi",
  "Nissan", "Pontiac", "Porsche", "Ram", "Subaru", "Tesla", "Toyota",
  "Volkswagen", "Volvo",
];
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

// ===== module markers (positions are % of the live viewport — a browser
// has no real spatial AR tracking, so these are honest overlay guides,
// but the camera, capture, capture/share, x-ray toggle and taps are all real) =====
interface Marker {
  id: string;
  name: string;
  color: string;
  desc: string;
  pos: { x: number; y: number };
  icon: React.ComponentType<{ className?: string }>;
}
const MARKERS: Marker[] = [
  {
    id: "obd2", name: "OBD2 Port", color: "#3b82f6",
    desc: "Diagnostic link connector. Under the driver-side dash, above the pedals. Plug-in access for scans, IMMO PIN pulls and J2534 flashing.",
    pos: { x: 16, y: 76 }, icon: ScanLine,
  },
  {
    id: "ecu", name: "ECU / ECM", color: "#00e5ff",
    desc: "Engine control unit — the main computer. Engine bay, near the battery or behind the strut tower. Ship us this for cloning / remapping.",
    pos: { x: 48, y: 22 }, icon: Cpu,
  },
  {
    id: "bcm", name: "BCM (Body Control)", color: "#22c55e",
    desc: "Body control module — runs locks, lights and immobilizer handshakes. Under the passenger-side dash or behind the glovebox. We clone / virginize these.",
    pos: { x: 84, y: 70 }, icon: Workflow,
  },
  {
    id: "immo", name: "Immobilizer Ring", color: "#ff8a00",
    desc: "Transponder reader ring around the ignition cylinder. Reads the chip in your key — a frequent cause of cranks-but-no-start lockouts.",
    pos: { x: 44, y: 60 }, icon: KeyRound,
  },
];
// wiring-harness paths (pairs of marker ids that are connected)
const WIRES: [string, string][] = [
  ["obd2", "ecu"],
  ["ecu", "bcm"],
  ["ecu", "immo"],
  ["bcm", "immo"],
];

type Facing = "environment" | "user";
type Phase = "select" | "acquiring" | "live" | "denied" | "nocam" | "noapi";

export default function ArScan() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const acquireTimer = useRef<number | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<Phase>("select");
  const [errMsg, setErrMsg] = useState<string>("");
  const [facing, setFacing] = useState<Facing>("environment");

  // vehicle selection
  const urlParams = new URLSearchParams(window.location.search);
  const [year, setYear] = useState<string>(urlParams.get("year") || "");
  const [make, setMake] = useState<string>(urlParams.get("make") || "");
  const [model, setModel] = useState<string>(urlParams.get("model") || "");
  const [vin, setVin] = useState<string>((urlParams.get("vin") || "").toUpperCase());
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState<boolean>(false);

  const [xrayOn, setXrayOn] = useState<boolean>(true);
  const [active, setActive] = useState<Marker | null>(null);
  const [snapUrl, setSnapUrl] = useState<string>("");
  const [motionScore, setMotionScore] = useState<number | null>(null);

  const { data: decoded } = useVinDecode(VIN_RE.test(vin) ? vin : "");

  // live model list from NHTSA when year + make chosen
  useEffect(() => {
    if (!year || !make) { setModels([]); return; }
    let cancelled = false;
    setModelsLoading(true);
    fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(make)}/modelyear/${year}?format=json`)
      .then((r) => r.json())
      .then((d: { Results?: { Model_Name?: string }[] }) => {
        if (cancelled) return;
        const names = (d.Results || []).map((x) => (x.Model_Name || "").trim()).filter(Boolean) as string[];
        setModels(Array.from(new Set(names)).sort());
      })
      .catch(() => !cancelled && setModels([]))
      .finally(() => !cancelled && setModelsLoading(false));
    return () => { cancelled = true; };
  }, [year, make]);

  // if a VIN decoded cleanly, auto-fill year/make/model once
  useEffect(() => {
    if (decoded?.decoded) {
      const d = decoded.decoded;
      if (d.year && !year) setYear(d.year);
      if (d.make && !make) setMake(d.make);
      if (d.model && !model) setModel(d.model);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decoded]);

  const vehicleReady = Boolean((year && make && model) || VIN_RE.test(vin));
  const vehicleLabel = `${year || "?"} ${make || "?"} ${model || "?"}`.trim();

  const stop = useCallback(() => {
    if (acquireTimer.current) window.clearTimeout(acquireTimer.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setPhase("select");
    setActive(null);
    setSnapUrl("");
    setMotionScore(null);
  }, []);

  const start = useCallback(async (face: Facing) => {
    if (!window.isSecureContext) {
      setPhase("noapi");
      setErrMsg("Camera requires HTTPS. Open the published site over HTTPS on your phone.");
      return;
    }
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      setPhase("noapi");
      setErrMsg("Camera API not available in this browser.");
      return;
    }
    setPhase("acquiring");
    setErrMsg("");
    if (acquireTimer.current) window.clearTimeout(acquireTimer.current);
    acquireTimer.current = window.setTimeout(() => {
      setPhase("denied");
      setErrMsg("Camera didn't respond in time. Check permissions (the aA / lock icon in the address bar) and retry.");
    }, 9000);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: face } },
          audio: false,
        });
      } catch (e1) {
        const n1 = (e1 as any)?.name || "";
        if (n1 === "NotAllowedError" || n1 === "SecurityError") throw e1;
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      if (acquireTimer.current) { window.clearTimeout(acquireTimer.current); acquireTimer.current = null; }
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = stream;
      setPhase("live");
    } catch (e) {
      if (acquireTimer.current) { window.clearTimeout(acquireTimer.current); acquireTimer.current = null; }
      const name = (e as any)?.name || "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setPhase("denied");
        setErrMsg("Camera access denied. Tap the camera icon in your address bar and allow this site, then retry.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setPhase("nocam");
        setErrMsg("No camera detected on this device.");
      } else {
        setPhase("denied");
        setErrMsg("Camera unavailable: " + (e as Error).message);
      }
    }
  }, []);

  // attach stream once <video> mounts (phase → live → element present)
  useEffect(() => {
    if (phase !== "live") return;
    if (streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      const p = videoRef.current.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
  }, [phase]);

  // Motion is only used as a framing aid. It does not identify a module or
  // diagnose an electrical fault.
  useEffect(() => {
    if (phase !== "live") return;
    const video = videoRef.current;
    if (!video) return;
    const sample = document.createElement("canvas");
    sample.width = 32;
    sample.height = 24;
    const ctx = sample.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    let previous: Uint8ClampedArray | null = null;
    const timer = window.setInterval(() => {
      if (video.readyState < 2) return;
      ctx.drawImage(video, 0, 0, sample.width, sample.height);
      const current = ctx.getImageData(0, 0, sample.width, sample.height).data;
      if (previous) {
        let delta = 0;
        for (let i = 0; i < current.length; i += 4) {
          delta += Math.abs(current[i] - previous[i]) + Math.abs(current[i + 1] - previous[i + 1]) + Math.abs(current[i + 2] - previous[i + 2]);
        }
        setMotionScore(Math.min(100, Math.round((delta / (current.length / 4) / 255) * 100)));
      }
      previous = new Uint8ClampedArray(current);
    }, 500);
    return () => window.clearInterval(timer);
  }, [phase]);

  // cleanup on unmount
  useEffect(() => () => {
    if (acquireTimer.current) window.clearTimeout(acquireTimer.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
  }, []);

  const switchFacing = () => {
    const next: Facing = facing === "environment" ? "user" : "environment";
    setFacing(next);
    if (phase === "live" || phase === "acquiring") start(next);
  };

  // ===== capture (real canvas composite of video + overlay) =====
  const capture = useCallback(() => {
    const video = videoRef.current;
    const box = boxRef.current;
    if (!video || !video.videoWidth || !box) return;
    const W = video.videoWidth;
    const H = video.videoHeight;
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // draw cover-fitted video
    const bRatio = box.clientWidth / box.clientHeight;
    const vRatio = W / H;
    let dx = 0, dy = 0, dw = W, dh = H;
    if (vRatio > bRatio) { dw = H * bRatio; dx = (W - dw) / 2; }
    else { dh = W / bRatio; dy = (H - dh) / 2; }
    ctx.drawImage(video, dx, dy, dw, dh, 0, 0, W, H);
    const px = (x: number) => (x / 100) * W;
    const py = (y: number) => (y / 100) * H;
    // wires
    WIRES.forEach(([a, b]) => {
      const ma = MARKERS.find((m) => m.id === a)!;
      const mb = MARKERS.find((m) => m.id === b)!;
      ctx.strokeStyle = xrayOn ? "rgba(0,229,255,0.95)" : "rgba(0,229,255,0.4)";
      ctx.lineWidth = Math.max(2, W / 480);
      ctx.setLineDash([10, 6]);
      ctx.beginPath(); ctx.moveTo(px(ma.pos.x), py(ma.pos.y)); ctx.lineTo(px(mb.pos.x), py(mb.pos.y)); ctx.stroke();
      ctx.setLineDash([]);
    });
    // markers
    MARKERS.forEach((m) => {
      const mx = px(m.pos.x), my = py(m.pos.y);
      ctx.beginPath(); ctx.arc(mx, my, Math.max(8, W / 110), 0, Math.PI * 2);
      ctx.fillStyle = m.color; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(8,8,9,0.85)"; ctx.stroke();
      ctx.font = `bold ${Math.max(16, W / 60)}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = m.color;
      ctx.fillText(m.name, mx + 14, my + 6);
    });
    // watermark
    ctx.fillStyle = "rgba(0,229,255,0.9)";
    ctx.font = `bold ${Math.max(18, W / 50)}px 'JetBrains Mono', monospace`;
    ctx.fillText("SINNINNATI KEY — AR MODULE LOCATOR", 16, H - 16);
    ctx.fillText(vehicleLabel, 16, H - 16 - Math.max(22, W / 40));
    setSnapUrl(canvas.toDataURL("image/png"));
  }, [xrayOn, vehicleLabel]);

  const downloadSnap = (url: string) => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url; a.download = `skc-ar-scan-${Date.now()}.png`; a.click();
  };
  const shareSnap = async (url: string) => {
    if (!url) return;
    try {
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], `skc-ar-scan-${Date.now()}.png`, { type: "image/png" });
      const nav = navigator as any;
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: "AR module scan", text: "Module locator — Sinsinnati Key Connection" });
        return;
      }
    } catch { /* fall through to download */ }
    downloadSnap(url);
  };

  const resetSelect = () => {
    setYear(""); setMake(""); setModel(""); setVin(""); setModels([]);
    setPhase("select");
  };

  // ============================================================
  // SELECTION PHASE
  // ============================================================
  if (phase === "select") {
    return (
      <section id="ar" className="relative bg-titanium border-t border-cyan/10">
        <div className="circuit-grid absolute inset-0 opacity-20 pointer-events-none" />
        <div className="relative max-w-[1100px] mx-auto px-6 lg:px-10 py-24">
          <div className="flex items-center gap-3 mb-4">
            <ScanLine className="w-5 h-5 text-cyan" />
            <span className="font-mono text-xs uppercase tracking-[0.3em] text-cyan">// Step 1 — Identify Your Vehicle</span>
          </div>
          <h2 className="font-heading text-4xl sm:text-5xl uppercase text-data leading-[0.95] mb-4">
            Tell us the <span className="text-cyan">vehicle</span>, then scan it.
          </h2>
          <p className="font-body text-sm text-muted-foreground max-w-2xl mb-8">
            Pick Year → Make → Model, or just type the 17-character VIN. Once we know the vehicle we launch the
            live AR camera overlay to show you where the OBD2 port, ECU, BCM and immobilizer ring live on it.
          </p>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* YMM selectors */}
            <div className="border border-cyan/20 bg-blueprint/20 p-5">
              <div className="font-mono text-[11px] uppercase tracking-wider text-cyan mb-4">// By Year / Make / Model</div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-mono text-[10px] uppercase text-cyan/70 mb-1 block">Year</label>
                  <select value={year} onChange={(e) => { setYear(e.target.value); setModel(""); }} className="w-full bg-titanium border border-cyan/20 px-3 py-3 font-body text-sm text-data focus:border-cyan focus:outline-none">
                    <option value="">—</option>
                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-mono text-[10px] uppercase text-cyan/70 mb-1 block">Make</label>
                  <select value={make} onChange={(e) => { setMake(e.target.value); setModel(""); }} className="w-full bg-titanium border border-cyan/20 px-3 py-3 font-body text-sm text-data focus:border-cyan focus:outline-none">
                    <option value="">—</option>
                    {MAKES.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-mono text-[10px] uppercase text-cyan/70 mb-1 block">Model</label>
                  {year && make ? (
                    <select value={model} onChange={(e) => setModel(e.target.value)} className="w-full bg-titanium border border-cyan/20 px-3 py-3 font-body text-sm text-data focus:border-cyan focus:outline-none">
                      <option value="">{modelsLoading ? "Loading…" : "—"}</option>
                      {models.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  ) : (
                    <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Select year & make" className="w-full bg-titanium border border-cyan/20 px-3 py-3 font-body text-sm text-data focus:border-cyan focus:outline-none disabled:opacity-50" disabled={!make} />
                  )}
                </div>
              </div>
            </div>

            {/* VIN */}
            <div className="border border-cyan/20 bg-blueprint/20 p-5">
              <div className="font-mono text-[11px] uppercase tracking-wider text-cyan mb-4">// By VIN</div>
              <input
                value={vin}
                onChange={(e) => setVin(e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17))}
                placeholder="17-character VIN"
                className="w-full bg-titanium border border-cyan/20 px-4 py-3 font-mono text-sm text-data tracking-wider focus:border-cyan focus:outline-none"
              />
              {vin && !VIN_RE.test(vin) && <p className="font-mono text-[10px] text-heat mt-2">VIN must be 17 chars (no I/O/Q).</p>}
              {decoded?.decoded && (
                <div className="mt-3 font-mono text-[11px] text-cyan/80 leading-relaxed">
                  Decoded → {decoded.decoded.year} {decoded.decoded.make} {decoded.decoded.model}
                  {decoded.decoded.engine_size ? ` · ${decoded.decoded.engine_size}L` : ""}
                  {decoded.decoded.plant ? ` · ${decoded.decoded.plant}` : ""}
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              onClick={() => start("environment")}
              disabled={!vehicleReady}
              className="inline-flex items-center gap-2 bg-cyan text-titanium font-mono text-xs uppercase px-6 py-3 hover:glow-cyan disabled:opacity-40"
            >
              <Camera className="w-4 h-4" /> Launch AR Scanner
            </button>
            <div className="flex items-center gap-2">
              <button onClick={switchFacing} className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase text-muted-foreground border border-cyan/30 px-3 py-2 hover:text-cyan">
                <SwitchCamera className="w-3.5 h-3.5" /> Start with: {facing === "environment" ? "Back" : "Front"} camera
              </button>
            </div>
            <span className="font-mono text-[10px] uppercase text-cyan/60">{vehicleReady ? `Ready: ${vehicleLabel}` : "Select a vehicle to begin"}</span>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-cyan/40 mt-4">
            // note: the live overlay is a real camera feed with positioned module guides — browsers can't do true spatial AR
            // without a model + tracking framework, so markers show approximate factory locations for your vehicle.
          </p>
        </div>
      </section>
    );
  }

  // ============================================================
  // NO-API / HARDWARE BLOCKED
  // ============================================================
  if (phase === "noapi") {
    return (
      <FallbackBox icon={AlertTriangle} msg={errMsg}>
        <Link to="/contact" className="font-mono text-[10px] uppercase tracking-wider text-cyan/70 hover:text-cyan underline underline-offset-4">Talk to a technician</Link>
      </FallbackBox>
    );
  }

  // ============================================================
  // PERMISSION DENIED / TIMEOUT
  // ============================================================
  if (phase === "denied") {
    return (
      <FallbackBox icon={AlertTriangle} msg={errMsg}>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button onClick={() => start(facing)} className="inline-flex items-center gap-2 bg-cyan text-titanium font-mono text-xs uppercase px-5 py-3 hover:glow-cyan">
            <RefreshCw className="w-3.5 h-3.5" /> Request Permission / Retry
          </button>
          <button onClick={() => setPhase("nocam")} className="inline-flex items-center gap-2 border border-cyan/40 text-cyan font-mono text-xs uppercase px-5 py-3 hover:bg-cyan hover:text-titanium">
            <Monitor className="w-3.5 h-3.5" /> Use 3D Fallback
          </button>
        </div>
      </FallbackBox>
    );
  }

  // ============================================================
  // NO CAMERA → 3D MODEL FALLBACK with the same markers
  // ============================================================
  if (phase === "nocam") {
    return (
      <section className="bg-titanium border-t border-cyan/10">
        <div className="max-w-[1100px] mx-auto px-6 lg:px-10 py-20">
          <div className="flex items-center gap-3 mb-3">
            <Monitor className="w-5 h-5 text-cyan" />
            <span className="font-mono text-xs uppercase tracking-[0.3em] text-cyan">// 3D Fallback — No Camera</span>
          </div>
          <p className="font-body text-sm text-muted-foreground max-w-2xl mb-6">{errMsg} Showing the 3D module view for {vehicleLabel} with the same component markers.</p>
          <ModuleViewer3D year={year} make={make} model={model} vin={vin} />
          <div className="flex flex-wrap gap-3 mt-6">
            <button onClick={() => start(facing)} className="inline-flex items-center gap-2 border border-cyan/40 text-cyan font-mono text-xs uppercase px-5 py-3 hover:bg-cyan hover:text-titanium">
              <RefreshCw className="w-3.5 h-3.5" /> Retry Camera
            </button>
            <button onClick={resetSelect} className="inline-flex items-center gap-2 font-mono text-xs uppercase text-muted-foreground border border-cyan/20 px-5 py-3 hover:text-cyan">
              <RefreshCw className="w-3.5 h-3.5" /> Pick a different vehicle
            </button>
          </div>
        </div>
      </section>
    );
  }

  // ============================================================
  // ACQUIRING + LIVE
  // ============================================================
  const markerById = (id: string) => MARKERS.find((m) => m.id === id)!;

  return (
    <section id="ar" className="relative bg-titanium border-t border-cyan/10">
      <div className="circuit-grid absolute inset-0 opacity-20 pointer-events-none" />
      <div className="relative max-w-[1100px] mx-auto px-6 lg:px-10 py-12">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-3">
              <ScanLine className="w-5 h-5 text-cyan" />
              <span className="font-mono text-xs uppercase tracking-[0.3em] text-cyan">// Step 2 — AR Overlay · {vehicleLabel}</span>
            </div>
          </div>
          <button onClick={switchFacing} className="inline-flex items-center gap-1.5 bg-titanium/80 border border-cyan/40 text-cyan font-mono text-[10px] uppercase px-3 py-2">
            <SwitchCamera className="w-3.5 h-3.5" /> Flip ({facing === "environment" ? "Back" : "Front"})
          </button>
        </div>

        <div ref={boxRef} className="relative bg-black border border-cyan/20 aspect-[4/3] sm:aspect-video overflow-hidden">
          <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />

          {/* SVG wiring harness (always present; x-ray makes it bright) */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
            {WIRES.map(([a, b], i) => {
              const ma = markerById(a), mb = markerById(b);
              return (
                <line
                  key={i}
                  x1={`${ma.pos.x}%`} y1={`${ma.pos.y}%`}
                  x2={`${mb.pos.x}%`} y2={`${mb.pos.y}%`}
                  stroke={xrayOn ? "rgba(0,229,255,0.9)" : "rgba(0,229,255,0.35)"}
                  strokeWidth={xrayOn ? 2.5 : 1.5}
                  strokeDasharray="7 5"
                  className="animate-pulse"
                />
              );
            })}
          </svg>

          {/* glowing dot markers */}
          {MARKERS.map((m) => {
            const Icon = m.icon;
            const on = active?.id === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setActive(on ? null : m)}
                className="absolute -translate-x-1/2 -translate-y-1/2 z-10 group"
                style={{ left: `${m.pos.x}%`, top: `${m.pos.y}%` }}
                aria-label={m.name}
              >
                <span
                  className="absolute inset-0 -m-2 rounded-full animate-pulse-ring"
                  style={{ boxShadow: `0 0 0 1px ${m.color}80` }}
                />
                <span
                  className="relative flex items-center justify-center w-5 h-5 rounded-full border-2 border-black/70 transition-transform group-hover:scale-125"
                  style={{ background: m.color, opacity: xrayOn ? 1 : 0.55, boxShadow: `0 0 14px ${m.color}` }}
                >
                  <Icon className="w-3 h-3 text-titanium" />
                </span>
                <span
                  className="absolute left-7 top-1/2 -translate-y-1/2 whitespace-nowrap font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 bg-titanium/85 border border-cyan/30"
                  style={{ color: m.color, opacity: xrayOn ? 1 : 0.6 }}
                >
                  {m.name}
                </span>
              </button>
            );
          })}

          {/* HUD */}
          <div className="absolute top-3 left-3 font-mono text-[9px] uppercase tracking-widest text-cyan/70 pointer-events-none">
            .AR.LOCK · {xrayOn ? "X-RAY" : "NORMAL"}
          </div>
          {phase === "live" && motionScore !== null && (
            <div className="absolute top-3 right-3 max-w-[11rem] bg-black/55 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-cyan/80 pointer-events-none">
              Frame motion {motionScore}% · steady camera for capture
            </div>
          )}

          {phase === "acquiring" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
              <Loader2 className="w-7 h-7 text-cyan animate-spin" />
              <span className="font-mono text-xs uppercase tracking-wider text-cyan/70">Requesting camera…</span>
            </div>
          )}

          {/* active marker info panel */}
          {phase === "live" && active && (
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-[92%] max-w-md bg-titanium/90 backdrop-blur-md border p-4"
              style={{ borderColor: active.color }}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: active.color }}>// {active.name}</span>
                <button onClick={() => setActive(null)} className="text-muted-foreground hover:text-heat"><X className="w-4 h-4" /></button>
              </div>
              <p className="font-body text-xs text-data leading-relaxed">{active.desc}</p>
              <Link to="/mail-in" className="inline-flex items-center gap-1.5 mt-2 font-mono text-[10px] uppercase text-cyan hover:gap-3 transition-all">
                <Truck className="w-3 h-3" /> Ship this module in <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* control bar */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button onClick={() => setXrayOn((x) => !x)} aria-pressed={xrayOn} className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase px-3 py-2 border ${xrayOn ? "border-cyan text-cyan bg-cyan/10" : "border-cyan/30 text-muted-foreground"}`}>
            <Zap className="w-3.5 h-3.5" /> X-Ray {xrayOn ? "On" : "Off"}
          </button>
          <button onClick={capture} className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase px-3 py-2 border border-cyan/40 text-cyan hover:bg-cyan hover:text-titanium">
            <Camera className="w-3.5 h-3.5" /> Capture
          </button>
          <button onClick={() => downloadSnap(snapUrl)} disabled={!snapUrl} className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase px-3 py-2 border border-cyan/40 text-cyan disabled:opacity-40">
            <Download className="w-3.5 h-3.5" /> Save
          </button>
          <button onClick={() => shareSnap(snapUrl)} disabled={!snapUrl} className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase px-3 py-2 border border-cyan/40 text-cyan disabled:opacity-40">
            <Share2 className="w-3.5 h-3.5" /> Share
          </button>
          <button onClick={stop} className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase px-3 py-2 border border-heat/40 text-heat hover:bg-heat hover:text-titanium">
            <CameraOff className="w-3.5 h-3.5" /> Stop
          </button>
          <button onClick={resetSelect} className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase px-3 py-2 border border-cyan/20 text-muted-foreground hover:text-cyan">
            <RefreshCw className="w-3.5 h-3.5" /> New vehicle
          </button>
        </div>

        {/* module legend / quick-select */}
        <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {MARKERS.map((m) => (
            <button key={m.id} onClick={() => setActive(m)} className="text-left border border-cyan/15 bg-blueprint/20 p-3 hover:border-cyan/40">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: m.color, boxShadow: `0 0 8px ${m.color}` }} />
                <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: m.color }}>{m.name}</span>
              </div>
              <p className="font-body text-[11px] text-muted-foreground leading-snug">{m.desc.split(".")[0]}.</p>
            </button>
          ))}
        </div>

        {snapUrl && (
          <div className="mt-4 border border-cyan/20 p-3">
            <div className="font-mono text-[10px] uppercase tracking-wider text-cyan/70 mb-2">// Last capture</div>
            <img src={snapUrl} alt="AR scan capture" className="w-full max-w-md border border-cyan/20" />
            <div className="flex gap-2 mt-2">
              <button onClick={() => downloadSnap(snapUrl)} className="flex-1 inline-flex items-center justify-center gap-1.5 border border-cyan/40 text-cyan font-mono text-[10px] uppercase py-2">
                <Download className="w-3.5 h-3.5" /> Save
              </button>
              <button onClick={() => shareSnap(snapUrl)} className="flex-1 inline-flex items-center justify-center gap-1.5 border border-cyan/40 text-cyan font-mono text-[10px] uppercase py-2">
                <Share2 className="w-3.5 h-3.5" /> Share
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function FallbackBox({ icon: Icon, msg, children }: { icon: React.ComponentType<{ className?: string }>; msg: string; children?: React.ReactNode }) {
  return (
    <section className="bg-titanium border-t border-cyan/10">
      <div className="max-w-[1100px] mx-auto px-6 lg:px-10 py-20">
        <div className="border border-heat/30 bg-blueprint/20 p-8 flex flex-col items-center text-center gap-4">
          <Icon className="w-9 h-9 text-heat" />
          <p className="font-mono text-xs text-heat max-w-md leading-relaxed">{msg}</p>
          {children}
        </div>
      </div>
    </section>
  );
}