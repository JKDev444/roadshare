import { useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileText,
  Flag,
  Home,
  Loader2,
  Route as RouteIcon,
  Scale,
  Trash2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { CcrDraft } from "@/lib/onboarding/ccrDraft";

type SectionId =
  | "summary"
  | "community"
  | "properties"
  | "roads"
  | "maintenance"
  | "documents"
  | "items"
  | "finish";

const SECTIONS: Array<{ id: SectionId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "summary", label: "Summary", icon: ClipboardList },
  { id: "community", label: "Community", icon: Building2 },
  { id: "properties", label: "Properties", icon: Home },
  { id: "roads", label: "Roads", icon: RouteIcon },
  { id: "maintenance", label: "Maintenance Rules", icon: Scale },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "items", label: "Items to Review", icon: Flag },
  { id: "finish", label: "Finish Setup", icon: CheckCircle2 },
];

function unresolvedLots(draft: CcrDraft): number {
  return draft.lots.filter((l) => !l.address).length;
}

function ProvenanceChip({ p }: { p?: string }) {
  const label =
    p === "extracted"
      ? "Extracted"
      : p === "entered"
      ? "Entered"
      : p === "confirmed"
      ? "Confirmed"
      : p === "sample"
      ? "Sample"
      : "Unresolved";
  const cls =
    p === "confirmed"
      ? "bg-primary/10 text-primary"
      : p === "sample"
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
      : p === "entered"
      ? "bg-blue-500/10 text-blue-700 dark:text-blue-400"
      : p === "extracted"
      ? "bg-muted text-muted-foreground"
      : "bg-destructive/10 text-destructive";
  return <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", cls)}>{label}</span>;
}

