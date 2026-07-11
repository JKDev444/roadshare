CREATE TYPE public.confidence_level AS ENUM ('high','medium','low');
CREATE TYPE public.verification_status AS ENUM ('verified','unverified','disputed');

-- Communities
CREATE TABLE public.communities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  region text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communities TO authenticated;
GRANT ALL ON public.communities TO service_role;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their communities" ON public.communities
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

-- Parcels
CREATE TABLE public.parcels (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  label text NOT NULL,
  owner_name text,
  address text,
  area_sqft numeric,
  frontage_ft numeric,
  pos_x numeric NOT NULL DEFAULT 50,
  pos_y numeric NOT NULL DEFAULT 50,
  source text,
  confidence public.confidence_level NOT NULL DEFAULT 'medium',
  verification public.verification_status NOT NULL DEFAULT 'unverified',
  effective_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parcels TO authenticated;
GRANT ALL ON public.parcels TO service_role;
ALTER TABLE public.parcels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their parcels" ON public.parcels
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX parcels_community_idx ON public.parcels(community_id);

-- Road segments
CREATE TABLE public.road_segments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  geometry jsonb NOT NULL DEFAULT '[]'::jsonb,
  length_ft numeric,
  surface text,
  responsibility text NOT NULL DEFAULT 'shared',
  source text,
  confidence public.confidence_level NOT NULL DEFAULT 'medium',
  verification public.verification_status NOT NULL DEFAULT 'unverified',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.road_segments TO authenticated;
GRANT ALL ON public.road_segments TO service_role;
ALTER TABLE public.road_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their road segments" ON public.road_segments
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX road_segments_community_idx ON public.road_segments(community_id);

-- Provenance / change history
CREATE TABLE public.record_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  entity_type text NOT NULL,
  entity_label text,
  action text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.record_events TO authenticated;
GRANT ALL ON public.record_events TO service_role;
ALTER TABLE public.record_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners view their record events" ON public.record_events
  FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Owners insert their record events" ON public.record_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE INDEX record_events_community_idx ON public.record_events(community_id);

-- updated_at triggers (reuse existing function)
CREATE TRIGGER update_communities_updated_at BEFORE UPDATE ON public.communities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_parcels_updated_at BEFORE UPDATE ON public.parcels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_road_segments_updated_at BEFORE UPDATE ON public.road_segments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();