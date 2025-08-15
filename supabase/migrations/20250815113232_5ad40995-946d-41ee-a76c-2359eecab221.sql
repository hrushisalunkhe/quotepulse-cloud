-- Fix the search path for the function
CREATE OR REPLACE FUNCTION public.get_user_rfqs(_user_id uuid)
RETURNS TABLE(rfq_id uuid)
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = 'public'
AS $$
  SELECT id as rfq_id FROM public.rfqs WHERE created_by = _user_id
  UNION
  SELECT rfq_id FROM public.rfq_participants WHERE vendor_id = _user_id;
$$;