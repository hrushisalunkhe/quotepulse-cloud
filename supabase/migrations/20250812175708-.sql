-- Fix function search path issues
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_vendor_is_participant()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.rfq_participants p
    WHERE p.rfq_id = NEW.rfq_id AND p.vendor_id = NEW.vendor_id AND p.status IN ('invited','accepted','submitted')
  ) THEN
    RAISE EXCEPTION 'Vendor % is not a participant of RFQ %', NEW.vendor_id, NEW.rfq_id;
  END IF;
  RETURN NEW;
END;
$$;