-- ===== myFridge schema =====
-- Rayon taxonomy (PRD règle métier): Frais, Épicerie, Surgelés, Boissons, Hygiène, Autre
create type rayon as enum ('frais','epicerie','surgeles','boissons','hygiene','autre');
create type item_origin as enum ('ia','manuel','recette');
create type scan_type as enum ('frigo','armoire','ticket');

-- Profiles (1-1 with auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  preferences jsonb not null default '{}'::jsonb,
  camera_granted boolean not null default false,
  notifications_granted boolean not null default false,
  onboarding_done boolean not null default false,
  created_at timestamptz not null default now()
);

-- Pantries (garde-manger)
create table public.pantries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Mon garde-manger',
  last_scan_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  pantry_id uuid not null references public.pantries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  rayon rayon not null default 'autre',
  quantity numeric not null default 1,
  unit text not null default 'piece',
  expiry_date date,
  source text not null default 'manuel',
  created_at timestamptz not null default now()
);

-- Shopping lists
create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  rayon rayon not null default 'autre',
  quantity numeric not null default 1,
  unit text not null default 'piece',
  checked boolean not null default false,
  origin item_origin not null default 'manuel',
  confidence numeric,
  created_at timestamptz not null default now()
);

-- Scans (results only; images not persisted for privacy/RGPD)
create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type scan_type not null,
  results jsonb,
  created_at timestamptz not null default now()
);

-- Indexes
create index on public.pantries(user_id);
create index on public.pantry_items(pantry_id);
create index on public.pantry_items(user_id);
create index on public.shopping_lists(user_id);
create index on public.list_items(list_id);
create index on public.list_items(user_id);
create index on public.scans(user_id);

-- ===== Row Level Security =====
alter table public.profiles enable row level security;
alter table public.pantries enable row level security;
alter table public.pantry_items enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.list_items enable row level security;
alter table public.scans enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own pantries" on public.pantries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own pantry_items" on public.pantry_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own lists" on public.shopping_lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own list_items" on public.list_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own scans" on public.scans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ===== Auto-provision profile + default active shopping list on signup =====
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'));

  insert into public.shopping_lists (user_id, status)
  values (new.id, 'active');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
