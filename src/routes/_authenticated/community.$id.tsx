import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  History,
  LayoutGrid,
  Map as MapIcon,
  PartyPopper,
  Plus,
  Pencil,
  Route as RouteIcon,
  Ruler,
  Sparkles,
  Trash2,
  TriangleAlert,
  Users,
  Home as HomeIcon,
} from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { MyRoadTab } from "@/components/community/MyRoadTab";
import { Confetti } from "@/components/onboarding/Confetti";
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

const TABS = ["roads", "homes"] as const;
type Tab = (typeof TABS)[number];

// Backward compatibility for older links / bookmarks.
function normalizeTab(v: unknown): Tab {
  if (v === "map") return "roads";
  if (v === "properties") return "homes";
  if (v === "projects" || v === "home") return "roads";
  if (typeof v === "string" && (TABS as readonly string[]).includes(v)) return v as Tab;
  return "roads";
}

export const Route = createFileRoute("/_authenticated/community/$id")({
  head: () => ({ meta: [{ title: "Community Record — RoadShare" }, { name: "robots", content: "noindex" }] }),
  validateSearch: (s: Record<string, unknown>): { tab: Tab; justCreated?: string } => ({
    tab: normalizeTab(s.tab),
    justCreated: s.justCreated === "1" ? "1" : undefined,
  }),
  component: CommunityDetail,
});

function CommunityDetail() {
  const { id } = Route.useParams();
  const { tab, justCreated } = Route.useSearch();
  const navigate = Route.useNavigate();

  const [celebrate, setCelebrate] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  useEffect(() => {
    if (justCreated === "1") {
      setCelebrate(true);
      setShowWelcome(true);
      // Strip the flag from the URL so it doesn't re-fire on refresh.
      void navigate({ search: { tab }, replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justCreated]);

  const community = useQuery({ queryKey: ["community", id], queryFn: () => getCommunity(id) });
  const parcels = useQuery({ queryKey: ["parcels", id], queryFn: () => listParcels(id) });
  const segments = useQuery({ queryKey: ["segments", id], queryFn: () => listSegments(id) });
  const events = useQuery({ queryKey: ["events", id], queryFn: () => listEvents(id) });

  const p = parcels.data ?? [];
  const s = segments.data ?? [];

  return (
    <AppShell>
      <div className="relative mx-auto flex h-[calc(100vh-4rem)] max-w-7xl flex-col space-y-4 px-4 py-4">
        <Confetti show={celebrate} />
        {showWelcome && (
          <WelcomeBanner
            communityName={community.data?.name ?? "your community"}
            parcelCount={p.length}
            roadCount={s.length}
            onDismiss={() => setShowWelcome(false)}
          />
        )}
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

        <div className="flex min-h-0 flex-1 flex-col space-y-8">
          <MyRoadTab parcels={p} segments={s} />
          <div className="border-t border-border pt-6">
            <h2 className="mb-3 font-display text-lg font-bold tracking-tight">Manage homes</h2>
            <PropertiesTab communityId={id} parcels={p} loading={parcels.isLoading} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function WelcomeBanner({
  communityName,
  parcelCount,
  roadCount,
  onDismiss,
}: {
  communityName: string;
  parcelCount: number;
  roadCount: number;
  onDismiss: () => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-fun-2/10 to-fun-3/15 px-4 py-3 fun-shadow-sm">
      <div className="pointer-events-none absolute -right-4 -top-4 opacity-30">
        <Sparkles className="h-16 w-16 text-primary" />
      </div>
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md">
            <PartyPopper className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-base font-bold leading-tight">
              {communityName} is ready to go
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              We added <strong>{parcelCount}</strong> {parcelCount === 1 ? "home" : "homes"}
              {roadCount > 0 ? ` and ${roadCount} ${roadCount === 1 ? "road" : "roads"}` : ""}. Head
              back to Home to see the next steps.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button size="sm" onClick={onDismiss}>Got it</Button>
        </div>
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
    onSuccess: () => { invalidate(); toast.success("Home removed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {parcels.length} {parcels.length === 1 ? "home" : "homes"} tracked
        </p>
        <ParcelDialog communityId={communityId} onSaved={invalidate} />
      </div>
      {!loading && parcels.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-primary/30 bg-gradient-to-br from-fun-1/10 via-card to-fun-3/10 px-6 py-14 text-center fun-shadow-sm">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-fun-2 text-primary-foreground shadow-md">
            <Users className="h-7 w-7" />
          </span>
          <h2 className="mt-5 font-display text-xl font-bold">No homes here yet</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Add the homes that share your road. You can pull them from the map or add one at a time.
          </p>
          <div className="mt-6"><ParcelDialog communityId={communityId} onSaved={invalidate} /></div>
        </div>
      ) : (
      <div className="overflow-x-auto rounded-2xl border border-border bg-card fun-shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Lot</th>
              <th className="px-4 py-3 font-semibold">Owner</th>
              <th className="px-4 py-3 font-semibold">Road frontage</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
            ) : parcels.map((p) => (
              <tr key={p.id} className="border-b border-border/60 last:border-0 hover:bg-accent/30">
                <td className="px-4 py-3 font-semibold">{p.label}</td>
                <td className="px-4 py-3">
                  <div className="font-medium">{p.owner_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{p.address ?? ""}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {p.frontage_ft ? `${Number(p.frontage_ft).toLocaleString()} ft` : "—"}
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
      )}
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
            frontage_ft: parcel.frontage_ft,
          }
        : {},
    );
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload: ParcelInput = {
        ...form,
        frontage_ft: form.frontage_ft ? Number(form.frontage_ft) : null,
      };
      if (parcel) await updateParcel(parcel.id, communityId, payload);
      else await createParcel(communityId, payload);
    },
    onSuccess: () => { onSaved(); toast.success(parcel ? "Home updated" : "Home added"); setOpen(false); },
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
          <Button><Plus className="h-4 w-4" /> Add home</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{parcel ? `Edit home ${parcel.label}` : "Add home"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <Field label="Home label"><Input value={form.label ?? ""} onChange={(e) => set({ label: e.target.value })} placeholder="e.g. Home 1 or The Smiths" /></Field>
          <Field label="Owner name"><Input value={form.owner_name ?? ""} onChange={(e) => set({ owner_name: e.target.value })} /></Field>
          <Field label="Address" full><Input value={form.address ?? ""} onChange={(e) => set({ address: e.target.value })} /></Field>
          <Field label="Feet of road touching this home" full>
            <Input type="number" value={form.frontage_ft ?? ""} onChange={(e) => set({ frontage_ft: e.target.value ? Number(e.target.value) : null })} placeholder="Optional — used to split cost by frontage" />
          </Field>
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
  const [notes, setNotes] = useState(segment.source ?? "");

  const save = useMutation({
    mutationFn: () => updateSegment(segment.id, communityId, { name, source: notes }),
    onSuccess: () => { onSaved(); toast.success("Road updated"); },
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
        <div className="space-y-1.5"><Label>Notes (optional)</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth remembering about this road" /></div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save road"}
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
