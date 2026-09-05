import React from "react";
import BookingWizard from "@/components/apex/BookingWizard";

export default function IntakeSection() {
  return (
    <section id="intake" className="relative bg-titanium border-t border-cyan/10">
      <div className="circuit-grid absolute inset-0 opacity-30 pointer-events-none" />
      <div className="relative max-w-[1400px] mx-auto px-6 lg:px-10 py-24">
        <div className="text-center mb-12">
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-cyan mb-3">
            // Intake & Triage
          </div>
          <h2 className="font-heading text-4xl sm:text-5xl uppercase text-data leading-[0.95]">
            Vehicle Diagnostic <span className="text-cyan">Initialization</span>
          </h2>
          <p className="mt-4 font-body text-sm text-muted-foreground max-w-xl mx-auto">
            This isn't a contact form — it's a structured onboarding process that
            converts your anxiety into action.
          </p>
        </div>
        <BookingWizard />
      </div>
    </section>
  );
}