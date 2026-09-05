import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Camera, X, ScanLine, Crosshair, Truck } from "lucide-react";

// WebAR component-location scanner. Opens the device camera and overlays a holographic
// guide showing where the OBD2 port, ECU, BCM, and Immobilizer ring sit so a customer
// can locate and remove the part to ship it to us. Honest: placements are generic
// (real per-vehicle 3D models aren't feasible in-browser); the camera + labels are live.
interface MarkerPos { top: string; left: string }
interface Marker {
  id: string;
  label: string;
  pos: MarkerPos;
  where: string;
  action: string;
}

const MARKERS: Marker[] = [
  { id: "obd2", label: "OBD2 Port", pos: { top: "62%", left: "30%" }, where: "Under the driver-side dashboard, above the pedals.", action: "Diagnostics / flashing access point." },
  { id: "ecu", label: "ECU / PCM", pos: { top: "28%", left: "55%" }, where: "Engine bay — typically near the battery or under a plastic cover behind the strut tower.", action: "The main engine computer. Ship us this for cloning / remapping." },
  { id: "bcm", label: "BCM (Body Control)", pos: { top: "58%", left: "62%" }, where: "Under the dash on the passenger side or behind the glovebox.", action: "Controls locks, lights, immo. We clone / virginize these." },
  { id: "immo", label: "Immobilizer Ring", pos: { top: "52%", left: "40%" }, where: "Around the ignition cylinder where you insert the key.", action: "Reads the transponder chip in your key." },
];

export default function ArScan() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState<boolean>(false);
  const [sel, setSel] = useState<string | null>(null);
  const [err, setErr] = useState<string>("");
  const [vehicle, setVehicle] = useState<string>("");

  const launch = async () => {
    setErr("");
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      setErr("Camera isn't available here — open this page over HTTPS on your phone (not in the builder preview).");
      return;
    }
    try {
      // Resilient capture: prefer the rear camera, but fall back broadly so
      // any device (tablet, front-only laptop cam, browsers that reject the
      // constraint) still gets a working feed instead of throwing immediately.
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      } catch (e1) {
        const n1 = (e1 as any)?.name || "";
        // Surface permission/security denials immediately; retry only on
        // device/constraint failures.
        if (n1 === "NotAllowedError" || n1 === "SecurityError") throw e1;
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try { await videoRef.current.play(); } catch (_e) { /* autoPlay handles it */ }
      }
      setActive(true);
    } catch (e) {
      const name = (e as any)?.name || "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setErr("Camera permission was denied. Enable camera access in your browser or device settings and try again.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setErr("No camera was found on this device.");
      } else if (name === "NotReadableError") {
        setErr("Your camera is in use by another app. Close it and try again.");
      } else {
        setErr("Camera access was blocked or unavailable on this device.");
      }
    }
  };

  const stop = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setSel(null);
  };

  useEffect(() => () => { if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop()); }, []);

  const selected = sel ? MARKERS.find((m) => m.id === sel) : undefined;

  return (
    <section id="ar" className="relative bg-titanium border-t border-cyan/10">
      <div className="circuit-grid absolute inset-0 opacity-20 pointer-events-none" />
      <div className="relative max-w-[1100px] mx-auto px-6 lg:px-10 py-24">
        <div className="flex items-center gap-3 mb-4">
          <ScanLine className="w-5 h-5 text-cyan" />
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-cyan">// WebAR — Find It & Ship It</span>
        </div>
        <h2 className="font-heading text-4xl sm:text-5xl uppercase text-data leading-[0.95] mb-4">
          Point Your Camera. <span className="text-cyan">Locate the Module.</span>
        </h2>
        <p className="font-body text-sm text-muted-foreground max-w-2xl mb-8">
          Open your phone camera, aim it at your dashboard or engine bay, and tap a component marker to see exactly
          where your OBD2 port, ECU, BCM, or Immobilizer ring lives — then pull it and ship it to us for cloning,
          programming, or repair. (Generic placement guide — confirm against your specific year/make/model.)
        </p>

        <div className="mb-5 max-w-sm">
          <label className="font-mono text-[11px] uppercase tracking-wider text-cyan mb-2 block">Your vehicle (optional)</label>
          <input value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="2019 Dodge Charger" className="w-full bg-titanium border border-cyan/20 px-4 py-3 font-body text-sm text-data focus:border-cyan focus:outline-none" />
        </div>

        <div className="relative bg-blueprint/40 border border-cyan/20 aspect-[4/3] sm:aspect-video overflow-hidden">
          {!active ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-6">
              {err && <div className="font-mono text-xs text-heat">{err}</div>}
              <Camera className="w-10 h-10 text-cyan/70" />
              <p className="font-mono text-xs text-muted-foreground max-w-xs">Grant camera access to overlay component locations on your live view.</p>
              <button onClick={launch} className="inline-flex items-center gap-2 bg-cyan text-titanium font-mono text-xs uppercase px-6 py-3 hover:glow-cyan">
                <Camera className="w-4 h-4" /> Launch AR Scanner
              </button>
            </div>
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 scanline opacity-20 animate-bitstream" />
                {MARKERS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSel(m.id)}
                    style={m.pos}
                    className="absolute -translate-x-1/2 -translate-y-1/2 group pointer-events-auto"
                    aria-label={m.label}
                  >
                    <span className="absolute -inset-3 border border-cyan/40 rounded-full animate-pulse-ring group-hover:border-cyan/70" />
                    <Crosshair className="w-7 h-7 text-cyan drop-shadow-[0_0_8px_rgba(0,229,255,0.9)]" />
                    <span className="absolute top-8 left-1/2 -translate-x-1/2 w-[190px] max-w-[72vw] flex flex-col gap-0.5 bg-titanium/40 backdrop-blur-md border border-cyan/30 px-2.5 py-1.5 text-left shadow-[0_0_18px_rgba(0,229,255,0.15)]">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-cyan">{m.label}</span>
                      <span className="font-body text-[10px] leading-snug text-data/80 line-clamp-2">{m.where}</span>
                      <span className="font-mono text-[8px] uppercase tracking-wider text-cyan/50">tap for guide</span>
                    </span>
                  </button>
                ))}
              </div>
              <button onClick={stop} className="absolute top-3 right-3 flex items-center gap-1.5 bg-titanium/80 border border-heat/40 text-heat font-mono text-[10px] uppercase px-2.5 py-1.5">
                <X className="w-3.5 h-3.5" /> Stop
              </button>
              {selected && (
                <div className="absolute bottom-3 left-3 right-3 bg-titanium/90 border border-cyan/30 p-4 backdrop-blur-md">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs uppercase text-cyan">{selected.label}</span>
                    <button onClick={() => setSel(null)} className="text-muted-foreground hover:text-heat"><X className="w-4 h-4" /></button>
                  </div>
                  <p className="font-body text-xs text-data leading-relaxed mb-1">{selected.where}</p>
                  <p className="font-body text-xs text-muted-foreground mb-3">{selected.action}</p>
                  <Link to="/mail-in" className="inline-flex items-center gap-1.5 bg-cyan text-titanium font-mono text-[10px] uppercase px-3 py-2 hover:glow-cyan">
                    <Truck className="w-3.5 h-3.5" /> Ship this part
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}