import React, { Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";

import type { CommunityMapEditorProps } from "./CommunityMapEditorImpl";

const LazyCommunityMapEditor = React.lazy(() => import("./CommunityMapEditorImpl"));

export function CommunityMapEditor(props: CommunityMapEditorProps) {
  return (
    <ClientOnly fallback={<MapSkeleton />}>
      <Suspense fallback={<MapSkeleton />}>
        <LazyCommunityMapEditor {...props} />
      </Suspense>
    </ClientOnly>
  );
}

function MapSkeleton() {
  return (
    <div className="relative h-full min-h-0 flex-1 overflow-hidden rounded-3xl border border-border bg-muted">
      <div className="absolute inset-0 animate-pulse bg-muted" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="rounded-full bg-card px-4 py-2 fun-shadow-sm">
          <span className="text-sm font-medium">Loading map…</span>
        </div>
      </div>
    </div>
  );
}
