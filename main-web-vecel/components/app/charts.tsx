"use client";

/*
 * Charts follow the data-viz method: one y-axis, thin marks (2px lines, 4px rounded bar ends),
 * recessive grid, legend + direct labels for multi-series, hover tooltip on every chart.
 * Series colours come from validated CSS roles (--viz-1 blue, --viz-2 orange) that switch for dark mode.
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { cn } from "@/lib/utils";

const AXIS = { stroke: "var(--viz-axis)", fontSize: 11, tickLine: false, axisLine: false } as const;

function ChartTooltip({ active, payload, label, labelFormat }: TooltipProps<number, string> & { labelFormat?: (l: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-border/70 bg-card px-3.5 py-2.5 text-xs shadow-xl">
      <p className="mb-1.5 font-medium text-foreground">{labelFormat ? labelFormat(String(label)) : label}</p>
      {payload.map((p) => (
        <div key={p.dataKey as string} className="flex items-center gap-2 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="flex-1">{p.name}</span>
          <span className="tabular font-medium text-foreground">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

const shortDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** Attempts and AI flags per day — two series of the same unit on one axis. */
export function ActivityChart({ data, height = 240 }: { data: { date: string; attempts: number; flags: number }[]; height?: number }) {
  const last = data[data.length - 1];
  const series = [
    { key: "attempts", name: "Attempts", color: "var(--viz-1)" },
    { key: "flags", name: "AI flags", color: "var(--viz-2)" },
  ] as const;
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground" aria-label="Legend">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} />
            {s.name}
            {last && <span className="tabular font-medium text-foreground">· {last[s.key]} today</span>}
          </span>
        ))}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} {...AXIS} minTickGap={24} />
            <YAxis allowDecimals={false} {...AXIS} width={44} />
            <Tooltip
              content={<ChartTooltip labelFormat={shortDate} />}
              cursor={{ stroke: "var(--viz-axis)", strokeWidth: 1, strokeDasharray: "3 3" }}
            />
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Single-series vertical bars (e.g. score distribution). */
export function ColumnChart({
  data,
  xKey,
  yKey,
  name,
  height = 220,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  yKey: string;
  name: string;
  height?: number;
}) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid stroke="var(--viz-grid)" vertical={false} />
          <XAxis dataKey={xKey} {...AXIS} />
          <YAxis allowDecimals={false} {...AXIS} width={44} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))", radius: 8 }} />
          <Bar dataKey={yKey} name={name} fill="var(--viz-1)" radius={[4, 4, 0, 0]} maxBarSize={48} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Ranked horizontal bars in plain HTML — label left, value right, hover shows exact share. */
export function BarList({
  items,
  format = (v) => String(v),
  max,
  className,
  empty = "No data yet",
}: {
  items: { label: string; value: number; hint?: string }[];
  format?: (v: number) => string;
  max?: number;
  className?: string;
  empty?: string;
}) {
  if (!items.length) return <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  const top = max ?? Math.max(...items.map((i) => i.value), 1);
  const total = items.reduce((a, b) => a + b.value, 0);
  return (
    <ul className={cn("space-y-3", className)}>
      {items.map((item) => (
        <li
          key={item.label}
          className="group"
          title={`${item.label}: ${format(item.value)}${max === undefined && total ? ` (${Math.round((100 * item.value) / total)}%)` : ""}`}
        >
          <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate text-foreground">{item.label}</span>
            <span className="tabular shrink-0 font-medium">{format(item.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-[width] duration-500 group-hover:opacity-80"
              style={{ width: `${Math.max(2, (100 * item.value) / top)}%`, background: "var(--viz-1)" }}
            />
          </div>
          {item.hint && <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>}
        </li>
      ))}
    </ul>
  );
}
