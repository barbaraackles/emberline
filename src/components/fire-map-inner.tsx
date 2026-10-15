import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FireMapProps } from "@/components/fire-map";
import {
  causeLabel,
  prettyName,
  formatHa,
  type City,
  type FireRecord,
} from "@/lib/catalog";

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

const BC_BOUNDS: maplibregl.LngLatBoundsLike = [
  [-141.2, 47.4],
  [-112.6, 60.9],
];

const CARTO_TILES = [
  "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
  "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
  "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
  "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
];

const ESRI_TILES = [
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
];

const TERRAIN_TILES = [
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
];

const HIT_LAYERS = ["cities-circle", "fires-circle"] as const;

function footprintRadiusM(ha: number): number {
  return Math.sqrt((ha * 10000) / Math.PI);
}

function circlePolygon(lng: number, lat: number, radiusM: number, steps = 48): GeoJSON.Polygon {
  const coords: [number, number][] = [];
  const latRad = (lat * Math.PI) / 180;
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos(latRad);
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    coords.push([lng + (radiusM * Math.cos(a)) / mPerDegLng, lat + (radiusM * Math.sin(a)) / mPerDegLat]);
  }
  return { type: "Polygon", coordinates: [coords] };
}

function firesToGeoJSON(fires: FireRecord[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: fires.map((f) => ({
      type: "Feature" as const,
      properties: { id: f.id, ha: f.ha, cause: f.cause },
      geometry: { type: "Point" as const, coordinates: [f.lng, f.lat] },
    })),
  };
}

function citiesToGeoJSON(cities: City[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: cities.map((c) => ({
      type: "Feature" as const,
      properties: { id: c.id, name: c.name },
      geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] },
    })),
  };
}

function footprintsToGeoJSON(fires: FireRecord[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: fires
      .filter((f) => f.ha >= 500)
      .map((f) => ({
        type: "Feature" as const,
        properties: { id: f.id, cause: f.cause },
        geometry: circlePolygon(f.lng, f.lat, footprintRadiusM(f.ha), 40),
      })),
  };
}

