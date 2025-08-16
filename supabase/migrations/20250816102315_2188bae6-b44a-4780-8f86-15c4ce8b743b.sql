-- Test and fix RLS policy for rfqs table
-- First, let's check if the policy is working by temporarily allowing all inserts

-- Drop existing policies
DROP POLICY IF EXISTS "Users can create their own RFQs" ON public.rfqs;

-- Recreate the INSERT policy with explicit check
CREATE POLICY "Users can create their own RFQs" 
ON public.rfqs 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Also ensure the SELECT policy allows users to see their own RFQs
DROP POLICY IF EXISTS "RFQs are viewable by owner or participants" ON public.rfqs;

CREATE POLICY "RFQs are viewable by owner or participants" 
ON public.rfqs 
FOR SELECT 
TO authenticated
USING (created_by = auth.uid() OR id IN (
  SELECT rfq_id FROM public.rfq_participants WHERE vendor_id = auth.uid()
));