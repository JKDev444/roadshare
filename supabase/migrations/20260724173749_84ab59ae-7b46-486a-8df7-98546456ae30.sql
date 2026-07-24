CREATE TABLE public.road_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  road_id UUID NOT NULL REFERENCES public.roads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.road_shares TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.road_shares TO authenticated;
GRANT ALL ON public.road_shares TO service_role;

ALTER TABLE public.road_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view shared roads by slug"
ON public.road_shares FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Owners can manage their shares"
ON public.road_shares FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_road_shares_updated_at
BEFORE UPDATE ON public.road_shares
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX road_shares_road_id_idx ON public.road_shares(road_id);
CREATE INDEX road_shares_user_id_idx ON public.road_shares(user_id);