function selectionToGeoJSON(
  city: City | null,
  fire: FireRecord | null,
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  if (city) {
    features.push(
      {
        type: "Feature",
        properties: { kind: "hiz" },
        geometry: circlePolygon(city.lng, city.lat, 2_000, 64),
      },
      {
        type: "Feature",
        properties: { kind: "community" },
        geometry: circlePolygon(city.lng, city.lat, 10_000, 64),
      },
      {
        type: "Feature",
        properties: { kind: "landscape" },
        geometry: circlePolygon(city.lng, city.lat, 25_000, 64),
      },
    );
  }
  if (fire) {
    features.push({
      type: "Feature",
      properties: { kind: "selected-fire" },
      geometry: circlePolygon(
        fire.lng,
        fire.lat,
        Math.max(400, footprintRadiusM(fire.ha) * 0.15),
        48,
      ),
    });
  }
  return { type: "FeatureCollection", features };
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function setSourceData(map: maplibregl.Map, id: string, data: GeoJSON.FeatureCollection) {
  const src = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
  src?.setData(data);
}

function buildStyle(basemap: "dark" | "sat"): maplibregl.StyleSpecification {
  return {
    version: 8,
    glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
    sources: {
      basemap: {
        type: "raster",
        tiles: basemap === "sat" ? ESRI_TILES : CARTO_TILES,
        tileSize: 256,
        attribution:
          "© OpenStreetMap © CARTO · Tiles © Esri · Terrain AWS/Mapzen",
        maxzoom: 19,
      },
      terrain: {
        type: "raster-dem",
        tiles: TERRAIN_TILES,
        encoding: "terrarium",
        tileSize: 256,
        maxzoom: 15,
      },
      hillshade: {
        type: "raster-dem",
        tiles: TERRAIN_TILES,
        encoding: "terrarium",
        tileSize: 256,
        maxzoom: 15,
      },
      fires: { type: "geojson", data: EMPTY },
      cities: { type: "geojson", data: EMPTY },
      footprints: { type: "geojson", data: EMPTY },
      selection: { type: "geojson", data: EMPTY },
    },
    layers: [
      {
        id: "basemap",
        type: "raster",
        source: "basemap",
      },
      {
        id: "hillshade",
        type: "hillshade",
        source: "hillshade",
        paint: {
          "hillshade-exaggeration": basemap === "sat" ? 0.22 : 0.38,
          "hillshade-shadow-color": "#0e0d0c",
          "hillshade-highlight-color": "#ece8e1",
          "hillshade-accent-color": "#c24b32",
          "hillshade-illumination-direction": 315,
        },
      },
      {
        id: "footprints-fill",
        type: "fill",
        source: "footprints",
        paint: {
          "fill-color": "#c24b32",
          "fill-opacity": 0.08,
        },
      },
      {
        id: "footprints-line",
        type: "line",
        source: "footprints",
        paint: {
          "line-color": [
            "match",
            ["get", "cause"],
            "h",
            "#c24b32",
            "#d7d0c4",
          ],
          "line-width": 0.7,
          "line-opacity": 0.35,
        },
      },
      {
        id: "buffer-fill",
        type: "fill",
        source: "selection",
        filter: ["in", ["get", "kind"], ["literal", ["hiz", "community", "landscape"]]],
        paint: {
          "fill-color": [
            "match",
            ["get", "kind"],
            "hiz",
            "#ece8e1",
            "community",
            "#c24b32",
            "#9a948a",
          ],
          "fill-opacity": [
            "match",
            ["get", "kind"],
            "hiz",
            0.04,
            "community",
            0.05,
            0.03,
          ],
        },
      },
      {
        id: "buffer-line",
        type: "line",
        source: "selection",
        paint: {
          "line-color": [
            "match",
            ["get", "kind"],
            "hiz",
            "#ece8e1",
            "community",
            "#c24b32",
            "landscape",
            "#9a948a",
            "#ece8e1",
          ],
          "line-width": [
            "match",
            ["get", "kind"],
            "hiz",
            1.2,
            "community",
            1.1,
            "selected-fire",
            1.6,
            0.8,
          ],
          "line-dasharray": [
            "match",
            ["get", "kind"],
            "hiz",
            ["literal", [1, 1.4]],
            "landscape",
            ["literal", [0.4, 1.6]],
            ["literal", [1, 0]],
          ],
          "line-opacity": 0.85,
        },
      },
      {
        id: "fires-heat",
        type: "heatmap",
        source: "fires",
        maxzoom: 13,
        paint: {
          "heatmap-weight": [
            "interpolate",
            ["linear"],
            ["get", "ha"],
            1,
            0.18,
            100,
            0.45,
            1000,
            0.75,
            20000,
            1,
          ],
          "heatmap-intensity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            1.15,
            9,
            1.35,
            12,
            1.7,
          ],
          "heatmap-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            22,
            8,
            28,
            12,
            40,
          ],
          "heatmap-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            0.88,
            9,
            0.55,
            12,
            0.14,
          ],
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,
            "rgba(194,75,50,0)",
            0.15,
            "rgba(194,75,50,0.18)",
            0.35,
            "rgba(194,75,50,0.45)",
            0.6,
            "rgba(214,140,90,0.7)",
            0.85,
            "rgba(232,200,150,0.88)",
            1,
            "rgba(236,232,225,0.95)",
          ],
        },
      },
      {
        id: "fires-circle",
        type: "circle",
        source: "fires",
        paint: {
          "circle-radius": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            [
              "+",
              2.1,
              [
                "*",
                5.4,
                ["/", ["ln", ["+", ["get", "ha"], 1]], ["ln", 20001]],
              ],
            ],
            12,
            [
              "+",
              4,
              [
                "*",
                14,
                ["/", ["ln", ["+", ["get", "ha"], 1]], ["ln", 20001]],
              ],
            ],
          ],
          "circle-color": ["match", ["get", "cause"], "h", "#c24b32", "#d7d0c4"],
          "circle-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            0.42,
            8,
            0.72,
            12,
            0.88,
          ],
          "circle-stroke-width": 0.6,
          "circle-stroke-color": ["match", ["get", "cause"], "h", "#c24b32", "#ece8e1"],
          "circle-pitch-alignment": "map",
        },
      },
      {
        id: "cities-circle",
        type: "circle",
        source: "cities",
        paint: {
          "circle-radius": 5,
          "circle-color": "#171513",
          "circle-stroke-width": 1.25,
          "circle-stroke-color": "#e8e0d4",
          "circle-pitch-alignment": "viewport",
        },
      },
    ],
    terrain: { source: "terrain", exaggeration: 0.95 },
    sky: {
      "sky-color": "#0e0d0c",
      "sky-horizon-blend": 0.6,
      "horizon-color": "#1f1c19",
      "horizon-fog-blend": 0.7,
      "fog-color": "#171513",
      "fog-ground-blend": 0.45,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 4, 0.55, 8, 0],
    },
    light: {
      anchor: "viewport",
      color: "#ece8e1",
      intensity: 0.35,
      position: [1.15, 210, 28],
    },
  };
}

