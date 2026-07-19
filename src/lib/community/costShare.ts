import type { Parcel, RoadSegment } from "./api";
import { haversineFt } from "./api";

export type CostMethod = "equal" | "frontage" | "distance";

export type CostShareRow = {
  parcelId: string;
  label: string;
  address: string | null;
  basis: number;
  share: number;
  amount: number;
};

export type CostShareResult = {
  method: CostMethod;
  total: number;
  rows: CostShareRow[];
  fallback: "equal" | null; // set when the requested method lacked data and we fell back
};

/** Return [lng, lat] of the first vertex of the first segment, if any. */
function entrancePoint(segments: RoadSegment[]): [number, number] | null {
  for (const s of segments) {
    const g = s.geometry as unknown as { type?: string; coordinates?: unknown };
    if (g && g.type === "LineString" && Array.isArray(g.coordinates)) {
      const first = (g.coordinates as unknown[])[0];
      if (Array.isArray(first) && first.length >= 2) {
        const lng = Number(first[0]);
        const lat = Number(first[1]);
        if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
      }
    }
  }
  return null;
}

/** Straight-line distance in ft from a parcel to the road entrance. */
function parcelDistanceFt(p: Parcel, entrance: [number, number] | null): number {
  if (!entrance || p.lat == null || p.lng == null) return 0;
  return haversineFt(entrance, [Number(p.lng), Number(p.lat)]);
}

/**
 * Compute cost shares across three fair-share methods.
 * - equal: every home pays 1/N
 * - frontage: uses `parcel.frontage_ft`; falls back to equal if none present
 * - distance: straight-line from each home to the first road entrance; falls
 *   back to equal if no road drawn or no coordinates
 *
 * This math is intentionally simple — the Cedar Hollow demo has the fuller
 * network model. All three methods are preserved.
 */
export function computeCostShare(
  parcels: Parcel[],
  segments: RoadSegment[],
  total: number,
  method: CostMethod,
): CostShareResult {
  const n = parcels.length;
  const equalRow = (p: Parcel): number => (n > 0 ? 1 / n : 0);

  let basis: number[] = [];
  let fallback: "equal" | null = null;

  if (method === "equal") {
    basis = parcels.map(() => 1);
  } else if (method === "frontage") {
    basis = parcels.map((p) => Number(p.frontage_ft ?? 0));
    if (basis.every((b) => b <= 0)) {
      basis = parcels.map(() => 1);
      fallback = "equal";
    }
  } else {
    const entrance = entrancePoint(segments);
    basis = parcels.map((p) => parcelDistanceFt(p, entrance));
    if (basis.every((b) => b <= 0)) {
      basis = parcels.map(() => 1);
      fallback = "equal";
    }
  }

  const sum = basis.reduce((a, b) => a + b, 0);
  const rows: CostShareRow[] = parcels.map((p, i) => {
    const share = sum > 0 ? basis[i] / sum : equalRow(p);
    return {
      parcelId: p.id,
      label: p.label,
      address: p.address ?? null,
      basis: basis[i],
      share,
      amount: total * share,
    };
  });
  rows.sort((a, b) => b.share - a.share);

  return { method, total, rows, fallback };
}

export function formatUSD(n: number): string {
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}
