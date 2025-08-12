-- Enums
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'vendor', 'client');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rfq_status') THEN
    CREATE TYPE public.rfq_status AS ENUM ('draft', 'open', 'closed', 'awarded', 'cancelled');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'participant_status') THEN
    CREATE TYPE public.participant_status AS ENUM ('invited', 'accepted', 'declined', 'submitted');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quote_status') THEN
    CREATE TYPE public.quote_status AS ENUM ('draft', 'submitted', 'withdrawn', 'accepted', 'rejected');
  END IF;
END $$;

-- Utility function to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Role helper function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  full_name text,
  company_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_id_fk_auth FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Profiles are viewable by everyone'
  ) THEN
    CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Users can insert their own profile'
  ) THEN
    CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- profiles triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- user_roles policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_roles' AND policyname='Users can view their roles'
  ) THEN
    CREATE POLICY "Users can view their roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_roles' AND policyname='Users can insert their own role'
  ) THEN
    CREATE POLICY "Users can insert their own role" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_roles' AND policyname='Users can delete their own role'
  ) THEN
    CREATE POLICY "Users can delete their own role" ON public.user_roles FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='user_roles' AND policyname='Users can update their own role'
  ) THEN
    CREATE POLICY "Users can update their own role" ON public.user_roles FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

-- rfqs table
CREATE TABLE IF NOT EXISTS public.rfqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status public.rfq_status NOT NULL DEFAULT 'draft',
  due_date timestamptz,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rfqs ENABLE ROW LEVEL SECURITY;

-- rfqs policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rfqs' AND policyname='RFQs are viewable by owner or participants'
  ) THEN
    CREATE POLICY "RFQs are viewable by owner or participants" ON public.rfqs FOR SELECT USING (
      created_by = auth.uid() OR EXISTS (
        SELECT 1 FROM public.rfq_participants p WHERE p.rfq_id = rfqs.id AND p.vendor_id = auth.uid()
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rfqs' AND policyname='Users can create their own RFQs'
  ) THEN
    CREATE POLICY "Users can create their own RFQs" ON public.rfqs FOR INSERT WITH CHECK (created_by = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rfqs' AND policyname='Owners can update their RFQs'
  ) THEN
    CREATE POLICY "Owners can update their RFQs" ON public.rfqs FOR UPDATE USING (created_by = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rfqs' AND policyname='Owners can delete their RFQs'
  ) THEN
    CREATE POLICY "Owners can delete their RFQs" ON public.rfqs FOR DELETE USING (created_by = auth.uid());
  END IF;
END $$;

-- rfqs triggers
DROP TRIGGER IF EXISTS update_rfqs_updated_at ON public.rfqs;
CREATE TRIGGER update_rfqs_updated_at
BEFORE UPDATE ON public.rfqs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- rfq_participants table
CREATE TABLE IF NOT EXISTS public.rfq_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.participant_status NOT NULL DEFAULT 'invited',
  invited_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rfq_id, vendor_id)
);

ALTER TABLE public.rfq_participants ENABLE ROW LEVEL SECURITY;

-- rfq_participants policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rfq_participants' AND policyname='Participants viewable by RFQ owner or vendor'
  ) THEN
    CREATE POLICY "Participants viewable by RFQ owner or vendor" ON public.rfq_participants FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.rfqs r WHERE r.id = rfq_participants.rfq_id AND r.created_by = auth.uid())
      OR vendor_id = auth.uid()
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rfq_participants' AND policyname='Only RFQ owner can add participants'
  ) THEN
    CREATE POLICY "Only RFQ owner can add participants" ON public.rfq_participants FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.rfqs r WHERE r.id = rfq_participants.rfq_id AND r.created_by = auth.uid())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rfq_participants' AND policyname='Vendor or owner can update participant status'
  ) THEN
    CREATE POLICY "Vendor or owner can update participant status" ON public.rfq_participants FOR UPDATE USING (
      vendor_id = auth.uid() OR EXISTS (SELECT 1 FROM public.rfqs r WHERE r.id = rfq_participants.rfq_id AND r.created_by = auth.uid())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='rfq_participants' AND policyname='Only RFQ owner can remove participants'
  ) THEN
    CREATE POLICY "Only RFQ owner can remove participants" ON public.rfq_participants FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.rfqs r WHERE r.id = rfq_participants.rfq_id AND r.created_by = auth.uid())
    );
  END IF;
END $$;

-- quotes table
CREATE TABLE IF NOT EXISTS public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_id uuid NOT NULL REFERENCES public.rfqs(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  message text,
  status public.quote_status NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rfq_id, vendor_id)
);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- quotes policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quotes' AND policyname='Quotes are viewable by RFQ owner or vendor'
  ) THEN
    CREATE POLICY "Quotes are viewable by RFQ owner or vendor" ON public.quotes FOR SELECT USING (
      vendor_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.rfqs r WHERE r.id = quotes.rfq_id AND r.created_by = auth.uid()
      )
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quotes' AND policyname='Vendors can create their own quotes'
  ) THEN
    CREATE POLICY "Vendors can create their own quotes" ON public.quotes FOR INSERT WITH CHECK (vendor_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quotes' AND policyname='Vendor or RFQ owner can update quotes'
  ) THEN
    CREATE POLICY "Vendor or RFQ owner can update quotes" ON public.quotes FOR UPDATE USING (
      vendor_id = auth.uid() OR EXISTS (SELECT 1 FROM public.rfqs r WHERE r.id = quotes.rfq_id AND r.created_by = auth.uid())
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='quotes' AND policyname='Vendor or RFQ owner can delete quotes'
  ) THEN
    CREATE POLICY "Vendor or RFQ owner can delete quotes" ON public.quotes FOR DELETE USING (
      vendor_id = auth.uid() OR EXISTS (SELECT 1 FROM public.rfqs r WHERE r.id = quotes.rfq_id AND r.created_by = auth.uid())
    );
  END IF;
END $$;

-- quotes triggers
DROP TRIGGER IF EXISTS update_quotes_updated_at ON public.quotes;
CREATE TRIGGER update_quotes_updated_at
BEFORE UPDATE ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure vendor is participant before inserting a quote
CREATE OR REPLACE FUNCTION public.ensure_vendor_is_participant()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.rfq_participants p
    WHERE p.rfq_id = NEW.rfq_id AND p.vendor_id = NEW.vendor_id AND p.status IN ('invited','accepted','submitted')
  ) THEN
    RAISE EXCEPTION 'Vendor % is not a participant of RFQ %', NEW.vendor_id, NEW.rfq_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_quotes_vendor_participant ON public.quotes;
CREATE TRIGGER trg_quotes_vendor_participant
BEFORE INSERT ON public.quotes
FOR EACH ROW EXECUTE FUNCTION public.ensure_vendor_is_participant();
