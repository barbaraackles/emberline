import {
  type City,
  type Hotspot,
  causeLabel,
  prettyName,
  formatHa,
  ratingLabel,
} from "@/lib/catalog";
import { haversineKm } from "@/lib/utils";

export type PlanAction = {
  zone: string;
  title: string;
  detail: string;
};

export type PlanMonth = {
  when: string;
  work: string;
};

export type CityPlan = {
  city: City;
  headline: string;
  situation: string;
  ignition: string;
  actions: PlanAction[];
  calendar: PlanMonth[];
  partners: string[];
};

function regionPlay(region: string): { fuel: string; wind: string } {
  const r = region.toLowerCase();
  if (r.includes("okanagan") || r.includes("similkameen") || r.includes("nicola")) {
    return {
      fuel: "Ponderosa pine, bunchgrass and sage on dry benches. Fine fuels cure early and carry fire into the home ignition zone.",
      wind: "Afternoon valley winds and lake-effect gusts throw embers across water and into subdivisions.",
    };
  }
  if (r.includes("fraser canyon") || r.includes("thompson")) {
    return {
      fuel: "Grass, sage and Interior Douglas-fir on steep canyon walls. Heat pooling in the Fraser and Thompson trenches dries fuels to extreme levels.",
      wind: "Channeled canyon winds; spotting distances of several kilometres are documented on Elephant Hill and Lytton Creek.",
    };
  }
  if (r.includes("cariboo") || r.includes("nechako") || r.includes("lakes")) {
    return {
      fuel: "Lodgepole pine (including beetle-killed stands) over a continuous landscape. Fires merge into complexes measured in hundreds of thousands of hectares.",
      wind: "Synoptic dry lightning and west winds push fire through plateau forest with few natural breaks near towns.",
    };
  }
  if (r.includes("peace") || r.includes("northern") || r.includes("rockies")) {
    return {
      fuel: "Boreal mixedwood and black spruce. Deep organic soils support holdover fires that re-flare the following May.",
      wind: "Long-running lightning complexes (Donnie Creek, Nogah, Hossitl) can make 20–40 km runs toward industrial and municipal edges.",
    };
  }
  if (
    r.includes("kootenay") ||
    r.includes("columbia") ||
    r.includes("boundary") ||
    r.includes("shuswap")
  ) {
    return {
      fuel: "Steep valley timber with slash and deadfall. Settlements occupy the only flat ground, so fire coming off the slope hits the town first.",
      wind: "Upslope afternoon winds and outflow through lake valleys. Highway closures isolate towns for days.",
    };
  }
  if (r.includes("sea to sky")) {
    return {
      fuel: "Coastal forest that still dries in drought summers; interface lots back directly onto timber.",
      wind: "Outflow and inflow along a single highway corridor. A closure south or north strands the valley.",
    };
  }
  if (
    r.includes("island") ||
    r.includes("fraser valley") ||
    r.includes("metro") ||
    r.includes("coast")
  ) {
    return {
      fuel: "Coastal forest and slash. Risk is concentrated on the wildland edge — North Shore slopes, Sooke Hills, Alberni valley — not the urban core.",
      wind: "Outflow and drought-year east winds. A single highway (Hwy 4, Sea-to-Sky, Island Hwy) becomes the failure point.",
    };
  }
  return {
    fuel: "Mixed forest and grassland typical of the southern Cordillera.",
    wind: "Local slope and valley winds during the July–August peak.",
  };
}

export function nearbyHotspots(city: City, hotspots: Hotspot[], km = 40): Hotspot[] {
  return hotspots
    .map((h) => ({ h, d: haversineKm(city.lat, city.lng, h.lat, h.lng) }))
    .filter((x) => x.d <= km)
    .sort((a, b) => a.d - b.d || b.h.score - a.h.score)
    .slice(0, 5)
    .map((x) => x.h);
}

