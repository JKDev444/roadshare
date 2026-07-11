import { createFileRoute } from "@tanstack/react-router";
import { Map as MapIcon } from "lucide-react";

import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/_authenticated/map")({
  head: () => ({ meta: [{ title: "GIS & Roads — RoadShare" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <ComingSoon
      icon={MapIcon}
      phase="Phase 4"
      title="GIS & Road Geometry"
      description="Edit road segments, assign maintenance responsibility, and connect geometry to the community record. Coming soon."
    />
  ),
});