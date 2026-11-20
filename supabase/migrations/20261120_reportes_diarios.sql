-- Reporte diario: formulario de actividad de las contratas.
-- El ticket son los 8 primeros caracteres del id (se calcula solo y no se puede editar).
-- La contrata ve solo sus reportes; el administrador ve todos (mismo criterio que documentos_campo).

create table public.reportes_diarios (
  id uuid primary key default gen_random_uuid(),
  ticket text generated always as (substr(id::text, 1, 8)) stored,
  contrata_id uuid not null default auth.uid() references public.perfiles (user_id),
  site text not null check (length(trim(site)) > 0),
  responsable text not null check (length(trim(responsable)) > 0),
  creado_en timestamptz not null default now()
);

create index reportes_diarios_contrata_idx on public.reportes_diarios (contrata_id, creado_en desc);

alter table public.reportes_diarios enable row level security;

create policy "insertar reportes propios" on public.reportes_diarios
  for insert to authenticated
  with check (contrata_id = (select auth.uid()));

create policy "leer reportes propios o admin" on public.reportes_diarios
  for select to authenticated
  using (contrata_id = (select auth.uid()) or privado.es_admin());

-- Permisos mínimos: solo leer e insertar (las políticas RLS filtran qué filas).
revoke all on public.reportes_diarios from anon;
revoke all on public.reportes_diarios from authenticated;
grant select, insert on public.reportes_diarios to authenticated;
