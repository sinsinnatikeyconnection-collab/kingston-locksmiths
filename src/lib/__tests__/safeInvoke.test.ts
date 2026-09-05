import { describe, it, expect } from "vitest";
import { safeInvoke } from "../safeInvoke";

describe("safeInvoke", () => {
  it("returns the value on first success", async () => {
    expect(await safeInvoke(() => Promise.resolve(42))).toEqual({ ok: true, value: 42 });
  });

  it("retries network dropouts (TypeError) then succeeds", async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 2) throw new TypeError("Failed to fetch");
      return "ok";
    };
    const res = await safeInvoke(fn, { retries: 2, baseMs: 1 });
    expect(calls).toBe(2);
    expect(res).toEqual({ ok: true, value: "ok" });
  });

  it("retries AbortError then succeeds", async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 2) throw new DOMException("aborted", "AbortError");
      return 1;
    };
    const res = await safeInvoke(fn, { retries: 2, baseMs: 1 });
    expect(calls).toBe(2);
    expect(res).toEqual({ ok: true, value: 1 });
  });

  it("does NOT retry non-network errors and is not retryable", async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      throw new Error("validation bad");
    };
    const res = await safeInvoke(fn, { retries: 3 });
    expect(calls).toBe(1);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.retryable).toBe(false);
      expect(res.error).toBe("validation bad");
    }
  });

  it("exhausts retries and returns a retryable Err", async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      throw new TypeError("Failed to fetch");
    };
    const res = await safeInvoke(fn, { retries: 2, baseMs: 1 });
    expect(calls).toBe(3);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.retryable).toBe(true);
  });
});