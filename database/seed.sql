-- Ejecuta primero schema.sql.
-- El usuario administrador inicial se crea con:
-- npm run seed:admin
-- Este seed deja lista la configuracion financiera por defecto.

insert into configuracion_cobros (concepto, cuotas_totales, valor_cuota, anio, mes_inicio, activo)
values
  ('PORTONES', 5, 40000, extract(year from now())::integer, 1, true),
  ('MANTENCION', 12, 2000, extract(year from now())::integer, 1, true)
on conflict (concepto) do update
set
  cuotas_totales = excluded.cuotas_totales,
  valor_cuota = excluded.valor_cuota,
  anio = excluded.anio,
  mes_inicio = excluded.mes_inicio,
  activo = excluded.activo;