export function FireMapInner(props: FireMapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const lastCityId = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const wrap = wrapRef.current;
    const host = hostRef.current;
    if (!wrap || !host) return;

    const tooltip = document.createElement("div");
    tooltip.className =
      "pointer-events-none absolute z-10 hidden max-w-56 rounded-xs bg-surface px-2 py-1.5 shadow-border";
    tooltip.innerHTML =
      '<p data-title class="text-xs font-medium leading-snug text-fg"></p><p data-sub class="text-2xs text-muted"></p>';
    host.appendChild(tooltip);
    tooltipRef.current = tooltip;

    const map = new maplibregl.Map({
      container: wrap,
      style: buildStyle(propsRef.current.filters.basemap),
      center: [-124.8, 53.2],
      zoom: 5.2,
      minZoom: 5,
      maxZoom: 14,
      pitch: 40,
      bearing: -14,
      maxPitch: 75,
      maxBounds: BC_BOUNDS,
      attributionControl: false,
      fadeDuration: prefersReducedMotion() ? 0 : 300,
      canvasContextAttributes: { antialias: true, failIfMajorPerformanceCaveat: false },
      renderWorldCopies: false,
    });
    mapRef.current = map;

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      "bottom-right",
    );
    map.addControl(
      new maplibregl.NavigationControl({
        visualizePitch: true,
        showZoom: true,
        showCompass: true,
      }),
      "bottom-left",
    );
    map.addControl(
      new maplibregl.TerrainControl({ source: "terrain", exaggeration: 1.2 }),
      "bottom-left",
    );

    const applyTerrainForZoom = () => {
      const z = map.getZoom();
      const exaggeration = z < 7 ? 0.95 : z < 9.5 ? 1.2 : 1.4;
      map.setTerrain({ source: "terrain", exaggeration });
    };

    const onLoad = () => {
      map.resize();
      applyTerrainForZoom();
      syncFromProps(map, propsRef.current);
      setReady(true);
    };
    map.on("load", onLoad);
    map.on("zoomend", applyTerrainForZoom);

    map.on("click", (e) => {
      const hits = map.queryRenderedFeatures(e.point, { layers: [...HIT_LAYERS] });
      const p = propsRef.current;
      if (!hits.length) {
        p.onSelectFire(null);
        return;
      }
      const hit = hits[0];
      const id = String(hit.properties?.id ?? "");
      if (hit.layer.id === "cities-circle") {
        const city = p.cities.find((c) => c.id === id);
        if (city) p.onSelectCity(city);
        return;
      }
      const fire = p.fires.find((f) => f.id === id);
      if (fire) p.onSelectFire(fire);
    });

    map.on("mousemove", (e) => {
      const tooltip = tooltipRef.current;
      if (!tooltip) return;
      const hits = map.queryRenderedFeatures(e.point, { layers: [...HIT_LAYERS] });
      map.getCanvas().style.cursor = hits.length ? "pointer" : "";
      if (!hits.length) {
        tooltip.classList.add("hidden");
        return;
      }
      const hit = hits[0];
      const id = String(hit.properties?.id ?? "");
      const p = propsRef.current;
      let title = "";
      let sub = "";
      if (hit.layer.id === "cities-circle") {
        const city = p.cities.find((c) => c.id === id);
        if (!city) {
          tooltip.classList.add("hidden");
          return;
        }
        title = city.name;
        sub = city.region;
      } else {
        const fire = p.fires.find((f) => f.id === id);
        if (!fire) {
          tooltip.classList.add("hidden");
          return;
        }
        title = `${prettyName(fire.name)} · ${fire.y}`;
        sub = `${formatHa(fire.ha)} · ${causeLabel(fire.cause)}`;
      }
      tooltip.classList.remove("hidden");
      tooltip.style.left = `${e.point.x + 14}px`;
      tooltip.style.top = `${e.point.y + 14}px`;
      const heading = tooltip.querySelector("[data-title]");
      const body = tooltip.querySelector("[data-sub]");
      if (heading) heading.textContent = title;
      if (body) body.textContent = sub;
    });

    map.on("mouseleave", () => {
      tooltip.classList.add("hidden");
    });
    wrap.addEventListener("mouseleave", () => {
      tooltip.classList.add("hidden");
    });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(wrap);

    return () => {
      setReady(false);
      ro.disconnect();
      tooltip.remove();
      tooltipRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // Map is created once; later prop changes flow through the sync effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    syncFromProps(map, props);
  }, [
    ready,
    props.fires,
    props.cities,
    props.selectedCity,
    props.selectedFire,
    props.filters.basemap,
    props.filters.showHotspots,
    props.filters.showFootprints,
    props.filters.showCities,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    const city = props.selectedCity;
    if (!map || !ready || !city) return;
    if (lastCityId.current === city.id) return;
    lastCityId.current = city.id;
    const camera = {
      center: [city.lng, city.lat] as [number, number],
      zoom: 10.4,
      pitch: 56,
      bearing: -22,
    };
    if (prefersReducedMotion()) {
      map.jumpTo(camera);
    } else {
      map.flyTo({ ...camera, duration: 1100, essential: true });
    }
  }, [ready, props.selectedCity]);

  return (
    <div ref={hostRef} className="relative h-full w-full bg-bg">
      <div ref={wrapRef} className="h-full w-full" />
    </div>
  );
}

