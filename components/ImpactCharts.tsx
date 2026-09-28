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
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface ImpactChartsProps {
  categoryBreakdown: Record<string, number>;
  totalAssets: number;
  totalComparisons: number;
  verifiedComparisonsCount: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  Environmental: "#10b981",
  Infrastructure: "#06b6d4",
  Community: "#8b5cf6",
  "Disaster Response": "#f59e0b",
  Uncategorized: "#64748b",
};

const DEFAULT_COLOR = "#3b82f6";

export function ImpactCharts({
  categoryBreakdown,
  totalAssets,
  totalComparisons,
  verifiedComparisonsCount,
}: ImpactChartsProps) {
  const pieData = useMemo(() => {
    return Object.entries(categoryBreakdown).map(([name, value]) => ({
      name,
      value,
      color: CATEGORY_COLORS[name] || DEFAULT_COLOR,
    }));
  }, [categoryBreakdown]);

  const barData = useMemo(() => {
    return Object.entries(categoryBreakdown).map(([category, count]) => ({
      category,
      count,
      color: CATEGORY_COLORS[category] || DEFAULT_COLOR,
    }));
  }, [categoryBreakdown]);

  const verificationData = useMemo(() => {
    const unverified = Math.max(0, totalComparisons - verifiedComparisonsCount);
    return [
      { name: "AI-Verified Pairs", value: verifiedComparisonsCount, color: "#10b981" },
      { name: "Unverified Pairs", value: unverified, color: "#f59e0b" },
    ];
  }, [totalComparisons, verifiedComparisonsCount]);

  if (totalAssets === 0) {
    return (
      <div className="glass-panel rounded-2xl p-8 text-center text-slate-500 text-xs">
        No catalogued media assets to display analytics for. Upload assets to view distribution charts.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Category Donut Distribution */}
      <div className="lg:col-span-6 glass-panel rounded-2xl p-5 border border-white/10 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-slate-100">Domain Category Distribution</h3>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              {totalAssets} Total Assets
            </span>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            AI-classified visual evidence proportions across sustainability pillars
          </p>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={4}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                  fontSize: "12px",
                  color: "#f8fafc",
                }}
                formatter={(val: any, name: any) => [`${val} asset(s)`, name]}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                wrapperStyle={{ fontSize: "11px", paddingTop: "12px" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Asset Volume per Category Bar Chart */}
      <div className="lg:col-span-6 glass-panel rounded-2xl p-5 border border-white/10 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-bold text-slate-100">Evidence Volume by Pillar</h3>
            <span className="text-[11px] font-mono text-slate-400">Counts</span>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Absolute asset distribution across active domain categories
          </p>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <XAxis
                dataKey="category"
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
                angle={-15}
                textAnchor="end"
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "#94a3b8", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
                contentStyle={{
                  backgroundColor: "#0f172a",
                  borderColor: "rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                  fontSize: "12px",
                  color: "#f8fafc",
                }}
                formatter={(val: any) => [`${val} assets`, "Total"]}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {barData.map((entry, index) => (
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
