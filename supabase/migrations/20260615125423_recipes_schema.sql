-- Recipes (US9) + their ingredients (US8 import target)
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  image_url text,
  source_url text,
  source text not null default 'instagram',
  steps jsonb not null default '[]'::jsonb,
  favorite boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  quantity numeric not null default 1,
  unit text not null default 'piece',
  rayon rayon not null default 'autre',
  created_at timestamptz not null default now()
);

create index on public.recipes(user_id);
create index on public.recipe_ingredients(recipe_id);
create index on public.recipe_ingredients(user_id);

alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;

create policy "own recipes" on public.recipes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own recipe_ingredients" on public.recipe_ingredients
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
