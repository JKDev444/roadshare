import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Home, Sparkles } from "lucide-react";

import { Section, Reveal, Eyebrow } from "./primitives";

/**
 * Interactive "secret sauce" section.
 * A single shared road with 4 houses along it. The user slides the "your house"
 * marker; each house's fair share (as a % of a fixed project) updates live
 * using distance-along-road (each home pays for every foot of road it drives on
 * to reach the entrance).
 */

const ROAD_LENGTH_FT = 1000;
const PROJECT_COST = 40000;

// Fixed positions (feet from entrance) for the four neighbors.
const NEIGHBORS = [
  { name: "Ana",   ft: 150 },
  { name: "Ben",   ft: 380 },
  { name: "Cora",  ft: 620 },
  { name: "Devon", ft: 860 },
];

function shares(youFt: number) {
  // Distance-based: each home's share is proportional to how far along the
  // road they live. Together, they pay 100% of PROJECT_COST.
  const all = [...NEIGHBORS.map((n) => n.ft), youFt];
  const total = all.reduce((a, b) => a + b, 0);
  return all.map((ft) => (ft / total) * PROJECT_COST);
}

function usd(n: number) {
  return `$${Math.round(n).toLocaleString()}`;
}

export function SecretSauce() {
  const [youFt, setYouFt] = useState(500);
  const values = useMemo(() => shares(youFt), [youFt]);
  const yourShare = values[values.length - 1];

  return (
    <Section>
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-fun-1/15 via-card to-fun-3/15 p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-8 -top-8 opacity-30" aria-hidden>
          <Sparkles className="h-32 w-32 text-primary" />
        </div>

        <div className="relative grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <Reveal>
            <Eyebrow>The secret sauce</Eyebrow>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Pay for the road <span className="mark-gold">you actually drive on</span>.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Live near the entrance? You use less road, so you pay less. Live at the
              far end? You drive past every neighbor to get home — so you chip in more.
              No spreadsheets, no arguments.
            </p>

            <div className="mt-6 rounded-2xl border border-primary/20 bg-background/70 p-4 backdrop-blur">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Your share of a {usd(PROJECT_COST)} road project
              </p>
              <p className="mt-1 font-display text-4xl font-bold text-primary">
                <motion.span
                  key={Math.round(yourShare / 50)}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="inline-block"
                >
                  {usd(yourShare)}
                </motion.span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Move the slider to see how your share changes.
              </p>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {["Distance-based", "Frontage-based", "Equal split"].map((m, i) => (
                <span
                  key={m}
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    i === 0
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-card text-muted-foreground"
                  }`}
                >
                  {m}
                </span>
              ))}
              <span className="rounded-full px-3 py-1 text-xs font-medium text-muted-foreground">
                — you pick
              </span>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <FormulaMap youFt={youFt} onChange={setYouFt} values={values} />
          </Reveal>
        </div>
      </div>
    </Section>
  );
}

function FormulaMap({
  youFt,
  onChange,
  values,
}: {
  youFt: number;
  onChange: (v: number) => void;
  values: number[];
}) {
  const width = 520;
  const height = 260;
  const roadY = 170;
  const marginX = 40;

  const xForFt = (ft: number) =>
    marginX + (ft / ROAD_LENGTH_FT) * (width - marginX * 2);

  const houses = NEIGHBORS.map((n, i) => ({
    ...n,
    x: xForFt(n.ft),
    share: values[i],
  }));
  const you = { x: xForFt(youFt), share: values[values.length - 1] };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-lg">
      <div className="absolute inset-0 topo-grid opacity-30" aria-hidden />
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="relative h-auto w-full"
        role="img"
        aria-label="Interactive map showing how road cost splits across four neighbors and your house"
      >
        {/* Entrance marker */}
        <g>
          <circle cx={marginX} cy={roadY} r={9} fill="var(--color-primary)" />
          <circle
            cx={marginX}
            cy={roadY}
            r={9}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={2}
          >
            <animate attributeName="r" values="9;18" dur="1.8s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.7;0" dur="1.8s" repeatCount="indefinite" />
          </circle>
          <text
            x={marginX}
            y={roadY + 30}
            textAnchor="middle"
            className="fill-muted-foreground font-mono text-[10px]"
          >
            Entrance
          </text>
        </g>

        {/* Road */}
        <line
          x1={marginX}
          y1={roadY}
          x2={width - marginX}
          y2={roadY}
          stroke="var(--color-map-asphalt)"
          strokeWidth={22}
          strokeLinecap="round"
        />
        <line
          x1={marginX}
          y1={roadY}
          x2={width - marginX}
          y2={roadY}
          stroke="var(--color-map-lane)"
          strokeWidth={2}
          strokeDasharray="10 10"
          strokeLinecap="round"
        />

        {/* Neighbor houses */}
        {houses.map((h) => (
          <g key={h.name}>
            <rect
              x={h.x - 20}
              y={roadY - 58}
              width={40}
              height={30}
              rx={5}
              fill="var(--color-selected)"
              opacity={0.7}
            />
            <polygon
              points={`${h.x - 22},${roadY - 58} ${h.x},${roadY - 74} ${h.x + 22},${roadY - 58}`}
              fill="var(--color-selected)"
              opacity={0.85}
            />
            <text
              x={h.x}
              y={roadY - 40}
              textAnchor="middle"
              className="fill-foreground font-mono text-[10px] font-semibold"
            >
              {h.name}
            </text>
            <text
              x={h.x}
              y={roadY - 78}
              textAnchor="middle"
              className="fill-muted-foreground font-mono text-[10px]"
            >
              {usd(h.share)}
            </text>
          </g>
        ))}

        {/* Your house */}
        <motion.g
          animate={{ x: you.x }}
          initial={false}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <rect
            x={-24}
            y={roadY + 12}
            width={48}
            height={34}
            rx={6}
            fill="var(--color-gold)"
          />
          <polygon
            points={`-26,${roadY + 12} 0,${roadY - 4} 26,${roadY + 12}`}
            fill="var(--color-gold)"
          />
          <text
            x={0}
            y={roadY + 34}
            textAnchor="middle"
            className="fill-foreground font-mono text-[11px] font-bold"
          >
            You
          </text>
          <text
            x={0}
            y={roadY + 62}
            textAnchor="middle"
            className="fill-primary font-mono text-[11px] font-bold"
          >
            {usd(you.share)}
          </text>
        </motion.g>
      </svg>

      {/* Slider */}
      <div className="mt-2 flex items-center gap-3 px-1">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold/20 text-foreground">
          <Home className="h-3.5 w-3.5" />
        </span>
        <input
          type="range"
          min={40}
          max={ROAD_LENGTH_FT - 20}
          value={youFt}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Where your house sits along the shared road"
          className="fair-slider h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--color-primary), var(--color-primary))",
            backgroundSize: `${((youFt - 40) / (ROAD_LENGTH_FT - 60)) * 100}% 100%`,
            backgroundRepeat: "no-repeat",
          }}
        />
        <span className="font-mono text-[11px] text-muted-foreground">
          {Math.round(youFt)} ft in
        </span>
      </div>
    </div>
  );
}