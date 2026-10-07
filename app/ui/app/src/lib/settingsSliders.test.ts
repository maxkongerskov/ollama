import { describe, expect, it } from "vitest";
import {
  formatContextLength,
  parseNumCtx,
  pickActiveModel,
  parseTrainCtx,
  resolveDisplayedContextLength,
  snapToContextLengthOption,
} from "./settingsSliders";

describe("parseNumCtx", () => {
  it("reads num_ctx from /api/show parameters, including exponent notation", () => {
    expect(parseNumCtx("num_ctx                        1.048576e+06")).toBe(
      1_048_576,
    );
    expect(parseNumCtx('stop "<|end|>"\nnum_ctx 32768\ntemperature 0.6')).toBe(
      32_768,
    );
    expect(parseNumCtx("temperature 0.6")).toBeUndefined();
    expect(parseNumCtx(undefined)).toBeUndefined();
  });
});

describe("parseTrainCtx", () => {
  it("reads the architecture's context_length", () => {
    expect(
      parseTrainCtx({
        "general.architecture": "glm5next",
        "glm5next.context_length": 1_048_576,
      }),
    ).toBe(1_048_576);
    expect(parseTrainCtx({})).toBeUndefined();
  });
});

describe("snapToContextLengthOption", () => {
  it("keeps stop values and snaps others to the nearest stop", () => {
    expect(snapToContextLengthOption(1_048_576)).toBe(1_048_576);
    expect(snapToContextLengthOption(2_000_000)).toBe(1_048_576);
    expect(snapToContextLengthOption(40_000)).toBe(32_768);
    expect(snapToContextLengthOption(200_000)).toBe(262_144);
    expect(snapToContextLengthOption(1_000)).toBe(4_096);
  });
});

describe("formatContextLength", () => {
  it("matches the slider labels", () => {
    expect(formatContextLength(1_048_576)).toBe("1M");
    expect(formatContextLength(131_072)).toBe("128k");
    expect(formatContextLength(40_960)).toBe("40k");
    expect(formatContextLength(2_097_152)).toBe("2M");
  });
});

describe("pickActiveModel", () => {
  it("prefers the selected loaded model, then any loaded, then the selected", () => {
    const running = [
      { name: "small:latest", context_length: 8_192 },
      { name: "glm", context_length: 1_048_576 },
    ];
    expect(pickActiveModel(running, "glm")).toEqual({
      name: "glm",
      loadedContextLength: 1_048_576,
    });
    expect(pickActiveModel(running, "other")?.name).toBe("small:latest");
    expect(pickActiveModel([], "glm")).toEqual({ name: "glm" });
    expect(pickActiveModel(undefined, "")).toBeNull();
  });
});

describe("resolveDisplayedContextLength", () => {
  const glm = "glm5.3-flash:q6-vision";

  it("locks to the model when it sets its own num_ctx", () => {
    expect(
      resolveDisplayedContextLength({
        setting: 65_536,
        runningModels: [{ name: glm, context_length: 1_048_576 }],
        selectedModel: glm,
        activeModelInfo: { numCtx: 1_048_576 },
        defaultContextLength: 262_144,
      }),
    ).toEqual({
      value: 1_048_576,
      effective: 1_048_576,
      source: "loaded-model",
      lockedBy: glm,
    });
    expect(
      resolveDisplayedContextLength({
        setting: 0,
        selectedModel: glm,
        activeModelInfo: { numCtx: 1_048_576 },
      }),
    ).toEqual({
      value: 1_048_576,
      effective: 1_048_576,
      source: "model-parameter",
      lockedBy: glm,
    });
  });

  it("is not locked by matching numbers alone", () => {
    expect(
      resolveDisplayedContextLength({
        setting: 0,
        runningModels: [{ name: glm, context_length: 1_048_576 }],
        selectedModel: glm,
        activeModelInfo: { trainCtx: 1_048_576 },
        defaultContextLength: 1_048_576,
      }),
    ).toEqual({
      value: 1_048_576,
      effective: 1_048_576,
      source: "loaded-model",
    });
  });

  it("prefers an explicit setting when the model has no num_ctx", () => {
    expect(
      resolveDisplayedContextLength({
        setting: 65_536,
        runningModels: [{ name: glm, context_length: 1_048_576 }],
        defaultContextLength: 262_144,
      }),
    ).toEqual({ value: 65_536, effective: 65_536, source: "setting" });
  });

  it("falls back to the capped server default", () => {
    expect(
      resolveDisplayedContextLength({
        setting: 0,
        activeModelInfo: { trainCtx: 131_072 },
        defaultContextLength: 262_144,
      }),
    ).toEqual({ value: 131_072, effective: 131_072, source: "server-default" });
    expect(
      resolveDisplayedContextLength({
        setting: 0,
        defaultContextLength: 50_000,
      }),
    ).toEqual({ value: 65_536, effective: 50_000, source: "server-default" });
    expect(resolveDisplayedContextLength({ setting: 0 })).toBeNull();
  });
});
