
import React, { useRef, useState } from "react";
import { ChevronRight, Phone, MousePointer2 } from "lucide-react";
import { Image } from "@/components/ui/image";

const HERO_IMG =
  "/automotive-service.svg";

interface SpotPos { x: number; y: number }

const CORNERS = [
  "top-6 left-6 border-t border-l",
  "top-6 right-6 border-t border-r",
  "bottom-6 left-6 border-b border-l",
  "bottom-6 right-6 border-b border-r",
];

export default function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<SpotPos>({ x: 50, y: 50 });

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <section
      id="top"
      ref={ref}
      onMouseMove={onMove}
      className="relative min-h-screen w-full overflow-hidden flex items-center justify-center bg-titanium"
    >
      {/* base circuit image */}
      <Image
        src={HERO_IMG}
        alt="ECU circuit board under probe"
        fittingType="fill"
        className="absolute inset-0 w-full h-full object-cover opacity-40"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-titanium via-titanium/60 to-titanium/80" />

      {/* X-ray flashlight effect */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle 320px at ${pos.x}% ${pos.y}%, rgba(0,229,255,0.18), transparent 70%)`,
        }}
      />
      {/* circuit grid */}
      <div className="pointer-events-none absolute inset-0 circuit-grid opacity-50" />

      {/* corner brackets */}
      {CORNERS.map((c) => (
        <span key={c} className={`absolute w-8 h-8 border-cyan/40 ${c}`} />
      ))}

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-2 mb-7 font-mono text-[11px] uppercase tracking-[0.3em] text-cyan/80 border border-cyan/30 px-3 py-1.5">
          <span className="w-1.5 h-1.5 bg-cyan rounded-full animate-pulse" />
          Sinsinnati Key Connection // Cincinnati, OH
        </div>

        <h1 className="font-heading text-5xl sm:text-7xl lg:text-8xl uppercase text-data leading-[0.95] tracking-tighter">
          <span data-i18n="hero_h1_a">Total Vehicle</span>
          <br />
          <span data-i18n="hero_h1_b" className="text-transparent [-webkit-text-stroke:2px_#00E5FF] text-glow-cyan">
            Domination
          </span>
        </h1>

        <p data-i18n="hero_sub" className="mt-8 max-w-2xl mx-auto font-body text-base sm:text-lg text-muted-foreground leading-relaxed">
          Lost car keys, immobilizer lockouts, ECU cloning & EEPROM programming,
          full electrical diagnostics, custom tuning, and complete mechanical
          teardowns. We control every wire, every chip, and every bolt.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#intake"
            className="group flex items-center gap-2 bg-cyan text-titanium font-mono text-sm uppercase tracking-wider px-7 py-4 hover:glow-cyan transition-all"
          >
            <span data-i18n="hero_cta_init">Initialize System</span>
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </a>
          <a
            href="tel:+15135682744"
            className="group flex items-center gap-2 border border-heat text-heat font-mono text-sm uppercase tracking-wider px-7 py-4 hover:glow-heat transition-all"
          >
            <Phone className="w-4 h-4 group-hover:rotate-12 transition-transform" />
            <span data-i18n="hero_cta_emerg">Emergency Override</span>
          </a>
        </div>

        <div className="mt-16 flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
          <MousePointer2 className="w-3 h-3" />
          <span data-i18n="hero_helper">Move cursor to scan beneath the surface</span>
        </div>
      </div>

      {/* bitstream side bars */}
      <div className="pointer-events-none absolute top-0 left-0 w-px h-full overflow-hidden">
        <div className="w-px h-20 bg-gradient-to-b from-transparent via-cyan to transparent animate-bitstream" />
      </div>
      <div className="pointer-events-none absolute top-0 right-0 w-px h-full overflow-hidden">
        <div className="w-px h-20 bg-gradient-to-b from-transparent via-cyan to transparent animate-bitstream" style={{ animationDelay: "2s" }} />
      </div>
    </section>
  );
}