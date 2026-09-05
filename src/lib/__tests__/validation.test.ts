import { describe, it, expect } from "vitest";
import {
  validateVin,
  validateEmail,
  validatePhone,
  validateNonEmpty,
  validateMinLength,
} from "../validation";

describe("validateVin", () => {
  it("accepts a valid 17-character VIN", () => {
    expect(validateVin("1FTFW1ET5DFC10312")).toEqual({ ok: true });
  });
  it("uppercases and trims input", () => {
    expect(validateVin("  1ftfw1et5dfc10312  ")).toEqual({ ok: true });
  });
  it("rejects empty input", () => {
    expect(validateVin("")).toEqual({ ok: false, error: "VIN is required." });
  });
  it("rejects non-17 length", () => {
    const r = validateVin("1FTFW1ET5DFC1031");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("17");
  });
  it("rejects forbidden characters I, O, Q", () => {
    const r = validateVin("1FTFW1ET5DFC1031Q");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/invalid characters/i);
  });
  it("is null-safe", () => {
    expect(validateVin(null as unknown as string).ok).toBe(false);
  });
});

describe("validateEmail", () => {
  it("accepts a valid email", () => expect(validateEmail("a@b.co")).toEqual({ ok: true }));
  it("trims surrounding whitespace", () => expect(validateEmail("  a@b.co  ")).toEqual({ ok: true }));
  it("rejects empty", () => expect(validateEmail("").ok).toBe(false));
  it("rejects missing @", () => expect(validateEmail("abc.com").ok).toBe(false));
  it("rejects missing domain dot", () => expect(validateEmail("a@b").ok).toBe(false));
});

describe("validatePhone", () => {
  it("accepts a formatted US phone", () => expect(validatePhone("(513) 010-1990")).toEqual({ ok: true }));
  it("accepts digits-only", () => expect(validatePhone("5130101990")).toEqual({ ok: true }));
  it("rejects empty", () => expect(validatePhone("").ok).toBe(false));
  it("rejects too few digits", () => expect(validatePhone("123").ok).toBe(false));
});

describe("validateNonEmpty", () => {
  it("accepts a non-empty value", () => expect(validateNonEmpty("Name", "John")).toEqual({ ok: true }));
  it("rejects whitespace-only", () => expect(validateNonEmpty("Name", "   ").ok).toBe(false));
  it("surfaces the field name in the error", () => {
    const r = validateNonEmpty("Name", "");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Name");
  });
});

describe("validateMinLength", () => {
  it("accepts at the threshold", () => expect(validateMinLength("Problem", "abcdef", 6)).toEqual({ ok: true }));
  it("rejects below the threshold", () => {
    const r = validateMinLength("Problem", "abc", 6);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("6");
  });
  it("singularizes the message when min is 1", () => {
    const r = validateMinLength("X", "", 1);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).not.toMatch(/characters/);
  });
});