
-- Update RLS policies to allow vendors to view open RFQs
-- First, drop the existing SELECT policy for RFQs
DROP POLICY IF EXISTS "RFQs are viewable by owner or participants" ON public.rfqs;

-- Create new SELECT policy that allows:
-- 1. Owners (clients) to see their own RFQs
-- 2. Vendors to see open RFQs (status = 'open')
-- 3. Participants to see RFQs they're invited to
CREATE POLICY "RFQs visibility policy" 
ON public.rfqs 
FOR SELECT 
TO authenticated
USING (
  created_by = auth.uid() OR  -- Owners can see their RFQs
  (status = 'open' AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'vendor')) OR  -- Vendors can see open RFQs
  id IN (SELECT rfq_id FROM public.rfq_participants WHERE vendor_id = auth.uid())  -- Participants can see invited RFQs
);

-- Update INSERT policy to only allow clients to create RFQs
DROP POLICY IF EXISTS "Users can create their own RFQs" ON public.rfqs;

CREATE POLICY "Only clients can create RFQs" 
ON public.rfqs 
FOR INSERT 
TO authenticated
WITH CHECK (
  auth.uid() = created_by AND 
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'client')
);

-- Update quotes INSERT policy to only allow vendors
DROP POLICY IF EXISTS "Vendors can create their own quotes" ON public.quotes;

CREATE POLICY "Only vendors can create quotes" 
ON public.quotes 
FOR INSERT 
TO authenticated
WITH CHECK (
  vendor_id = auth.uid() AND 
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'vendor')
);
