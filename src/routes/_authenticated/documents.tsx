import { createFileRoute } from "@tanstack/react-router";
import { FileText } from "lucide-react";

import { ComingSoon } from "@/components/app/ComingSoon";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({ meta: [{ title: "Documents — RoadShare" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <ComingSoon
      icon={FileText}
      phase="Phase 6"
      title="Document Vault"
      description="Upload deeds, agreements, and amendments with automated classification and human review. Coming in a later build phase."
    />
  ),
});