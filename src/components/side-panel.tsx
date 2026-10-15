import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  catalog,
  type City,
  type FireRecord,
  type Hotspot,
  causeLabel,
  centreLabel,
  formatCompact,
  formatCost,
  formatHa,
  officialTotals,
  prettyName,
  ratingLabel,
} from "@/lib/catalog";
import { buildPlan, nearbyHotspots } from "@/lib/plan";
import { cn, haversineKm } from "@/lib/utils";
import { AreaBurnedChart, CauseChart, CostChart } from "@/components/decade-charts";
import { Badge, RatingBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Tab = "decade" | "hotspots" | "cities" | "plan";

export function SidePanel({
  tab,
  onTab,
  city,
  onSelectCity,
  fire,
  hotspots,
  year,
}: {
  tab: Tab;
  onTab: (tab: Tab) => void;
  city: City | null;
  onSelectCity: (city: City) => void;
  fire: FireRecord | null;
  hotspots: Hotspot[];
  year: number | "all";
}) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "decade", label: "Decade" },
    { id: "hotspots", label: "Hotspots" },
    { id: "cities", label: "Cities" },
    { id: "plan", label: "Plan" },
  ];

  return (
    <aside className="flex h-full min-h-0 flex-col bg-surface">
      <div className="flex gap-1 p-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTab(t.id)}
            className={cn(
              "h-10 flex-1 rounded-sm text-xs font-medium transition-[background-color,color] duration-150",
              tab === t.id ? "bg-raised text-fg" : "text-muted hover:text-fg",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-1">
        {tab === "decade" && <DecadeTab year={year} fire={fire} />}
        {tab === "hotspots" && (
          <HotspotsTab
            hotspots={hotspots}
            onSelectCity={onSelectCity}
            onOpenPlan={() => onTab("plan")}
          />
        )}
        {tab === "cities" && (
          <CitiesTab
            city={city}
            onSelectCity={(c) => {
              onSelectCity(c);
              onTab("plan");
            }}
          />
        )}
        {tab === "plan" && (
          <PlanTab city={city} hotspots={hotspots} onSelectCity={onSelectCity} />
        )}
      </div>
    </aside>
  );
}

function DecadeTab({
  year,
  fire,
}: {
  year: number | "all";
  fire: FireRecord | null;
}) {
  const row =
    year === "all"
      ? null
      : catalog.official.find((y) => y.year === year) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-2xs font-medium uppercase tracking-caps text-subtle">
          British Columbia · 2015–2025
        </p>
        <h2 className="mt-1 font-display text-2xl leading-tight text-fg">
          A decade of fire, measured from the official record.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          BC Wildfire Service season totals. Mapped points are incidents of 1 hectare
          or more from the historical incident layer.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <Stat
          label={year === "all" ? "Area burned" : `${year} area`}
          value={formatHa(row ? row.ha : officialTotals.ha)}
        />
        <Stat
          label="Wildfires"
          value={formatCompact(row ? row.fires : officialTotals.fires)}
        />
        <Stat
          label={row?.costM == null ? "Suppression 2015–24" : "Season cost"}
          value={formatCost(row?.costM ?? officialTotals.costM)}
        />
        <Stat
          label="Lightning share"
          value={`${Math.round(
            (100 * (row ? row.lightning : officialTotals.lightning)) /
              (row ? row.fires : officialTotals.fires),
          )}%`}
        />
      </div>

      <section>
        <h3 className="text-2xs font-medium uppercase tracking-caps text-subtle">
          Hectares burned
        </h3>
        <AreaBurnedChart />
        <p className="mt-1 text-xs leading-relaxed text-subtle">
          2023 is the record: 2.84 million hectares — more than 2015, 2016, 2019,
          2020 and 2022 combined.
        </p>
      </section>

      <section>
        <h3 className="text-2xs font-medium uppercase tracking-caps text-subtle">
          Starts by cause
        </h3>
        <CauseChart />
        <p className="mt-1 text-xs leading-relaxed text-subtle">
          Lightning is about 60% of starts and most of the area. Human starts cluster
          on the town perimeter — that is the prevention problem.
        </p>
      </section>

      <section>
        <h3 className="text-2xs font-medium uppercase tracking-caps text-subtle">
          Suppression cost
        </h3>
        <CostChart />
      </section>

      {fire ? (
        <section className="rounded-lg bg-raised p-4">
          <p className="text-2xs font-medium uppercase tracking-caps text-subtle">
            Selected fire
          </p>
          <h3 className="mt-1 font-display text-xl text-fg">{prettyName(fire.name)}</h3>
          <p className="mt-1 text-sm text-muted">
            {fire.y} · {formatHa(fire.ha)} · {causeLabel(fire.cause)} ·{" "}
            {centreLabel(String(fire.centre))} Fire Centre
          </p>
          <p className="mt-2 font-mono text-xs text-subtle">{fire.id}</p>
        </section>
      ) : null}

      <p className="text-xs leading-relaxed text-subtle">
        Sources: {catalog.meta.source}. Season totals from {catalog.meta.statsSource}.
        Retrieved {catalog.meta.retrieved}. This is a planning aid, not an operational
        fire-control system.
      </p>
    </div>
  );
}

