// src/app/components/FilterBox.tsx
"use client";
import React from "react";
import { Range, getTrackBackground } from "react-range";

// --- Type definitions are unchanged ---
type ValueFilters = {
  capital_value: [number, number];
  land_value: [number, number];
  improvements_value: [number, number];
};
type SliderPositions = ValueFilters;
type FilterMode = "total" | "components";

type FilterBoxProps = {
  types: string[];
  selectedTypes: Set<string>;
  onFilterChange: (type: string, isSelected: boolean) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onResidentialOnly: () => void;
  viewMode: "polygons" | "heatmap";
  onViewModeToggle: () => void;
  valueFilters: ValueFilters;
  sliderPositions: SliderPositions;
  onValueChange: (
    filterType: keyof ValueFilters,
    newPositions: [number, number]
  ) => void;
  isFiltering: boolean;
  activeFilterMode: FilterMode;
};

// --- Unchanged formatLabel function ---
const formatLabel = (key: string) => {
  return key.replace("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
};

export default function FilterBox({
  types,
  selectedTypes,
  onFilterChange,
  onSelectAll,
  onDeselectAll,
  onResidentialOnly,
  viewMode,
  onViewModeToggle,
  valueFilters,
  sliderPositions,
  onValueChange,
  isFiltering,
  activeFilterMode,
}: FilterBoxProps) {
  return (
    <div className="absolute top-15 left-2.5 bg-white p-4 rounded-xs shadow-lg max-h-[80vh] overflow-y-auto z-10 w-72">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-bold text-gray-800">Map Controls</h3>
        {isFiltering && (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
        )}
      </div>

      <div className="mb-4 border-b pb-3">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          View Mode
        </label>
        <button
          onClick={onViewModeToggle}
          className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors ${
            viewMode === "polygons"
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-red-600 hover:bg-red-700 text-white"
          }`}
        >
          {viewMode === "polygons" ? (
            <span className="flex items-center justify-center gap-2">
              🏠 Property Boundaries
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              🔥 Value Heatmap
            </span>
          )}
        </button>
        <p className="text-xs text-gray-500 mt-1 text-center">
          {viewMode === "polygons"
            ? "Click to switch to heatmap view"
            : "Heatmap shows property value density"}
        </p>
      </div>

      <div className="mb-3 border-b pb-3">
        <h4 className="text-md font-semibold mb-2 text-gray-800">
          Filter by Value Range
        </h4>
        <div className="flex flex-col gap-6 px-2">
          {(Object.keys(valueFilters) as Array<keyof ValueFilters>).map(
            (key) => {
              const isComponentSlider =
                key === "land_value" || key === "improvements_value";
              const isDisabled =
                isComponentSlider && activeFilterMode === "total";

              const positions = sliderPositions[key] || [0, 100];
              const values = valueFilters[key] || [0, 0];
              return (
                <div
                  key={key}
                  className={`transition-opacity duration-300 ${
                    isDisabled ? "opacity-50" : ""
                  }`}
                >
                  <label className="block text-sm font-medium text-gray-700 mb-4">
                    {formatLabel(key)}
                  </label>
                  <Range
                    step={0.1}
                    min={0}
                    max={100}
                    values={positions}
                    // REMOVED: The `disabled` prop that was causing the issue
                    onChange={(newPositions) =>
                      onValueChange(key, newPositions as [number, number])
                    }
                    renderTrack={({ props, children }) => (
                      <div
                        onMouseDown={props.onMouseDown}
                        onTouchStart={props.onTouchStart}
                        style={{
                          ...props.style,
                          height: "36px",
                          display: "flex",
                          width: "100%",
                        }}
                      >
                        <div
                          ref={props.ref}
                          style={{
                            height: "5px",
                            width: "100%",
                            borderRadius: "4px",
                            background: getTrackBackground({
                              values: positions,
                              colors: ["#ccc", "#548BF4", "#ccc"],
                              min: 0,
                              max: 100,
                            }),
                            alignSelf: "center",
                          }}
                        >
                          {children}
                        </div>
                      </div>
                    )}
                    renderThumb={({ props, index }) => {
                      const { key: thumbKey, ...restProps } = props;
                      return (
                        <div
                          key={thumbKey}
                          {...restProps}
                          style={{
                            ...restProps.style,
                            height: "20px",
                            width: "20px",
                            backgroundColor: "#FFF",
                            borderRadius: "50%",
                            boxShadow: "0px 2px 6px #AAA",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <div className="absolute -top-6 text-xs text-gray-600 bg-white px-1 py-0.5 rounded shadow">
                            {values?.[index] !== undefined &&
                              `$${values[index].toLocaleString()}`}
                          </div>
                        </div>
                      );
                    }}
                  />
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* --- Rest of the component is unchanged --- */}
      <div className="mb-3">
        <h4 className="text-md font-semibold mb-2 text-gray-800">
          Filter by Property Type
        </h4>
        <div className="flex gap-2 mb-3 border-b pb-3">
          <button
            onClick={onSelectAll}
            className="flex-1 text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-1 px-2 rounded"
          >
            Select All
          </button>
          <button
            onClick={onDeselectAll}
            className="flex-1 text-sm bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-1 px-2 rounded"
          >
            Deselect All
          </button>
        </div>
        <div className="mb-3">
          <button
            onClick={onResidentialOnly}
            className="w-full text-sm bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-3 rounded-lg transition-colors"
          >
            🏠 Residential Only
          </button>
          <p className="text-xs text-gray-500 mt-1 text-center">
            Show only residential properties
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        {types.map((type) => (
          <div key={type} className="flex items-center">
            <input
              type="checkbox"
              id={type}
              checked={selectedTypes.has(type)}
              onChange={(e) => onFilterChange(type, e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label
              htmlFor={type}
              className="ml-2 block text-sm text-gray-900 truncate"
              title={type}
            >
              {type}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}
