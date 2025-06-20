// src/app/components/MapContainer.tsx
"use client";

import {
  APIProvider,
  Map,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { useEffect, useState, useRef, useMemo } from "react";
import FilterBox from "@/app/components/FilterBox";

// Update the Property type to include the land_use_description
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

const QLDC_CENTER = { lat: -45.0312, lng: 168.6626 }; // Queenstown, NZ

// New Heatmap component
const PropertyHeatmap = ({ properties }: { properties: Property[] }) => {
  const map = useMap();
  const visualization = useMapsLibrary("visualization");
  const [heatmap, setHeatmap] =
    useState<google.maps.visualization.HeatmapLayer | null>(null);

  useEffect(() => {
    if (!map || !visualization || !properties.length) return;

    // Clear existing heatmap
    if (heatmap) {
      heatmap.setMap(null);
    }

    // Create heatmap data points
    const heatmapData = properties
      .filter((property) => property.geojson?.coordinates?.[0])
      .map((property) => {
        // Get the centroid of the polygon
        const coords = property.geojson.coordinates[0];
        const centerLat =
          coords.reduce((sum, coord) => sum + coord[1], 0) / coords.length;
        const centerLng =
          coords.reduce((sum, coord) => sum + coord[0], 0) / coords.length;

        // Weight by capital value (normalized)
        const weight = Math.min(property.capital_value / 1000000, 10); // Cap at 10M for visualization

        return {
          location: new google.maps.LatLng(centerLat, centerLng),
          weight: Math.max(weight, 0.1), // Minimum weight of 0.1
        };
      });

    // Create new heatmap
    const newHeatmap = new visualization.HeatmapLayer({
      data: heatmapData,
      map: map,
    });

    // Configure heatmap options
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

// PropertyPolygons component (unchanged)
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

        const content = `
          <div style="color: black;">
            <strong>Address:</strong> ${property.address}<br>
            <strong>Capital Value:</strong> $${Number(
              property.capital_value
            ).toLocaleString()}<br>
            <strong>Land Value:</strong> $${Number(
              property.land_value
            ).toLocaleString()}<br>
            <strong>Improvements Value:</strong> $${Number(
              property.improvements_value
            ).toLocaleString()}
          </div>
        `;

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
  const [viewMode, setViewMode] = useState<"polygons" | "heatmap">("polygons"); // New state

  const mapsLibrary = useMapsLibrary("maps");

  const mapTypeControlOptions = useMemo<
    google.maps.MapTypeControlOptions | undefined
  >(() => {
    if (!mapsLibrary) return undefined;

    return {
      style: mapsLibrary.MapTypeControlStyle.HORIZONTAL_BAR,
      position: google.maps.ControlPosition.TOP_CENTER,
    };
  }, [mapsLibrary]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/properties");
        if (!response.ok) throw new Error("Failed to fetch data");
        const data: Property[] = await response.json();
        setAllProperties(data);

        const uniqueTypes = Array.from(
          new Set(
            data
              .map((p) => p.type)
              .filter(
                (type) => type !== null && type !== undefined && type !== ""
              ) // Filter out null/undefined/empty types
          )
        ).sort();
        setPropertyTypes(uniqueTypes);
        setSelectedTypes(new Set(uniqueTypes));
      } catch (error) {
        console.error(error);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    if (allProperties.length > 0) {
      const filtered = allProperties.filter(
        (p) => p.type && selectedTypes.has(p.type) // Only include properties with non-null types
      );
      setFilteredProperties(filtered);
    }
  }, [selectedTypes, allProperties]);

  const handleFilterChange = (type: string, isSelected: boolean) => {
    setSelectedTypes((prev) => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(type);
      } else {
        newSet.delete(type);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    setSelectedTypes(new Set(propertyTypes));
  };

  const handleDeselectAll = () => {
    setSelectedTypes(new Set());
  };

  // New handler for residential only filter
  const handleResidentialOnly = () => {
    const residentialTypes = propertyTypes.filter(
      (type) =>
        type && // Check if type is not null/undefined
        (type.toLowerCase().includes("residential") ||
          type.toLowerCase().includes("lifestyle"))
    );
    setSelectedTypes(new Set(residentialTypes));
  };

  // New handler for view mode toggle
  const handleViewModeToggle = () => {
    setViewMode((prev) => (prev === "polygons" ? "heatmap" : "polygons"));
  };

  return (
    <div style={{ height: "100vh", width: "100%" }}>
      <APIProvider apiKey={process.env.NEXT_PUBLIC_MAPS_API_KEY!}>
        <FilterBox
          types={propertyTypes}
          selectedTypes={selectedTypes}
          onFilterChange={handleFilterChange}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onResidentialOnly={handleResidentialOnly}
          viewMode={viewMode}
          onViewModeToggle={handleViewModeToggle}
        />
        <Map
          defaultCenter={QLDC_CENTER}
          defaultZoom={12}
          gestureHandling={"greedy"}
          disableDefaultUI={true}
          defaultTilt={45}
          mapTypeControl={true}
          mapTypeControlOptions={mapTypeControlOptions}
          mapId="my-map-id"
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
