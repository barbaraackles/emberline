import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { catalog, formatCompact, formatCost, formatHa } from "@/lib/catalog";

const tooltipStyle = {
  background: "#171513",
  border: "1px solid color-mix(in oklab, #ece8e1 12%, transparent)",
  borderRadius: 8,
  fontSize: 12,
  color: "#ece8e1",
};

export function AreaBurnedChart() {
  const data = catalog.official.map((y) => ({
    year: String(y.year),
    ha: y.ha,
    lightning: y.lightning,
    human: y.human,
  }));

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap={6}>
          <CartesianGrid stroke="rgba(236,232,225,0.06)" vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fill: "#9a948a", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#9a948a", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={40}
            tickFormatter={(v: number) => formatCompact(v)}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => formatHa(Number(value ?? 0))}
            labelFormatter={(l) => `Season ${l}`}
          />
          <Bar dataKey="ha" fill="#c24b32" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CauseChart() {
  const data = catalog.official.map((y) => ({
    year: String(y.year),
    Lightning: y.lightning,
    Human: y.human,
  }));

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap={4}>
          <CartesianGrid stroke="rgba(236,232,225,0.06)" vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fill: "#9a948a", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#9a948a", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={32}
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="Lightning" stackId="a" fill="#c9c2b4" />
          <Bar dataKey="Human" stackId="a" fill="#c24b32" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CostChart() {
  const data = catalog.official
    .filter((y) => y.costM != null)
    .map((y) => ({ year: String(y.year), cost: y.costM as number }));

  return (
    <div className="h-36 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap={6}>
          <CartesianGrid stroke="rgba(236,232,225,0.06)" vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fill: "#9a948a", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#9a948a", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={36}
            tickFormatter={(v: number) => formatCost(v)}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => formatCost(Number(value ?? 0))}
          />
          <Bar dataKey="cost" fill="#e8e0d4" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
