import React from "react";
import PageShell from "@/components/apex/PageShell";
import PillarDetail from "@/components/apex/PillarDetail";
import DynoVisualizer from "@/components/apex/DynoVisualizer";

export default function ServicePerformance() {
  return (
    <PageShell tagline="// 03 — Horsepower Fluent">
      <PillarDetail id="performance" afterCapabilities={<DynoVisualizer />} />
    </PageShell>
  );
}