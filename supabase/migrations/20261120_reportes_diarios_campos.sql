-- Reporte diario: campos completos del formulario (la tabla aún no tiene filas).
-- Los archivos van al bucket privado documentos-campo, en <user_id>/reportes/<id>/..., y se listan en "archivos".

alter table public.reportes_diarios
  add column proyecto text not null check (length(trim(proyecto)) > 0),
  add column actividad text not null check (length(trim(actividad)) > 0),
  add column fecha_actividad date not null,
  add column hora_ingreso time not null,
  add column hora_salida time not null,
  add column cantidad_tecnicos smallint not null check (cantidad_tecnicos between 1 and 4),
  add column tipo_alto_riesgo text not null check (length(trim(tipo_alto_riesgo)) > 0),
  add column incidentes boolean not null,
  add column choques_vehiculares boolean not null,
  add column usa_escalera boolean,
  add column trabajo_altura boolean not null,
  add column trabajo_electrico boolean not null,
  add column archivos jsonb not null default '[]'::jsonb;
