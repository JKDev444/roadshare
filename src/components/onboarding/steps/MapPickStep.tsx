import React, { Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";

import type { MapPickStepProps } from "./MapPickStepImpl";
import { Button } from "@/components/ui/button";

const LazyMapPickStep = React.lazy(async () => {
  const { MapPickStep } = await import("./MapPickStepImpl");
  return { default: MapPickStep };
});

export type { MapPickResult } from "./MapPickStepImpl";

export function MapPickStep(props: MapPickStepProps) {
  return (
    <ClientOnly fallback={<MapSkeleton />}>
      <MapErrorBoundary onCancel={props.onCancel}>
        <Suspense fallback={<MapSkeleton />}>
          <LazyMapPickStep {...props} />
        </Suspense>
      </MapErrorBoundary>
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

type BoundaryProps = { onCancel: () => void; children: React.ReactNode };
type BoundaryState = { error: Error | null };

class MapErrorBoundary extends React.Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error("MapPickStep failed:", error); }
  render() {
    if (this.state.error) {
      return (
        <div className="space-y-4 rounded-2xl border border-border bg-card p-6 text-center">
          <h3 className="font-display text-lg font-semibold">The map couldn't load</h3>
          <p className="text-sm text-muted-foreground">
            We hit a snag opening the neighborhood map. You can go back and try again, or
            skip the map and add your neighbors' addresses by hand.
          </p>
          <Button size="sm" onClick={this.props.onCancel}>Go back</Button>
        </div>
      );
    }
    return this.props.children;
  }
}
