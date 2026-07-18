import React, { Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";

import type { MapPickStepProps } from "./MapPickStepImpl";

const LazyMapPickStep = React.lazy(async () => {
  const { MapPickStep } = await import("./MapPickStepImpl");
  return { default: MapPickStep };
});

export type { MapPickResult } from "./MapPickStepImpl";

export function MapPickStep(props: MapPickStepProps) {
  return (
    <ClientOnly fallback={<MapSkeleton />}>
      <Suspense fallback={<MapSkeleton />}>
        <LazyMapPickStep {...props} />
      </Suspense>
    </ClientOnly>
  );
}

function MapSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-muted">
      <div className="h-[440px] w-full animate-pulse bg-muted" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5 fun-shadow-sm">
          <span className="text-xs font-medium">Loading map…</span>
        </div>
      </div>
    </div>
  );
}
