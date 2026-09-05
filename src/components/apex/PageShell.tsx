import React from "react";
import Navbar from "@/components/apex/Navbar";
import Footer from "@/components/apex/Footer";
import FloatingCall from "@/components/apex/FloatingCall";

interface PageShellProps {
  children: React.ReactNode;
  title?: string;
  tagline?: string;
}

export default function PageShell({ children, title, tagline }: PageShellProps) {
  return (
    <div className="bg-titanium min-h-screen">
      <Navbar />
      <main className="pt-16">
        {title && (
          <section className="relative border-b border-cyan/10 overflow-hidden">
            <div className="circuit-grid absolute inset-0 opacity-30 pointer-events-none" />
            <div className="relative max-w-[1400px] mx-auto px-6 lg:px-10 py-16 pt-20">
              {tagline && (
                <div className="font-mono text-xs uppercase tracking-[0.3em] text-cyan mb-3">
                  {tagline}
                </div>
              )}
              <h1 className="font-heading text-4xl sm:text-5xl uppercase text-data leading-[0.95]">
                {title}
              </h1>
            </div>
          </section>
        )}
        {children}
      </main>
      <Footer />
      <FloatingCall />
    </div>
  );
}