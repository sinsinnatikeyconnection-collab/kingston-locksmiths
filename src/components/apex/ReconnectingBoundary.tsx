import React from "react";
import { RotateCw, Loader2 } from "lucide-react";
import { logSystemHealth } from "@/lib/logSystemHealth";

interface ReconnectingBoundaryProps {
  children: React.ReactNode;
  component: string;
}

interface ReconnectingBoundaryState {
  hasError: boolean;
  error: Error | null;
  attempts: number;
}

const MAX_AUTO_ATTEMPTS = 2;
const AUTO_RETRY_MS = 2500;

// Per-component fault containment for the advanced/heavy modules (3D viewers,
// WebAR scanner, audio triage, digital twin). If the chunk fails to lazy-load
// OR the module throws at runtime, the rest of the site stays mounted and a
// sleek branded "Reconnecting" screen takes its place with auto + manual retry.
// Must wrap *outside* any <Suspense> so lazy chunk-load rejections are caught
// here (not just runtime errors).
export default class ReconnectingBoundary extends React.Component<
  ReconnectingBoundaryProps,
  ReconnectingBoundaryState
> {
  override state: ReconnectingBoundaryState = { hasError: false, error: null, attempts: 0 };
  autoTimer: number | null = null;

  static getDerivedStateFromError(error: Error): Partial<ReconnectingBoundaryState> {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    try {
      console.error(`ReconnectingBoundary [${this.props.component}]`, error, info.componentStack);
    } catch {
      /* never let logging throw */
    }
    logSystemHealth({
      code: "RENDER_ERROR",
      message: error.message || "Component failed to render",
      stack: String(info.componentStack || error.stack || "").slice(0, 2000),
      component: this.props.component,
      action: error.message || "advanced component failed",
      severity: "error",
    });
    if (this.state.attempts < MAX_AUTO_ATTEMPTS) {
      this.autoTimer = window.setTimeout(() => {
        this.setState((s) => ({ hasError: false, error: null, attempts: s.attempts + 1 }));
      }, AUTO_RETRY_MS);
    }
  }

  override componentWillUnmount(): void {
    if (this.autoTimer) window.clearTimeout(this.autoTimer);
  }

  manualRetry = (): void => {
    this.setState((s) => ({ hasError: false, error: null, attempts: s.attempts + 1 }));
  };

  override render(): React.ReactNode {
    if (!this.state.hasError) {
      // key forces a fresh mount on each retry attempt so ephemeral WebGL /
      // camera / three.js contexts re-initialize instead of retrying into the
      // same dead state.
      return (
        <React.Fragment key={this.state.attempts}>{this.props.children}</React.Fragment>
      );
    }
    const manual = this.state.attempts >= MAX_AUTO_ATTEMPTS;
    return (
      <section className="relative bg-titanium border-t border-cyan/10 overflow-hidden">
        <div className="circuit-grid absolute inset-0 opacity-20 pointer-events-none" />
        <div className="relative max-w-[1100px] mx-auto px-6 lg:px-10 py-24 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 border border-cyan/30 rounded-full mb-6 relative">
            {!manual ? (
              <Loader2 className="w-7 h-7 text-cyan animate-spin" />
            ) : (
              <RotateCw className="w-7 h-7 text-cyan" />
            )}
            <span className="absolute inset-0 rounded-full border border-cyan/30 animate-pulse-ring" />
          </div>
          <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-cyan mb-3">
            // {this.props.component} — Reconnecting
          </div>
          <h2 className="font-heading text-2xl uppercase text-data mb-3 leading-tight">
            Re-establishing Link
          </h2>
          <p className="font-body text-sm text-muted-foreground max-w-md mx-auto mb-6">
            {manual
              ? "This module couldn't reconnect automatically. Retry to reload it — the rest of the site is unaffected."
              : "This module lost its signal. Stand by while we re-establish the connection…"}
          </p>
          {manual && (
            <button
              onClick={this.manualRetry}
              className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-cyan border border-cyan/40 px-5 py-2.5 hover:glow-cyan transition-all"
            >
              <RotateCw className="w-3.5 h-3.5" /> Retry
            </button>
          )}
        </div>
      </section>
    );
  }
}