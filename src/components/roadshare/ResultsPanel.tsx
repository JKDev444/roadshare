import { motion } from "framer-motion";
import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import {
  formatFt,
  formatUSD,
  type AllocationResult,
  type Methodology,
} from "@/lib/roadshare/engine";

const METHOD_LABEL: Record<Methodology, string> = {
  distance: "By distance from entrance",
  frontage: "By frontage on the road",
  equal: "Split evenly per home",
};

function Tile({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        highlight
          ? "border-gold bg-gold/15"
          : "border-border bg-muted/40"
      }`}
    >
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 font-mono text-lg font-semibold ${
          highlight ? "text-foreground" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export function ResultsPanel({
  result,
  methodology,
  compact = false,
  hideHero = false,
}: {
  result: AllocationResult;
  methodology: Methodology;
  /** Compact mode: show only the "your share" hero + total. Used in the app's
   *  right rail so the number stays visible while the user tweaks sliders. */
  compact?: boolean;
  /** Skip rendering the hero (used when the hero is pinned above this block). */
  hideHero?: boolean;
}) {
  const { rows, pctValid, hasEntrance } = result;
  const maxResp = Math.max(1, ...rows.map((r) => r.responsibility));
  const showDollars = pctValid && hasEntrance;
  const yourRow = rows.find((r) => r.isYou);
  const yourDelta =
    yourRow && yourRow.equalPerYear > 0
      ? yourRow.perYear - yourRow.equalPerYear
      : 0;

  return (
    <div className="space-y-4">
      {!pctValid && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Surface mix totals {result.pctTotal.toFixed(0)}%. Adjust to 100% to
            see dollar figures.
          </span>
        </div>
      )}
      {pctValid && !hasEntrance && (
        <div className="flex items-start gap-2 rounded-lg border border-gold/50 bg-gold/10 p-3 text-sm text-foreground">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
          <span>Pin at least one entrance on the map so we can measure distance.</span>
        </div>
      )}

      {/* Your-share hero */}
      {!hideHero && showDollars && yourRow && (
        <div className="overflow-hidden rounded-2xl border border-gold/60 bg-gradient-to-br from-gold/25 via-gold/10 to-background p-5 shadow-sm">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-foreground/80">
            Your estimated share
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-4xl font-extrabold leading-none tracking-tight text-foreground">
              {formatUSD(yourRow.perYear)}
            </span>
            <span className="text-sm font-medium text-muted-foreground">/ year</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="rounded-full bg-background/70 px-2 py-0.5 font-mono font-bold text-foreground ring-1 ring-gold/40">
              {(yourRow.share * 100).toFixed(1)}% of the group
            </span>
            {Math.abs(yourDelta) < 1 ? (
              <span className="text-muted-foreground">Even with an equal split.</span>
            ) : yourDelta > 0 ? (
              <span className="inline-flex items-center gap-1 text-destructive">
                <TrendingUp className="h-3 w-3" /> {formatUSD(yourDelta)} more than equal split
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-selected">
                <TrendingDown className="h-3 w-3" /> {formatUSD(-yourDelta)} less than equal split
              </span>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gold/30 pt-3 text-xs">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total project</div>
              <div className="mt-0.5 font-mono text-base font-bold text-foreground">{formatUSD(result.totalCost)}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Per year (group)</div>
              <div className="mt-0.5 font-mono text-base font-bold text-foreground">{formatUSD(result.totalPerYear)}</div>
            </div>
          </div>
        </div>
      )}

      {compact ? (
        null
      ) : (
        <>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold">Cost breakdown</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          {METHOD_LABEL[methodology]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Tile label="Total road" value={formatFt(result.totalRoadFt)} />
        <Tile
          label="Blended $/sq ft"
          value={formatUSD(result.blendedRate, true)}
        />
        <Tile
          label="Total project"
          value={showDollars ? formatUSD(result.totalCost) : "—"}
        />
        <Tile
          label="Per year"
          value={showDollars ? formatUSD(result.totalPerYear) : "—"}
        />
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Tap homes on the map to add them to the group sharing the road.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="p-2 text-left font-medium">Address</th>
                <th className="p-2 text-right font-medium">Share</th>
                <th className="p-2 text-right font-medium">Per yr</th>
                <th className="p-2 text-right font-medium">Equal/yr</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <motion.tr
                  key={r.id}
                  layout
                  className={`border-t border-border ${
                    r.isYou ? "bg-gold/15" : ""
                  }`}
                >
                  <td className="p-2">
                    <div className="flex items-center gap-1.5">
                      {r.isYou && (
                        <span className="rounded bg-gold px-1 text-[9px] font-bold uppercase text-gold-foreground">
                          You
                        </span>
                      )}
                      <span className="font-medium">{r.address}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${
                          r.isYou ? "bg-gold" : "bg-selected"
                        }`}
                        style={{
                          width: `${(r.responsibility / maxResp) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                      {formatFt(r.responsibility)}
                    </div>
                  </td>
                  <td className="p-2 text-right font-mono">
                    {(r.share * 100).toFixed(1)}%
                  </td>
                  <td className="p-2 text-right font-mono font-semibold">
                    {showDollars ? formatUSD(r.perYear) : "—"}
                  </td>
                  <td className="p-2 text-right font-mono text-muted-foreground">
                    {showDollars ? formatUSD(r.equalPerYear) : "—"}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}
    </div>
  );
}