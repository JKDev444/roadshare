import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type BasicInfo = {
  communityName: string;
  city: string;
  state: string;
  startingAddress: string;
};

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

/** Step 1. Basic community information. Plain language, minimal fields. */
export function BasicInfoStep({
  initial,
  onContinue,
  onNoAddress,
  onBack,
}: {
  initial?: Partial<BasicInfo>;
  onContinue: (info: BasicInfo) => void;
  onNoAddress: (info: Omit<BasicInfo, "startingAddress"> & { startingAddress: "" }) => void;
  onBack: () => void;
}) {
  const [communityName, setCommunityName] = useState(initial?.communityName ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [state, setState] = useState(initial?.state ?? "");
  const [startingAddress, setStartingAddress] = useState(initial?.startingAddress ?? "");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold">Tell us about your road group</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Just the basics. You can change any of this later.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="bi-name" className="text-xs">
            Community or road name <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="bi-name"
            value={communityName}
            onChange={(e) => setCommunityName(e.target.value)}
            placeholder="e.g. Cedar Hollow Road Group"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="bi-city" className="text-xs">City</Label>
            <Input
              id="bi-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Fort Collins"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bi-state" className="text-xs">State</Label>
            <select
              id="bi-state"
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            >
              <option value="">—</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bi-addr" className="text-xs">One starting property address</Label>
          <Input
            id="bi-addr"
            value={startingAddress}
            onChange={(e) => setStartingAddress(e.target.value)}
            placeholder="e.g. 101 Cedar Hollow Lane"
          />
          <p className="text-[11px] text-muted-foreground">
            Any address on your road. We'll build outward from there.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onNoAddress({ communityName, city, state, startingAddress: "" })
            }
          >
            I Don't Know the Address Yet
          </Button>
          <Button
            size="sm"
            onClick={() => onContinue({ communityName, city, state, startingAddress })}
            disabled={!startingAddress.trim() && !city.trim() && !communityName.trim()}
          >
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}