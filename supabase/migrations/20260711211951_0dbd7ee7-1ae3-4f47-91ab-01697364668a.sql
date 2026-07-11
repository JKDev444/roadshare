CREATE TYPE public.project_status AS ENUM ('planning','bidding','funded','complete');
CREATE TYPE public.allocation_method AS ENUM ('equal','frontage','area','segment_benefit','base_plus_use','custom');

-- Projects
CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  description text,
  status public.project_status NOT NULL DEFAULT 'planning',
  total_cost numeric NOT NULL DEFAULT 0,
  contingency_pct numeric NOT NULL DEFAULT 0,
  reserve_target numeric NOT NULL DEFAULT 0,
  base_amount numeric NOT NULL DEFAULT 0,
  allocation_method public.allocation_method NOT NULL DEFAULT 'equal',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their projects" ON public.projects
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX projects_community_idx ON public.projects(community_id);

-- Project line items (cost breakdown / bids)
CREATE TABLE public.project_line_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  label text NOT NULL,
  category text,
  amount numeric NOT NULL DEFAULT 0,
  is_bid boolean NOT NULL DEFAULT false,
  contractor text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_line_items TO authenticated;
GRANT ALL ON public.project_line_items TO service_role;
ALTER TABLE public.project_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their project line items" ON public.project_line_items
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX project_line_items_project_idx ON public.project_line_items(project_id);

-- Per-parcel allocation settings
CREATE TABLE public.project_allocations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parcel_id uuid NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  weight numeric NOT NULL DEFAULT 1,
  override_amount numeric,
  benefits boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, parcel_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_allocations TO authenticated;
GRANT ALL ON public.project_allocations TO service_role;
ALTER TABLE public.project_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage their project allocations" ON public.project_allocations
  FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE INDEX project_allocations_project_idx ON public.project_allocations(project_id);

-- updated_at triggers
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_project_line_items_updated_at BEFORE UPDATE ON public.project_line_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_project_allocations_updated_at BEFORE UPDATE ON public.project_allocations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();