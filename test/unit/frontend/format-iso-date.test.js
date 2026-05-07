import { describe, expect, test } from "bun:test";
import { formatIsoDate } from "#public/utils/format-iso-date.js";

describe("formatIsoDate", () => {
  test("formats a single-digit day without leading zero", () => {
    expect(formatIsoDate("2026-05-07")).toBe("7 May 2026");
  });

  test("formats a two-digit day", () => {
    expect(formatIsoDate("2026-12-25")).toBe("25 December 2026");
  });

  test("uses full month names for every month", () => {
    expect(formatIsoDate("2025-01-15")).toBe("15 January 2025");
    expect(formatIsoDate("2025-02-15")).toBe("15 February 2025");
    expect(formatIsoDate("2025-03-15")).toBe("15 March 2025");
    expect(formatIsoDate("2025-04-15")).toBe("15 April 2025");
    expect(formatIsoDate("2025-06-15")).toBe("15 June 2025");
    expect(formatIsoDate("2025-07-15")).toBe("15 July 2025");
    expect(formatIsoDate("2025-08-15")).toBe("15 August 2025");
    expect(formatIsoDate("2025-09-15")).toBe("15 September 2025");
    expect(formatIsoDate("2025-10-15")).toBe("15 October 2025");
    expect(formatIsoDate("2025-11-15")).toBe("15 November 2025");
  });

  test("does not shift dates due to timezone offset", () => {
    expect(formatIsoDate("2026-01-01")).toBe("1 January 2026");
    expect(formatIsoDate("2026-12-31")).toBe("31 December 2026");
  });

  test("throws on a non-ISO string", () => {
    expect(() => formatIsoDate("07/05/2026")).toThrow("Invalid ISO date");
  });

  test("throws on an empty string", () => {
    expect(() => formatIsoDate("")).toThrow("Invalid ISO date");
  });

  test("throws on a partial date", () => {
    expect(() => formatIsoDate("2026-05")).toThrow("Invalid ISO date");
  });
});
