// Deterministic, immutable state-transition tables.
//
// Every allowed status transition is declared explicitly; any transition not
// in the table throws IllegalStateTransitionError. This is the single source
// of truth for status changes — both UI and backend call the assert* helpers
// before persisting, so a stored status can never drift into an illegal state
// and the frontend can never render a status the backend would reject.

export type BookingStatus = "received" | "reviewing" | "scheduled" | "completed";
export type MailInStatus =
  | "requested"
  | "label_ready"
  | "shipped"
  | "received"
  | "in_progress"
  | "shipped_back"
  | "completed";
export type InvoiceStatus = "unpaid" | "paid";

function freezeTransitions<S extends string>(table: Record<S, S[]>): Readonly<Record<S, readonly S[]>> {
  Object.values(table).forEach((transitions) => Object.freeze(transitions));
  return Object.freeze(table);
}

export const BOOKING_TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = freezeTransitions<BookingStatus>({
  received: ["reviewing", "scheduled", "completed"],
  reviewing: ["scheduled", "completed"],
  scheduled: ["completed"],
  completed: [],
});

export const MAIL_IN_TRANSITIONS: Readonly<Record<MailInStatus, readonly MailInStatus[]>> = freezeTransitions<MailInStatus>({
  requested: ["label_ready", "shipped", "received", "in_progress"],
  label_ready: ["shipped", "received"],
  shipped: ["received"],
  received: ["in_progress", "shipped_back"],
  in_progress: ["shipped_back", "completed"],
  shipped_back: ["completed"],
  completed: [],
});

export const INVOICE_TRANSITIONS: Readonly<Record<InvoiceStatus, readonly InvoiceStatus[]>> = freezeTransitions<InvoiceStatus>({
  unpaid: ["paid"],
  paid: [],
});

export class IllegalStateTransitionError extends Error {
  constructor(
    public readonly entity: string,
    public readonly from: string,
    public readonly to: string,
  ) {
    super(`Illegal ${entity} status transition: ${from} → ${to}`);
    this.name = "IllegalStateTransitionError";
  }
}

function assertTransition<S extends string>(
  entity: string,
  table: Readonly<Record<S, readonly S[]>>,
  from: S,
  to: S,
): S {
  const allowed = table[from];
  if (!allowed || !allowed.includes(to)) {
    throw new IllegalStateTransitionError(entity, from, to);
  }
  return to;
}

export function assertBookingTransition(from: BookingStatus, to: BookingStatus): BookingStatus {
  return assertTransition("ServiceBooking", BOOKING_TRANSITIONS, from, to);
}

export function assertMailInTransition(from: MailInStatus, to: MailInStatus): MailInStatus {
  return assertTransition("MailInRequest", MAIL_IN_TRANSITIONS, from, to);
}

export function assertInvoiceTransition(from: InvoiceStatus, to: InvoiceStatus): InvoiceStatus {
  return assertTransition("Invoice", INVOICE_TRANSITIONS, from, to);
}

export function canTransition<S extends string>(
  table: Readonly<Record<S, readonly S[]>>,
  from: S,
  to: S,
): boolean {
  return !!table[from]?.includes(to);
}