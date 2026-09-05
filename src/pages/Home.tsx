import React, { Suspense, lazy } from "react";
import Navbar from "@/components/apex/Navbar";
import Footer from "@/components/apex/Footer";
import FloatingCall from "@/components/apex/FloatingCall";
import Hero from "@/components/apex/Hero";
import TrustSeals from "@/components/apex/TrustSeals";
import VerifiedBadges from "@/components/apex/VerifiedBadges";
import InstallPrompt from "@/components/apex/InstallPrompt";
import DayNightAccent from "@/components/apex/DayNightAccent";
import ReconnectingBoundary from "@/components/apex/ReconnectingBoundary";
import SecureCheckoutBadge from "@/components/apex/SecureCheckoutBadge";

// Heavy 3D / diagnostic modules ship as separate chunks so the hero paints
// immediately and three.js / leaflet only load when scrolled into view.
const Pillars = lazy(() => import("@/components/apex/Pillars"));
const ProofGallery = lazy(() => import("@/components/apex/ProofGallery"));
const IntakeSection = lazy(() => import("@/components/apex/IntakeSection"));
const EngineDiagnostic = lazy(() => import("@/components/apex/EngineDiagnostic"));
const EmergencyStranded = lazy(() => import("@/components/apex/EmergencyStranded"));
const ModuleViewer3D = lazy(() => import("@/components/apex/ModuleViewer3D"));
const CarExplorer3D = lazy(() => import("@/components/apex/CarExplorer3D"));
const ArScan = lazy(() => import("@/components/apex/ArScan"));
const BehaviorEngine = lazy(() => import("@/components/apex/BehaviorEngine"));
const AudioDiagnostic = lazy(() => import("@/components/apex/AudioDiagnostic"));

function SectionFallback() {
  return (
    <div className="flex items-center justify-center py-24 bg-titanium">
      <div className="w-6 h-6 border-2 border-cyan/20 border-t-cyan rounded-full animate-spin" />
    </div>
  );
}

export default function Home() {
  return (
    <div className="bg-titanium min-h-screen">
      <Navbar />
      <main id="main-content" className="scroll-mt-16">
        <Hero />
        <TrustSeals />
        <VerifiedBadges />
        <Suspense fallback={<SectionFallback />}><Pillars /></Suspense>
        <Suspense fallback={<SectionFallback />}><EngineDiagnostic /></Suspense>
        <ReconnectingBoundary component="Vehicle 3D Explorer">
          <Suspense fallback={<SectionFallback />}><CarExplorer3D /></Suspense>
        </ReconnectingBoundary>
        <ReconnectingBoundary component="Exploded ECU 3D View">
          <Suspense fallback={<SectionFallback />}><ModuleViewer3D /></Suspense>
        </ReconnectingBoundary>
        <Suspense fallback={<SectionFallback />}><ProofGallery /></Suspense>
        <ReconnectingBoundary component="WebAR Module Scanner">
          <Suspense fallback={<SectionFallback />}><ArScan /></Suspense>
        </ReconnectingBoundary>
        <Suspense fallback={<SectionFallback />}><EmergencyStranded /></Suspense>
        <ReconnectingBoundary component="Acoustic Triage Engine">
          <Suspense fallback={<SectionFallback />}><AudioDiagnostic /></Suspense>
        </ReconnectingBoundary>
        <Suspense fallback={<SectionFallback />}><IntakeSection /></Suspense>
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 pb-12">
          <SecureCheckoutBadge />
        </div>
      </main>
      <Footer />
      <FloatingCall />
      <InstallPrompt />
      <Suspense fallback={null}><BehaviorEngine /></Suspense>
      <DayNightAccent />
    </div>
  );
}