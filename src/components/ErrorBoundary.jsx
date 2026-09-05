import React from "react";
import { logSystemHealth } from "@/lib/logSystemHealth";

// Global React error boundary. Any uncaught render/lifecycle/lazy-load error
// is contained here so the application interface can never fully white-screen.
// The rest of the tree stays mounted at the provider level (auth, router, toasts)
// and the user gets a one-tap recovery path.

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Vite stale-chunk failure after a redeploy: a tab holding an old
    // index.html 404s on the old hashed chunk name. Auto-reload once so the
    // browser fetches the fresh hashes; this self-heals, so skip logging a
    // critical alert that would only spam the admin inbox for a transient
    // deployment-cache mismatch.
    const msg = String((error && error.message) || "");
    if (/failed to fetch dynamically imported module|importing a module script failed|failed to fetch .*\.js/i.test(msg)) {
      try {
        if (!sessionStorage.getItem("skc_chunk_reload_attempt")) {
          sessionStorage.setItem("skc_chunk_reload_attempt", "1");
          window.location.reload();
          return;
        }
      } catch (_) { /* fall through to log + show recovery UI */ }
    }
    // Best-effort logging only — never rethrow, never propagate.
    try {
      console.error("ErrorBoundary caught:", error, info && info.componentStack);
      logSystemHealth({
        code: "APP_FATAL",
        message: (error && error.message) || "Unhandled render fault",
        stack: String((info && info.componentStack) || (error && error.stack) || "").slice(0, 2000),
        component: "RootErrorBoundary",
        action: (error && error.message) || "root tree failed",
        severity: "critical",
      });
    } catch (_e) {
      /* swallowing the logger must never create a new failure */
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex items-center justify-center bg-titanium px-6"
          style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="max-w-md text-center border border-cyan/20 bg-blueprint/40 p-8">
            <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-cyan mb-3">
              // Runtime Fault Contained
            </div>
            <h2 className="font-heading text-2xl uppercase text-data mb-3">
              Something broke — app still alive
            </h2>
            <p className="font-body text-sm text-muted-foreground mb-6">
              A component failed while rendering. The rest of the application is
              unaffected. Retry to reload this view, or return home to continue.
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={this.reset}
                className="font-mono text-xs uppercase tracking-wider text-cyan border border-cyan/40 px-5 py-2.5 hover:glow-cyan transition-all"
              >
                Retry
              </button>
              <a
                href="/"
                className="font-mono text-xs uppercase tracking-wider text-muted-foreground border border-cyan/20 px-5 py-2.5 hover:text-cyan transition-all"
              >
                Home
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}