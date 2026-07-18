ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS lat numeric;
ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS lng numeric;
ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS geojson jsonb;

-- lightweight index for map bounding-box queries
CREATE INDEX IF NOT EXISTS parcels_geojson_community_idx ON public.parcels(community_id) INCLUDE (lat, lng);
