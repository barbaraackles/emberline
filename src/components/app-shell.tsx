import { useMemo, useState, type ReactNode } from "react";
import { Flame, Layers, Satellite } from "lucide-react";
import {
  catalog,
  YEAR_MAX,
  YEAR_MIN,
  type City,
  type FireRecord,
} from "@/lib/catalog";
import { FireMap, type MapFilters } from "@/components/fire-map";
import { SidePanel } from "@/components/side-panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const YEARS = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i);

type Tab = "decade" | "hotspots" | "cities" | "plan";

export function AppShell() {
  const [year, setYear] = useState<number | "all">("all");
  const [cause, setCause] = useState<"all" | "l" | "h">("all");
  const [minHa, setMinHa] = useState(1);
  const [basemap, setBasemap] = useState<"dark" | "sat">("dark");
  const [showHotspots, setShowHotspots] = useState(true);
  const [showFootprints, setShowFootprints] = useState(true);
  const [showCities, setShowCities] = useState(true);
  const [city, setCity] = useState<City | null>(null);
  const [fire, setFire] = useState<FireRecord | null>(null);
  const [tab, setTab] = useState<Tab>("decade");
  const [mobilePanel, setMobilePanel] = useState(false);

  const fires = useMemo(() => {
    return catalog.fires.filter((f) => {
      if (year !== "all" && f.y !== year) return false;
      if (cause !== "all" && f.cause !== cause) return false;
      if (f.ha < minHa) return false;
      return true;
    });
  }, [year, cause, minHa]);

  const filters: MapFilters = {
    year,
    cause,
    minHa,
    showHotspots,
    showFootprints,
    showCities,
    basemap,
  };

  function selectCity(next: City) {
    setCity(next);
    setFire(null);
    setTab("plan");
    setMobilePanel(true);
  }

  return (
    <div className="flex h-dvh flex-col bg-bg text-fg">
      <header className="flex shrink-0 flex-col gap-2 border-b border-border px-4 py-2.5 lg:px-5">
        <div className="flex items-center gap-3">
          <div className="flex shrink-0 items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-sm bg-ember text-fg">
              <Flame className="size-4" strokeWidth={1.75} />
            </span>
            <div>
              <p className="font-display text-lg leading-none tracking-tight">Emberline</p>
              <p className="mt-0.5 text-2xs uppercase tracking-caps text-subtle">
                B.C. wildfire perimeters
              </p>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
            <Chip active={year === "all"} onClick={() => setYear("all")}>
              2015–25
            </Chip>
            {YEARS.map((y) => (
              <Chip key={y} active={year === y} onClick={() => setYear(y)}>
                {y}
              </Chip>
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 lg:hidden"
            onClick={() => setMobilePanel((v) => !v)}
          >
            {mobilePanel ? "Map" : "Analysis"}
          </Button>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          <Chip active={cause === "all"} onClick={() => setCause("all")}>
            All causes
          </Chip>
          <Chip active={cause === "l"} onClick={() => setCause("l")}>
            Lightning
          </Chip>
          <Chip active={cause === "h"} onClick={() => setCause("h")}>
            Human
          </Chip>
          <span className="mx-1 hidden h-4 w-px shrink-0 bg-border-strong sm:block" />
          {[1, 5, 100, 1000].map((n) => (
            <Chip key={n} active={minHa === n} onClick={() => setMinHa(n)}>
              {n === 1 ? "1 ha+" : n >= 1000 ? "1,000 ha+" : `${n} ha+`}
            </Chip>
          ))}
          <span className="mx-1 hidden h-4 w-px shrink-0 bg-border-strong sm:block" />
          <IconChip
            label={basemap === "sat" ? "Satellite" : "Map"}
            pressed={basemap === "sat"}
            onClick={() => setBasemap((b) => (b === "sat" ? "dark" : "sat"))}
          >
            <Satellite className="size-3.5" />
          </IconChip>
          <IconChip
            label="Hotspots"
            pressed={showHotspots}
            onClick={() => setShowHotspots((v) => !v)}
          >
            <Layers className="size-3.5" />
          </IconChip>
          <IconChip
            label="Burn footprints"
            pressed={showFootprints}
            onClick={() => setShowFootprints((v) => !v)}
          >
            <Flame className="size-3.5" />
          </IconChip>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        <section className="relative min-h-64 min-w-0 flex-1 bg-bg">
          <div className="absolute inset-0">
            <FireMap
              fires={fires}
              hotspots={catalog.hotspots}
              cities={catalog.cities}
              selectedCity={city}
              selectedFire={fire}
              filters={filters}
              onSelectCity={selectCity}
              onSelectFire={(f) => {
                setFire(f);
                setTab("decade");
                setMobilePanel(true);
              }}
            />
          </div>
          <div className="pointer-events-none absolute left-3 top-3 hidden rounded-md bg-bg/80 px-3 py-2 text-2xs text-muted lg:block">
            {fires.length.toLocaleString("en-CA")} mapped fires
            {year === "all" ? " · 2015–2025" : ` · ${year}`}
            {city ? ` · ${city.name} 2 / 10 / 25 km` : " · 3D terrain"}
          </div>
        </section>

        <section
          className={cn(
            "min-h-0 w-full bg-surface lg:relative lg:flex lg:w-96 lg:flex-col lg:border-l lg:border-border",
            "max-lg:absolute max-lg:inset-0 max-lg:z-10",
            mobilePanel ? "flex flex-col" : "hidden lg:flex",
          )}
        >
          <SidePanel
            tab={tab}
            onTab={setTab}
            city={city}
            onSelectCity={selectCity}
            fire={fire}
            hotspots={catalog.hotspots}
            year={year}
          />
        </section>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 shrink-0 rounded-full px-2.5 text-2xs font-medium tracking-wide transition-[background-color,color] duration-150",
        active ? "bg-accent text-accent-fg" : "bg-raised text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function IconChip({
  pressed,
  onClick,
  label,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full transition-[background-color,color] duration-150",
        pressed ? "bg-accent text-accent-fg" : "bg-raised text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
