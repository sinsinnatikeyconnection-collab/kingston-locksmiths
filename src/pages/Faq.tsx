import React from "react";
import PageShell from "@/components/apex/PageShell";
import DiagnosticTree from "@/components/apex/DiagnosticTree";

export default function Faq() {
  return (
    <PageShell title="Diagnostic Tree" tagline="// Interactive Triage">
      <div className="max-w-[900px] mx-auto px-6 lg:px-10 py-16">
        <p className="font-body text-sm text-muted-foreground max-w-2xl mb-8">
          Skip the FAQ. Walk our diagnostic decision tree — answer a few questions and we'll route you to the exact
          service you need. This is the same professional thought process we use on the bench, so you see how
          complex the routing really is.
        </p>
        <DiagnosticTree />
      </div>
    </PageShell>
  );
}