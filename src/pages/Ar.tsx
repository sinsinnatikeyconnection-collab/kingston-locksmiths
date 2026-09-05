import React from "react";
import PageShell from "@/components/apex/PageShell";
import ArScan from "@/components/apex/ArScan";
import ThermalScanner from "@/components/apex/ThermalScanner";
import ReconnectingBoundary from "@/components/apex/ReconnectingBoundary";

export default function Ar() {
  return (
    <PageShell title="WebAR & Thermal Diagnostics" tagline="// Find It & Ship It">
      <ReconnectingBoundary component="WebAR Module Scanner">
        <ArScan />
      </ReconnectingBoundary>
      <ThermalScanner />
    </PageShell>
  );
}