import { useSyncExternalStore, type ComponentType } from "react";
import type { City, FireRecord, Hotspot } from "@/lib/catalog";

export type MapFilters = {
  year: number | "all";
  cause: "all" | "l" | "h";
  minHa: number;
  showHotspots: boolean;
  showFootprints: boolean;
  showCities: boolean;
  basemap: "dark" | "sat";
};

export type FireMapProps = {
  fires: FireRecord[];
  hotspots: Hotspot[];
  cities: City[];
  selectedCity: City | null;
  selectedFire: FireRecord | null;
  filters: MapFilters;
  onSelectCity: (city: City) => void;
  onSelectFire: (fire: FireRecord | null) => void;
};

let mapInner: ComponentType<FireMapProps> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

if (typeof window !== "undefined") {
  void import("./fire-map-inner")
    .then((mod) => {
      mapInner = mod.FireMapInner;
      emit();
    })
    .catch((err) => {
      console.error("Failed to load map engine", err);
    });
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

function getSnapshot() {
  return mapInner;
}

function getServerSnapshot() {
  return null;
}

export function FireMap(props: FireMapProps) {
  const Inner = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (!Inner) {
    return (
      <div className="flex h-full w-full items-end bg-bg p-4" aria-hidden="true">
        <p className="text-2xs uppercase tracking-caps text-subtle">Loading terrain</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <Inner {...props} />
    </div>
  );
}
