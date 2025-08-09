-- Enums
create type if not exists public.app_role as enum ('client','vendor','admin');
create type if not exists public.rfq_status as enum ('draft','open','closed','awarded','cancelled');
create type if not exists public.quote_status as enum ('submitted','withdrawn','accepted','rejected');

-- Profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  company_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- User roles table
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);

alter table public.user_roles enable row level security;

-- has_role helper function
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

-- Updated at trigger function
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Trigger for profiles
create trigger if not exists trg_profiles_updated_at
before update on public.profiles
for each row execute function public.update_updated_at_column();

-- Auto-create profile and default role on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, company_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', ''),
    coalesce(new.raw_user_meta_data ->> 'company_name', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  ) on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'client'::public.app_role)
  on conflict do nothing;

  return new;
end;
$$;

-- Ensure trigger exists
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RFQs table
create table if not exists public.rfqs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  specifications jsonb,
  status public.rfq_status not null default 'open',
  due_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rfqs enable row level security;

create index if not exists idx_rfqs_created_by on public.rfqs(created_by);

create trigger if not exists trg_rfqs_updated_at
before update on public.rfqs
for each row execute function public.update_updated_at_column();

-- RFQ participants table
create table if not exists public.rfq_participants (
  rfq_id uuid not null references public.rfqs(id) on delete cascade,
  vendor_user_id uuid not null references auth.users(id) on delete cascade,
  invited_at timestamptz not null default now(),
  primary key (rfq_id, vendor_user_id)
);

alter table public.rfq_participants enable row level security;

create index if not exists idx_rfq_participants_vendor on public.rfq_participants(vendor_user_id);

-- Quotes table
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  rfq_id uuid not null references public.rfqs(id) on delete cascade,
  vendor_user_id uuid not null references auth.users(id) on delete cascade,
  total_price numeric(12,2) not null,
  currency text default 'USD',
  delivery_days integer,
  notes text,
  compliance jsonb,
  score numeric,
  status public.quote_status not null default 'submitted',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rfq_id, vendor_user_id)
);

alter table public.quotes enable row level security;

create index if not exists idx_quotes_rfq on public.quotes(rfq_id);
create index if not exists idx_quotes_vendor on public.quotes(vendor_user_id);

create trigger if not exists trg_quotes_updated_at
before update on public.quotes
for each row execute function public.update_updated_at_column();

-- RLS policies

-- profiles
create policy if not exists "Users can view their profile"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy if not exists "Users can update their profile"
  on public.profiles for update to authenticated
  using (id = auth.uid());

create policy if not exists "Users can insert their profile"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

-- user_roles
create policy if not exists "Users can read their roles"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- rfqs
create policy if not exists "RFQ creator full access"
  on public.rfqs for all to authenticated
  using (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'))
  with check (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy if not exists "Participants can view RFQ"
  on public.rfqs for select to authenticated
  using (exists (
    select 1 from public.rfq_participants rp
    where rp.rfq_id = public.rfqs.id and rp.vendor_user_id = auth.uid()
  ));

-- rfq_participants
create policy if not exists "Creator manages participants"
  on public.rfq_participants for all to authenticated
  using (exists (
    select 1 from public.rfqs r where r.id = rfq_id and r.created_by = auth.uid()
  ))
  with check (exists (
    select 1 from public.rfqs r where r.id = rfq_id and r.created_by = auth.uid()
  ));

create policy if not exists "Vendor sees own participant row"
  on public.rfq_participants for select to authenticated
  using (vendor_user_id = auth.uid());

-- quotes
create policy if not exists "Vendor inserts own quote"
  on public.quotes for insert to authenticated
  with check (
    vendor_user_id = auth.uid()
    and exists (
      select 1 from public.rfq_participants rp
      where rp.rfq_id = public.quotes.rfq_id and rp.vendor_user_id = auth.uid()
    )
  );

create policy if not exists "Vendor updates own quote"
  on public.quotes for update to authenticated
  using (vendor_user_id = auth.uid());

create policy if not exists "Vendor reads own quotes"
  on public.quotes for select to authenticated
  using (vendor_user_id = auth.uid());

create policy if not exists "RFQ creator reads quotes"
  on public.quotes for select to authenticated
  using (exists (
    select 1 from public.rfqs r where r.id = public.quotes.rfq_id and r.created_by = auth.uid()
  ));

create policy if not exists "RFQ creator updates quote status"
  on public.quotes for update to authenticated
  using (exists (
    select 1 from public.rfqs r where r.id = public.quotes.rfq_id and r.created_by = auth.uid()
  ));
