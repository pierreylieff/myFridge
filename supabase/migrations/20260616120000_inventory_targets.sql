-- ===== Inventory model: cible optionnelle + flag de réassort =====
-- Sépare clairement le stock (pantry_items) de la liste de courses (list_items).
-- target_qty : quantité souhaitée (« ce que je devrais avoir »), optionnelle.
-- needs_restock : marquage manuel « à racheter » quand aucune cible n'est définie.

alter table public.pantry_items
  add column if not exists target_qty numeric,
  add column if not exists needs_restock boolean not null default false;

-- Dédup à l'upsert depuis le scan : un même produit (nom insensible à la casse +
-- unité) n'apparaît qu'une fois par garde-manger.
create unique index if not exists pantry_items_dedup
  on public.pantry_items (pantry_id, lower(name), unit);

-- ===== Garde-manger par défaut à l'inscription =====
-- handle_new_user() ne créait jusqu'ici qu'une shopping_list. On y ajoute la
-- création du garde-manger par défaut.
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

  insert into public.pantries (user_id, name)
  values (new.id, 'Mon garde-manger');

  return new;
end;
$$;

-- Backfill : un garde-manger pour les utilisateurs existants qui n'en ont pas.
insert into public.pantries (user_id, name)
select u.id, 'Mon garde-manger'
from auth.users u
where not exists (
  select 1 from public.pantries p where p.user_id = u.id
);
