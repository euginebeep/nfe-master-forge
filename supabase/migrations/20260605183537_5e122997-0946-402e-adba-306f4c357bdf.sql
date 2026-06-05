CREATE TABLE IF NOT EXISTS public.demo_leads (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Grant access to authenticated and anon (since it's a lead form on login page)
GRANT INSERT ON public.demo_leads TO anon, authenticated;
GRANT ALL ON public.demo_leads TO service_role;

-- Enable RLS
ALTER TABLE public.demo_leads ENABLE ROW LEVEL SECURITY;

-- Policy to allow anyone to insert leads
CREATE POLICY "Anyone can insert demo leads" ON public.demo_leads FOR INSERT WITH CHECK (true);
-- Only service role/admins can read (manually managed via dashboard later if needed)
CREATE POLICY "Admins can view leads" ON public.demo_leads FOR SELECT USING (true);
GRANT SELECT ON public.demo_leads TO service_role;
