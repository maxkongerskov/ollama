import "@/index.css";
import { page } from "@vitest/browser/context";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  contextLengthOptions,
  keepAliveOptions,
  settingsSliderTrackInset,
} from "@/lib/settingsSliders";
import { Slider } from "./slider";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  container.className = "bg-white p-4";
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

// Mirrors the Settings page markup: an icon column next to a full-width
// column holding the label and slider.
function SettingsSliders() {
  return (
    <div className="space-y-6">
      {[
        {
          name: "Context length",
          value: 262144,
          options: contextLengthOptions,
        },
        { name: "Keep alive", value: -1, options: keepAliveOptions },
      ].map(({ name, value, options }) => (
        <div key={name} className="flex items-start space-x-3">
          <div className="mt-1 h-5 w-5 flex-shrink-0" />
          <div className="w-full" data-slider-field={name}>
            <div className="text-sm font-medium">{name}</div>
            <div className="mt-3">
              <Slider
                value={value}
                options={options}
                trackInset={settingsSliderTrackInset}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function box(element: Element) {
  const rect = element.getBoundingClientRect();
  return {
    left: rect.left,
    right: rect.right,
    center: rect.left + rect.width / 2,
    width: rect.width,
    height: rect.height,
  };
}

function measure(name: string) {
  const field = container.querySelector(`[data-slider-field="${name}"]`)!;
  const track = field.querySelector("[data-slider-track]")!;
  const stops = [...field.querySelectorAll("[data-slider-stop]")].map(
    (stop) => ({
      text: stop.querySelector("[data-slider-label]")!.textContent,
      dot: box(stop.querySelector("[data-slider-dot]")!),
      label: box(stop.querySelector("[data-slider-label]")!),
    }),
  );
  return { track: box(track), slider: box(track.parentElement!), stops };
}

// 832px is the content width of the Settings page at its max-w-4xl width;
// 420px is a narrow window.
for (const width of [832, 420]) {
  it(`lines up both settings sliders at ${width}px`, async () => {
    await page.viewport(width + 100, 400);
    container.style.width = `${width}px`;
    await act(async () => root.render(<SettingsSliders />));

    const context = measure("Context length");
    const keepAlive = measure("Keep alive");

    expect(context.stops.map((stop) => stop.text)).toEqual(
      contextLengthOptions.map((option) => option.label),
    );
    expect(keepAlive.stops.map((stop) => stop.text)).toEqual(
      keepAliveOptions.map((option) => option.label),
    );

    // Both tracks start and end at the same x positions.
    expect(Math.abs(context.track.left - keepAlive.track.left)).toBeLessThan(1);
    expect(Math.abs(context.track.right - keepAlive.track.right)).toBeLessThan(
      1,
    );

    for (const { track, slider, stops } of [context, keepAlive]) {
      const spacing = (track.right - track.left) / (stops.length - 1);
      stops.forEach((stop, index) => {
        // Stops are evenly spaced from the start to the end of the track.
        expect(
          Math.abs(stop.dot.center - (track.left + spacing * index)),
        ).toBeLessThan(1);
        // Each dot is centered over its label.
        expect(Math.abs(stop.dot.center - stop.label.center)).toBeLessThan(1);
        // Labels stay on one line and inside the slider.
        expect(stop.label.height).toBeLessThan(20);
        expect(stop.label.left).toBeGreaterThanOrEqual(slider.left - 0.5);
        expect(stop.label.right).toBeLessThanOrEqual(slider.right + 0.5);
        // Neighbouring labels do not touch.
        if (index > 0) {
          expect(
            stop.label.left - stops[index - 1].label.right,
          ).toBeGreaterThan(2);
        }
      });
    }

    const last = keepAlive.stops[keepAlive.stops.length - 1];
    expect(last.text).toBe("Never unload");
    expect(Math.abs(last.dot.center - keepAlive.track.right)).toBeLessThan(1);

    const minGap = (stops: typeof context.stops) =>
      Math.min(
        ...stops
          .slice(1)
          .map((stop, index) => stop.label.left - stops[index].label.right),
      );
    console.log(
      JSON.stringify({
        width,
        slider: [context.slider.left, context.slider.right],
        contextTrack: [context.track.left, context.track.right],
        keepAliveTrack: [keepAlive.track.left, keepAlive.track.right],
        neverUnload: {
          dot: last.dot.center,
          label: last.label.center,
          labelWidth: last.label.width,
        },
        contextMinLabelGap: minGap(context.stops),
        keepAliveMinLabelGap: minGap(keepAlive.stops),
      }),
    );

    if (import.meta.env.VITE_SLIDER_SCREENSHOT_DIR) {
      await page.screenshot({
        element: container,
        path: `${import.meta.env.VITE_SLIDER_SCREENSHOT_DIR}/settings-sliders-${width}.png`,
      });
    }
  });
}
