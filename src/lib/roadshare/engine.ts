import { type RoadPos, type SurfaceType } from "./data";
import type { Layout, LayoutEdge, LayoutEntrance, LayoutParcel } from "./layout";

export type Methodology = "distance" | "frontage" | "equal";

// Dijkstra over the small road-network graph, from a source node.
function nodeDistances(source: string, layout: Layout): Record<string, number> {
  const nodeIds = Object.keys(layout.nodes);
  const distByNode: Record<string, number> = {};
  nodeIds.forEach((n) => (distByNode[n] = Infinity));
  distByNode[source] = 0;
  const visited = new Set<string>();

  while (visited.size < nodeIds.length) {
    let u: string | null = null;
    let best = Infinity;
    for (const n of nodeIds) {
      if (!visited.has(n) && distByNode[n] < best) {
        best = distByNode[n];
        u = n;
      }
    }
    if (u === null) break;
    visited.add(u);
    for (const e of layout.edges) {
      if (e.a === u && distByNode[u] + e.length < distByNode[e.b]) {
        distByNode[e.b] = distByNode[u] + e.length;
      }
      if (e.b === u && distByNode[u] + e.length < distByNode[e.a]) {
        distByNode[e.a] = distByNode[u] + e.length;
      }
    }
  }
  return distByNode;
}

function edgeById(id: string, layout: Layout): LayoutEdge {
  return layout.edges.find((e) => e.id === id)!;
}

// Network distance from a source's node-distance map to a road position.
function distToPos(nd: Record<string, number>, pos: RoadPos, layout: Layout): number {
  const e = edgeById(pos.edge, layout);
  const viaA = nd[e.a] + pos.offset;
  const viaB = nd[e.b] + (e.length - pos.offset);
  return Math.min(viaA, viaB);
}

function frontageLength(p: LayoutParcel): number {
  return Math.abs(p.frontage[1].offset - p.frontage[0].offset);
}

function distanceResponsibility(p: LayoutParcel, entranceNode: string, layout: Layout): number {
  const nd = nodeDistances(entranceNode, layout);
  return Math.max(distToPos(nd, p.frontage[0], layout), distToPos(nd, p.frontage[1], layout));
}

export interface AllocationInput {
  selected: string[]; // parcel ids in the cost-sharing group
  entrances: string[]; // pinned entrance ids
  methodology: Methodology;
  surfaces: { pct: number; cost: number }[]; // aligned with SURFACE_TYPES
  surfaceTypes: SurfaceType[];
  roadWidth: number;
  fundingPeriod: number;
  you: string | null;
  layout: Layout;
}

export interface AllocationRow {
  id: string;
  address: string;
  isYou: boolean;
  responsibility: number; // basis footage for the chosen method
  share: number; // 0..1
  total: number;
  perYear: number;
  equalPerYear: number;
}

export interface AllocationResult {
  totalRoadFt: number;
  pavementArea: number;
  pctTotal: number;
  pctValid: boolean;
  blendedRate: number;
  totalCost: number;
  totalPerYear: number;
  rows: AllocationRow[];
  hasEntrance: boolean;
}

function responsibilityFor(
  p: LayoutParcel,
  methodology: Methodology,
  entranceNodes: string[],
  layout: Layout,
): number {
  if (methodology === "equal") return 1;
  if (methodology === "frontage") return frontageLength(p);
  // distance: average across pinned entrances
  if (entranceNodes.length === 0) return 0;
  const perEntrance = entranceNodes.map((n) => distanceResponsibility(p, n, layout));
  return perEntrance.reduce((a, b) => a + b, 0) / perEntrance.length;
}

export function computeAllocation(input: AllocationInput): AllocationResult {
  const {
    selected,
    entrances,
    methodology,
    surfaces,
    roadWidth,
    fundingPeriod,
    you,
    layout,
  } = input;

  const pctTotal = surfaces.reduce((s, x) => s + (Number(x.pct) || 0), 0);
  const pctValid = Math.abs(pctTotal - 100) < 0.001;
  const blendedRate = surfaces.reduce(
    (s, x) => s + ((Number(x.pct) || 0) / 100) * (Number(x.cost) || 0),
    0,
  );
  const pavementArea = layout.totalRoadFt * (Number(roadWidth) || 0);
  const totalCost = pctValid ? pavementArea * blendedRate : 0;
  const period = Math.max(1, Number(fundingPeriod) || 1);

  const entranceNodes = layout.entrances
    .filter((e) => entrances.includes(e.id))
    .map((e) => e.node);
  const hasEntrance = methodology !== "distance" || entranceNodes.length > 0;

  const group = layout.parcels.filter((p) => selected.includes(p.id));
  const resp = new Map<string, number>();
  group.forEach((p) =>
    resp.set(p.id, responsibilityFor(p, methodology, entranceNodes, layout)),
  );
  const respSum = [...resp.values()].reduce((a, b) => a + b, 0);
  const n = group.length;

  const rows: AllocationRow[] = group.map((p) => {
    const r = resp.get(p.id) ?? 0;
    const share = respSum > 0 ? r / respSum : 0;
    const total = totalCost * share;
    const equalTotal = n > 0 ? totalCost / n : 0;
    return {
      id: p.id,
      address: p.address,
      isYou: p.id === you,
      responsibility: r,
      share,
      total,
      perYear: total / period,
      equalPerYear: equalTotal / period,
    };
  });

  rows.sort((a, b) => b.responsibility - a.responsibility);

  return {
    totalRoadFt: layout.totalRoadFt,
    pavementArea,
    pctTotal,
    pctValid,
    blendedRate,
    totalCost,
    totalPerYear: totalCost / period,
    rows,
    hasEntrance,
  };
}

export function formatUSD(n: number, cents = false): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
}

export function formatFt(n: number): string {
  return `${Math.round(n).toLocaleString("en-US")} ft`;
}