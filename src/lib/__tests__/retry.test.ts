import { describe, it, expect } from "vitest";
import { withRetry } from "@base44/shared/retry";

describe("withRetry", () => {
  it("returns on first success and passes the attempt index", async () => {
    let seen = -1;
    const v = await withRetry((i) => {
      seen = i;
      return Promise.resolve("x");
    }, { baseDelay: 1 });
    expect(v).toBe("x");
    expect(seen).toBe(0);
  });

  it("retries on failure then succeeds", async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      if (calls < 3) return Promise.reject(new Error("boom"));
      return Promise.resolve("ok");
    };
    const v = await withRetry(fn, { tries: 3, baseDelay: 1 });
    expect(v).toBe("ok");
    expect(calls).toBe(3);
  });

  it("throws the last error after exhausting tries", async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      return Promise.reject(new Error(`e${calls}`));
    };
    await expect(withRetry(fn, { tries: 2, baseDelay: 1 })).rejects.toThrow("e2");
    expect(calls).toBe(2);
  });

  it("defaults to 3 tries when omitted", async () => {
    let calls = 0;
    const fn = () => {
      calls++;
      return Promise.reject(new Error("x"));
    };
    await expect(withRetry(fn, { baseDelay: 1 })).rejects.toThrow();
    expect(calls).toBe(3);
  });
});