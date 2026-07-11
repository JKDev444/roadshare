import {
  EDGES,
  ENTRANCES,
  NODES,
  PARCELS,
  TOTAL_ROAD_FT,
  type Edge,
  type NodeId,
  type Parcel,
  type RoadPos,
  type SurfaceType,
} from "./data";

export type Methodology = "distance" | "frontage" | "equal";

// Dijkstra over the small road-network graph, from a source node.
function nodeDistances(source: NodeId): Record<string, number> {
  const nodeIds = Object.keys(NODES) as NodeId[];
  const distByNode: Record<string, number> = {};
  nodeIds.forEach((n) => (distByNode[n] = Infinity));
  distByNode[source] = 0;
  const visited = new Set<string>();

  while (visited.size < nodeIds.length) {
    let u: NodeId | null = null;
    let best = Infinity;
    for (const n of nodeIds) {
      if (!visited.has(n) && distByNode[n] < best) {
        best = distByNode[n];
        u = n;
      }
    }
    if (u === null) break;
    visited.add(u);
    for (const e of EDGES) {
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

function edgeById(id: string): Edge {
  return EDGES.find((e) => e.id === id)!;
}

// Network distance from a source's node-distance map to a road position.
function distToPos(nd: Record<string, number>, pos: RoadPos): number {
  const e = edgeById(pos.edge);
  const viaA = nd[e.a] + pos.offset;
  const viaB = nd[e.b] + (e.length - pos.offset);
  return Math.min(viaA, viaB);
}

function frontageLength(p: Parcel): number {
  return Math.abs(p.frontage[1].offset - p.frontage[0].offset);
}

// Direction-aware "far edge" responsibility from a single entrance:
// the greater of the network distances to the two frontage endpoints.
function distanceResponsibility(p: Parcel, entranceNode: NodeId): number {
  const nd = nodeDistances(entranceNode);
  return Math.max(distToPos(nd, p.frontage[0]), distToPos(nd, p.frontage[1]));
}

export interface AllocationInput {
  selected: string[]; // parcel ids in the cost-sharing group
  entrances: ("west" | "north")[]; // pinned entrance ids
  methodology: Methodology;
  surfaces: { pct: number; cost: number }[]; // aligned with SURFACE_TYPES
  surfaceTypes: SurfaceType[];
  roadWidth: number;
  fundingPeriod: number;
  you: string | null;
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
  p: Parcel,
  methodology: Methodology,
  entranceNodes: NodeId[],
): number {
  if (methodology === "equal") return 1;
  if (methodology === "frontage") return frontageLength(p);
  // distance: average across pinned entrances
  if (entranceNodes.length === 0) return 0;
  const perEntrance = entranceNodes.map((n) => distanceResponsibility(p, n));
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
  } = input;

  const pctTotal = surfaces.reduce((s, x) => s + (Number(x.pct) || 0), 0);
  const pctValid = Math.abs(pctTotal - 100) < 0.001;
  const blendedRate = surfaces.reduce(
    (s, x) => s + ((Number(x.pct) || 0) / 100) * (Number(x.cost) || 0),
    0,
  );
  const pavementArea = TOTAL_ROAD_FT * (Number(roadWidth) || 0);
  const totalCost = pctValid ? pavementArea * blendedRate : 0;
  const period = Math.max(1, Number(fundingPeriod) || 1);

  const entranceNodes = ENTRANCES.filter((e) => entrances.includes(e.id)).map(
    (e) => e.node,
  );
  const hasEntrance = methodology !== "distance" || entranceNodes.length > 0;

  const group = PARCELS.filter((p) => selected.includes(p.id));
  const resp = new Map<string, number>();
  group.forEach((p) =>
    resp.set(p.id, responsibilityFor(p, methodology, entranceNodes)),
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
    totalRoadFt: TOTAL_ROAD_FT,
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