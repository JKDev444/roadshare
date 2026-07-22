import type { Layout } from "@/lib/roadshare/layout";

interface PlatMapProps {
  layout: Layout;
  selected: string[];
  you: string | null;
  entrances: string[];
  hovered: string | null;
  activeStep?: "home" | "neighbors" | "entrances" | "review";
  title?: string;
  onToggleParcel: (id: string) => void;
  onHoverParcel: (id: string | null) => void;
  onToggleEntrance: (id: string) => void;
}

// Axis-aligned bounding box for a rectangular parcel polygon.
function bbox(poly: [number, number][]) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

export function PlatMap({
  layout,
  selected,
  you,
  entrances,
  hovered,
  activeStep = "home",
  title,
  onToggleParcel,
  onHoverParcel,
  onToggleEntrance,
}: PlatMapProps) {
  const { view: VIEW, nodes: NODES, edges: EDGES, entrances: ENTRANCES, parcels: PARCELS } = layout;
  const node = (id: string) => NODES[id];
  const hoveredParcel = PARCELS.find((p) => p.id === hovered);
  // For labels: only draw named-road text overlays for the Cedar Hollow sample.
  const isCedar = ENTRANCES.some((e) => e.id === "north");
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Map title bar */}
      <div className="flex items-center justify-between border-b border-border/70 bg-card/80 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="font-display text-sm font-semibold tracking-tight">
            {title ?? layout.roadName}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {activeStep === "home"
              ? "Tap a home to start"
              : activeStep === "neighbors"
                ? "Tap homes to add or remove"
                : activeStep === "entrances"
                  ? "Tap entrance pins"
                  : "Review the selected group"}
          </span>
        </div>
        <div className="hidden items-center gap-3 text-[11px] text-muted-foreground sm:flex">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-gold" /> You
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-selected" /> Sharing the road
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] border border-border bg-card" />
            Available
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
        className="block w-full select-none"
        role="img"
        aria-label={`${title ?? layout.roadName} plat map`}
      >
        <defs>
          <linearGradient id="land" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-map-land-top)" />
            <stop offset="100%" stopColor="var(--color-map-land-bottom)" />
          </linearGradient>
          <pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse">
            <path
              d="M 36 0 L 0 0 0 36"
              fill="none"
              stroke="var(--color-map-ink)"
              strokeWidth="0.5"
              opacity="0.08"
            />
          </pattern>
          <filter id="parcelShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1.4" stdDeviation="1.6" floodOpacity="0.16" />
          </filter>
        </defs>

        {/* Land */}
        <rect width={VIEW.w} height={VIEW.h} fill="url(#land)" />
        <rect width={VIEW.w} height={VIEW.h} fill="url(#grid)" />

        {/* Public road stubs at each entrance */}
        {ENTRANCES.map((e) => (
          <PublicRoad
            key={`pub-${e.id}`}
            d={
              e.y < 100
                ? `M ${e.x} 8 L ${e.x} ${e.y}`
                : e.y > VIEW.h - 100
                  ? `M ${e.x} ${e.y} L ${e.x} ${VIEW.h - 8}`
                  : e.x < 100
                    ? `M 8 ${e.y} L ${e.x} ${e.y}`
                    : `M ${e.x} ${e.y} L ${VIEW.w - 8} ${e.y}`
            }
            width={16}
          />
        ))}

        {/* Private road casing + asphalt */}
        {EDGES.map((e) => {
          const a = node(e.a);
          const b = node(e.b);
          return (
            <line key={`c-${e.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--color-map-asphalt-edge)" strokeWidth="24" strokeLinecap="round" />
          );
        })}
        {isCedar && NODES.E && (
          <>
            <circle cx={NODES.E.x} cy={NODES.E.y} r="26" fill="var(--color-map-asphalt-edge)" />
            <circle cx={NODES.E.x} cy={NODES.E.y} r="21" fill="var(--color-map-asphalt)" />
          </>
        )}
        {EDGES.map((e) => {
          const a = node(e.a);
          const b = node(e.b);
          return (
            <line key={`a-${e.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--color-map-asphalt)" strokeWidth="19" strokeLinecap="round" />
          );
        })}
        {/* Dashed lane centerlines */}
        {EDGES.map((e) => {
          const a = node(e.a);
          const b = node(e.b);
          return (
            <line
              key={`l-${e.id}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="var(--color-map-lane)"
              strokeWidth="1.6"
              strokeDasharray="9 8"
              opacity="0.7"
              style={{ animation: "rs-dash 1.4s linear infinite" }}
            />
          );
        })}

        {/* Road name label (single-edge layouts only) */}
        {EDGES.length === 1 && (() => {
          const e = EDGES[0];
          const a = node(e.a);
          const b = node(e.b);
          const midX = (a.x + b.x) / 2;
          const midY = (a.y + b.y) / 2 - 6;
          return (
            <text x={midX} y={midY} fill="var(--color-map-lane)" fontSize="10" fontWeight="600" fontFamily="var(--font-mono)" textAnchor="middle" letterSpacing="1.5" opacity="0.95">
              {layout.roadName.toUpperCase()}
            </text>
          );
        })()}

        {/* Parcels */}
        {PARCELS.map((p, idx) => {
          const isSel = selected.includes(p.id);
          const isYou = you === p.id;
          const isHover = hovered === p.id;
          const { x, y, w, h } = bbox(p.poly);
          let fill = "var(--color-map-parcel)";
          let stroke = "var(--color-map-parcel-edge)";
          let sw = 1;
          if (isSel) {
            fill = "color-mix(in oklch, var(--color-selected) 22%, var(--color-map-parcel))";
            stroke = "var(--color-selected)";
            sw = 1.75;
          }
          if (isYou) {
            fill = "color-mix(in oklch, var(--color-gold) 34%, var(--color-map-parcel))";
            stroke = "var(--color-gold)";
            sw = 2;
          }
          return (
            <g
              key={p.id}
              className="cursor-pointer"
              onClick={() => onToggleParcel(p.id)}
              onMouseEnter={() => onHoverParcel(p.id)}
              onMouseLeave={() => onHoverParcel(null)}
            >
              <rect
                x={x}
                y={y}
                width={w}
                height={h}
                rx="4"
                fill={fill}
                stroke={stroke}
                strokeWidth={isHover ? sw + 1 : sw}
                filter="url(#parcelShadow)"
              />
              {isSel && (
                <line
                  x1={p.frontageLine[0][0]}
                  y1={p.frontageLine[0][1]}
                  x2={p.frontageLine[1][0]}
                  y2={p.frontageLine[1][1]}
                  stroke={isYou ? "var(--color-gold)" : "var(--color-selected)"}
                  strokeWidth="4.5"
                  strokeLinecap="round"
                />
              )}
              <text
                x={p.label[0]}
                y={p.label[1]}
                fill="var(--color-map-ink)"
                fontSize="9"
                fontWeight={isYou || isSel ? 700 : 500}
                fontFamily="var(--font-mono)"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                {(p.address.match(/\d+/)?.[0]) ?? String(idx + 1)}
              </text>
            </g>
          );
        })}

        {/* Entrances */}
        {ENTRANCES.map((e) => {
          const pinned = entrances.includes(e.id);
          return (
            <g key={e.id} className="cursor-pointer" onClick={() => onToggleEntrance(e.id)}>
              {!pinned && (
                <circle
                  cx={e.x}
                  cy={e.y}
                  r="13"
                  fill="none"
                  stroke="var(--color-gold)"
                  strokeWidth="2"
                  style={{ transformOrigin: `${e.x}px ${e.y}px`, animation: "rs-pulse 2s ease-out infinite" }}
                />
              )}
              {pinned ? (
                <g style={{ transformOrigin: `${e.x}px ${e.y}px` }} className="animate-scale-in">
                  <path
                    d={`M ${e.x} ${e.y} C ${e.x - 11} ${e.y - 14}, ${e.x - 9} ${e.y - 30}, ${e.x} ${e.y - 30} C ${e.x + 9} ${e.y - 30}, ${e.x + 11} ${e.y - 14}, ${e.x} ${e.y} Z`}
                    fill="var(--color-primary)"
                    stroke="var(--color-card)"
                    strokeWidth="1.5"
                  />
                  <circle cx={e.x} cy={e.y - 21} r="4.5" fill="var(--color-card)" />
                </g>
              ) : (
                <circle cx={e.x} cy={e.y} r="7.5" fill="var(--color-card)" stroke="var(--color-primary)" strokeWidth="2" />
              )}
            </g>
          );
        })}

        {/* Hover tooltip */}
        {hoveredParcel && (
          <g pointerEvents="none">
            <rect
              x={hoveredParcel.label[0] - 62}
              y={bbox(hoveredParcel.poly).y - 26}
              width="124"
              height="19"
              rx="5"
              fill="var(--color-primary)"
            />
            <text
              x={hoveredParcel.label[0]}
              y={bbox(hoveredParcel.poly).y - 13}
              fill="var(--color-primary-foreground)"
              fontSize="9.5"
              fontFamily="var(--font-sans)"
              fontWeight="600"
              textAnchor="middle"
            >
              {hoveredParcel.address}
            </text>
          </g>
        )}

        {/* North arrow */}
        <g transform={`translate(${VIEW.w - 44}, ${VIEW.h - 56})`}>
          <circle r="17" fill="var(--color-card)" stroke="var(--color-border)" strokeWidth="1" opacity="0.9" />
          <path d="M 0 -11 L 5 8 L 0 3 L -5 8 Z" fill="var(--color-primary)" />
          <text x="0" y="-13" fill="var(--color-map-ink)" fontSize="8.5" fontWeight="700" fontFamily="var(--font-mono)" textAnchor="middle">
            N
          </text>
        </g>

        {/* Scale bar */}
        <g transform={`translate(56, ${VIEW.h - 22})`}>
          <rect x="-6" y="-13" width="104" height="22" rx="5" fill="var(--color-card)" opacity="0.85" />
          <line x1="0" y1="0" x2="80" y2="0" stroke="var(--color-map-ink)" strokeWidth="2" />
          <line x1="0" y1="-4" x2="0" y2="4" stroke="var(--color-map-ink)" strokeWidth="2" />
          <line x1="80" y1="-4" x2="80" y2="4" stroke="var(--color-map-ink)" strokeWidth="2" />
          <text x="40" y="-5" fill="var(--color-map-ink)" fontSize="8.5" fontFamily="var(--font-mono)" textAnchor="middle">
            100 ft
          </text>
        </g>
      </svg>
    </div>
  );
}

function PublicRoad({ d, width }: { d: string; width: number }) {
  return (
    <>
      <path d={d} stroke="var(--color-map-asphalt-edge)" strokeWidth={width + 3} fill="none" strokeLinecap="round" />
      <path d={d} stroke="var(--color-map-asphalt)" strokeWidth={width} fill="none" strokeLinecap="round" />
      <path d={d} stroke="var(--color-map-lane)" strokeWidth="1.4" strokeDasharray="8 8" fill="none" opacity="0.55" />
    </>
  );
}