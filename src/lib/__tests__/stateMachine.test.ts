import { describe, it, expect } from "vitest";
import {
  assertBookingTransition,
  assertMailInTransition,
  assertInvoiceTransition,
  canTransition,
  BOOKING_TRANSITIONS,
  MAIL_IN_TRANSITIONS,
  IllegalStateTransitionError,
} from "../stateMachine";

describe("booking transitions", () => {
  it("allows received -> reviewing", () =>
    expect(assertBookingTransition("received", "reviewing")).toBe("reviewing"));
  it("allows received -> completed (skip)", () =>
    expect(assertBookingTransition("received", "completed")).toBe("completed"));
  it("rejects completed -> received (terminal)", () =>
    expect(() => assertBookingTransition("completed", "received")).toThrow(IllegalStateTransitionError));
  it("rejects scheduled -> reviewing (backwards)", () =>
    expect(() => assertBookingTransition("scheduled", "reviewing")).toThrow());
});

describe("mail-in transitions", () => {
  it("requested -> label_ready ok", () =>
    expect(assertMailInTransition("requested", "label_ready")).toBe("label_ready"));
  it("shipped -> received ok", () =>
    expect(assertMailInTransition("shipped", "received")).toBe("received"));
  it("rejects label_ready -> requested", () =>
    expect(() => assertMailInTransition("label_ready", "requested")).toThrow());
  it("completed is terminal", () =>
    expect(() => assertMailInTransition("completed", "requested")).toThrow());
  it("transition tables are frozen (immutable)", () =>
    expect(() => {
      (MAIL_IN_TRANSITIONS as Record<string, string[]>).requested.push("completed" as never);
    }).toThrow());
});

describe("invoice transitions", () => {
  it("unpaid -> paid ok", () =>
    expect(assertInvoiceTransition("unpaid", "paid")).toBe("paid"));
  it("paid is terminal", () =>
    expect(() => assertInvoiceTransition("paid", "unpaid")).toThrow());
});

describe("canTransition", () => {
  it("true for allowed", () =>
    expect(canTransition(BOOKING_TRANSITIONS, "received", "scheduled")).toBe(true));
  it("false for disallowed", () =>
    expect(canTransition(BOOKING_TRANSITIONS, "completed", "received")).toBe(false));
});

describe("IllegalStateTransitionError", () => {
  it("carries entity/from/to and a descriptive message", () => {
    try {
      assertBookingTransition("completed", "received");
      throw new Error("expected IllegalStateTransitionError");
    } catch (e) {
      expect(e).toBeInstanceOf(IllegalStateTransitionError);
      const err = e as IllegalStateTransitionError;
      expect(err.entity).toBe("ServiceBooking");
      expect(err.from).toBe("completed");
      expect(err.to).toBe("received");
      expect(err.message).toContain("completed");
      expect(err.message).toContain("received");
    }
  });
});