import { EDGES, ENTRANCES, NODES, PARCELS, VIEW, type NodeId } from "@/lib/roadshare/data";

interface PlatMapProps {
  selected: string[];
  you: string | null;
  entrances: ("west" | "north")[];
  hovered: string | null;
  onToggleParcel: (id: string) => void;
  onHoverParcel: (id: string | null) => void;
  onToggleEntrance: (id: "west" | "north") => void;
}

function node(id: NodeId) {
  return NODES[id];
}

export function PlatMap({
  selected,
  you,
  entrances,
  hovered,
  onToggleParcel,
  onHoverParcel,
  onToggleEntrance,
}: PlatMapProps) {
  return (
    <svg
      viewBox={`0 0 ${VIEW.w} ${VIEW.h}`}
      className="w-full h-auto select-none rounded-xl border border-border bg-[var(--map-parcel)]"
      role="img"
      aria-label="Cedar Hollow plat map"
    >
      {/* subtle grid */}
      <defs>
        <pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse">
          <path
            d="M 30 0 L 0 0 0 30"
            fill="none"
            stroke="var(--color-map-road)"
            strokeWidth="0.4"
            opacity="0.25"
          />
        </pattern>
      </defs>
      <rect width={VIEW.w} height={VIEW.h} fill="url(#grid)" />

      {/* Public roads */}
      <line x1="30" y1="20" x2="30" y2={VIEW.h - 20} stroke="var(--color-map-road)" strokeWidth="14" opacity="0.5" />
      <text x="18" y={VIEW.h / 2} fill="var(--color-map-ink)" fontSize="11" fontFamily="var(--font-mono)" transform={`rotate(-90 18 ${VIEW.h / 2})`} textAnchor="middle">
        COUNTY RD 12
      </text>
      <line x1="40" y1="30" x2={VIEW.w - 20} y2="30" stroke="var(--color-map-road)" strokeWidth="14" opacity="0.5" />
      <text x={VIEW.w - 30} y="24" fill="var(--color-map-ink)" fontSize="11" fontFamily="var(--font-mono)" textAnchor="end">
        RIDGE RD
      </text>

      {/* Private road centerlines */}
      {EDGES.map((e) => {
        const a = node(e.a);
        const b = node(e.b);
        return (
          <line
            key={e.id}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="var(--color-map-road)"
            strokeWidth="18"
            strokeLinecap="round"
          />
        );
      })}
      {/* Cul-de-sac bulb */}
      <circle cx={NODES.E.x} cy={NODES.E.y} r="22" fill="var(--color-map-road)" />
      {/* road name labels */}
      <text x="260" y="345" fill="var(--color-map-ink)" fontSize="11" fontFamily="var(--font-mono)" textAnchor="middle">
        CEDAR HOLLOW LANE
      </text>
      <text x="500" y="200" fill="var(--color-map-ink)" fontSize="11" fontFamily="var(--font-mono)" transform="rotate(-90 500 200)" textAnchor="middle">
        HOLLOW RIDGE CT
      </text>

      {/* Parcels */}
      {PARCELS.map((p) => {
        const isSel = selected.includes(p.id);
        const isYou = you === p.id;
        const isHover = hovered === p.id;
        let fill = "var(--color-card)";
        let stroke = "var(--color-border)";
        if (isSel) {
          fill = "color-mix(in oklch, var(--color-selected) 30%, var(--color-card))";
          stroke = "var(--color-selected)";
        }
        if (isYou) {
          fill = "color-mix(in oklch, var(--color-gold) 40%, var(--color-card))";
          stroke = "var(--color-gold)";
        }
        return (
          <g
            key={p.id}
            className="cursor-pointer"
            onClick={() => onToggleParcel(p.id)}
            onMouseEnter={() => onHoverParcel(p.id)}
            onMouseLeave={() => onHoverParcel(null)}
          >
            <polygon
              points={p.poly.map((pt) => pt.join(",")).join(" ")}
              fill={fill}
              stroke={stroke}
              strokeWidth={isYou || isSel ? 2 : 1}
              opacity={isHover ? 0.85 : 1}
            />
            {/* frontage marker when selected */}
            {isSel && (
              <line
                x1={p.frontageLine[0][0]}
                y1={p.frontageLine[0][1]}
                x2={p.frontageLine[1][0]}
                y2={p.frontageLine[1][1]}
                stroke={isYou ? "var(--color-gold)" : "var(--color-selected)"}
                strokeWidth="4"
                strokeLinecap="round"
              />
            )}
            <text
              x={p.label[0]}
              y={p.label[1]}
              fill="var(--color-map-ink)"
              fontSize="9"
              fontFamily="var(--font-mono)"
              textAnchor="middle"
              dominantBaseline="middle"
              pointerEvents="none"
            >
              {p.address.split(" ")[0]}
            </text>
          </g>
        );
      })}

      {/* Entrances */}
      {ENTRANCES.map((e) => {
        const pinned = entrances.includes(e.id);
        return (
          <g
            key={e.id}
            className="cursor-pointer"
            onClick={() => onToggleEntrance(e.id)}
          >
            {!pinned && (
              <circle
                cx={e.x}
                cy={e.y}
                r="12"
                fill="none"
                stroke="var(--color-gold)"
                strokeWidth="2"
                strokeDasharray="4 3"
                style={{ transformOrigin: `${e.x}px ${e.y}px`, animation: "rs-pulse 2s ease-out infinite" }}
              />
            )}
            <circle cx={e.x} cy={e.y} r="8" fill={pinned ? "var(--color-selected)" : "var(--color-card)"} stroke="var(--color-map-ink)" strokeWidth="1.5" />
            {pinned && (
              <path d={`M ${e.x} ${e.y - 8} L ${e.x} ${e.y - 26} L ${e.x + 14} ${e.y - 22} L ${e.x} ${e.y - 18}`} fill="var(--color-selected)" stroke="var(--color-selected)" strokeWidth="1.5" strokeLinejoin="round" />
            )}
          </g>
        );
      })}

      {/* North arrow */}
      <g transform={`translate(${VIEW.w - 46}, ${VIEW.h - 58})`}>
        <path d="M 0 -18 L 6 6 L 0 0 L -6 6 Z" fill="var(--color-map-ink)" />
        <text x="0" y="22" fill="var(--color-map-ink)" fontSize="11" fontFamily="var(--font-mono)" textAnchor="middle">
          N
        </text>
      </g>

      {/* Scale bar: 100 ft = 80 units */}
      <g transform={`translate(60, ${VIEW.h - 24})`}>
        <line x1="0" y1="0" x2="80" y2="0" stroke="var(--color-map-ink)" strokeWidth="2" />
        <line x1="0" y1="-4" x2="0" y2="4" stroke="var(--color-map-ink)" strokeWidth="2" />
        <line x1="80" y1="-4" x2="80" y2="4" stroke="var(--color-map-ink)" strokeWidth="2" />
        <text x="40" y="14" fill="var(--color-map-ink)" fontSize="10" fontFamily="var(--font-mono)" textAnchor="middle">
          100 ft
        </text>
      </g>
    </svg>
  );
}