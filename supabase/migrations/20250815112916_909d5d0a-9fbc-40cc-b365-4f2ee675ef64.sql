-- Create helper functions to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.get_user_rfqs(_user_id uuid)
RETURNS TABLE(rfq_id uuid)
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT id as rfq_id FROM public.rfqs WHERE created_by = _user_id
  UNION
  SELECT rfq_id FROM public.rfq_participants WHERE vendor_id = _user_id;
$$;

-- Drop and recreate all problematic policies
DROP POLICY IF EXISTS "RFQs are viewable by owner or participants" ON public.rfqs;
DROP POLICY IF EXISTS "Participants viewable by RFQ owner or vendor" ON public.rfq_participants;
DROP POLICY IF EXISTS "Quotes are viewable by RFQ owner or vendor" ON public.quotes;
DROP POLICY IF EXISTS "Vendor or RFQ owner can update quotes" ON public.quotes;
DROP POLICY IF EXISTS "Vendor or RFQ owner can delete quotes" ON public.quotes;
DROP POLICY IF EXISTS "Only RFQ owner can add participants" ON public.rfq_participants;
DROP POLICY IF EXISTS "Only RFQ owner can remove participants" ON public.rfq_participants;
DROP POLICY IF EXISTS "Vendor or owner can update participant status" ON public.rfq_participants;

-- Create new policies using the helper function
CREATE POLICY "RFQs are viewable by owner or participants" 
ON public.rfqs 
FOR SELECT 
USING (id IN (SELECT rfq_id FROM public.get_user_rfqs(auth.uid())));

CREATE POLICY "Participants are viewable by involved users" 
ON public.rfq_participants 
FOR SELECT 
USING (rfq_id IN (SELECT rfq_id FROM public.get_user_rfqs(auth.uid())));

CREATE POLICY "Quotes are viewable by involved users" 
ON public.quotes 
FOR SELECT 
USING (rfq_id IN (SELECT rfq_id FROM public.get_user_rfqs(auth.uid())));

-- Participant management policies
CREATE POLICY "Only RFQ owner can add participants" 
ON public.rfq_participants 
FOR INSERT 
WITH CHECK (
  EXISTS (SELECT 1 FROM public.rfqs WHERE id = rfq_id AND created_by = auth.uid())
);

CREATE POLICY "Only RFQ owner can remove participants" 
ON public.rfq_participants 
FOR DELETE 
USING (
  EXISTS (SELECT 1 FROM public.rfqs WHERE id = rfq_id AND created_by = auth.uid())
);

CREATE POLICY "Participants can update their own status" 
ON public.rfq_participants 
FOR UPDATE 
USING (
  vendor_id = auth.uid() 
  OR EXISTS (SELECT 1 FROM public.rfqs WHERE id = rfq_id AND created_by = auth.uid())
);

-- Quote management policies  
CREATE POLICY "Vendors and owners can update quotes" 
ON public.quotes 
FOR UPDATE 
USING (
  vendor_id = auth.uid() 
  OR EXISTS (SELECT 1 FROM public.rfqs WHERE id = rfq_id AND created_by = auth.uid())
);

CREATE POLICY "Vendors and owners can delete quotes" 
ON public.quotes 
FOR DELETE 
USING (
  vendor_id = auth.uid() 
  OR EXISTS (SELECT 1 FROM public.rfqs WHERE id = rfq_id AND created_by = auth.uid())
);