export function buildPlan(city: City, hotspots: Hotspot[]): CityPlan {
  const { fuel, wind } = regionPlay(city.region);
  const humanShare = city.starts10 > 0 ? Math.round((100 * city.human10) / city.starts10) : 0;
  const lightningShare =
    city.starts10 > 0 ? Math.round((100 * city.lightning10) / city.starts10) : 0;
  const unknownShare = city.starts10 > 0 ? Math.max(0, 100 - humanShare - lightningShare) : 0;
  const mix = `human ${humanShare}%, lightning ${lightningShare}%, unknown or unrecorded cause ${unknownShare}%`;
  const local = nearbyHotspots(city, hotspots);
  const largest = city.largest;
  const rating = ratingLabel(city.rating);

  const headline =
    city.rating === "extreme" || city.rating === "very-high"
      ? `${city.name} sits inside a proven burn path. Treat the 30-metre perimeter as critical infrastructure.`
      : city.rating === "high"
        ? `${city.name} has a documented interface problem. Fuel, embers and access — in that order — decide whether the next fire stays in the timber.`
        : city.rating === "moderate"
          ? `${city.name} is not a free pass. Keep the home ignition zone clean and the egress routes redundant before a drought year arrives.`
          : `${city.name} is lower on the provincial ranking, but the wildland edge still needs a maintained perimeter and a practised evacuation.`;

  const situation = [
    `Perimeter risk for ${city.name} is ${rating.toLowerCase()} (${city.score.toFixed(0)} / 100) based on 2015–2025 BC Wildfire Service incidents.`,
    `Within 10 km: ${city.n10} mapped fires (${formatHa(city.ha10)}) and ${city.starts10} recorded starts, ${city.human10} of them human-caused.`,
    `Within 25 km: ${city.n25} fires totalling ${formatHa(city.ha25)}.`,
    largest
      ? `Largest nearby: ${prettyName(largest.name)} (${largest.y}, ${formatHa(largest.ha)}, ${largest.km} km, ${causeLabel(largest.cause).toLowerCase()}).`
      : `No large mapped fire sits inside 50 km — landscape risk is still carried by regional complexes.`,
    city.note,
    fuel,
    wind,
  ].join(" ");

  const ignition =
    humanShare >= 45
      ? `Human starts dominate the 10 km ring (${mix}). Prevention spend should follow people: campfires, machinery, powerlines, right-of-ways and discarded smoking materials — not only remote lightning country.`
      : lightningShare >= 45
        ? `Lightning accounts for ${lightningShare}% of starts inside 10 km (${mix}). Landscape fuel treatment, holdover detection and sprinkler protection on the town edge outrank campfire posters.`
        : city.starts10 === 0
          ? `No starts were recorded inside 10 km this decade. Keep both a people program and a fuel program ready; one quiet decade is not a forecast.`
          : lightningShare === 0
            ? `No lightning starts were recorded inside 10 km (${mix}). The known starts are human-caused, so prevention should follow people first, but the large unknown share means fuel treatment on the edge still matters.`
            : `Starts inside 10 km are mixed (${mix}). Run both a people program and a fuel program; neither is optional.`;

  const actions: PlanAction[] = [
    {
      zone: "0–1.5 m · immediate",
      title: "Non-combustible ground against every structure",
      detail:
        "Replace bark mulch and ornamental conifers with gravel, stone or irrigated lawn. Screen vents with 3 mm mesh. Clear needles from roofs, gutters and under decks each May and after wind events. This zone is where embers become house fires.",
    },
    {
      zone: "1.5–10 m · intermediate",
      title: "Break the path from grass to siding",
      detail:
        "Mow to 10 cm through fire season. Space shrubs; lift tree crowns to 2 m; move firewood, boats and propane 10 m from walls. On slopes above the town, treat uphill first — fire runs uphill into the lots.",
    },
    {
      zone: "10–30 m · extended",
      title: "Thin the lot, then the lane",
      detail: `Create a discontinuous canopy so a surface fire cannot ladder into the overstory and spot into ${city.name}. Prioritize the ${local.length ? "mapped hotspot cells on the town perimeter" : "prevailing upwind and upslope timber"}. Chip or haul — do not leave piles through July.`,
    },
    {
      zone: "100–2,000 m · community",
      title: "A maintained fuel break on the wildland edge",
      detail:
        "Work with the regional district and BCWS to keep a 100 m treated buffer around subdivisions that back onto timber. Place hydrant-fed or portable-pump sprinkler lines on the last street, not on the first fire. Identify two engine-accessible loops so a single tree-down does not trap a neighbourhood.",
    },
    {
      zone: "Access",
      title:
        city.pop < 5000
          ? "Second way out — or a practised stay-and-defend protocol"
          : "Keep at least two ploughed, signed egress routes",
      detail:
        city.pop < 5000
          ? `${city.name} is a small community. If the highway closes, residents are in the fire. Pre-plan assembly points, livestock relocation, and a 30-minute notice list. Mark dead-end lanes now.`
          : `Pre-clear snow/vegetation on collector roads that feed the highway. Require new subdivisions to have two ways out. Stage a reception centre agreement with the next town before July.`,
    },
    {
      zone: "Ignitions",
      title:
        humanShare >= 40
          ? "Shut down the human-start pipeline inside 10 km"
          : "Watch lightning holdovers on the town-side ridges",
      detail:
        humanShare >= 40
          ? `${city.human10} human-caused starts were logged within 10 km this decade. Target industrial right-of-ways, recreation sites, and the first long weekend of campfire season with patrols and bans that actually match FWI. Powerline vegetation clearance is a perimeter project, not a utility footnote.`
          : `Lightning starts inside 10 km: ${city.lightning10}. Fund morning IR / holdover patrols on the ridges that face ${city.name} after dry-lightning nights in July and August.`,
    },
    {
      zone: "Buildings",
      title: "Ember-resistant construction on the interface",
      detail:
        "Class A roofs, non-combustible cladding, enclosed soffits, and no untreated wood fences tied into siding. Use development permits on the WUI overlay so new lots do not recreate 2021/2023 losses. Retrofit grants beat rebuild grants.",
    },
    {
      zone: "People",
      title: "FireSmart the neighbourhood, not the brochure",
      detail: `Enrol street-scale FireSmart Canada Neighbourhood Recognition. The 2023 McDougall Creek and 2021 Lytton losses were ember-and-structure problems as much as forest problems. ${city.name} should be able to name its FireSmart coordinator, its sprinkler cache, and its 24-hour notice channel.`,
    },
  ];

  if (largest && largest.ha >= 5000 && largest.km <= 30) {
    actions.unshift({
      zone: "Lesson",
      title: `Plan against ${prettyName(largest.name)} (${largest.y})`,
      detail: `This fire reached ${formatHa(largest.ha)} and came within ${largest.km} km of ${city.name}. Reconstruct its run: where it spotted, which road closed first, which neighbourhoods lost power, and which structures survived. Those surviving lots are the local building code.`,
    });
  }

  const calendar: PlanMonth[] = [
    {
      when: "Jan–Mar",
      work: "Update the Community Wildfire Resiliency Plan. Bid fuel-treatment contracts on the upwind perimeter. Inventory sprinkler kits and pumps.",
    },
    {
      when: "April",
      work: "Roof and gutter campaign. Test hydrants and fill portable tanks. Neighbourhood FireSmart assessments before long weekends.",
    },
    {
      when: "May–Jun",
      work: "Mow the 10 m zone. Chip winter piles. Stand up industrial and recreation patrols. Confirm livestock and elder transport lists.",
    },
    {
      when: "Jul–Aug",
      work: "Peak season. Daily FWI to the public. Ban campfires to match conditions, not the calendar. Night-time holdover patrols after lightning.",
    },
    {
      when: "Sep–Oct",
      work: "After-action on every alert. Burn windows for piled fuel. Replant treated breaks with fire-resistant deciduous where it will survive.",
    },
    {
      when: "Nov–Dec",
      work: "Building-permit review against WUI guidelines. Grant applications for retrofits. Tabletop evacuation with BCWS, RCMP and the regional district.",
    },
  ];

  const partners = [
    "BC Wildfire Service — " +
      (city.centre === "kamloops"
        ? "Kamloops"
        : city.centre === "cariboo"
          ? "Cariboo"
          : city.centre === "prince-george"
            ? "Prince George"
            : city.centre === "northwest"
              ? "Northwest"
              : city.centre === "southeast"
                ? "Southeast"
                : "Coastal") +
      " Fire Centre",
    "FireSmart BC / FireSmart Canada Neighbourhood Recognition",
    "Local fire department and regional district emergency program",
    "Adjacent First Nations emergency operations",
    "Ministry of Forests — fuel management and landscape fire planning",
  ];

  return { city, headline, situation, ignition, actions, calendar, partners };
}
