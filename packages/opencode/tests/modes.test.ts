import { describe, it, expect } from "vite-plus/test";
import { detectMode, stripKeyword, getModeMarker, getModePrompt } from "../src/modes/index.js";
import type { ModeResult } from "../src/modes/types.js";

// ---------------------------------------------------------------------------
// detectMode
// ---------------------------------------------------------------------------
describe("detectMode", () => {
  it("detects keyword at start of message", () => {
    const result = detectMode("fein build the feature");
    expect(result).not.toBeNull();
    expect(result!.mode).toBe("fein");
    expect(result!.keyword).toBe("fein");
    expect(result!.index).toBe(0);
  });

  it("detects keyword in middle of message", () => {
    const result = detectMode("let's sonar this design");
    expect(result).not.toBeNull();
    expect(result!.mode).toBe("sonar");
    expect(result!.keyword).toBe("sonar");
    expect(result!.index).toBe(6);
  });

  it("detects keyword at end of message", () => {
    const result = detectMode("implement it blitz");
    expect(result).not.toBeNull();
    expect(result!.mode).toBe("blitz");
    expect(result!.keyword).toBe("blitz");
  });

  it("rightmost wins with multiple keywords", () => {
    const result = detectMode("fein research then blitz implement");
    expect(result).not.toBeNull();
    expect(result!.mode).toBe("blitz");
    expect(result!.index).toBe(19);
  });

  it("returns null when no keyword present", () => {
    const result = detectMode("please implement this feature");
    expect(result).toBeNull();
  });

  it("is case insensitive (FEIN, Sonar, BLITZ)", () => {
    const r1 = detectMode("FEIN uppercase");
    expect(r1).not.toBeNull();
    expect(r1!.mode).toBe("fein");

    const r2 = detectMode("Sonar title case");
    expect(r2).not.toBeNull();
    expect(r2!.mode).toBe("sonar");

    const r3 = detectMode("uppercase BLITZ");
    expect(r3).not.toBeNull();
    expect(r3!.mode).toBe("blitz");
  });

  it("does not match inside word boundaries (feinish, dfein, blitzkrieg)", () => {
    expect(detectMode("feinish the work")).toBeNull();
    expect(detectMode("dfein research")).toBeNull();
    expect(detectMode("blitzkrieg attack")).toBeNull();
  });

  it("does not match inside fenced code blocks", () => {
    const text = "```blitz this```";
    const result = detectMode(text);
    expect(result).toBeNull();
  });

  it("detects keyword outside code block correctly", () => {
    const text = "some code:\n```\nconst x = 1;\n```\nfein then build";
    const result = detectMode(text);
    expect(result).not.toBeNull();
    expect(result!.mode).toBe("fein");
  });

  it("does not match inside inline backtick content", () => {
    const text = "run `blitz` command";
    const result = detectMode(text);
    expect(result).toBeNull();
  });

  it("matches hyphenated keyword (sonar-like)", () => {
    // Hyphen is a non-word char boundary, so `sonar` in `sonar-like` matches
    const result = detectMode("sonar-like exploration");
    expect(result).not.toBeNull();
    expect(result!.mode).toBe("sonar");
  });

  it("respects disabled keywords", () => {
    const result = detectMode("fein research then blitz build", new Set(["blitz"]));
    expect(result).not.toBeNull();
    expect(result!.mode).toBe("fein");
  });

  it("returns null when all keywords disabled", () => {
    const result = detectMode("fein research", new Set(["fein", "sonar", "blitz"]));
    expect(result).toBeNull();
  });

  it("handles empty string", () => {
    const result = detectMode("");
    expect(result).toBeNull();
  });

  it("detects keyword with trailing colon", () => {
    const result = detectMode("fein: build the feature");
    expect(result).not.toBeNull();
    expect(result!.mode).toBe("fein");
    expect(result!.index).toBe(0);
    expect(result!.keyword).toBe("fein");
  });

  it("returns prompt and marker in result", () => {
    const result = detectMode("sonar research this");
    expect(result).not.toBeNull();
    expect(result!.prompt).toBeTruthy();
    expect(result!.marker).toBe("[MODE: sonar]");
  });
});

