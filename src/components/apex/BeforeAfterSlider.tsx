import React, { useRef, useState } from "react";
import { Image } from "@/components/ui/image";

// Draggable before/after comparison slider. Before fills the frame; After is
// clipped to the left of the handle. Pointer + keyboard (range input) driven.
export default function BeforeAfterSlider({ before, after, alt }: { before: string; after: string; alt: string }) {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);

  const update = (clientX: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const p = Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100));
    setPos(p);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    update(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (e.buttons === 0 && e.pointerType === "mouse") return;
    update(e.clientX);
  };

  return (
    <div
      ref={ref}
      className="relative w-full aspect-[4/3] overflow-hidden bg-titanium select-none cursor-ew-resize border border-cyan/20"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
    >
      {/* Before (full) */}
      <Image src={before} alt={"Before — " + alt} fittingType="fill" className="w-full h-full object-cover" />
      <span className="absolute top-3 left-3 font-mono text-[10px] uppercase tracking-widest px-2 py-1 border border-heat/40 text-heat bg-titanium/80">Before</span>

      {/* After (clipped) */}
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <Image src={after} alt={"After — " + alt} fittingType="fill" className="w-full h-full object-cover" />
        <span className="absolute top-3 right-3 font-mono text-[10px] uppercase tracking-widest px-2 py-1 border border-cyan/40 text-cyan bg-titanium/80" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>After</span>
      </div>

      {/* Handle */}
      <div className="absolute top-0 bottom-0 w-0.5 bg-cyan glow-cyan pointer-events-none" style={{ left: `${pos}%` }}>
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-titanium border border-cyan flex items-center justify-center text-cyan font-mono text-xs">⇆</div>
      </div>

      {/* Keyboard range */}
      <input
        type="range"
        min={0}
        max={100}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Reveal before/after"
        className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize"
      />
    </div>
  );
}