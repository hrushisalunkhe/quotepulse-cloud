-- Fix RLS policies to avoid recursion

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "RFQs are viewable by owner or participants" ON public.rfqs;
DROP POLICY IF EXISTS "Participants viewable by RFQ owner or vendor" ON public.rfq_participants;
DROP POLICY IF EXISTS "Quotes are viewable by RFQ owner or vendor" ON public.quotes;

-- Create improved RLS policies without recursion
CREATE POLICY "RFQs are viewable by owner or participants" 
ON public.rfqs 
FOR SELECT 
USING (
  created_by = auth.uid() 
  OR 
  id IN (
    SELECT rfq_id 
    FROM public.rfq_participants 
    WHERE vendor_id = auth.uid()
  )
);

CREATE POLICY "Participants viewable by RFQ owner or vendor" 
ON public.rfq_participants 
FOR SELECT 
USING (
  vendor_id = auth.uid() 
  OR 
  rfq_id IN (
    SELECT id 
    FROM public.rfqs 
    WHERE created_by = auth.uid()
  )
);

CREATE POLICY "Quotes are viewable by RFQ owner or vendor" 
ON public.quotes 
FOR SELECT 
USING (
  vendor_id = auth.uid() 
  OR 
  rfq_id IN (
    SELECT id 
    FROM public.rfqs 
    WHERE created_by = auth.uid()
  )
);

-- Update other quote policies to avoid recursion
DROP POLICY IF EXISTS "Vendor or RFQ owner can update quotes" ON public.quotes;
DROP POLICY IF EXISTS "Vendor or RFQ owner can delete quotes" ON public.quotes;

CREATE POLICY "Vendor or RFQ owner can update quotes" 
ON public.quotes 
FOR UPDATE 
USING (
  vendor_id = auth.uid() 
  OR 
  rfq_id IN (
    SELECT id 
    FROM public.rfqs 
    WHERE created_by = auth.uid()
  )
);

CREATE POLICY "Vendor or RFQ owner can delete quotes" 
ON public.quotes 
FOR DELETE 
USING (
  vendor_id = auth.uid() 
  OR 
  rfq_id IN (
    SELECT id 
    FROM public.rfqs 
    WHERE created_by = auth.uid()
  )
);

-- Update participant policies to avoid recursion
DROP POLICY IF EXISTS "Only RFQ owner can add participants" ON public.rfq_participants;
DROP POLICY IF EXISTS "Only RFQ owner can remove participants" ON public.rfq_participants;
DROP POLICY IF EXISTS "Vendor or owner can update participant status" ON public.rfq_participants;

CREATE POLICY "Only RFQ owner can add participants" 
ON public.rfq_participants 
FOR INSERT 
WITH CHECK (
  rfq_id IN (
    SELECT id 
    FROM public.rfqs 
    WHERE created_by = auth.uid()
  )
);

CREATE POLICY "Only RFQ owner can remove participants" 
ON public.rfq_participants 
FOR DELETE 
USING (
  rfq_id IN (
    SELECT id 
    FROM public.rfqs 
    WHERE created_by = auth.uid()
  )
);

CREATE POLICY "Vendor or owner can update participant status" 
ON public.rfq_participants 
FOR UPDATE 
USING (
  vendor_id = auth.uid() 
  OR 
  rfq_id IN (
    SELECT id 
    FROM public.rfqs 
    WHERE created_by = auth.uid()
  )
);