export function getMapboxToken(): string {
  const token = import.meta.env.VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN;
  if (!token) {
    throw new Error(
      "Mapbox public token is not configured. Connect the Mapbox connector in your workspace settings.",
    );
  }
  return token;
}

/**
 * Map style used inside the app for the community/road workspace. A calm,
 * minimal grey basemap that lets our home dots and road line stand out.
 * The onboarding lasso keeps a richer style so users can recognize their
 * own neighborhood.
 */
export const MAP_STYLE = "mapbox://styles/mapbox/light-v11";
