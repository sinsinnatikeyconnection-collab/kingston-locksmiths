import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Accessibility, Mic, MicOff, CalendarClock, X, Type, Volume2 } from "lucide-react";

type Nav = (to: string) => void;

export default function UniversalAccess() {
  const [open, setOpen] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [unsupported, setUnsupported] = useState(false);
  const recRef = useRef<any>(null);
  const navigate = useNavigate() as Nav;

  // restore persisted large-text preference
  useEffect(() => {
    setLargeText(localStorage.getItem("skc_large_text") === "1");
  }, []);

  // apply large-text by scaling the root font size (Tailwind rem units cascade up)
  useEffect(() => {
    document.documentElement.classList.toggle("text-lg-mode", largeText);
    localStorage.setItem("skc_large_text", largeText ? "1" : "0");
  }, [largeText]);

  const stopListening = useCallback(() => {
    try { recRef.current?.stop(); } catch { /* ignore */ }
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) { setUnsupported(true); return; }
    setUnsupported(false);
    setHeard("");
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    rec.onresult = (e: any) => {
      const txt = (e.results[0][0].transcript || "").toLowerCase();
      setHeard(txt);
      if (/mail|ship|send/.test(txt)) navigate("/mail-in");
      else if (/book|appointment|schedule|service|repair/.test(txt)) navigate("/#intake");
      else if (/call|phone|emergency|dispatch|tow/.test(txt)) window.location.href = "tel:+15135682744";
      else if (/price|quote|cost|estimate/.test(txt)) navigate("/services");
      else if (/home|start|menu/.test(txt)) navigate("/");
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { setListening(false); }
  }, [navigate]);

  useEffect(() => () => { try { recRef.current?.stop(); } catch { /* ignore */ } }, []);

  return (
    <div className="fixed bottom-4 left-4 z-40 flex flex-col items-start gap-2 select-none" data-daynight-keep>
      {open && (
        <>
          <div className="w-64 bg-titanium/95 backdrop-blur-md border border-cyan/40 p-4 shadow-[0_0_22px_rgba(0,229,255,0.18)]">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-cyan flex items-center gap-1.5">
                <Accessibility className="w-3.5 h-3.5" /> Universal Access
              </span>
              <button onClick={() => setOpen(false)} aria-label="Close access panel" className="text-muted-foreground hover:text-cyan transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Large text */}
            <button
              onClick={() => setLargeText((v) => !v)}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 border mb-2 font-mono text-[11px] uppercase tracking-wider transition-colors ${largeText ? "border-cyan text-cyan bg-cyan/10" : "border-cyan/30 text-muted-foreground hover:text-cyan"}`}
              aria-pressed={largeText}
            >
              <span className="flex items-center gap-2"><Type className="w-4 h-4" /> Large text</span>
              <span className={`text-[10px] ${largeText ? "text-cyan" : "text-muted-foreground/60"}`}>{largeText ? "ON" : "OFF"}</span>
            </button>

            {/* Quick book */}
            <button
              onClick={() => { setOpen(false); navigate("/#intake"); }}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 border border-cyan/30 mb-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground hover:text-cyan hover:border-cyan transition-colors"
            >
              <span className="flex items-center gap-2"><CalendarClock className="w-4 h-4" /> Quick book</span>
              <span className="text-[10px] text-cyan/60">→</span>
            </button>

            {/* Voice command */}
            <button
              onClick={listening ? stopListening : startListening}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 border font-mono text-[11px] uppercase tracking-wider transition-colors ${listening ? "border-heat text-heat bg-heat/10" : "border-cyan/30 text-muted-foreground hover:text-cyan hover:border-cyan"}`}
              aria-pressed={listening}
            >
              <span className="flex items-center gap-2">
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {listening ? "Stop listening" : "Voice command"}
              </span>
              {listening ? <span className="text-[10px] text-heat">●</span> : <Volume2 className="w-3.5 h-3.5 text-cyan/50" />}
            </button>

            {unsupported && (
              <p className="mt-2 font-mono text-[10px] text-heat leading-relaxed">
                Voice not supported on this device. Try Chrome on Android/desktop, or use Quick book.
              </p>
            )}
            {heard && (
              <p className="mt-2 font-mono text-[10px] text-cyan/70">heard: “{heard}”</p>
            )}
            <p className="mt-3 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/50 leading-relaxed">
              say: “book service” · “mail in” · “call dispatch” · “price” · “home”
            </p>
          </div>
        </>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open accessibility and quick actions"
        aria-expanded={open}
        className="flex items-center justify-center w-12 h-12 bg-titanium/90 border border-cyan/40 backdrop-blur-md text-cyan hover:glow-cyan transition-all"
      >
        <Accessibility className="w-5 h-5" />
      </button>
    </div>
  );
}