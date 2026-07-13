/* ================================================================
 * Lightweight SVG charts for the Performance Analysis Center.
 * ----------------------------------------------------------------
 * Pure presentation. No cricket math, no external chart libraries.
 * ================================================================ */
import { useMemo } from "react";
import { cn } from "@/lib/utils";

/* ---------- Sparkline / line chart ---------- */

export function LineChartSVG({
  values,
  labels,
  height = 120,
  color = "hsl(var(--primary))",
  fill = true,
  showDots = true,
  ariaLabel,
}: {
  values: number[];
  labels?: string[];
  height?: number;
  color?: string;
  fill?: boolean;
  showDots?: boolean;
  ariaLabel?: string;
}) {
  const width = 320;
  const pad = 8;
  const { path, area, dots, max, min } = useMemo(() => {
    if (values.length === 0) {
      return { path: "", area: "", dots: [], max: 0, min: 0 };
    }
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const stepX = values.length === 1 ? 0 : (width - pad * 2) / (values.length - 1);
    const pts = values.map((v, i) => {
      const x = pad + i * stepX;
      const y = height - pad - ((v - min) / range) * (height - pad * 2);
      return { x, y };
    });
    const path = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const area =
      pts.length > 1
        ? `${path} L ${pts.at(-1)!.x} ${height - pad} L ${pts[0].x} ${height - pad} Z`
        : "";
    return { path, area, dots: pts, max, min };
  }, [values, height]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel ?? "Trend chart"}
      className="w-full"
    >
      {fill && area && (
        <path d={area} fill={color} opacity={0.12} />
      )}
      {path && (
        <path d={path} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" />
      )}
      {showDots &&
        dots.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3} fill={color} />
            {labels?.[i] && (
              <title>
                {labels[i]}: {values[i]}
              </title>
            )}
          </g>
        ))}
      {values.length === 0 && (
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          className="fill-muted-foreground text-[10px]"
        >
          No data
        </text>
      )}
      <text x={pad} y={12} className="fill-muted-foreground text-[9px]">
        max {max}
      </text>
      <text x={pad} y={height - 2} className="fill-muted-foreground text-[9px]">
        min {min}
      </text>
    </svg>
  );
}

/* ---------- Bar chart ---------- */

export function BarChartSVG({
  data,
  height = 140,
  color = "hsl(var(--primary))",
  ariaLabel,
}: {
  data: Array<{ label: string; value: number }>;
  height?: number;
  color?: string;
  ariaLabel?: string;
}) {
  const width = 320;
  const pad = 20;
  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = data.length ? (width - pad * 2) / data.length - 4 : 0;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={ariaLabel ?? "Bar chart"}
      className="w-full"
    >
      {data.map((d, i) => {
        const h = ((d.value / max) * (height - pad * 2)) || 0;
        const x = pad + i * (barW + 4);
        const y = height - pad - h;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={h} rx={2} fill={color} opacity={0.85} />
            <text
              x={x + barW / 2}
              y={height - 6}
              textAnchor="middle"
              className="fill-muted-foreground text-[9px]"
            >
              {d.label.length > 8 ? d.label.slice(0, 8) + "…" : d.label}
            </text>
            <text
              x={x + barW / 2}
              y={y - 3}
              textAnchor="middle"
              className="fill-foreground text-[9px] font-semibold"
            >
              {d.value}
            </text>
          </g>
        );
      })}
      {data.length === 0 && (
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          className="fill-muted-foreground text-[10px]"
        >
          No data
        </text>
      )}
    </svg>
  );
}

/* ---------- Radar chart ---------- */

export function RadarChartSVG({
  axes,
  values,
  compare,
  size = 220,
  ariaLabel,
}: {
  axes: string[];
  values: number[]; // 0..100
  compare?: number[]; // optional second series (0..100)
  size?: number;
  ariaLabel?: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 24;

  const points = (vals: number[]) =>
    axes
      .map((_, i) => {
        const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
        const v = Math.max(0, Math.min(100, vals[i] ?? 0));
        const rr = (v / 100) * r;
        return `${cx + Math.cos(angle) * rr},${cy + Math.sin(angle) * rr}`;
      })
      .join(" ");

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={ariaLabel ?? "Radar chart"}
      className="w-full max-w-[240px] mx-auto"
    >
      {[0.25, 0.5, 0.75, 1].map((f, i) => (
        <polygon
          key={i}
          points={axes
            .map((_, ai) => {
              const angle = (Math.PI * 2 * ai) / axes.length - Math.PI / 2;
              return `${cx + Math.cos(angle) * r * f},${cy + Math.sin(angle) * r * f}`;
            })
            .join(" ")}
          fill="none"
          stroke="hsl(var(--border))"
          strokeWidth={0.5}
        />
      ))}
      {compare && (
        <polygon
          points={points(compare)}
          fill="hsl(var(--muted-foreground))"
          fillOpacity={0.15}
          stroke="hsl(var(--muted-foreground))"
          strokeWidth={1.5}
        />
      )}
      <polygon
        points={points(values)}
        fill="hsl(var(--primary))"
        fillOpacity={0.25}
        stroke="hsl(var(--primary))"
        strokeWidth={2}
      />
      {axes.map((label, i) => {
        const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
        const x = cx + Math.cos(angle) * (r + 12);
        const y = cy + Math.sin(angle) * (r + 12);
        return (
          <text
            key={label}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground text-[10px] font-semibold uppercase tracking-widest"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}

/* ---------- Progress ring ---------- */

export function ProgressRing({
  value,
  max = 100,
  label,
  hint,
  size = 96,
  color = "hsl(var(--primary))",
}: {
  value: number;
  max?: number;
  label?: string;
  hint?: string;
  size?: number;
  color?: string;
}) {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(1, value / max));
  const dash = circumference * pct;

  return (
    <div className="inline-flex flex-col items-center">
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={label}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="hsl(var(--border))"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="-mt-[calc(50%+8px)] flex flex-col items-center text-center">
        <span className="text-xl font-black tabular-nums">{Math.round(value)}</span>
        {hint && <span className="text-[9px] uppercase tracking-widest text-muted-foreground">{hint}</span>}
      </div>
      {label && (
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
      )}
    </div>
  );
}

/* ---------- Trend arrow ---------- */

export function TrendArrow({
  trend,
  delta,
  className,
}: {
  trend: "up" | "down" | "flat";
  delta?: number;
  className?: string;
}) {
  const color =
    trend === "up"
      ? "text-emerald-500 bg-emerald-500/10"
      : trend === "down"
        ? "text-rose-500 bg-rose-500/10"
        : "text-muted-foreground bg-muted";
  const glyph = trend === "up" ? "▲" : trend === "down" ? "▼" : "→";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums",
        color,
        className,
      )}
    >
      <span>{glyph}</span>
      {delta !== undefined && <span>{delta > 0 ? `+${delta}` : delta}</span>}
    </span>
  );
}

/* ---------- Simple stat pill ---------- */

export function StatPill({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-3", className)}>
      <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-2xl font-black tabular-nums">{value}</div>
      {hint && (
        <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>
      )}
    </div>
  );
}