function syncFromProps(map: maplibregl.Map, props: FireMapProps) {
  if (!map.getSource("fires")) return;

  setSourceData(map, "fires", firesToGeoJSON(props.fires));
  setSourceData(
    map,
    "cities",
    props.filters.showCities ? citiesToGeoJSON(props.cities) : EMPTY,
  );
  setSourceData(
    map,
    "footprints",
    props.filters.showFootprints ? footprintsToGeoJSON(props.fires) : EMPTY,
  );
  setSourceData(map, "selection", selectionToGeoJSON(props.selectedCity, props.selectedFire));

  map.setLayoutProperty(
    "fires-heat",
    "visibility",
    props.filters.showHotspots ? "visible" : "none",
  );

  const basemap = map.getSource("basemap") as maplibregl.RasterTileSource | undefined;
  if (basemap) {
    const tiles = props.filters.basemap === "sat" ? ESRI_TILES : CARTO_TILES;
    basemap.setTiles(tiles);
  }
  if (map.getLayer("hillshade")) {
    map.setPaintProperty(
      "hillshade",
      "hillshade-exaggeration",
      props.filters.basemap === "sat" ? 0.22 : 0.38,
    );
  }

  const cityId = props.selectedCity?.id ?? "";
  map.setPaintProperty("cities-circle", "circle-radius", [
    "case",
    ["==", ["get", "id"], cityId],
    7,
    5,
  ]);
  map.setPaintProperty("cities-circle", "circle-stroke-width", [
    "case",
    ["==", ["get", "id"], cityId],
    2,
    1.25,
  ]);
  map.setPaintProperty("cities-circle", "circle-color", [
    "case",
    ["==", ["get", "id"], cityId],
    "#ece8e1",
    "#171513",
  ]);

  const fireId = props.selectedFire?.id ?? "";
  map.setPaintProperty("fires-circle", "circle-stroke-width", [
    "case",
    ["==", ["get", "id"], fireId],
    2,
    0.6,
  ]);
  map.setPaintProperty("fires-circle", "circle-stroke-color", [
    "case",
    ["==", ["get", "id"], fireId],
    "#ece8e1",
    ["match", ["get", "cause"], "h", "#c24b32", "#ece8e1"],
  ]);
}
