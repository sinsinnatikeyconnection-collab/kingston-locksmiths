import db from "@/api/apiClient";


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
  // Ghost-report guard: if a caller passes an entry with no message AND no
  // code, there is nothing to report — skip the network call entirely so a
  // misbehaving reporter can't generate a blank "FRONTEND_FAULT" admin alert.
  const hasMessage = !!(entry.message && String(entry.message).trim());
  const hasCode = !!(entry.code && String(entry.code).trim());
  if (!hasMessage && !hasCode) return;
  const msgSlice = hasMessage ? String(entry.message).slice(0, 80) : "";
  const key = entry.component + "|" + entry.code + "|" + msgSlice;
  if (seen.has(key)) return;
  seen.add(key);
  try {
    void db.functions
      .invoke("logSystemHealth", { ...entry, source: "frontend" })
      .catch(() => {
        /* logging never surfaces to the user */
      });
  } catch {
    /* ignore */
  }
}