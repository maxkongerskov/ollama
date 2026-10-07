// Presets for the sliders on the Settings page.

// Context length presets in tokens. 1M (1048576) matches the context window
// of the largest local models (e.g. GLM 5.3 Flash).
export const contextLengthOptions = [
  { value: 4096, label: "4k" },
  { value: 8192, label: "8k" },
  { value: 16384, label: "16k" },
  { value: 32768, label: "32k" },
  { value: 65536, label: "64k" },
  { value: 131072, label: "128k" },
  { value: 262144, label: "256k" },
  { value: 524288, label: "512k" },
  { value: 1048576, label: "1M" },
];

// Keep alive is stored in seconds. 0 means "unset" (the server default, 1 hour
// in this build) and -1 keeps models loaded indefinitely.
export const defaultKeepAliveSeconds = 3600;
export const keepAliveOptions = [
  { value: 300, label: "5m" },
  { value: 900, label: "15m" },
  { value: 3600, label: "1h" },
  { value: 14400, label: "4h" },
  { value: 86400, label: "24h" },
  { value: -1, label: "Never unload" },
];

// Both settings sliders share this inset so their tracks start and end at the
// same x positions. It must stay at least half the width of the widest end
// label ("Never unload") so that label is centered on its stop without
// overflowing.
export const settingsSliderTrackInset = "2.5rem";

/** Context window details for a model, from POST /api/show. */
export interface ModelContextInfo {
  /** num_ctx from the model's parameters (Modelfile), if it sets one. */
  numCtx?: number;
  /** The model's trained context window (model_info.*.context_length). */
  trainCtx?: number;
}

/** Reads num_ctx from the text `parameters` block returned by /api/show. */
export function parseNumCtx(
  parameters: string | undefined,
): number | undefined {
  const match = parameters?.match(/^\s*num_ctx\s+(\S+)\s*$/m);
  if (!match) return undefined;
  const value = Number(match[1]);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : undefined;
}

/** Reads the trained context window from /api/show model_info. */
export function parseTrainCtx(
  modelInfo: Record<string, unknown> | undefined,
): number | undefined {
  if (!modelInfo) return undefined;
  for (const [key, value] of Object.entries(modelInfo)) {
    if (key.endsWith(".context_length") && typeof value === "number") {
      return value > 0 ? value : undefined;
    }
  }
  return undefined;
}

export type ContextLengthSource =
  | "setting"
  | "loaded-model"
  | "model-parameter"
  | "server-default";

export interface RunningModelContext {
  name?: string;
  model?: string;
  context_length?: number;
}

export interface DisplayedContextLength {
  /** The slider stop to show. */
  value: number;
  /** The effective context length before snapping to a stop. */
  effective: number;
  source: ContextLengthSource;
  /**
   * Set when the active model has its own num_ctx parameter. That parameter
   * overrides the server-wide context length, so the slider cannot affect
   * this model and is shown locked.
   */
  lockedBy?: string;
}

/** Snaps a context length to the nearest stop (by ratio, so 48k picks 32k/64k sensibly). */
export function snapToContextLengthOption(contextLength: number): number {
  let best = contextLengthOptions[0].value;
  let bestDistance = Infinity;
  for (const { value } of contextLengthOptions) {
    const distance = Math.abs(Math.log2(value) - Math.log2(contextLength));
    if (distance < bestDistance) {
      best = value;
      bestDistance = distance;
    }
  }
  return best;
}

/** Formats a context length like the slider labels (4k … 512k, 1M). */
export function formatContextLength(contextLength: number): string {
  const option = contextLengthOptions.find(
    ({ value }) => value === contextLength,
  );
  if (option) return option.label;
  if (contextLength >= 1_048_576 && contextLength % 1_048_576 === 0) {
    return `${contextLength / 1_048_576}M`;
  }
  return `${Math.round(contextLength / 1024)}k`;
}

/**
 * The model whose context matters: the selected model if it is loaded, then
 * any loaded model, then the selected model even if it is not loaded.
 */
export function pickActiveModel(
  runningModels: RunningModelContext[] | undefined,
  selectedModel: string | undefined,
): { name: string; loadedContextLength?: number } | null {
  const loaded = (Array.isArray(runningModels) ? runningModels : []).filter(
    (model) => !!(model.name || model.model),
  );
  const loadedSelected = loaded.find(
    (model) =>
      !!selectedModel &&
      (model.name === selectedModel || model.model === selectedModel),
  );
  const active = loadedSelected ?? loaded[0];
  if (active) {
    return {
      name: (active.name || active.model)!,
      loadedContextLength:
        (active.context_length ?? 0) > 0 ? active.context_length : undefined,
    };
  }
  return selectedModel ? { name: selectedModel } : null;
}

/**
 * Works out what the Context length slider shows.
 *
 * - If the active model sets its own num_ctx, that wins over the server-wide
 *   setting, so the slider is locked and shows the model's context.
 * - Otherwise an explicit setting is shown.
 * - With an automatic setting (0) it shows the loaded model's context, then
 *   the server default (capped at the model's trained context).
 *
 * The result is display-only.
 */
export function resolveDisplayedContextLength({
  setting,
  runningModels,
  selectedModel,
  activeModelInfo,
  defaultContextLength,
}: {
  setting: number;
  runningModels?: RunningModelContext[];
  selectedModel?: string;
  /** /api/show details for the model returned by pickActiveModel. */
  activeModelInfo?: ModelContextInfo;
  defaultContextLength?: number;
}): DisplayedContextLength | null {
  const resolved = (
    effective: number,
    source: ContextLengthSource,
    lockedBy?: string,
  ): DisplayedContextLength => ({
    value: snapToContextLengthOption(effective),
    effective,
    source,
    ...(lockedBy ? { lockedBy } : {}),
  });

  const active = pickActiveModel(runningModels, selectedModel);

  if (active && activeModelInfo?.numCtx) {
    return active.loadedContextLength
      ? resolved(active.loadedContextLength, "loaded-model", active.name)
      : resolved(activeModelInfo.numCtx, "model-parameter", active.name);
  }

  if (setting > 0) return resolved(setting, "setting");

  if (active?.loadedContextLength) {
    return resolved(active.loadedContextLength, "loaded-model");
  }

  if (defaultContextLength && defaultContextLength > 0) {
    const trainCtx = activeModelInfo?.trainCtx;
    return resolved(
      trainCtx
        ? Math.min(defaultContextLength, trainCtx)
        : defaultContextLength,
      "server-default",
    );
  }

  return null;
}
