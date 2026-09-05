import React, { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import PageShell from "@/components/apex/PageShell";
import { useVinDecode } from "@/hooks/useVinDecode";
import { Camera, Download, Search, ChevronRight, Loader2, RefreshCw, AlertTriangle } from "lucide-react";

const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;

export default function VinScan() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [vin, setVin] = useState("");
  const [camState, setCamState] = useState<"idle" | "live" | "denied">("idle");
  const [snapUrl, setSnapUrl] = useState("");

  const { data, loading, error } = useVinDecode(VIN_RE.test(vin) ? vin : "");
  const valid = VIN_RE.test(vin);
  const decoded = data?.decoded;

  const startCam = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamState("denied");
      return;
    }
    setCamState("idle");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = stream;
      setCamState("live");
      // attach once mounted
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch {
      setCamState("denied");
    }
  }, []);

  const stopCam = useCallback(() => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamState("idle");
  }, []);

  const capturePlate = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth; canvas.height = v.videoHeight;
    canvas.getContext("2d")?.drawImage(v, 0, 0);
    setSnapUrl(canvas.toDataURL("image/png"));
  };

  const gotoAR = () => {
    const params = new URLSearchParams();
    if (vin) params.set("vin", vin);
    if (decoded?.year) params.set("year", decoded.year);
    if (decoded?.make) params.set("make", decoded.make);
    if (decoded?.model) params.set("model", decoded.model);
    navigate(`/ar?${params.toString()}`);
  };

  return (
    <PageShell title="VIN Scan" tagline="// Identify & Decode">
      <div className="max-w-[900px] mx-auto px-6 lg:px-10 py-12">
        {/* camera plate capture */}
        <div className="border border-cyan/20 bg-blueprint/30 p-5 mb-6">
          <div className="font-mono text-[11px] uppercase tracking-wider text-cyan mb-3">// Step 1 — Snap the VIN plate</div>
          <div className="relative aspect-[16/9] bg-black border border-cyan/30 overflow-hidden mb-3">
            {camState === "live" && (
              <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover" />
            )}
            {camState === "idle" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
                <Camera className="w-8 h-8 text-cyan/60" />
                <p className="font-mono text-[11px] text-muted-foreground max-w-xs">Capture the 17-character VIN on your dash plate or door jamb, then type it below.</p>
                <button onClick={startCam} className="inline-flex items-center gap-2 bg-cyan text-titanium font-mono text-xs uppercase px-5 py-3 hover:glow-cyan">
                  <Camera className="w-4 h-4" /> Scan with Camera
                </button>
              </div>
            )}
            {camState === "denied" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
                <AlertTriangle className="w-8 h-8 text-heat" />
                <p className="font-mono text-[11px] text-heat max-w-xs">Camera blocked or unavailable. Type the VIN manually below.</p>
                <button onClick={startCam} className="inline-flex items-center gap-2 border border-cyan/40 text-cyan font-mono text-xs uppercase px-4 py-2">
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </button>
              </div>
            )}
            {snapUrl && camState === "live" && <img src={snapUrl} alt="VIN plate" className="absolute inset-0 w-full h-full object-contain" />}
          </div>
          {camState === "live" && (
            <div className="flex flex-wrap gap-2">
              <button onClick={capturePlate} className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase px-3 py-2 border border-cyan/40 text-cyan hover:bg-cyan hover:text-titanium">
                <Camera className="w-3.5 h-3.5" /> Capture plate photo
              </button>
              {snapUrl && (
                <a href={snapUrl} download={`vin-plate-${Date.now()}.png`} className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase px-3 py-2 border border-cyan/40 text-cyan">
                  <Download className="w-3.5 h-3.5" /> Save photo
                </a>
              )}
              <button onClick={stopCam} className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase px-3 py-2 border border-heat/40 text-heat">
                Stop camera
              </button>
            </div>
          )}
        </div>

        {/* manual entry + decode */}
        <div className="border border-cyan/20 bg-blueprint/30 p-5 mb-6">
          <div className="font-mono text-[11px] uppercase tracking-wider text-cyan mb-3">// Step 2 — Enter the VIN</div>
          <div className="flex gap-2">
            <input
              value={vin}
              onChange={(e) => setVin(e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17))}
              placeholder="1G1ZC54789F1..."
              className="flex-1 bg-titanium border border-cyan/20 px-4 py-3 font-mono text-sm text-data tracking-wider focus:border-cyan focus:outline-none"
            />
          </div>
          <p className="font-mono text-[10px] text-muted-foreground mt-2">
            Auto-decodes from NHTSA VPIC as you type (17 chars, no I/O/Q). Capture the plate photo for your reference.
          </p>
        </div>

        {/* decoded display */}
        {loading && (
          <div className="border border-cyan/20 bg-blueprint/20 p-5 mb-6 flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-cyan animate-spin" />
            <span className="font-mono text-xs text-cyan/80">Decoding VIN…</span>
          </div>
        )}
        {error && (
          <div className="border border-heat/40 bg-heat/5 p-5 mb-6">
            <p className="font-mono text-xs text-heat">{error}</p>
          </div>
        )}
        {valid && decoded && (
          <div className="border border-cyan/30 bg-blueprint/20 p-6 mb-6 glow-cyan">
            <div className="font-mono text-[10px] uppercase tracking-widest text-cyan mb-4">// Decoded vehicle</div>
            <h3 className="font-heading text-2xl uppercase text-data mb-4">{decoded.year} {decoded.make} {decoded.model}</h3>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 font-mono text-sm">
              <Row label="Year" value={decoded.year} />
              <Row label="Make" value={decoded.make} />
              <Row label="Model" value={decoded.model} />
              <Row label="Trim" value={decoded.trim} />
              <Row label="Engine" value={decoded.engine_size ? `${decoded.engine_size}L · ${decoded.cylinders} cyl` : decoded.engineModel} />
              <Row label="Fuel" value={decoded.fuelType} />
              <Row label="Drive" value={decoded.driveType} />
              <Row label="Transmission" value={decoded.transmission} />
              <Row label="Body" value={decoded.bodyClass} />
              <Row label="Plant" value={decoded.plant} />
              <Row label="Vehicle type" value={decoded.vehicleType} />
            </dl>
          </div>
        )}

        <button
          onClick={gotoAR}
          disabled={!valid}
          className="inline-flex items-center gap-2 bg-cyan text-titanium font-mono text-xs uppercase px-6 py-3 hover:glow-cyan disabled:opacity-40"
        >
          <Search className="w-4 h-4" /> Continue to AR Diagnostics <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </PageShell>
  );
}

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-[10px] uppercase">{label}</dt>
      <dd className="text-data">{value || "—"}</dd>
    </div>
  );
}