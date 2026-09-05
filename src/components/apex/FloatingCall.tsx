import React, { useState, useEffect } from "react";
import { Phone, X } from "lucide-react";

interface PhoneLine {
  label: string;
  value: string;
  tel: string;
}

const NUMBERS: PhoneLine[] = [
  { label: "Primary", value: "513-568-2744", tel: "+15135682744" },
  { label: "Secondary", value: "812-571-5765", tel: "+18125715765" },
];

export default function FloatingCall() {
  const [open, setOpen] = useState<boolean>(false);
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-5 z-50 flex flex-col items-end gap-3 transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none"
      }`}
    >
      {open && (
        <div className="flex flex-col gap-2 bg-titanium border border-cyan/40 p-3 w-56 shadow-lg">
          <div className="font-mono text-[10px] uppercase tracking-widest text-cyan mb-1 px-1">
            // Emergency Dispatch
          </div>
          {NUMBERS.map((n) => (
            <a
              key={n.tel}
              href={`tel:${n.tel}`}
              className="flex items-center justify-between px-3 py-2.5 border border-cyan/20 hover:border-cyan hover:bg-cyan/5 transition-all"
            >
              <div>
                <div className="font-mono text-[9px] uppercase text-muted-foreground">{n.label}</div>
                <div className="font-mono text-sm text-data">{n.value}</div>
              </div>
              <Phone className="w-4 h-4 text-cyan" />
            </a>
          ))}
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 bg-cyan text-titanium px-4 py-3 shadow-lg hover:glow-cyan transition-all ${
          open ? "bg-heat text-titanium glow-heat" : ""
        }`}
        aria-label="Call Sinsinnati Key Connection"
      >
        {open ? <X className="w-5 h-5" /> : <Phone className="w-5 h-5" />}
        {!open && <span className="font-mono text-xs uppercase tracking-wider font-bold hidden sm:inline">Call Now</span>}
      </button>
    </div>
  );
}