import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Download,
  History,
  LayoutGrid,
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
import { ConfidenceBadge, VerificationBadge } from "@/components/community/badges";
import { GisEditor } from "@/components/community/GisEditor";
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
  type Parcel,
  type ParcelInput,
  type Point,
  type RoadSegment,
  type Verification,
} from "@/lib/community/api";

const TABS = ["overview", "properties", "roads", "provenance"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/_authenticated/community/$id")({
  head: () => ({ meta: [{ title: "Community Record — RoadShare" }, { name: "robots", content: "noindex" }] }),
  validateSearch: (s: Record<string, unknown>): { tab: Tab } => ({
    tab: TABS.includes(s.tab as Tab) ? (s.tab as Tab) : "overview",
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
  const totalRoad = s.reduce((sum, seg) => sum + pathLengthFt(toPoints(seg.geometry)), 0);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link to="/community" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> All communities
          </Link>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h1 className="truncate font-display text-2xl font-bold tracking-tight sm:text-3xl">
                {community.data?.name ?? "Loading…"}
              </h1>
              {community.data?.region && (
                <p className="text-sm font-medium text-muted-foreground">{community.data.region}</p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat icon={Users} label="Parcels" value={String(p.length)} />
          <Stat icon={CheckCircle2} label="Verified" value={`${verified}/${p.length || 0}`} tone="primary" />
          <Stat icon={Ruler} label="Road mapped" value={`${totalRoad.toLocaleString()} ft`} />
          <Stat icon={TriangleAlert} label="Disputed" value={String(disputed)} tone={disputed ? "warn" : "muted"} />
        </div>

        <Tabs value={tab} onValueChange={(v) => navigate({ search: { tab: v as Tab } })}>
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview"><LayoutGrid className="mr-1.5 h-4 w-4" /> Overview</TabsTrigger>
            <TabsTrigger value="properties"><Users className="mr-1.5 h-4 w-4" /> Property layer</TabsTrigger>
            <TabsTrigger value="roads"><RouteIcon className="mr-1.5 h-4 w-4" /> Road geometry</TabsTrigger>
            <TabsTrigger value="provenance"><History className="mr-1.5 h-4 w-4" /> Provenance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <OverviewTab community={community.data?.description} parcels={p} segments={s} events={events.data ?? []} />
          </TabsContent>
          <TabsContent value="properties" className="mt-6">
            <PropertiesTab communityId={id} parcels={p} loading={parcels.isLoading} />
          </TabsContent>
          <TabsContent value="roads" className="mt-6">
            <RoadsTab communityId={id} community={community.data ?? null} parcels={p} segments={s} />
          </TabsContent>
          <TabsContent value="provenance" className="mt-6">
            <ProvenanceTab events={events.data ?? []} loading={events.isLoading} />
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
    <div className="rounded-2xl border border-border bg-card p-4">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${toneCls}`}><Icon className="h-4 w-4" /></span>
      <p className="mt-3 font-display text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

// ---------------- Overview ----------------
type EventRow = { id: string; action: string; entity_type: string; entity_label: string | null; note: string | null; created_at: string };

function OverviewTab({ community, parcels, segments, events }: { community?: string | null; parcels: Parcel[]; segments: RoadSegment[]; events: EventRow[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        {community && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-sm leading-relaxed text-muted-foreground">{community}</p>
          </div>
        )}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="font-display text-base font-semibold">Plat overview</h3>
          <PlatPreview parcels={parcels} segments={segments} />
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5">
        <h3 className="font-display text-base font-semibold">Recent activity</h3>
        <ActivityList events={events.slice(0, 8)} />
      </div>
    </div>
  );
}

function PlatPreview({ parcels, segments }: { parcels: Parcel[]; segments: RoadSegment[] }) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-border bg-background">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-64 w-full">
        <defs>
          <pattern id="ov-dots" width="4" height="4" patternUnits="userSpaceOnUse">
            <circle cx="0.5" cy="0.5" r="0.35" fill="var(--color-foreground)" opacity="0.1" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#ov-dots)" />
        {segments.map((seg) => {
          const pts = toPoints(seg.geometry);
          if (pts.length < 2) return null;
          return (
            <path key={seg.id} d={pts.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x} ${pt.y}`).join(" ")}
              fill="none" stroke="var(--color-primary)" style={{ strokeWidth: 4 }} strokeLinecap="round" opacity={0.85} />
          );
        })}
        {parcels.map((p) => (
          <g key={p.id}>
            <rect x={p.pos_x - 4} y={p.pos_y - 3} width={8} height={6} rx={1.2}
              fill="var(--color-map-parcel)" stroke="var(--color-map-parcel-edge)" strokeWidth={0.3} />
            <text x={p.pos_x} y={p.pos_y + 1} textAnchor="middle" fontSize={2.6} fontWeight={700} fill="var(--color-map-ink)">{p.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function ActivityList({ events }: { events: EventRow[] }) {
  if (events.length === 0) return <p className="mt-4 text-sm text-muted-foreground">No activity yet.</p>;
  return (
    <ol className="mt-4 space-y-4">
      {events.map((e) => (
        <li key={e.id} className="relative pl-5">
          <span className="absolute left-0 top-1.5 h-2 w-2 rounded-full bg-primary" />
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
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
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

// ---------------- Roads ----------------
function RoadsTab({ communityId, community, parcels, segments }: { communityId: string; community: Community | null; parcels: Parcel[]; segments: RoadSegment[] }) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["segments", communityId] });
    qc.invalidateQueries({ queryKey: ["events", communityId] });
  };
  const invalidateParcels = () => qc.invalidateQueries({ queryKey: ["parcels", communityId] });

  const create = useMutation({
    mutationFn: (geometry: Point[]) => createSegment(communityId, { geometry, name: `Segment ${segments.length + 1}` }),
    onSuccess: (seg) => { invalidate(); setSelectedId(seg.id); toast.success("Road segment added"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateGeom = useMutation({
    mutationFn: ({ id, geometry }: { id: string; geometry: Point[] }) => updateSegment(id, communityId, { geometry }, { silent: true }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });
  const moveParcel = useMutation({
    mutationFn: ({ id, pos }: { id: string; pos: Point }) => updateParcel(id, communityId, { pos_x: pos.x, pos_y: pos.y }, { silent: true }),
    onSuccess: () => invalidateParcels(),
  });
  const del = useMutation({
    mutationFn: (seg: RoadSegment) => deleteSegment(seg.id, communityId, seg.name),
    onSuccess: () => { invalidate(); setSelectedId(null); toast.success("Segment deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const selected = segments.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{segments.length} road segment{segments.length === 1 ? "" : "s"} mapped</p>
        <Button
          variant="outline"
          disabled={segments.length === 0}
          onClick={() => {
            downloadGeoJSON(community, segments);
            toast.success("GeoJSON exported");
          }}
        >
          <Download className="h-4 w-4" /> Export GeoJSON
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <GisEditor
        parcels={parcels}
        segments={segments}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onCreate={(g) => create.mutate(g)}
        onUpdateGeometry={(id, geometry) => updateGeom.mutate({ id, geometry })}
        onDelete={(seg) => del.mutate(seg)}
        onMoveParcel={(id, pos) => moveParcel.mutate({ id, pos })}
      />
      <div className="space-y-4">
        {selected ? (
          <SegmentPanel key={selected.id} communityId={communityId} segment={selected} onSaved={invalidate} />
        ) : (
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="font-display text-base font-semibold">Segments</h3>
            <p className="mt-1 text-sm text-muted-foreground">Select a segment on the map to edit its details, or draw a new road.</p>
            <ul className="mt-4 space-y-2">
              {segments.map((seg) => (
                <li key={seg.id}>
                  <button
                    onClick={() => setSelectedId(seg.id)}
                    className="flex w-full items-center justify-between rounded-xl border border-border px-3 py-2 text-left text-sm transition-colors hover:border-primary/40 hover:bg-accent/40"
                  >
                    <span className="font-medium">{seg.name}</span>
                    <span className="text-xs text-muted-foreground">{pathLengthFt(toPoints(seg.geometry))} ft</span>
                  </button>
                </li>
              ))}
              {segments.length === 0 && <li className="text-sm text-muted-foreground">No segments yet.</li>}
            </ul>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function SegmentPanel({ communityId, segment, onSaved }: { communityId: string; segment: RoadSegment; onSaved: () => void }) {
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
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-base font-semibold">Segment details</h3>
        <span className="text-xs text-muted-foreground">{pathLengthFt(toPoints(segment.geometry))} ft</span>
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
        <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save segment"}
        </Button>
      </div>
    </div>
  );
}

// ---------------- Provenance ----------------
function ProvenanceTab({ events, loading }: { events: EventRow[]; loading: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="font-display text-base font-semibold">Change history</h3>
      <p className="mt-1 text-sm text-muted-foreground">Every addition and edit is logged and never overwritten.</p>
      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">Loading…</p>
      ) : events.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No history yet.</p>
      ) : (
        <ol className="mt-6 space-y-5 border-l border-border pl-6">
          {events.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />
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
    </div>
  );
}