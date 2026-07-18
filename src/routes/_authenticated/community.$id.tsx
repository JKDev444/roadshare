import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  HardHat,
  History,
  LayoutGrid,
  Map as MapIcon,
  Plus,
  Route as RouteIcon,
  Ruler,
  Trash2,
  TriangleAlert,
  Users,
} from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ConfidenceBadge, VerificationBadge } from "@/components/community/badges";
import { CommunityMapEditor } from "@/components/community/CommunityMapEditor";
import { ProjectsTab } from "@/components/planner/ProjectsTab";
import {
  createParcel,
  createSegment,
  deleteParcel,
  deleteSegment,
  downloadGeoJSON,
  getCommunity,
  listEvents,
  listParcels,
  listSegments,
  pathLengthFt,
  toPoints,
  updateParcel,
  updateSegment,
  type Confidence,
  type Community,
  type GeoJSONLineString,
  type Parcel,
  type ParcelInput,
  type RecordEvent,
  type RoadSegment,
  type Verification,
} from "@/lib/community/api";

const TABS = ["map", "properties", "projects"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/_authenticated/community/$id")({
  head: () => ({ meta: [{ title: "Community Record — RoadShare" }, { name: "robots", content: "noindex" }] }),
  validateSearch: (s: Record<string, unknown>): { tab: Tab } => ({
    tab: TABS.includes(s.tab as Tab) ? (s.tab as Tab) : "map",
  }),
  component: CommunityDetail,
});

