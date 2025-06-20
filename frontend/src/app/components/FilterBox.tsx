// src/app/components/FilterBox.tsx
"use client";
import React from "react";

type FilterBoxProps = {
  types: string[];
  selectedTypes: Set<string>;
  onFilterChange: (type: string, isSelected: boolean) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onResidentialOnly: () => void;
  viewMode: "polygons" | "heatmap";
  onViewModeToggle: () => void;
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
}: FilterBoxProps) {
  return (
    <div className="absolute top-20 right-4 bg-white p-4 rounded-lg shadow-lg max-h-[80vh] overflow-y-auto z-10 w-72">
      <h3 className="text-lg font-bold mb-2 text-gray-800">Map Controls</h3>

      {/* View Mode Toggle */}
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

      {/* Filter Controls */}
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

        {/* Residential Only Button */}
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

      {/* Property Type Checkboxes */}
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
