import React, { useMemo } from "react";
import { ShieldAlert, RefreshCw } from "lucide-react";

export interface SystemHealthLog {
  id: string;
  created_date?: string;
  code: string;
  message: string;
  stack?: string;
  component: string;
  action?: string;
  severity: string;
  source?: string;
}

const SEV_STYLE: Record<string, string> = {
  info: "border-cyan/30 text-cyan",
  warning: "border-yellow-400/50 text-yellow-400",
  error: "border-heat/50 text-heat",
  critical: "border-heat text-heat glow-heat",
};

// Admin "System Health" panel — surfaces silent failures logged from frontend
// error boundaries and external backend calls (NHTSA VIN, EasyPost shipping,
// Wix Payments) so the operator sees the exact code, the affected component,
// the contextual action, the full stack, and when it happened.
export default function SystemHealthPanel({ logs }: { logs: SystemHealthLog[] }) {
  const critical = useMemo(
    () => logs.filter((l) => l.severity === "critical" || l.severity === "error").length,
    [logs]
  );
  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-px bg-cyan/10 border border-cyan/10 mb-6">
        <div className="bg-titanium p-4">
          <div className="font-mono text-3xl font-bold text-cyan">{logs.length}</div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Total Events</div>
        </div>
        <div className="bg-titanium p-4">
          <div className="font-mono text-3xl font-bold text-heat">{critical}</div>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Errors / Critical</div>
        </div>
        <div className="bg-titanium p-4 hidden md:block">
          <div className="flex items-center gap-2 h-full">
            <ShieldAlert className="w-5 h-5 text-heat shrink-0" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground leading-snug">
              Silent failures auto-logged from frontend boundaries + backend external calls (VIN / shipping / payments).
            </span>
          </div>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="border border-dashed border-cyan/20 py-16 text-center">
          <ShieldAlert className="w-10 h-10 text-muted-foreground/40 mx-auto mb-4" />
          <div className="font-mono text-xs uppercase tracking-wider text-muted-foreground">No system faults logged. All systems nominal.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((l) => (
            <div key={l.id} className="border border-cyan/15 bg-titanium px-4 py-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="font-mono text-xs text-heat">{l.code}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  {l.source && <span className="font-mono text-[9px] uppercase text-muted-foreground">{l.source}</span>}
                  <span className={`font-mono text-[10px] uppercase px-2 py-0.5 border ${SEV_STYLE[l.severity] || SEV_STYLE.error}`}>
                    {l.severity}
                  </span>
                  {l.created_date && (
                    <span className="font-mono text-[10px] text-muted-foreground/60">
                      {new Date(l.created_date).toLocaleString("en-US", { timeZone: "America/New_York" })}
                    </span>
                  )}
                </div>
              </div>
              <div className="font-mono text-[11px] text-muted-foreground mt-1 break-words">
                {l.component}{l.action ? " · " + l.action : ""}
              </div>
              <div className="font-body text-sm text-data mt-1 break-words">{l.message}</div>
              {l.stack && (
                <pre className="font-mono text-[10px] text-muted-foreground/60 mt-2 whitespace-pre-wrap break-all max-h-40 overflow-y-auto border-t border-cyan/10 pt-2">
                  {l.stack}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4">
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground border border-cyan/20 px-3 py-2 hover:text-cyan transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>
    </div>
  );
}