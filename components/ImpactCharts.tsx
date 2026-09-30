"use client";

import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { BarChart3, ChartPie } from "lucide-react";
import { EmptyState, SectionHeader } from "@/components/ui";

interface ImpactChartsProps {
  categoryBreakdown: Record<string, number>;
  totalAssets: number;
  totalComparisons: number;
  verifiedComparisonsCount: number;
}

// Flat tones from the app palette; "Uncategorized" stays neutral.
const CATEGORY_COLORS: Record<string, string> = {
  Environmental: "#10b981",
  Infrastructure: "#0ea5e9",
  Community: "#8b5cf6",
  "Disaster Response": "#f59e0b",
  Uncategorized: "#d4d4d8",
};

const FALLBACK_COLORS = ["#10b981", "#0ea5e9", "#f59e0b", "#8b5cf6", "#71717a", "#6ee7b7", "#7dd3fc", "#fcd34d", "#c4b5fd"];

const colorFor = (name: string, index: number) =>
  CATEGORY_COLORS[name] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];

const GRID = "#f0f1f0";
const TICK = { fill: "#71717a", fontSize: 12 };
const TOOLTIP_STYLE = {
  backgroundColor: "#ffffff",
  border: "1px solid #e4e4e7",
  borderRadius: "10px",
  fontSize: "12px",
  color: "#18181b",
  boxShadow: "0 12px 28px -12px rgba(16,24,40,0.25)",
  padding: "8px 10px",
};

export function ImpactCharts({ categoryBreakdown, totalAssets }: ImpactChartsProps) {
  const data = useMemo(() => {
    return Object.entries(categoryBreakdown)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value, color: colorFor(name, i) }));
  }, [categoryBreakdown]);

  if (totalAssets === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No charts yet"
        description="Upload photos or videos to this project to see them broken down by category."
      />
    );
  }

  const barHeight = Math.max(200, data.length * 44 + 40);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="card space-y-5 p-5">
        <SectionHeader
          icon={ChartPie}
          tone="emerald"
          title="Media by category"
          description="Sorted automatically by what each photo shows."
        />

        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <div className="relative h-48 w-48 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={64}
                  outerRadius={92}
                  paddingAngle={data.length > 1 ? 2 : 0}
                  cornerRadius={4}
                  dataKey="value"
                  nameKey="name"
                  stroke="none"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  itemStyle={{ color: "#18181b" }}
                  formatter={(val: any, name: any) => [`${val} item${Number(val) === 1 ? "" : "s"}`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-semibold leading-none tracking-tight tabular-nums text-zinc-900">{totalAssets}</span>
              <span className="mt-1 text-xs text-zinc-500">items</span>
            </div>
          </div>

          <ul className="w-full min-w-0 space-y-3">
            {data.map((d) => {
              const pct = totalAssets > 0 ? Math.round((d.value / totalAssets) * 100) : 0;
              return (
                <li key={d.name} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color }} />
                      <span className="truncate text-zinc-700">{d.name}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">
                      <span className="font-medium text-zinc-900">{d.value}</span>
                      <span className="ml-1.5 text-xs text-zinc-400">{pct}%</span>
                    </span>
                  </div>
                  <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-100">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: d.color }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="card space-y-5 p-5">
        <SectionHeader
          icon={BarChart3}
          tone="sky"
          title="Items per category"
          description="Number of photos and videos in each category."
          actions={<span className="badge badge-neutral tabular-nums">{data.length} categories</span>}
        />

        <div className="w-full" style={{ height: barHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid horizontal={false} stroke={GRID} />
              <XAxis type="number" allowDecimals={false} tick={TICK} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={112} tick={TICK} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: "#f4f4f5", radius: 6 } as any}
                contentStyle={TOOLTIP_STYLE}
                itemStyle={{ color: "#18181b" }}
                formatter={(val: any) => [`${val} item${Number(val) === 1 ? "" : "s"}`, "Total"]}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={26}>
                {data.map((entry, index) => (
                  <Cell key={`bar-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
