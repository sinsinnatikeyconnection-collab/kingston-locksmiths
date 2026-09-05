import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronRight } from "lucide-react";

interface Dest { label: string; to: string }

const DESTS: Dest[] = [
  { label: "Home", to: "/" },
  { label: "Services", to: "/services" },
  { label: "Service Areas", to: "/service-areas" },
  { label: "Reviews", to: "/testimonials" },
  { label: "FAQ", to: "/faq" },
  { label: "Knowledge Base", to: "/knowledge" },
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
  { label: "Mail-In Service", to: "/mail-in" },
  { label: "VIN Diagnostics", to: "/diagnostics" },
  { label: "VIN Scan", to: "/vin-scan" },
  { label: "AR Scanner", to: "/ar" },
  { label: "Bluetooth OBD2", to: "/bt-diagnostic" },
  { label: "Customer Portal", to: "/portal" },
  { label: "Book a Service", to: "/#intake" },
  { label: "Emergency Dispatch", to: "/#emergency" },
];

export default function SiteSearch({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const results = q.trim()
    ? DESTS.filter((d) => d.label.toLowerCase().includes(q.trim().toLowerCase()))
    : DESTS;

  const go = (d: Dest) => {
    setOpen(false);
    setQ("");
    if (d.to.includes("#")) {
      const [path, hash] = d.to.split("#");
      navigate(path || "/");
      setTimeout(() => { window.location.hash = hash; }, 60);
    } else {
      navigate(d.to);
    }
  };

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <button onClick={() => setOpen((o) => !o)} aria-label="Search site" className="flex items-center justify-center w-9 h-9 text-muted-foreground hover:text-cyan transition-colors border border-cyan/20 hover:border-cyan/50">
        <Search className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-[88vw] max-w-sm bg-titanium/95 backdrop-blur-md border border-cyan/30 glow-cyan p-3">
          <div className="flex items-center gap-2 border border-cyan/20 px-2 py-1.5 mb-2">
            <Search className="w-3.5 h-3.5 text-cyan/60 shrink-0" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search the site…"
              className="flex-1 bg-transparent text-sm text-data placeholder:text-muted-foreground focus:outline-none"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto divide-y divide-cyan/10">
            {results.length === 0 && (
              <li className="font-mono text-[11px] text-muted-foreground px-2 py-3">No matches.</li>
            )}
            {results.map((d) => (
              <li key={d.to}>
                <button onClick={() => go(d)} className="w-full flex items-center justify-between px-2 py-2.5 group">
                  <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground group-hover:text-cyan">{d.label}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-cyan/40 group-hover:text-cyan" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}