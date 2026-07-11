import { motion } from "framer-motion";
import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import {
  formatFt,
  formatUSD,
  type AllocationResult,
  type Methodology,
} from "@/lib/roadshare/engine";

const METHOD_LABEL: Record<Methodology, string> = {
  distance: "Distance responsibility",
  frontage: "Frontage length",
  equal: "Equal per lot",
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
}: {
  result: AllocationResult;
  methodology: Methodology;
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
          <span>Pin at least one entrance to compute distance responsibility.</span>
        </div>
      )}

      {/* Your-share hero */}
      {showDollars && yourRow && (
        <div className="overflow-hidden rounded-xl border border-gold/60 bg-gradient-to-br from-gold/20 to-gold/5 p-4">
          <div className="text-[11px] font-medium uppercase tracking-wide text-gold-foreground/80">
            Your estimated share
          </div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="font-display text-3xl font-bold text-foreground">
              {formatUSD(yourRow.perYear)}
            </span>
            <span className="text-sm text-muted-foreground">/ year</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs">
            <span className="font-mono font-semibold text-foreground">
              {(yourRow.share * 100).toFixed(1)}%
            </span>
            <span className="text-muted-foreground">of the group ·</span>
            {Math.abs(yourDelta) < 1 ? (
              <span className="text-muted-foreground">even with equal split</span>
            ) : yourDelta > 0 ? (
              <span className="flex items-center gap-0.5 text-destructive">
                <TrendingUp className="h-3 w-3" /> {formatUSD(yourDelta)} vs equal
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-selected">
                <TrendingDown className="h-3 w-3" /> {formatUSD(-yourDelta)} vs equal
              </span>
            )}
          </div>
        </div>
      )}

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
          Select parcels on the map to build the cost-sharing group.
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
    </div>
  );
}