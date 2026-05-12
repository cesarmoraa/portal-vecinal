-- Migra configuracion_cobros y pagos para soportar conceptos dinamicos.
-- Ejecutar en ambientes que aun tengan el enum payment_concept.

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'configuracion_cobros'
      and column_name = 'concepto'
      and udt_name = 'payment_concept'
  ) then
    alter table configuracion_cobros
      alter column concepto type text using concepto::text;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pagos'
      and column_name = 'concepto'
      and udt_name = 'payment_concept'
  ) then
    alter table pagos
      alter column concepto type text using concepto::text;
  end if;
end
$$;

do $$
begin
  if exists (select 1 from pg_type where typname = 'payment_concept') then
    begin
      drop type payment_concept;
    exception
      when dependent_objects_still_exist then
        raise notice 'payment_concept sigue referenciado; revisar dependencias antes de eliminarlo.';
    end;
  end if;
end
$$;
