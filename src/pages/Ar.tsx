import React from "react";
import PageShell from "@/components/apex/PageShell";
import ArScan from "@/components/apex/ArScan";
import ReconnectingBoundary from "@/components/apex/ReconnectingBoundary";

export default function Ar() {
  return (
    <PageShell title="WebAR Locator" tagline="// Find It & Ship It">
      <ReconnectingBoundary component="WebAR Module Scanner">
        <ArScan />
      </ReconnectingBoundary>
    </PageShell>
  );
}