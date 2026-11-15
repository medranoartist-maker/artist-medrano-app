-- ARTIST MEDRANO · Esquema inicial para Supabase (ejecutar en SQL Editor).
-- No pegar datos reales de clientas ni contraseñas en GitHub.
-- Agregar el correo de cada empleado autorizado DESPUÉS, desde Table Editor
-- (salon_staff → Insert row), con active = true.

create extension if not exists pgcrypto;

create table if not exists public.salon_staff (
  email text primary key,
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint staff_email_lowercase check (email = lower(email)),
  constraint staff_email_length check (char_length(email) between 3 and 254)
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text,
  created_at timestamptz not null default now(),
  constraint client_name_length check (char_length(btrim(full_name)) between 1 and 100),
  constraint client_phone_length check (phone is null or char_length(phone) <= 40)
);

create index if not exists clients_full_name_idx on public.clients (full_name);

create table if not exists public.diagnoses (
  id text primary key,
  client_id uuid not null references public.clients(id) on delete restrict,
  visit_date text not null,
  status text not null,
  plan text not null default '',
  service text not null default '',
  answers jsonb not null,
  recommendation text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint diagnose_answers_object check (jsonb_typeof(answers) = 'object'),
  constraint diagnose_id_length check (char_length(id) between 1 and 100)
);

create index if not exists diagnoses_client_date_idx on public.diagnoses (client_id, created_at desc);

-- Esas tablas quedan privadas por defecto. El sitio de GitHub solo usa claves públicas.
alter table public.salon_staff enable row level security;
alter table public.clients enable row level security;
alter table public.diagnoses enable row level security;

-- La comprobación de permiso se realiza en el servidor de Supabase.
-- Usar SECURITY DEFINER evita políticas recursivas sobre salon_staff.
create or replace function public.is_salon_staff()
returns boolean language sql stable security definer set search_path = ''
as $$
 select exists (
   select 1 from public.salon_staff s
   where s.email = lower(auth.jwt() ->> 'email') and s.active is true
 );
$$;

revoke all on function public.is_salon_staff() from public;
grant execute on function public.is_salon_staff() to authenticated;

-- Cada persona autenticada únicamente puede consultar su propia autorización.
drop policy if exists salon_staff_select_self on public.salon_staff;
create policy salon_staff_select_self on public.salon_staff
 for select to authenticated
 using (email = lower(auth.jwt() ->> 'email'));

-- Solo los usuarios que figuren activos en salon_staff pueden consultar o guardar.
-- Eliminación deshabilitada por diseño, para conservar historial.
drop policy if exists clients_read_staff on public.clients;
create policy clients_read_staff on public.clients
 for select to authenticated using ((select public.is_salon_staff()));

drop policy if exists clients_insert_staff on public.clients;
create policy clients_insert_staff on public.clients
 for insert to authenticated with check ((select public.is_salon_staff()));

drop policy if exists clients_update_staff on public.clients;
create policy clients_update_staff on public.clients
 for update to authenticated using ((select public.is_salon_staff()))
 with check ((select public.is_salon_staff()));

drop policy if exists diagnoses_read_staff on public.diagnoses;
create policy diagnoses_read_staff on public.diagnoses
 for select to authenticated using ((select public.is_salon_staff()));

drop policy if exists diagnoses_insert_staff on public.diagnoses;
create policy diagnoses_insert_staff on public.diagnoses
 for insert to authenticated with check ((select public.is_salon_staff()));

drop policy if exists diagnoses_update_staff on public.diagnoses;
create policy diagnoses_update_staff on public.diagnoses
 for update to authenticated using ((select public.is_salon_staff()))
 with check ((select public.is_salon_staff()));

-- No otorgar permisos a usuarios anónimos. Nunca publicar la service_role key.
revoke all on public.salon_staff, public.clients, public.diagnoses from anon;
grant select on public.salon_staff to authenticated;
grant select, insert, update on public.clients, public.diagnoses to authenticated;
revoke delete on public.salon_staff, public.clients, public.diagnoses from authenticated;
