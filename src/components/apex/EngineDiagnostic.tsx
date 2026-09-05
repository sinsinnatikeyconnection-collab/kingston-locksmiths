import db from "@/api/base44Client";

import React, { useState } from "react";

import { Link } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Activity, ChevronRight, AlertTriangle } from "lucide-react";

interface DiagnosticResult {
  confidence?: string;
  cause?: string;
  summary?: string;
  book_cta?: string;
  category?: string;
}

export default function EngineDiagnostic() {
  const { toast } = useToast();
  const [symptoms, setSymptoms] = useState<string>("");
  const [vehicle, setVehicle] = useState<string>("");
  const [media, setMedia] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string>("");
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);

  const onFile = (file: File | null) => {
    if (!file) return;
    setMedia(file);
    setMediaUrl(URL.createObjectURL(file));
  };

  const analyze = async () => {
    if (symptoms.trim().length < 6) {
      toast({ title: "Describe the symptom", description: "Tell us what the car is doing.", variant: "destructive" });
      return;
    }
    setAnalyzing(true);
    setResult(null);
    try {
      let fileUrls: string[] | null = null;
      if (media) {
        const up = await db.integrations.Core.UploadFile({ file: media });
        fileUrls = [up.file_url];
      }
      const res = await db.functions.invoke("aiService", {
        kind: "diagnostic",
        symptoms: `${vehicle ? "Vehicle: " + vehicle + ". " : ""}${symptoms}`,
        fileUrls,
      });
      setResult((res?.data?.result as DiagnosticResult) || null);
    } catch (e) {
      toast({ title: "Analysis failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <section id="engineai" className="relative bg-titanium border-t border-cyan/10">
      <div className="circuit-grid absolute inset-0 opacity-20 pointer-events-none" />
      <div className="relative max-w-[1100px] mx-auto px-6 lg:px-10 py-24">
        <div className="flex items-center gap-3 mb-4">
          <Activity className="w-5 h-5 text-cyan" />
          <span className="font-mono text-xs uppercase tracking-[0.3em] text-cyan">// AI Engine Diagnostic Bench</span>
        </div>
        <h2 className="font-heading text-4xl sm:text-5xl uppercase text-data leading-[0.95] mb-4">
          Let AI <span className="text-cyan">Hear</span> Your Engine
        </h2>
        <p className="font-body text-sm text-muted-foreground max-w-2xl mb-10">
          Record or upload a 10-second clip of your engine knock, idle, or a video of flickering dash lights.
          Describe what's happening — our trained diagnostic model returns an estimated root cause and the exact
          repair to book. (AI estimate — always confirm in person before driving.)
        </p>

        <div className="grid lg:grid-cols-2 gap-8">
          <div className="bg-blueprint/40 border border-cyan/20 p-6">
            <label className="font-mono text-[11px] uppercase tracking-wider text-cyan mb-2 block">Vehicle (optional)</label>
            <input
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              placeholder="2018 Ford F-150"
              className="w-full bg-titanium border border-cyan/20 px-4 py-3 font-body text-sm text-data focus:border-cyan focus:outline-none mb-4"
            />
            <label className="font-mono text-[11px] uppercase tracking-wider text-cyan mb-2 block">Describe the symptom</label>
            <textarea
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              rows={4}
              placeholder="Engine knock when cold, dash lights flicker, won't start after sitting…"
              className="w-full bg-titanium border border-cyan/20 px-4 py-3 font-body text-sm text-data focus:border-cyan focus:outline-none resize-none mb-4"
            />
            <label className="font-mono text-[11px] uppercase tracking-wider text-cyan mb-2 block">Upload audio / video (optional)</label>
            <div className="flex items-center gap-4">
              <label className="flex flex-col items-center justify-center gap-2 border border-dashed border-cyan/30 px-6 py-5 cursor-pointer hover:border-cyan/60 hover:bg-cyan/5 transition-all text-center">
                <span className="font-mono text-[11px] text-muted-foreground">{media ? media.name.slice(0, 28) : "Choose media file"}</span>
                <span className="font-mono text-[10px] text-muted-foreground/60">mp3 / wav / mp4 / webm — 25MB max</span>
                <input type="file" accept="audio/*,video/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
              </label>
            </div>
            {mediaUrl && (media?.type?.startsWith("video/") ? (
              <video src={mediaUrl} muted controls className="w-full mt-4 border border-cyan/20 max-h-40 object-cover" />
            ) : (
              <audio src={mediaUrl} controls className="w-full mt-4" />
            ))}
            <button
              onClick={analyze}
              disabled={analyzing}
              className="mt-6 w-full flex items-center justify-center gap-2 bg-cyan text-titanium font-mono text-xs uppercase tracking-wider px-6 py-3.5 hover:glow-cyan transition-all disabled:opacity-50"
            >
              {analyzing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing frequency…</> : <><Activity className="w-4 h-4" /> Run AI Diagnosis</>}
            </button>
          </div>

          <div className="bg-titanium border border-cyan/20 p-6 min-h-[300px]">
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-4">// Diagnostic Output</div>
            {!result && !analyzing && (
              <div className="text-center text-muted-foreground/50 font-mono text-sm py-16">awaiting input…</div>
            )}
            {analyzing && (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-4 bg-cyan/5 animate-pulse" style={{ width: `${100 - i * 18}%` }} />
                ))}
              </div>
            )}
            {result && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 text-[10px] font-mono uppercase border ${result.confidence === "high" ? "border-cyan text-cyan" : result.confidence === "medium" ? "border-yellow-500 text-yellow-500" : "border-muted-foreground text-muted-foreground"}`}>
                    {result.confidence || "low"} confidence
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">AI ESTIMATE</span>
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase text-cyan mb-1">// Likely Cause</div>
                  <p className="font-body text-sm text-data leading-relaxed">{result.cause}</p>
                </div>
                <div>
                  <div className="font-mono text-[10px] uppercase text-cyan mb-1">// Plain English</div>
                  <p className="font-body text-sm text-muted-foreground leading-relaxed">{result.summary}</p>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <AlertTriangle className="w-4 h-4 text-heat" />
                  <span className="font-mono text-[10px] text-muted-foreground">{result.book_cta}</span>
                </div>
                <Link to={`/#intake`} className="mt-2 inline-flex items-center gap-1.5 bg-cyan text-titanium font-mono text-xs uppercase tracking-wider px-5 py-3 hover:glow-cyan transition-all">
                  Book {result.category?.replace(" & Diagnostics", "") || "this repair"} <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}