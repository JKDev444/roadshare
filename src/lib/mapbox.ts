export function getMapboxToken(): string {
  const token = import.meta.env.VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN;
  if (!token) {
    throw new Error(
      "Mapbox public token is not configured. Connect the Mapbox connector in your workspace settings.",
    );
  }
  return token;
}
