import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Zap, Compass } from "lucide-react";

type BehaviorKind = "rush" | "explore";
interface BehaviorPrompt { kind: BehaviorKind }

// Behavioral-AI adapter. Watches early-session signals (scroll depth, time-on-page,
// pointer velocity) and surfaces one context-adapted shortcut per session:
//  - rushed visitors → minimal emergency-booking path
//  - slow browsers → deeper interactive tech portfolio
export default function BehaviorEngine() {
  const [prompt, setPrompt] = useState<BehaviorPrompt | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(false);

  useEffect(() => {
    if (sessionStorage.getItem("skc_behavior")) return;
    const t0 = Date.now();
    let maxDepth = 0, moved = 0, samples = 0;
    const onScroll = () => { maxDepth = Math.max(maxDepth, window.scrollY); };
    const onMove = (e: MouseEvent) => {
      if (samples < 8) { moved += Math.abs(e.movementX) + Math.abs(e.movementY); samples++; }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousemove", onMove);

    const iv = window.setInterval(() => {
      const elapsed = (Date.now() - t0) / 1000;
      if (dismissed || prompt) return;
      if (elapsed > 3.5) {
        const rushed = (maxDepth > 700 && elapsed < 5) || (samples > 5 && moved / samples > 30);
        if (rushed) { setPrompt({ kind: "rush" }); sessionStorage.setItem("skc_behavior", "rush"); }
      }
      if (elapsed > 22 && !prompt) { setPrompt({ kind: "explore" }); sessionStorage.setItem("skc_behavior", "explore"); }
    }, 1000);
    return () => {
      clearInterval(iv);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onMove);
    };
  }, [prompt, dismissed]);

  if (!prompt) return null;
  const close = () => { setPrompt(null); setDismissed(true); };

  return (
    <div className="fixed bottom-4 right-4 z-40 max-w-[280px] bg-titanium/90 backdrop-blur-md border border-cyan/30 p-4 glow-cyan">
      <button onClick={close} className="absolute top-2 right-2 text-muted-foreground hover:text-heat text-xs">×</button>
      {prompt.kind === "rush" ? (
        <>
          <div className="flex items-center gap-2 font-mono text-xs uppercase text-heat mb-2"><Zap className="w-4 h-4" /> Emergency Mode</div>
          <p className="font-body text-xs text-muted-foreground mb-3">In a rush? Switch to a minimal large-button emergency booking flow.</p>
          <Link to="/#intake" onClick={close} className="block text-center bg-heat text-titanium font-mono text-xs uppercase px-4 py-2.5 hover:opacity-90">Quick Emergency Booking</Link>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 font-mono text-xs uppercase text-cyan mb-2"><Compass className="w-4 h-4" /> Take the Tour</div>
          <p className="font-body text-xs text-muted-foreground mb-3">You&rsquo;re browsing slow — dive into our interactive 3D tech portfolio and case studies.</p>
          <Link to="/#car3d" onClick={close} className="block text-center bg-cyan text-titanium font-mono text-xs uppercase px-4 py-2.5 hover:glow-cyan">Explore Tech</Link>
        </>
      )}
    </div>
  );
}