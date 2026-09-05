import React from "react";
import PageShell from "@/components/apex/PageShell";
import KbSearch from "@/components/apex/KbSearch";

export default function KnowledgeBase() {
  return (
    <PageShell title="Knowledge Base" tagline="// Searchable AI FAQ">
      <section className="max-w-[900px] mx-auto px-6 lg:px-10 py-16">
        <p className="font-body text-sm text-muted-foreground max-w-2xl mb-8">
          Search curated answers from our technicians, filter by service category,
          or hand any question to the SKC AI concierge for an instant, expert reply.
        </p>
        <KbSearch />
      </section>
    </PageShell>
  );
}