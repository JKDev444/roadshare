import { createFileRoute, redirect } from "@tanstack/react-router";

import { getMyRoad } from "@/lib/roadshare/road.functions";

export const Route = createFileRoute("/_authenticated/")({
  ssr: false,
  beforeLoad: async () => {
    const road = await getMyRoad();
    throw redirect({ to: road ? "/my-road" : "/welcome" });
  },
  component: () => null,
});