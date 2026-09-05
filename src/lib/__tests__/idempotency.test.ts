import { describe, it, expect, beforeEach } from "vitest";
import {
  newIdempotencyKey,
  persistIdempotencyKey,
  loadIdempotencyKey,
  clearIdempotencyKey,
} from "../idempotency";

describe("idempotency keys", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("generates unique, non-empty keys", () => {
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
    expect(a).not.toBe(b);
  });

  it("persists and loads a key by form namespace", () => {
    persistIdempotencyKey("booking", "key-123");
    expect(loadIdempotencyKey("booking")).toBe("key-123");
  });

  it("returns null when no key exists", () => {
    expect(loadIdempotencyKey("nope")).toBeNull();
  });

  it("clears a key", () => {
    persistIdempotencyKey("booking", "key-123");
    clearIdempotencyKey("booking");
    expect(loadIdempotencyKey("booking")).toBeNull();
  });

  it("isolates keys across form namespaces", () => {
    persistIdempotencyKey("booking", "b1");
    persistIdempotencyKey("mailin", "m1");
    expect(loadIdempotencyKey("booking")).toBe("b1");
    expect(loadIdempotencyKey("mailin")).toBe("m1");
    clearIdempotencyKey("booking");
    expect(loadIdempotencyKey("mailin")).toBe("m1");
  });
});