// ---------------------------------------------------------------------------
// stripKeyword
// ---------------------------------------------------------------------------
describe("stripKeyword", () => {
  function makeResult(
    mode: "fein" | "sonar" | "blitz",
    keyword: string,
    index: number,
  ): ModeResult {
    return {
      mode,
      keyword,
      index,
      prompt: getModePrompt(mode),
      marker: getModeMarker(mode),
    };
  }

  it("removes keyword from start", () => {
    const text = "fein build the feature";
    const result = makeResult("fein", "fein", 0);
    expect(stripKeyword(text, result)).toBe("build the feature");
  });

  it("removes keyword from middle, collapsing double spaces", () => {
    const text = "let's sonar research this";
    const result = makeResult("sonar", "sonar", 6);
    expect(stripKeyword(text, result)).toBe("let's research this");
  });

  it("removes keyword from end, trimming trailing whitespace", () => {
    const text = "implement it blitz";
    const result = makeResult("blitz", "blitz", 13);
    expect(stripKeyword(text, result)).toBe("implement it");
  });

  it("trims extra whitespace", () => {
    const text = "fein   build the feature";
    const result = makeResult("fein", "fein", 0);
    expect(stripKeyword(text, result)).toBe("build the feature");
  });

  it("returns empty string for keyword-only message", () => {
    const text = "fein";
    const result = makeResult("fein", "fein", 0);
    expect(stripKeyword(text, result)).toBe("");
  });

  it("handles keyword followed by colon", () => {
    const text = "fein: build the feature";
    const result = makeResult("fein", "fein", 0);
    expect(stripKeyword(text, result)).toBe("build the feature");
  });

  it("handles keyword followed by colon and extra space", () => {
    const text = "fein:  build the feature";
    const result = makeResult("fein", "fein", 0);
    expect(stripKeyword(text, result)).toBe("build the feature");
  });

  it("does not strip meaningfully when keyword is not present", () => {
    const text = "just a normal message";
    // Simulating a result that wouldn't actually be returned by detectMode
    const result = makeResult("fein", "fein", 100);
    expect(stripKeyword(text, result)).toBe("just a normal message");
  });
});

describe("stripKeyword whitespace", () => {
  function makeResult(
    mode: "fein" | "sonar" | "blitz",
    keyword: string,
    index: number,
  ): ModeResult {
    return {
      mode,
      keyword,
      index,
      prompt: getModePrompt(mode),
      marker: getModeMarker(mode),
    };
  }

  it("keyword at end should not leave trailing whitespace", () => {
    const text = "implement it blitz";
    const result = makeResult("blitz", "blitz", 13);
    expect(stripKeyword(text, result)).toBe("implement it");
  });

  it("keyword removed from middle should collapse double spaces", () => {
    const text = "let's sonar research this";
    const result = makeResult("sonar", "sonar", 6);
    expect(stripKeyword(text, result)).toBe("let's research this");
  });
});

// ---------------------------------------------------------------------------
// Config validation (MaestriaPlugin)
// ---------------------------------------------------------------------------
describe("MaestriaPlugin config validation", () => {
  it("throws on unknown keyword", async () => {
    const { MaestriaPlugin } = await import("../src/index.js");
    await expect(
      MaestriaPlugin({} as never, {
        modes: { disabledKeywords: ["invalid"] as any },
      }),
    ).rejects.toThrow(
      "Invalid enum value. Expected 'fein' | 'sonar' | 'blitz', received 'invalid'",
    );
  });

  it("accepts valid config with disabled keywords", async () => {
    const { MaestriaPlugin } = await import("../src/index.js");
    const plugin = await MaestriaPlugin({} as never, {
      modes: { disabledKeywords: ["blitz"] },
    });
    expect(plugin).toBeDefined();
    expect(typeof plugin.config).toBe("function");
  });

  it("accepts no options (all modes active)", async () => {
    const { MaestriaPlugin } = await import("../src/index.js");
    const plugin = await MaestriaPlugin({} as never);
    expect(plugin).toBeDefined();
    expect(typeof plugin.config).toBe("function");
  });

  it("accepts empty disabledKeywords array", async () => {
    const { MaestriaPlugin } = await import("../src/index.js");
    const plugin = await MaestriaPlugin({} as never, {
      modes: { disabledKeywords: [] },
    });
    expect(plugin).toBeDefined();
    expect(typeof plugin.config).toBe("function");
  });

  it("throws if disabledKeywords is not an array", async () => {
    const { MaestriaPlugin } = await import("../src/index.js");
    await expect(
      MaestriaPlugin({} as never, {
        modes: { disabledKeywords: "fein" as any },
      }),
    ).rejects.toThrow("Expected array, received string");
  });
});

// ---------------------------------------------------------------------------
// MaestriaPlugin chat.message hook
// ---------------------------------------------------------------------------
describe("MaestriaPlugin chat.message hook", () => {
  it("includes chat.message hook when options are provided", async () => {
    const { MaestriaPlugin } = await import("../src/index.js");
    const plugin = await MaestriaPlugin({} as never, {
      modes: { disabledKeywords: [] },
    });
    expect(typeof (plugin as any)["chat.message"]).toBe("function");
  });

  it("includes chat.message hook when no options", async () => {
    const { MaestriaPlugin } = await import("../src/index.js");
    const plugin = await MaestriaPlugin({} as never);
    expect(typeof (plugin as any)["chat.message"]).toBe("function");
  });
});
