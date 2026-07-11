import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";

import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/_authenticated/decisions")({
  head: () => ({ meta: [{ title: "Decision Rooms — RoadShare" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <ComingSoon
      icon={MessageSquare}
      phase="Phase 10"
      title="Decision Rooms"
      description="Run evidence-backed decisions with quorum tracking, structured discussion, and a tamper-evident audit trail. Coming in a later build phase."
    />
  ),
});