-- Artist Medrano V7 - mapa protegido para recuperar clientas de la V6 sin duplicarlas.
-- No borra ni cambia clientes ni diagnosticos existentes.
-- Requiere que supabase/schema.sql ya este instalado.
create table if not exists public.legacy_client_map (
  source_key text primary key,
  client_id uuid not null references public.clients(id) on delete restrict,
  imported_at timestamptz not null default now(),
  constraint source_key_valid check (length(source_key) between 4 and 120)
);
alter table public.legacy_client_map enable row level security;

drop policy if exists legacy_map_select_staff on public.legacy_client_map;
create policy legacy_map_select_staff on public.legacy_client_map
  for select to authenticated using ((select public.is_salon_staff()));
drop policy if exists legacy_map_insert_staff on public.legacy_client_map;
create policy legacy_map_insert_staff on public.legacy_client_map
  for insert to authenticated with check ((select public.is_salon_staff()));

revoke all on public.legacy_client_map from anon;
revoke all on public.legacy_client_map from authenticated;
grant select,insert on public.legacy_client_map to authenticated;
