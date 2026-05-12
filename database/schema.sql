create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('admin', 'tesorero', 'vecino');
  end if;
end
$$;

create table if not exists vecinos (
  id uuid primary key default gen_random_uuid(),
  pasaje text not null,
  numeracion integer not null,
  comuna text not null default 'Maipu',
  pais text not null default 'Chile',
  direccion text not null,
  coordenadas text,
  latitud numeric(10, 6),
  longitud numeric(10, 6),
  representante_nombre text,
  telefono text,
  firma_vobo boolean not null default false,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vecinos_pasaje_numero_unique unique (pasaje, numeracion)
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  role user_role not null,
  vecino_id uuid references vecinos(id) on delete set null,
  username text unique,
  pasaje text,
  numeracion integer,
  full_name text not null,
  phone text,
  pin_hash text not null,
  must_change_password boolean not null default true,
  active boolean not null default true,
  failed_login_attempts integer not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_role_identity_chk check (
    (role = 'vecino' and vecino_id is not null and pasaje is not null and numeracion is not null)
    or
    (role in ('admin', 'tesorero') and username is not null)
  )
);

create unique index if not exists users_vecino_uidx
  on users (vecino_id)
  where vecino_id is not null;

create unique index if not exists users_pasaje_numero_uidx
  on users (upper(pasaje), numeracion)
  where role = 'vecino';

create table if not exists configuracion_cobros (
  concepto text primary key,
  cuotas_totales integer not null check (cuotas_totales > 0),
  valor_cuota numeric(12, 2) not null check (valor_cuota > 0),
  anio integer not null,
  mes_inicio smallint not null default 1 check (mes_inicio between 1 and 12),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists pagos (
  id uuid primary key default gen_random_uuid(),
  vecino_id uuid not null references vecinos(id) on delete cascade,
  concepto text not null,
  monto numeric(12, 2) not null check (monto > 0),
  fecha_pago date not null,
  period_year integer,
  period_month smallint check (period_month between 1 and 12),
  observacion text,
  source text not null default 'manual',
  source_ref text,
  created_by uuid references users(id) on delete set null,
  updated_by uuid references users(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists pagos_import_uidx
  on pagos (vecino_id, concepto, source, source_ref)
  where source_ref is not null and deleted_at is null;

create index if not exists pagos_vecino_concepto_idx
  on pagos (vecino_id, concepto, fecha_pago)
  where deleted_at is null;

create table if not exists auditoria (
  id bigserial primary key,
  usuario_id uuid references users(id) on delete set null,
  usuario_identificador text,
  rol user_role,
  ip inet,
  accion text not null,
  entidad text not null,
  entidad_id text,
  valor_anterior jsonb,
  valor_nuevo jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists auditoria_created_at_idx
  on auditoria (created_at desc);

create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists vecinos_touch_updated_at on vecinos;
create trigger vecinos_touch_updated_at
before update on vecinos
for each row
execute function touch_updated_at();

drop trigger if exists users_touch_updated_at on users;
create trigger users_touch_updated_at
before update on users
for each row
execute function touch_updated_at();

drop trigger if exists configuracion_cobros_touch_updated_at on configuracion_cobros;
create trigger configuracion_cobros_touch_updated_at
before update on configuracion_cobros
for each row
execute function touch_updated_at();

drop trigger if exists pagos_touch_updated_at on pagos;
create trigger pagos_touch_updated_at
before update on pagos
for each row
execute function touch_updated_at();

insert into configuracion_cobros (concepto, cuotas_totales, valor_cuota, anio, mes_inicio, activo)
values
  ('PORTONES', 5, 40000, extract(year from now())::integer, 1, true),
  ('MANTENCION', 12, 2000, extract(year from now())::integer, 1, true)
on conflict (concepto) do nothing;
