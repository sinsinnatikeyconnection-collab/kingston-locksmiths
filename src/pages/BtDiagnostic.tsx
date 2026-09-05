import React from "react";
import PageShell from "@/components/apex/PageShell";
import BtObdScanner from "@/components/apex/BtObdScanner";
import ArScan from "@/components/apex/ArScan";

export default function BtDiagnostic() {
  return (
    <PageShell title="Bluetooth OBD2" tagline="// Live ELM327 Telemetry & DTC Scan">
      <BtObdScanner />
      <ArScan />
    </PageShell>
  );
}