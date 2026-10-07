import * as React from "react";

export interface SliderProps {
  label?: string;
  options?: { value: number; label: string }[];
  value?: number;
  onChange?: (value: number) => void;
  className?: string;
  disabled?: boolean;
  /**
   * Distance (any CSS length) from each side of the slider to the first and
   * last stop. The track runs between those two points and the stops are
   * spread evenly along it. Sliders that share a value line up exactly, and
   * the value should be at least half the width of the widest end label so
   * that label does not overflow.
   */
  trackInset?: string;
}

const defaultTrackInset = "0.625rem";

const Slider = React.forwardRef<HTMLDivElement, SliderProps>(
  (
    {
      label,
      options,
      value = 0,
      onChange,
      disabled = false,
      trackInset = defaultTrackInset,
    },
    ref,
  ) => {
    const [selectedValue, setSelectedValue] = React.useState(value);
    const [isDragging, setIsDragging] = React.useState(false);
    const trackRef = React.useRef<HTMLDivElement>(null);

    // Update internal state when value prop changes
    React.useEffect(() => {
      setSelectedValue(value);
    }, [value]);

    const handleClick = (optionValue: number) => {
      if (disabled) return;
      setSelectedValue(optionValue);
      onChange?.(optionValue);
    };

    const getClosestOption = (clientX: number) => {
      if (!trackRef.current || !options || options.length === 0) return null;
      if (options.length === 1) return options[0].value;

      // The track spans exactly from the first stop to the last stop.
      const rect = trackRef.current.getBoundingClientRect();
      const fraction = rect.width > 0 ? (clientX - rect.left) / rect.width : 0;

      let closestIndex = Math.round(fraction * (options.length - 1));
      closestIndex = Math.max(0, Math.min(closestIndex, options.length - 1));

      return options[closestIndex].value;
    };

    const handleMouseDown = (e: React.MouseEvent) => {
      if (disabled) return;
      setIsDragging(true);
      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const closestValue = getClosestOption(e.clientX);
      if (closestValue !== null && closestValue !== selectedValue) {
        setSelectedValue(closestValue);
        // Don't call onChange during drag, just update visual state
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        // Call onChange with the final value when drag ends
        onChange?.(selectedValue);
      }
      setIsDragging(false);
    };

    React.useEffect(() => {
      if (isDragging) {
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        return () => {
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);
        };
      }
    }, [isDragging, selectedValue]);

    if (!options) {
      return null;
    }

    // Each stop is anchored at its position along the track and centered on
    // it, so the dot always sits exactly over the middle of its label.
    const stopLeft = (index: number) => {
      const fraction = options.length > 1 ? index / (options.length - 1) : 0.5;
      return `calc(${trackInset} + (100% - 2 * ${trackInset}) * ${fraction})`;
    };

    return (
      <div className={`space-y-2 ${disabled ? "opacity-50" : ""}`} ref={ref}>
        {label && <label className="text-sm font-medium">{label}</label>}
        <div className="relative h-9">
          <div
            ref={trackRef}
            data-slider-track=""
            className="absolute top-[8px] h-1 bg-neutral-200 dark:bg-neutral-700 pointer-events-none rounded-full"
            style={{ left: trackInset, right: trackInset }}
          />

          {options.map((option, index) => (
            <div
              key={option.value}
              data-slider-stop=""
              className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
              style={{ left: stopLeft(index) }}
            >
              <button
                type="button"
                aria-label={option.label}
                aria-pressed={selectedValue === option.value}
                onClick={() => handleClick(option.value)}
                onMouseDown={handleMouseDown}
                disabled={disabled}
                className={`relative px-3 py-6 -mx-3 -my-6 z-10 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
              >
                <div
                  data-slider-dot=""
                  className="relative w-5 h-5 flex items-center justify-center"
                >
                  {/* A disabled slider still shows its position; the wrapper
                      grays it out. */}
                  {selectedValue === option.value && (
                    <div
                      data-slider-thumb=""
                      className={`w-4 h-4 bg-white dark:bg-white border border-neutral-400 dark:border-neutral-500 rounded-full ${disabled ? "" : "cursor-grab active:cursor-grabbing"}`}
                    />
                  )}
                </div>
              </button>
              <div
                data-slider-label=""
                className="whitespace-nowrap text-xs text-neutral-500 dark:text-neutral-400"
              >
                {option.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
);

Slider.displayName = "Slider";

export { Slider };
