import { createFileRoute } from "@tanstack/react-router";
import { Users } from "lucide-react";

import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/_authenticated/community")({
  head: () => ({ meta: [{ title: "Community Record — RoadShare" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <ComingSoon
      icon={Users}
      phase="Phase 4"
      title="Community Record & GIS Editor"
      description="A shared ledger of parcels, owners, and road geometry with source citations and confidence scoring. Coming in the next build phase."
    />
  ),
});