/** Guided review workspace (spec §8-13). Single scroll region, left stepper. */
export function ReviewWorkspace({
  draft,
  filenames,
  onChange,
  onFinish,
  onSaveForLater,
  applying,
  focusUnresolved,
}: {
  draft: CcrDraft;
  filenames: string[];
  onChange: (d: CcrDraft) => void;
  onFinish: (d: CcrDraft) => void | Promise<void>;
  onSaveForLater: () => void;
  applying?: boolean;
  focusUnresolved?: boolean;
}) {
  const [section, setSection] = useState<SectionId>(focusUnresolved ? "items" : "summary");
  const unresolved = unresolvedLots(draft);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[180px_1fr]">
      <nav aria-label="Review sections" className="space-y-1">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const active = section === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSection(s.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                active
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {s.label}
              {s.id === "items" && unresolved > 0 && (
                <span className="ml-auto rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                  {unresolved}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="min-w-0 space-y-4">
        {section === "summary" && <SummarySection draft={draft} filenames={filenames} unresolved={unresolved} onJump={setSection} />}
        {section === "community" && <CommunitySection draft={draft} onChange={onChange} />}
        {section === "properties" && <PropertiesSection draft={draft} onChange={onChange} unresolvedOnly={false} />}
        {section === "roads" && <RoadsSection draft={draft} onChange={onChange} />}
        {section === "maintenance" && <MaintenanceSection draft={draft} onChange={onChange} />}
        {section === "documents" && <DocumentsSection filenames={filenames} />}
        {section === "items" && <PropertiesSection draft={draft} onChange={onChange} unresolvedOnly />}
        {section === "finish" && (
          <FinishSection
            draft={draft}
            filenames={filenames}
            onFinish={onFinish}
            onSaveForLater={onSaveForLater}
            applying={applying}
          />
        )}
      </div>
    </div>
  );
}

function SummarySection({
  draft,
  filenames,
  unresolved,
  onJump,
}: {
  draft: CcrDraft;
  filenames: string[];
  unresolved: number;
  onJump: (s: SectionId) => void;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-display text-lg font-semibold">Here's what we found</h3>
        <p className="text-xs text-muted-foreground">
          Nothing is locked in yet. You can confirm or change each item before it is used in cost calculations.
        </p>
      </div>
      <ul className="space-y-1.5 text-sm">
        <SummaryRow label="Community" value={draft.community.name || "Not set"} />
        <SummaryRow label="Region" value={draft.community.region || "Not set"} />
        <SummaryRow label="Homes" value={String(draft.lots.length)} />
        <SummaryRow
          label="With street addresses"
          value={String(draft.lots.filter((l) => l.address).length)}
        />
        <SummaryRow label="Roads" value={String(draft.roads.length)} />
        <SummaryRow
          label="Maintenance summary"
          value={draft.maintenance_summary ? "Found" : "Not added yet"}
        />
        <SummaryRow
          label="Cost-sharing formula"
          value={draft.assessment_formula ? "Possible match" : "Not added yet"}
        />
        <SummaryRow label="Property map" value="Not added yet" />
      </ul>
      {(draft.meta?.missing_exhibits ?? []).length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
          <p className="font-semibold">Referenced but missing:</p>
          <ul className="mt-1 list-inside list-disc text-muted-foreground">
            {draft.meta!.missing_exhibits!.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {unresolved > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
          <p>We need your help with {unresolved} item{unresolved === 1 ? "" : "s"}.</p>
          <Button size="sm" variant="outline" onClick={() => onJump("items")}>Review Important Items <ArrowRight className="h-4 w-4" /></Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Uploaded: {filenames.length ? filenames.join(", ") : "None"}</p>
      <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Ready when you are</p>
          <p className="text-xs text-muted-foreground">You can create the workspace now and keep editing later.</p>
        </div>
        <Button size="sm" onClick={() => onJump("finish")}>
          Continue to Finish <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between border-b border-border/40 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </li>
  );
}

function CommunitySection({ draft, onChange }: { draft: CcrDraft; onChange: (d: CcrDraft) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-display text-lg font-semibold">Community</h3>
        <p className="text-xs text-muted-foreground">Basic identity for your road group.</p>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Community name</Label>
        <Input
          value={draft.community.name}
          onChange={(e) => onChange({ ...draft, community: { ...draft.community, name: e.target.value } })}
          placeholder="Required to create the workspace"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Region</Label>
        <Input
          value={draft.community.region ?? ""}
          onChange={(e) => onChange({ ...draft, community: { ...draft.community, region: e.target.value || null } })}
          placeholder="e.g. Larimer County, CO"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Description</Label>
        <Textarea
          rows={2}
          value={draft.community.description ?? ""}
          onChange={(e) => onChange({ ...draft, community: { ...draft.community, description: e.target.value || null } })}
        />
      </div>
    </div>
  );
}

function PropertiesSection({
  draft,
  onChange,
  unresolvedOnly,
}: {
  draft: CcrDraft;
  onChange: (d: CcrDraft) => void;
  unresolvedOnly: boolean;
}) {
  const visible = useMemo(
    () =>
      draft.lots
        .map((l, i) => ({ lot: l, index: i }))
        .filter(({ lot }) => (unresolvedOnly ? !lot.address : true)),
    [draft.lots, unresolvedOnly],
  );

  function patchLot(i: number, patch: Partial<CcrDraft["lots"][number]>) {
    onChange({ ...draft, lots: draft.lots.map((l, j) => (i === j ? { ...l, ...patch } : l)) });
  }
  function removeLot(i: number) {
    onChange({ ...draft, lots: draft.lots.filter((_, j) => j !== i) });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display text-lg font-semibold">
            {unresolvedOnly ? "Items to Review" : "Properties"}
          </h3>
          <p className="text-xs text-muted-foreground">
            {unresolvedOnly
              ? "These properties are missing details you may want to add."
              : "Confirm the properties. Each shows where it came from."}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">{visible.length} of {draft.lots.length}</p>
      </div>

      {visible.length === 0 && (
        <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          {unresolvedOnly ? "Nothing needs your attention here." : "No properties yet. Add some from the previous step."}
        </div>
      )}

      <ul className="space-y-2">
        {visible.map(({ lot, index }) => (
          <li key={index} className="rounded-lg border border-border bg-card p-3 text-sm">
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-primary" />
              <span className="font-semibold">{lot.label}</span>
              <ProvenanceChip p={lot.provenance} />
              <button
                type="button"
                className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                onClick={() => removeLot(index)}
                aria-label={`Remove ${lot.label}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              <div>
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Address</Label>
                <Input
                  value={lot.address ?? ""}
                  onChange={(e) => patchLot(index, { address: e.target.value || null })}
                  placeholder="Not found in the uploaded documents"
                  className="h-8"
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Owner</Label>
                <Input
                  value={lot.owner_name ?? ""}
                  onChange={(e) => patchLot(index, { owner_name: e.target.value || null })}
                  placeholder="Optional"
                  className="h-8"
                />
              </div>
            </div>
            {(lot.source_doc || lot.source_page) && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Source: {lot.source_doc ?? "document"}{lot.source_page ? `, page ${lot.source_page}` : ""}
              </p>
            )}
            {lot.provenance !== "confirmed" && (
              <div className="mt-2 flex gap-1.5">
                <Button size="sm" variant="outline" onClick={() => patchLot(index, { provenance: "confirmed" })}>
                  <CheckCircle2 className="h-3 w-3" /> Confirm
                </Button>
                {!lot.address && (
                  <Button size="sm" variant="ghost" onClick={() => patchLot(index, { provenance: "confirmed" })}>
                    Mark Confirmed Without Address
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RoadsSection({ draft, onChange }: { draft: CcrDraft; onChange: (d: CcrDraft) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-display text-lg font-semibold">Roads</h3>
        <p className="text-xs text-muted-foreground">
          Named roads found in your documents. You'll draw or refine roads on the map after setup.
        </p>
      </div>
      <ul className="space-y-2">
        {draft.roads.map((r, i) => (
          <li key={i} className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm">
            <RouteIcon className="h-4 w-4 text-primary" />
            <Input
              value={r.name}
              onChange={(e) =>
                onChange({ ...draft, roads: draft.roads.map((x, j) => (i === j ? { ...x, name: e.target.value } : x)) })
              }
              className="h-8 flex-1"
            />
            <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
              {r.has_geometry ? "Confirmed" : "No geometry"}
            </span>
            <ProvenanceChip p={r.provenance} />
          </li>
        ))}
        {draft.roads.length === 0 && (
          <li className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            No roads yet. You can add them in the map editor.
          </li>
        )}
      </ul>
    </div>
  );
}

function MaintenanceSection({ draft, onChange }: { draft: CcrDraft; onChange: (d: CcrDraft) => void }) {
  const hasRule = !!draft.maintenance_summary || !!draft.assessment_formula;
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-display text-lg font-semibold">Maintenance Rules</h3>
        <p className="text-xs text-muted-foreground">
          Cost-sharing rules pulled from your documents. Nothing here is legally binding — you decide what applies.
        </p>
      </div>
      {hasRule ? (
        <div className="space-y-3 rounded-lg border border-border bg-card p-3 text-sm">
          <div>
            <Label className="text-xs">What the documents say about maintenance</Label>
            <Textarea
              rows={2}
              value={draft.maintenance_summary ?? ""}
              onChange={(e) => onChange({ ...draft, maintenance_summary: e.target.value || null })}
            />
          </div>
          <div>
            <Label className="text-xs">Cost-sharing formula (possible match)</Label>
            <Input
              value={draft.assessment_formula ?? ""}
              onChange={(e) => onChange({ ...draft, assessment_formula: e.target.value || null })}
              placeholder="e.g. Equal 1/12 share per lot"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline">This Looks Correct</Button>
            <Button size="sm" variant="ghost">This Is Not Correct</Button>
            <Button size="sm" variant="ghost">I'm Not Sure</Button>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          No maintenance language was found. You can enter your own after setup.
        </div>
      )}
    </div>
  );
}

function DocumentsSection({ filenames }: { filenames: string[] }) {
  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg font-semibold">Documents</h3>
      {filenames.length === 0 ? (
        <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {filenames.map((f) => (
            <li key={f} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm">
              <FileText className="h-4 w-4 text-primary" /> {f}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FinishSection({
  draft,
  filenames,
  onFinish,
  onSaveForLater,
  applying,
}: {
  draft: CcrDraft;
  filenames: string[];
  onFinish: (d: CcrDraft) => void | Promise<void>;
  onSaveForLater: () => void;
  applying?: boolean;
}) {
  const confirmed = draft.lots.filter((l) => l.provenance === "confirmed").length;
  const unresolved = draft.lots.filter((l) => !l.address).length;
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-display text-lg font-semibold">Your starting workspace is ready</h3>
        <p className="text-xs text-muted-foreground">
          Nothing is final. You can keep editing everything after setup.
        </p>
      </div>
      <ul className="space-y-1 text-sm">
        <li>Community: <strong>{draft.community.name || "Untitled"}</strong></li>
        <li>Properties added: {draft.lots.length}{confirmed > 0 ? ` (${confirmed} confirmed)` : ""}</li>
        <li>Roads: {draft.roads.length}</li>
        <li>Documents: {filenames.length}</li>
        {unresolved > 0 && (
          <li className="text-muted-foreground">{unresolved} propert{unresolved === 1 ? "y" : "ies"} can still get an address later — that's fine.</li>
        )}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onSaveForLater} disabled={applying}>
          Save and Return Later
        </Button>
        <Button size="sm" onClick={() => onFinish(draft)} disabled={applying || !draft.community.name.trim()}>
          {applying && <Loader2 className="h-4 w-4 animate-spin" />}
          Create workspace and open the road map <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}