function HotspotsTab({
  hotspots,
  onSelectCity,
  onOpenPlan,
}: {
  hotspots: Hotspot[];
  onSelectCity: (city: City) => void;
  onOpenPlan: () => void;
}) {
  const landscape = useMemo(
    () => [...hotspots].sort((a, b) => b.ha - a.ha).slice(0, 8),
    [hotspots],
  );
  const interfaceCells = useMemo(() => {
    return hotspots
      .map((h) => {
        let nearest: City | null = null;
        let dist = Infinity;
        for (const c of catalog.cities) {
          const d = haversineKm(h.lat, h.lng, c.lat, c.lng);
          if (d < dist) {
            dist = d;
            nearest = c;
          }
        }
        return { h, nearest, dist };
      })
      .filter((x) => x.dist <= 40 && x.h.human >= 8)
      .sort((a, b) => b.h.human - a.h.human || a.dist - b.dist)
      .slice(0, 10);
  }, [hotspots]);

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-2xs font-medium uppercase tracking-caps text-subtle">
          Kernel of the last decade
        </p>
        <h2 className="mt-1 font-display text-2xl leading-tight">
          Two kinds of heat: people, and landscape.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Cells are 0.2° (~20 km). Interface cells sit within 40 km of a town and are
          heavy with human starts. Landscape cells are ranked by area burned.
        </p>
      </header>

      <section>
        <h3 className="text-2xs font-medium uppercase tracking-caps text-subtle">
          Interface ignition cells
        </h3>
        <ul className="mt-2 divide-y divide-border">
          {interfaceCells.map(({ h, nearest, dist }) => (
            <li key={`${h.lat}-${h.lng}`} className="py-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm text-fg">
                  {nearest ? nearest.name : "Unsettled"}{" "}
                  <span className="text-subtle">
                    {dist < 100 ? `${dist.toFixed(0)} km` : ""}
                  </span>
                </p>
                <p className="font-mono text-xs tabular-nums text-muted">
                  {h.human} human
                </p>
              </div>
              <p className="mt-0.5 text-xs text-subtle">
                {h.n} starts · {formatHa(h.ha)} · peak {h.topYear}
              </p>
              {nearest ? (
                <button
                  type="button"
                  className="mt-2 text-xs text-accent underline-offset-2 hover:underline"
                  onClick={() => {
                    onSelectCity(nearest);
                    onOpenPlan();
                  }}
                >
                  Open {nearest.name} plan
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-2xs font-medium uppercase tracking-caps text-subtle">
          Landscape burn cells
        </h3>
        <ul className="mt-2 divide-y divide-border">
          {landscape.map((h) => (
            <li key={`l-${h.lat}-${h.lng}`} className="flex items-baseline justify-between gap-3 py-3">
              <p className="text-sm text-fg">
                {h.lat.toFixed(1)}° N, {Math.abs(h.lng).toFixed(1)}° W
                <span className="mt-0.5 block text-xs text-subtle">
                  {h.n} starts · peak {h.topYear} ·{" "}
                  {h.lightning >= h.human ? "lightning" : "human"}-led
                </span>
              </p>
              <p className="font-mono text-xs tabular-nums text-muted">{formatHa(h.ha)}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function CitiesTab({
  city,
  onSelectCity,
}: {
  city: City | null;
  onSelectCity: (city: City) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return catalog.cities;
    return catalog.cities.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.region.toLowerCase().includes(s),
    );
  }, [q]);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="text-2xs font-medium uppercase tracking-caps text-subtle">
          Municipal perimeters
        </p>
        <h2 className="mt-1 font-display text-2xl leading-tight">
          Ranked by fire against the town edge.
        </h2>
      </header>
      <label className="relative block">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search a city or region"
          className="h-11 w-full rounded-md bg-raised pl-10 pr-3 text-sm text-fg placeholder:text-subtle shadow-border outline-none focus:ring-2 focus:ring-accent/50"
        />
      </label>
      <ul className="divide-y divide-border">
        {filtered.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelectCity(c)}
              className={cn(
                "flex w-full items-start justify-between gap-3 py-3 text-left transition-colors duration-150",
                city?.id === c.id ? "text-fg" : "text-muted hover:text-fg",
              )}
            >
              <span>
                <span className="block text-sm text-fg">{c.name}</span>
                <span className="mt-0.5 block text-xs text-subtle">
                  {c.region} · {c.starts10} starts inside 10 km
                </span>
              </span>
              <RatingBadge rating={c.rating} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlanTab({
  city,
  hotspots,
  onSelectCity,
}: {
  city: City | null;
  hotspots: Hotspot[];
  onSelectCity: (city: City) => void;
}) {
  const plan = city ? buildPlan(city, hotspots) : null;
  const local = city ? nearbyHotspots(city, hotspots) : [];

  if (!plan || !city) {
    return (
      <div className="flex flex-col gap-4">
        <h2 className="font-display text-2xl leading-tight">
          Choose a municipality to write its perimeter plan.
        </h2>
        <p className="text-sm leading-relaxed text-muted">
          Ranked starting points — the places where the last decade already tested
          the town edge.
        </p>
        <ul className="divide-y divide-border">
          {catalog.cities.slice(0, 8).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelectCity(c)}
                className="flex w-full items-center justify-between py-3 text-left"
              >
                <span>
                  <span className="block text-sm text-fg">{c.name}</span>
                  <span className="text-xs text-subtle">{c.region}</span>
                </span>
                <RatingBadge rating={c.rating} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="flex items-center gap-2">
          <RatingBadge rating={city.rating} />
          <Badge>{ratingLabel(city.rating)} · {city.score.toFixed(0)}</Badge>
        </div>
        <h2 className="mt-3 font-display text-2xl leading-tight">{city.name}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{plan.headline}</p>
      </header>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="10 km fires" value={String(city.n10)} />
        <Stat label="Burned 10 km" value={formatHa(city.ha10)} />
        <Stat label="Human starts" value={String(city.human10)} />
      </div>

      <p className="text-sm leading-relaxed text-muted">{plan.situation}</p>
      <p className="text-sm leading-relaxed text-muted">{plan.ignition}</p>

      {city.nearby.length ? (
        <section>
          <h3 className="text-2xs font-medium uppercase tracking-caps text-subtle">
            Nearby fires
          </h3>
          <ul className="mt-2 divide-y divide-border">
            {city.nearby.map((f) => (
              <li
                key={f.id + f.y}
                className="flex items-baseline justify-between gap-3 py-2.5"
              >
                <span>
                  <span className="block text-sm text-fg">{prettyName(f.name)}</span>
                  <span className="text-xs text-subtle">
                    {f.y} · {f.km} km · {causeLabel(f.cause)}
                  </span>
                </span>
                <span className="font-mono text-xs tabular-nums text-muted">
                  {formatHa(f.ha)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {local.length ? (
        <section>
          <h3 className="text-2xs font-medium uppercase tracking-caps text-subtle">
            Perimeter hotspot cells
          </h3>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            {local.map((h) => (
              <li key={`${h.lat}-${h.lng}`}>
                {h.n} starts · {formatHa(h.ha)} · {h.human} human · peak {h.topYear}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h3 className="text-2xs font-medium uppercase tracking-caps text-subtle">
          Prevention actions
        </h3>
        {plan.actions.map((a) => (
          <article key={a.title} className="rounded-lg bg-raised p-4">
            <p className="text-2xs font-medium uppercase tracking-caps text-subtle">
              {a.zone}
            </p>
            <h4 className="mt-1 text-sm font-medium text-fg">{a.title}</h4>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{a.detail}</p>
          </article>
        ))}
      </section>

      <section>
        <h3 className="text-2xs font-medium uppercase tracking-caps text-subtle">
          Twelve-month work
        </h3>
        <ul className="mt-2 divide-y divide-border">
          {plan.calendar.map((m) => (
            <li key={m.when} className="py-3">
              <p className="text-sm font-medium text-fg">{m.when}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{m.work}</p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="text-2xs font-medium uppercase tracking-caps text-subtle">
          Who to sit with
        </h3>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-muted">
          {plan.partners.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>

      <CopyPlan city={city} />
    </div>
  );
}

function CopyPlan({ city }: { city: City }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        const plan = buildPlan(city, catalog.hotspots);
        const text = [
          `Emberline perimeter plan — ${city.name}`,
          ratingLabel(city.rating),
          "",
          plan.headline,
          "",
          plan.situation,
          "",
          plan.ignition,
          "",
          ...plan.actions.map((a) => `${a.zone}: ${a.title}\n${a.detail}`),
          "",
          ...plan.calendar.map((m) => `${m.when}: ${m.work}`),
        ].join("\n");
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          window.setTimeout(() => setDone(false), 1800);
        } catch {
          setDone(false);
        }
      }}
    >
      {done ? "Copied" : "Copy plan"}
    </Button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-raised px-3 py-3">
      <p className="text-2xs font-medium uppercase tracking-caps text-subtle">
        {label}
      </p>
      <p className="mt-1 font-display text-xl tabular-nums leading-none text-fg">
        {value}
      </p>
    </div>
  );
}
