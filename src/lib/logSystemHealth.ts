import { base44 } from "@/api/base44Client";

export type HealthSeverity = "info" | "warning" | "error" | "critical";

export interface SystemHealthLogEntry {
  code: string;
  message: string;
  stack?: string;
  component: string;
  action?: string;
  severity?: HealthSeverity;
}

// Best-effort, deduped client-side error reporter. Repeated identical faults
// within a session are collapsed so a broken component doesn't spam the Admin
// inbox or the System Health log. Never throws — fire-and-forget from error
// boundaries, so reporting can never itself become a new crash source.
const seen = new Set<string>();

export function logSystemHealth(entry: SystemHealthLogEntry): void {
  const key = entry.component + "|" + entry.code + "|" + entry.message.slice(0, 80);
  if (seen.has(key)) return;
  seen.add(key);
  try {
    void base44.functions
      .invoke("logSystemHealth", { ...entry, source: "frontend" })
      .catch(() => {
        /* logging never surfaces to the user */
      });
  } catch {
    /* ignore */
  }
}