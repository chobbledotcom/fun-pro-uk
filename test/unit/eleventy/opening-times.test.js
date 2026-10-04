import { describe, expect, test } from "bun:test";
import {
  configureOpeningTimes,
  renderOpeningTimes,
} from "#eleventy/opening-times.js";
import { createMockEleventyConfig } from "#test/test-utils.js";

describe("opening-times", () => {
  test("Returns empty string for empty array", async () => {
    const result = await renderOpeningTimes([]);
    expect(result).toBe("");
  });

  test("Returns empty string for null input", async () => {
    const result = await renderOpeningTimes(null);
    expect(result).toBe("");
  });

  test("Returns empty string for undefined input", async () => {
    const result = await renderOpeningTimes(undefined);
    expect(result).toBe("");
  });

  test("Registers opening_times shortcode", () => {
    const mockConfig = createMockEleventyConfig();
    configureOpeningTimes(mockConfig);

    expect(typeof mockConfig.asyncShortcodes.opening_times).toBe("function");
  });
});
