import type { Layout, LayoutParcel } from "./layout";

export type MergedRibbon = {
  segmentId: string;
  ax: number;
  ay: number;
  bx: number;
  by: number;
};

/**
 * For every road segment, collect the frontage intervals of the given
 * selected parcels, merge overlapping/adjacent intervals (with a small pad so
 * neighbouring homes read as one continuous shared stretch), and return the
 * SVG-coordinate endpoints for each merged ribbon.
 */
export function mergeSelectedFrontage(
  layout: Layout,
  selectedIds: string[],
  padFt = 8,
): MergedRibbon[] {
  if (selectedIds.length === 0) return [];
  const selectedSet = new Set(selectedIds);
  const selectedParcels: LayoutParcel[] = layout.parcels.filter((p) => selectedSet.has(p.id));

  // Group intervals per edge id. Each interval is [offsetLow, offsetHigh] in ft.
  const perEdge = new Map<string, [number, number][]>();
  for (const p of selectedParcels) {
    if (!p.frontage || p.frontage.length !== 2) continue;
    const [a, b] = p.frontage;
    if (a.edge !== b.edge) continue;
    const lo = Math.min(a.offset, b.offset);
    const hi = Math.max(a.offset, b.offset);
    const list = perEdge.get(a.edge) ?? [];
    list.push([lo, hi]);
    perEdge.set(a.edge, list);
  }

  const ribbons: MergedRibbon[] = [];
  for (const edge of layout.edges) {
    const intervals = perEdge.get(edge.id);
    if (!intervals || intervals.length === 0) continue;

    // Sort + merge with a small pad so tiny gaps between adjacent homes close up.
    intervals.sort((a, b) => a[0] - b[0]);
    const merged: [number, number][] = [];
    for (const [lo, hi] of intervals) {
      const last = merged[merged.length - 1];
      if (last && lo - last[1] <= padFt) {
        last[1] = Math.max(last[1], hi);
      } else {
        merged.push([lo, hi]);
      }
    }

    const na = layout.nodes[edge.a];
    const nb = layout.nodes[edge.b];
    if (!na || !nb) continue;
    const dx = nb.x - na.x;
    const dy = nb.y - na.y;
    const segLenFt = edge.length || 1;
    for (const [lo, hi] of merged) {
      const t0 = Math.max(0, Math.min(1, lo / segLenFt));
      const t1 = Math.max(0, Math.min(1, hi / segLenFt));
      ribbons.push({
        segmentId: edge.id,
        ax: na.x + dx * t0,
        ay: na.y + dy * t0,
        bx: na.x + dx * t1,
        by: na.y + dy * t1,
      });
    }
  }
  return ribbons;
}