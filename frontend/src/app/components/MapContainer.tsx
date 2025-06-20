// src/app/components/MapContainer.tsx
"use client";

import {
  APIProvider,
  Map,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import FilterBox from "@/app/components/FilterBox";

// --- Type definitions ---
type Property = {
  source_property_id: string;
  address: string;
  capital_value: number;
  land_value: number;
  improvements_value: number;
  type: string;
  geojson: {
    type: string;
    coordinates: number[][][];
  };
};
type ValueFilters = {
  capital_value: [number, number];
  land_value: [number, number];
  improvements_value: [number, number];
};
type SliderBounds = ValueFilters;
// NEW: Define a type for the filter mode
type FilterMode = "total" | "components";

// --- Unchanged components (PropertyHeatmap, PropertyPolygons) and helpers ---
const QLDC_CENTER = { lat: -45.0312, lng: 168.6626 };
const SLIDER_POSITION_MIN = 0;
const SLIDER_POSITION_MAX = 100;

const positionToValue = (position: number, min: number, max: number) => {
  if (max === min) return max;
  const minp = SLIDER_POSITION_MIN;
  const maxp = SLIDER_POSITION_MAX;
  const minv = Math.log(min || 1);
  const maxv = Math.log(max || 1);
  const scale = (maxv - minv) / (maxp - minp);
  return Math.round(Math.exp(minv + scale * (position - minp)));
};

const valueToPosition = (value: number, min: number, max: number) => {
  if (max === min) return SLIDER_POSITION_MAX;
  const minp = SLIDER_POSITION_MIN;
  const maxp = SLIDER_POSITION_MAX;
  const minv = Math.log(min || 1);
  const maxv = Math.log(max || 1);
  const scale = (maxv - minv) / (maxp - minp);
  if (scale === 0) return minp;
  return minp + (Math.log(value || 1) - minv) / scale;
};
const PropertyHeatmap = ({ properties }: { properties: Property[] }) => {
  const map = useMap();
  const visualization = useMapsLibrary("visualization");
  const [heatmap, setHeatmap] =
    useState<google.maps.visualization.HeatmapLayer | null>(null);

  useEffect(() => {
    if (!map || !visualization) return;
    if (heatmap) {
      heatmap.setMap(null);
    }
    if (!properties.length) return;
    const heatmapData = properties
      .filter((property) => property.geojson?.coordinates?.[0])
      .map((property) => {
        const coords = property.geojson.coordinates[0];
        const centerLat =
          coords.reduce((sum, coord) => sum + coord[1], 0) / coords.length;
        const centerLng =
          coords.reduce((sum, coord) => sum + coord[0], 0) / coords.length;
        const weight = Math.min(property.capital_value / 1000000, 10);
        return {
          location: new google.maps.LatLng(centerLat, centerLng),
          weight: Math.max(weight, 0.1),
        };
      });
    const newHeatmap = new visualization.HeatmapLayer({
      data: heatmapData,
      map: map,
    });
    newHeatmap.setOptions({
      radius: 50,
      opacity: 0.8,
      gradient: [
        "rgba(0, 255, 255, 0)",
        "rgba(0, 255, 255, 1)",
        "rgba(0, 191, 255, 1)",
        "rgba(0, 127, 255, 1)",
        "rgba(0, 63, 255, 1)",
        "rgba(0, 0, 255, 1)",
        "rgba(0, 0, 223, 1)",
        "rgba(0, 0, 191, 1)",
        "rgba(0, 0, 159, 1)",
        "rgba(0, 0, 127, 1)",
        "rgba(63, 0, 91, 1)",
        "rgba(127, 0, 63, 1)",
        "rgba(191, 0, 31, 1)",
        "rgba(255, 0, 0, 1)",
      ],
    });
    setHeatmap(newHeatmap);
    return () => {
      if (newHeatmap) {
        newHeatmap.setMap(null);
      }
    };
  }, [map, visualization, properties]);

  return null;
};
const PropertyPolygons = ({ properties }: { properties: Property[] }) => {
  const map = useMap();
  const polygonsRef = useRef<google.maps.Polygon[]>([]);
  const [infoWindow, setInfoWindow] = useState<google.maps.InfoWindow | null>(
    null
  );
  const [selectedPolygon, setSelectedPolygon] =
    useState<google.maps.Polygon | null>(null);

  useEffect(() => {
    if (!map) return;
    setInfoWindow(new google.maps.InfoWindow());
  }, [map]);

  useEffect(() => {
    if (!map || !infoWindow) return;
    polygonsRef.current.forEach((poly) => poly.setMap(null));
    polygonsRef.current = [];
    properties.forEach((property) => {
      if (!property.geojson || !property.geojson.coordinates) return;
      const paths = property.geojson.coordinates[0].map((coords: number[]) => ({
        lng: coords[0],
        lat: coords[1],
      }));
      const newPolygon = new google.maps.Polygon({
        paths: paths,
        strokeColor: "#0000FF",
        strokeOpacity: 0.7,
        strokeWeight: 1,
        fillColor: "#0000FF",
        fillOpacity: 0.15,
      });
      newPolygon.setMap(map);
      polygonsRef.current.push(newPolygon);
      newPolygon.addListener("click", (e: google.maps.PolyMouseEvent) => {
        if (selectedPolygon) {
          selectedPolygon.setOptions({
            fillColor: "#0000FF",
            fillOpacity: 0.15,
          });
        }
        newPolygon.setOptions({ fillColor: "#FF0000", fillOpacity: 0.4 });
        setSelectedPolygon(newPolygon);
        // add property type
        const content = `<div style="color: black;"><strong>Address:</strong> ${
          property.address
        }<br><strong>Capital Value:</strong> $${Number(
          property.capital_value
        ).toLocaleString()}<br><strong>Land Value:</strong> $${Number(
          property.land_value
        ).toLocaleString()}<br><strong>Improvements Value:</strong> $${Number(
          property.improvements_value
        ).toLocaleString()}<br><strong>Property Type:</strong> ${
          property.type
        }</div>`;

        infoWindow.setContent(content);
        infoWindow.setPosition(e.latLng);
        infoWindow.open(map);
      });
    });
    return () => {
      if (polygonsRef.current) {
        polygonsRef.current.forEach((poly) => poly.setMap(null));
      }
    };
  }, [map, properties, infoWindow, selectedPolygon]);
  return null;
};

export default function MapContainer() {
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [filteredProperties, setFilteredProperties] = useState<Property[]>([]);
  const [propertyTypes, setPropertyTypes] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"polygons" | "heatmap">("polygons");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [sliderBounds, setSliderBounds] = useState<SliderBounds>({
    capital_value: [0, 0],
    land_value: [0, 0],
    improvements_value: [0, 0],
  });
  const [debouncedValueFilters, setDebouncedValueFilters] =
    useState<ValueFilters>({
      capital_value: [0, 0],
      land_value: [0, 0],
      improvements_value: [0, 0],
    });
  const [liveValueFilters, setLiveValueFilters] = useState<ValueFilters>({
    capital_value: [0, 0],
    land_value: [0, 0],
    improvements_value: [0, 0],
  });

  // NEW: State to track which slider group is active
  const [activeFilterMode, setActiveFilterMode] =
    useState<FilterMode>("components");

  const mapsLibrary = useMapsLibrary("maps");
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- useEffect hooks are unchanged ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/properties");
        if (!response.ok) throw new Error("Failed to fetch data");
        const data: Property[] = await response.json();
        setAllProperties(data);
        const uniqueTypes = Array.from(
          new Set(data.map((p) => p.type).filter((type) => !!type))
        ).sort();
        setPropertyTypes(uniqueTypes);
        setSelectedTypes(new Set(uniqueTypes));
        if (data.length > 0) {
          const initialBounds: SliderBounds = {
            capital_value: [
              Math.min(...data.map((p) => p.capital_value)),
              Math.max(...data.map((p) => p.capital_value)),
            ],
            land_value: [
              Math.min(...data.map((p) => p.land_value)),
              Math.max(...data.map((p) => p.land_value)),
            ],
            improvements_value: [
              Math.min(...data.map((p) => p.improvements_value)),
              Math.max(...data.map((p) => p.improvements_value)),
            ],
          };
          setSliderBounds(initialBounds);
          setLiveValueFilters(initialBounds);
          setDebouncedValueFilters(initialBounds);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsInitialLoading(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (isInitialLoading || allProperties.length === 0) return;
    const currentlySelectedProperties = allProperties.filter((p) =>
      selectedTypes.has(p.type)
    );
    if (currentlySelectedProperties.length === 0) {
      const zeroBounds: SliderBounds = {
        capital_value: [0, 0],
        land_value: [0, 0],
        improvements_value: [0, 0],
      };
      setSliderBounds(zeroBounds);
      setLiveValueFilters(zeroBounds);
      setDebouncedValueFilters(zeroBounds);
      return;
    }
    const newBounds: SliderBounds = {
      capital_value: [
        Math.min(...currentlySelectedProperties.map((p) => p.capital_value)),
        Math.max(...currentlySelectedProperties.map((p) => p.capital_value)),
      ],
      land_value: [
        Math.min(...currentlySelectedProperties.map((p) => p.land_value)),
        Math.max(...currentlySelectedProperties.map((p) => p.land_value)),
      ],
      improvements_value: [
        Math.min(
          ...currentlySelectedProperties.map((p) => p.improvements_value)
        ),
        Math.max(
          ...currentlySelectedProperties.map((p) => p.improvements_value)
        ),
      ],
    };
    setSliderBounds(newBounds);
    setLiveValueFilters(newBounds);
    setDebouncedValueFilters(newBounds);
    // When filters change, revert to 'components' mode
    setActiveFilterMode("components");
  }, [selectedTypes, allProperties, isInitialLoading]);

  useEffect(() => {
    if (isInitialLoading) return;
    setIsFiltering(true);
    const filterTimeout = setTimeout(() => {
      const filtered = allProperties
        .filter((p) => p.type && selectedTypes.has(p.type))
        .filter(
          (p) =>
            p.capital_value >= debouncedValueFilters.capital_value[0] &&
            p.capital_value <= debouncedValueFilters.capital_value[1] &&
            p.land_value >= debouncedValueFilters.land_value[0] &&
            p.land_value <= debouncedValueFilters.land_value[1] &&
            p.improvements_value >=
              debouncedValueFilters.improvements_value[0] &&
            p.improvements_value <= debouncedValueFilters.improvements_value[1]
        );
      setFilteredProperties(filtered);
      setIsFiltering(false);
    }, 50);
    return () => clearTimeout(filterTimeout);
  }, [selectedTypes, allProperties, debouncedValueFilters, isInitialLoading]);

  // MODIFIED: handleValueChange now sets the activeFilterMode
  const handleValueChange = useCallback(
    (filterType: keyof ValueFilters, newPositions: [number, number]) => {
      const bounds = sliderBounds[filterType];
      const newRealValues: [number, number] = [
        positionToValue(newPositions[0], bounds[0], bounds[1]),
        positionToValue(newPositions[1], bounds[0], bounds[1]),
      ];

      const updatedLiveFilters: Partial<ValueFilters> = {
        [filterType]: newRealValues,
      };

      if (filterType === "land_value" || filterType === "improvements_value") {
        // If component sliders move, set mode to 'components' and update capital value
        setActiveFilterMode("components");

        const landValues =
          filterType === "land_value"
            ? newRealValues
            : liveValueFilters.land_value;
        const improvementsValues =
          filterType === "improvements_value"
            ? newRealValues
            : liveValueFilters.improvements_value;

        updatedLiveFilters.capital_value = [
          landValues[0] + improvementsValues[0],
          landValues[1] + improvementsValues[1],
        ];
      } else if (filterType === "capital_value") {
        // If capital slider moves, set mode to 'total'
        setActiveFilterMode("total");
      }

      setLiveValueFilters((prev) => ({ ...prev, ...updatedLiveFilters }));

      setIsFiltering(true);
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = setTimeout(() => {
        setDebouncedValueFilters((prev) => ({
          ...prev,
          ...updatedLiveFilters,
        }));
      }, 1000);
    },
    [sliderBounds, liveValueFilters]
  );

  // --- Other handlers and memoized calculations are unchanged ---
  const handleFilterChange = (type: string, isSelected: boolean) => {
    setSelectedTypes((prev) => {
      const newSet = new Set(prev);
      if (isSelected) newSet.add(type);
      else newSet.delete(type);
      return newSet;
    });
  };
  const handleSelectAll = () => setSelectedTypes(new Set(propertyTypes));
  const handleDeselectAll = () => setSelectedTypes(new Set());
  const handleResidentialOnly = () => {
    const residentialTypes = propertyTypes.filter(
      (type) =>
        type &&
        (type.toLowerCase().includes("residential") ||
          type.toLowerCase().includes("lifestyle"))
    );
    setSelectedTypes(new Set(residentialTypes));
  };
  const handleViewModeToggle = () =>
    setViewMode((prev) => (prev === "polygons" ? "heatmap" : "polygons"));
  const mapTypeControlOptions = useMemo<
    google.maps.MapTypeControlOptions | undefined
  >(() => {
    if (!mapsLibrary) return undefined;
    return {
      style: mapsLibrary.MapTypeControlStyle.HORIZONTAL_BAR,
      position: google.maps.ControlPosition.TOP_CENTER,
    };
  }, [mapsLibrary]);
  const liveSliderPositions = useMemo(() => {
    return (Object.keys(liveValueFilters) as Array<keyof ValueFilters>).reduce(
      (acc, key) => {
        const bounds = sliderBounds[key];
        const values = liveValueFilters[key];
        acc[key] = [
          valueToPosition(values[0], bounds[0], bounds[1]),
          valueToPosition(values[1], bounds[0], bounds[1]),
        ];
        return acc;
      },
      {} as ValueFilters
    );
  }, [liveValueFilters, sliderBounds]);

  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <APIProvider
        apiKey={process.env.NEXT_PUBLIC_MAPS_API_KEY!}
        libraries={["visualization", "geometry", "places"]}
      >
        {isInitialLoading ? (
          <div className="absolute top-15 left-2.5 bg-white p-4 rounded-xs shadow-lg z-10 w-72">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-bold text-gray-800">Map Controls</h3>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            </div>
            <p className="text-sm text-gray-500 text-center">
              Loading properties...
            </p>
          </div>
        ) : (
          <FilterBox
            types={propertyTypes}
            selectedTypes={selectedTypes}
            onFilterChange={handleFilterChange}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onResidentialOnly={handleResidentialOnly}
            viewMode={viewMode}
            onViewModeToggle={handleViewModeToggle}
            valueFilters={liveValueFilters}
            sliderPositions={liveSliderPositions}
            onValueChange={handleValueChange}
            isFiltering={isFiltering}
            activeFilterMode={activeFilterMode} // Pass the new mode down
          />
        )}
        <Map
          defaultCenter={QLDC_CENTER}
          defaultZoom={15}
          disableDefaultUI={false}
          mapTypeControl={true}
          mapTypeControlOptions={mapTypeControlOptions}
          rotateControl={true}
          fullscreenControl={true}
          streetViewControl={true}
          mapId="my-map-id"
          mapTypeId="hybrid"
        >
          {viewMode === "polygons" ? (
            <PropertyPolygons properties={filteredProperties} />
          ) : (
            <PropertyHeatmap properties={filteredProperties} />
          )}
        </Map>
      </APIProvider>
    </div>
  );
}