function CommunityDetail() {
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();

  const community = useQuery({ queryKey: ["community", id], queryFn: () => getCommunity(id) });
  const parcels = useQuery({ queryKey: ["parcels", id], queryFn: () => listParcels(id) });
  const segments = useQuery({ queryKey: ["segments", id], queryFn: () => listSegments(id) });
  const events = useQuery({ queryKey: ["events", id], queryFn: () => listEvents(id) });

  const p = parcels.data ?? [];
  const s = segments.data ?? [];
  const verified = p.filter((x) => x.verification === "verified").length;
  const disputed = p.filter((x) => x.verification === "disputed").length;
  const totalRoad = s.reduce((sum, seg) => sum + pathLengthFt(seg.geometry), 0);

  return (
    <AppShell>
      <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-7xl flex-col space-y-4 px-4 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link to="/community" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> All communities
            </Link>
            <div className="mt-2 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
                <RouteIcon className="h-5 w-5" />
              </span>
              <div>
                <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  {community.data?.name ?? "Loading…"}
                </h1>
                {community.data?.region && (
                  <p className="text-sm font-medium text-muted-foreground">{community.data.region}</p>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ProvenancePopover events={events.data ?? []} loading={events.isLoading} />
            <Button
              variant="outline"
              size="sm"
              disabled={s.length === 0}
              onClick={() => {
                downloadGeoJSON(community.data ?? null, s);
                toast.success("GeoJSON exported");
              }}
            >
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={Users} label="Parcels" value={String(p.length)} />
          <Stat icon={CheckCircle2} label="Verified" value={`${verified}/${p.length || 0}`} tone="primary" />
          <Stat icon={Ruler} label="Road mapped" value={`${totalRoad.toLocaleString()} ft`} />
          <Stat icon={TriangleAlert} label="Disputed" value={String(disputed)} tone={disputed ? "warn" : "muted"} />
        </div>

        <Tabs value={tab} onValueChange={(v) => navigate({ search: { tab: v as Tab } })} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="flex-wrap">
            <TabsTrigger value="map"><MapIcon className="mr-1.5 h-4 w-4" /> Map</TabsTrigger>
            <TabsTrigger value="properties"><Users className="mr-1.5 h-4 w-4" /> Properties</TabsTrigger>
            <TabsTrigger value="projects"><HardHat className="mr-1.5 h-4 w-4" /> Projects</TabsTrigger>
          </TabsList>

          <TabsContent value="map" className="mt-4 flex min-h-0 flex-1 flex-col">
            <MapTab
              communityId={id}
              community={community.data ?? null}
              parcels={p}
              segments={s}
              events={events.data ?? []}
            />
          </TabsContent>
          <TabsContent value="properties" className="mt-4">
            <PropertiesTab communityId={id} parcels={p} loading={parcels.isLoading} />
          </TabsContent>
          <TabsContent value="projects" className="mt-4">
            <ProjectsTab communityId={id} />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}

function Stat({ icon: Icon, label, value, tone = "default" }: { icon: typeof Users; label: string; value: string; tone?: "default" | "primary" | "warn" | "muted" }) {
  const toneCls = {
    default: "bg-secondary text-secondary-foreground",
    primary: "bg-primary/10 text-primary",
    warn: "bg-destructive/10 text-destructive",
    muted: "bg-muted text-muted-foreground",
  }[tone];
  return (
    <div className="rounded-2xl border border-border bg-card p-4 fun-shadow-sm">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneCls}`}><Icon className="h-4 w-4" /></span>
      <p className="mt-3 font-display text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

// ---------------- Map tab ----------------
function MapTab({
  communityId,
  community,
  parcels,
  segments,
  events,
}: {
  communityId: string;
  community: Community | null;
  parcels: Parcel[];
  segments: RoadSegment[];
  events: RecordEvent[];
}) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["segments", communityId] });
    qc.invalidateQueries({ queryKey: ["events", communityId] });
  };
  const invalidateParcels = () => qc.invalidateQueries({ queryKey: ["parcels", communityId] });

  const create = useMutation({
    mutationFn: (geometry: GeoJSONLineString) =>
      createSegment(communityId, { geometry, name: `Segment ${segments.length + 1}` }),
    onSuccess: (seg) => {
      invalidate();
      setSelectedId(seg.id);
      toast.success("Road segment added — edit its details on the right");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (seg: RoadSegment) => deleteSegment(seg.id, communityId, seg.name),
    onSuccess: () => {
      invalidate();
      setSelectedId(null);
      toast.success("Segment deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selected = segments.find((s) => s.id === selectedId) ?? null;

  const hasNoData = parcels.length === 0 && segments.length === 0;

  return (
    <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_340px]">
      <div className="min-h-0 flex-1">
        {hasNoData ? (
          <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-border bg-card p-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-fun-1/20 text-fun-1-foreground">
              <MapIcon className="h-8 w-8" />
            </span>
            <h3 className="mt-4 font-display text-lg font-semibold">Nothing on the map yet</h3>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Add properties on the Properties tab, or draw a road directly on the map.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" onClick={() => navigate({ to: "/community/$id", params: { id: communityId }, search: { tab: "properties" } })}>
                Add properties
              </Button>
            </div>
          </div>
        ) : (
          <CommunityMapEditor
            parcels={parcels}
            segments={segments}
            selectedSegmentId={selectedId}
            onSelectSegment={setSelectedId}
            onCreateSegment={(g) => create.mutate(g)}
          />
        )}
      </div>
      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
        <div className="rounded-2xl border border-border bg-card p-4 fun-shadow-sm">
          <h3 className="font-display text-base font-semibold">Recent activity</h3>
          <ActivityList events={events.slice(0, 6)} />
        </div>
        {selected ? (
          <SegmentPanel key={selected.id} communityId={communityId} segment={selected} onSaved={invalidate} onDelete={() => del.mutate(selected)} />
        ) : (
          <div className="rounded-2xl border border-border bg-card p-4 fun-shadow-sm">
            <h3 className="font-display text-base font-semibold">Roads</h3>
            <p className="mt-1 text-sm text-muted-foreground">Click a road on the map to edit, or draw a new one.</p>
            <ul className="mt-3 space-y-2">
              {segments.map((seg) => (
                <li key={seg.id}>
                  <button
                    onClick={() => setSelectedId(seg.id)}
                    className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-2 text-left text-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
                  >
                    <span className="font-medium">{seg.name}</span>
                    <span className="text-xs text-muted-foreground">{pathLengthFt(seg.geometry)} ft</span>
                  </button>
                </li>
              ))}
              {segments.length === 0 && <li className="text-sm text-muted-foreground">No roads yet.</li>}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityList({ events }: { events: RecordEvent[] }) {
  if (events.length === 0) return <p className="mt-3 text-sm text-muted-foreground">No activity yet.</p>;
  return (
    <ol className="mt-3 space-y-3">
      {events.map((e) => (
        <li key={e.id} className="relative pl-4">
          <span className="absolute left-0 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
          <p className="text-xs">
            <span className="font-semibold capitalize">{e.entity_type}</span>{" "}
            {e.entity_label && <span className="text-muted-foreground">“{e.entity_label}”</span>}{" "}
            <span className="font-medium text-primary">{e.action}</span>
          </p>
          {e.note && <p className="text-[11px] text-muted-foreground">{e.note}</p>}
          <p className="text-[11px] text-muted-foreground">{new Date(e.created_at).toLocaleString()}</p>
        </li>
      ))}
    </ol>
  );
}

// ---------------- Properties ----------------
function PropertiesTab({ communityId, parcels, loading }: { communityId: string; parcels: Parcel[]; loading: boolean }) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["parcels", communityId] });
    qc.invalidateQueries({ queryKey: ["events", communityId] });
  };
  const del = useMutation({
    mutationFn: (p: Parcel) => deleteParcel(p.id, communityId, p.label),
    onSuccess: () => { invalidate(); toast.success("Parcel removed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{parcels.length} parcels tracked</p>
        <ParcelDialog communityId={communityId} onSaved={invalidate} />
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card fun-shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Lot</th>
              <th className="px-4 py-3 font-semibold">Owner</th>
              <th className="px-4 py-3 font-semibold">Area / frontage</th>
              <th className="px-4 py-3 font-semibold">Source</th>
              <th className="px-4 py-3 font-semibold">Data quality</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : parcels.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No parcels yet — add one to begin.</td></tr>
            ) : parcels.map((p) => (
              <tr key={p.id} className="border-b border-border/60 last:border-0 hover:bg-accent/30">
                <td className="px-4 py-3 font-semibold">{p.label}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{p.owner_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{p.address ?? ""}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {p.area_sqft ? `${Number(p.area_sqft).toLocaleString()} ft²` : "—"}
                  {p.frontage_ft ? ` · ${p.frontage_ft} ft front` : ""}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{p.source ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <VerificationBadge value={p.verification} />
                    <ConfidenceBadge value={p.confidence} />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <ParcelDialog communityId={communityId} parcel={p} onSaved={invalidate} />
                    <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => del.mutate(p)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ParcelDialog({ communityId, parcel, onSaved }: { communityId: string; parcel?: Parcel; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ParcelInput>({});

  function openDialog() {
    setForm(
      parcel
        ? {
            label: parcel.label, owner_name: parcel.owner_name ?? "", address: parcel.address ?? "",
            area_sqft: parcel.area_sqft, frontage_ft: parcel.frontage_ft, source: parcel.source ?? "",
            confidence: parcel.confidence, verification: parcel.verification, effective_date: parcel.effective_date,
          }
        : { confidence: "medium", verification: "unverified" },
    );
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload: ParcelInput = {
        ...form,
        area_sqft: form.area_sqft ? Number(form.area_sqft) : null,
        frontage_ft: form.frontage_ft ? Number(form.frontage_ft) : null,
      };
      if (parcel) await updateParcel(parcel.id, communityId, payload);
      else await createParcel(communityId, payload);
    },
    onSuccess: () => { onSaved(); toast.success(parcel ? "Parcel updated" : "Parcel added"); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (patch: ParcelInput) => setForm((f) => ({ ...f, ...patch }));

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? openDialog() : setOpen(false))}>
      <DialogTrigger asChild>
        {parcel ? (
          <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-foreground">
            <ClipboardList className="h-4 w-4" />
          </Button>
        ) : (
          <Button><Plus className="h-4 w-4" /> Add parcel</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{parcel ? `Edit parcel ${parcel.label}` : "Add parcel"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <Field label="Lot / label"><Input value={form.label ?? ""} onChange={(e) => set({ label: e.target.value })} /></Field>
          <Field label="Owner name"><Input value={form.owner_name ?? ""} onChange={(e) => set({ owner_name: e.target.value })} /></Field>
          <Field label="Address" full><Input value={form.address ?? ""} onChange={(e) => set({ address: e.target.value })} /></Field>
          <Field label="Area (ft²)"><Input type="number" value={form.area_sqft ?? ""} onChange={(e) => set({ area_sqft: e.target.value ? Number(e.target.value) : null })} /></Field>
          <Field label="Frontage (ft)"><Input type="number" value={form.frontage_ft ?? ""} onChange={(e) => set({ frontage_ft: e.target.value ? Number(e.target.value) : null })} /></Field>
          <Field label="Source" full><Input value={form.source ?? ""} onChange={(e) => set({ source: e.target.value })} placeholder="County parcel viewer, deed, owner statement…" /></Field>
          <Field label="Confidence">
            <Select value={form.confidence} onValueChange={(v) => set({ confidence: v as Confidence })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Verification">
            <Select value={form.verification} onValueChange={(v) => set({ verification: v as Verification })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="unverified">Unverified</SelectItem>
                <SelectItem value="disputed">Disputed</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Effective date"><Input type="date" value={form.effective_date ?? ""} onChange={(e) => set({ effective_date: e.target.value || null })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!form.label?.trim() || save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

// ---------------- Segment details ----------------
function SegmentPanel({
  communityId,
  segment,
  onSaved,
  onDelete,
}: {
  communityId: string;
  segment: RoadSegment;
  onSaved: () => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(segment.name);
  const [surface, setSurface] = useState(segment.surface ?? "");
  const [responsibility, setResponsibility] = useState(segment.responsibility);
  const [source, setSource] = useState(segment.source ?? "");
  const [confidence, setConfidence] = useState<Confidence>(segment.confidence);
  const [verification, setVerification] = useState<Verification>(segment.verification);

  const save = useMutation({
    mutationFn: () => updateSegment(segment.id, communityId, { name, surface, responsibility, source, confidence, verification }),
    onSuccess: () => { onSaved(); toast.success("Segment updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-4 fun-shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-semibold">Road details</h3>
        <span className="text-xs text-muted-foreground">{pathLengthFt(segment.geometry)} ft</span>
      </div>
      <div className="mt-4 space-y-4">
        <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Surface</Label><Input value={surface} onChange={(e) => setSurface(e.target.value)} placeholder="Gravel, chip seal, 2&quot; asphalt…" /></div>
        <div className="space-y-1.5">
          <Label>Maintenance responsibility</Label>
          <Select value={responsibility} onValueChange={setResponsibility}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="shared">Shared</SelectItem>
              <SelectItem value="private">Private</SelectItem>
              <SelectItem value="public">Public</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Source</Label><Input value={source} onChange={(e) => setSource(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Confidence</Label>
            <Select value={confidence} onValueChange={(v) => setConfidence(v as Confidence)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Verification</Label>
            <Select value={verification} onValueChange={(v) => setVerification(v as Verification)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="unverified">Unverified</SelectItem>
                <SelectItem value="disputed">Disputed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save segment"}
          </Button>
          <Button variant="destructive" size="icon" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Provenance popover ----------------
function ProvenancePopover({ events, loading }: { events: RecordEvent[]; loading: boolean }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Clock className="mr-1.5 h-4 w-4" /> History
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 max-h-[60vh] overflow-y-auto" align="end">
        <div className="space-y-1">
          <h3 className="font-display text-sm font-semibold">Change history</h3>
          <p className="text-xs text-muted-foreground">Every addition and edit is logged.</p>
        </div>
        {loading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading…</p>
        ) : events.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No history yet.</p>
        ) : (
          <ol className="mt-4 space-y-4 border-l border-border pl-4">
            {events.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary" />
                <p className="text-sm">
                  <span className="font-semibold capitalize">{e.entity_type}</span>{" "}
                  {e.entity_label && <span className="text-muted-foreground">“{e.entity_label}”</span>}{" "}
                  <span className="font-medium text-primary">{e.action}</span>
                </p>
                {e.note && <p className="text-xs text-muted-foreground">{e.note}</p>}
                <p className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</p>
              </li>
            ))}
          </ol>
        )}
      </PopoverContent>
    </Popover>
  );
}
