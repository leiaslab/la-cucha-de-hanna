-- Complements schema.sql. Adds products whose amount and display unit are chosen at sale time.

alter table public.productos
  drop constraint if exists productos_sale_type_check;

alter table public.productos
  add constraint productos_sale_type_check
  check (sale_type in ('fixed', 'weight', 'variable'));

alter table public.detalle_ventas
  drop constraint if exists detalle_ventas_sale_type_check;

alter table public.detalle_ventas
  add constraint detalle_ventas_sale_type_check
  check (sale_type in ('fixed', 'weight', 'variable'));

create or replace function public.create_sale_fast(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sale_id bigint;
  v_item jsonb;
  v_shift_id bigint;
  v_product_id bigint;
  v_quantity double precision;
  v_item_price double precision;
  v_item_stock_unit text;
  v_payment_method text;
  v_user_id bigint;
  v_local_id bigint;
  v_total double precision := 0;
  v_product record;
  v_order jsonb;
  v_shift jsonb;
  v_stock_updates jsonb;
begin
  v_user_id := nullif((p_payload ->> 'user_id')::bigint, 0);
  v_payment_method := nullif(p_payload ->> 'payment_method', '');

  if v_payment_method not in ('cash', 'mercado_pago', 'transfer') then
    raise exception 'La forma de pago no es valida.';
  end if;

  if jsonb_array_length(coalesce(p_payload -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'La venta no contiene productos.';
  end if;

  select id, local_id
  into v_shift_id, v_local_id
  from public.arqueos
  where status = 'open'
    and (
      (v_user_id is null and opened_by_user_id is null)
      or opened_by_user_id = v_user_id
    )
  order by opened_at desc
  limit 1;

  if v_shift_id is null then
    raise exception 'No hay turno abierto para este usuario.';
  end if;

  insert into public.ventas (
    client_id, user_id, local_id, total, status, notes, payment_method, shift_id
  )
  values (
    nullif((p_payload ->> 'client_id')::bigint, 0),
    v_user_id,
    v_local_id,
    0,
    'synced',
    nullif(p_payload ->> 'notes', ''),
    v_payment_method,
    v_shift_id
  )
  returning id into v_sale_id;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_payload -> 'items', '[]'::jsonb))
  loop
    v_product_id := (v_item ->> 'product_id')::bigint;

    select id, name, category, price, sale_type, stock_unit
    into v_product
    from public.productos
    where id = v_product_id;

    if not found then
      raise exception 'No existe el producto ID %', v_product_id;
    end if;

    if v_product.sale_type = 'variable' then
      v_quantity := 1;
      v_item_price := coalesce((v_item ->> 'price')::double precision, 0);
      v_item_stock_unit := coalesce(v_item ->> 'stock_unit', 'unit');

      if v_item_price <= 0
        or v_item_price > 1000000000000
        or v_item_price::text in ('NaN', 'Infinity', '-Infinity') then
        raise exception 'El importe libre debe ser mayor que cero.';
      end if;

      if v_item_stock_unit not in ('unit', 'kg', 'liter') then
        raise exception 'La unidad elegida no es valida.';
      end if;
    else
      v_quantity := coalesce((v_item ->> 'quantity')::double precision, 0);
      v_item_price := v_product.price;
      v_item_stock_unit := v_product.stock_unit;

      if v_quantity <= 0
        or v_quantity > 1000000000
        or v_quantity::text in ('NaN', 'Infinity', '-Infinity') then
        raise exception 'La cantidad debe ser mayor que cero.';
      end if;

      if v_local_id is not null then
        update public.productos_stock_local
        set stock = stock - v_quantity
        where product_id = v_product_id
          and local_id = v_local_id
          and stock >= v_quantity;

        if not found then
          raise exception 'Stock insuficiente en el local para el producto ID %', v_product_id;
        end if;
      end if;

      update public.productos
      set stock = stock - v_quantity,
          last_updated = timezone('utc', now())
      where id = v_product_id
        and stock >= v_quantity;

      if not found then
        raise exception 'Stock global insuficiente para el producto ID %', v_product_id;
      end if;
    end if;

    v_total := v_total + (v_item_price * v_quantity);

    insert into public.detalle_ventas (
      sale_id, product_id, name, price, quantity, category, sale_type, stock_unit, step
    )
    values (
      v_sale_id,
      v_product_id,
      v_product.name,
      v_item_price,
      v_quantity,
      v_product.category,
      v_product.sale_type,
      v_item_stock_unit,
      case when v_product.sale_type = 'variable' then 1
        else coalesce((v_item ->> 'step')::double precision, 1)
      end
    );
  end loop;

  v_total := round(v_total::numeric, 2)::double precision;

  if v_total <= 0 then
    raise exception 'El total de la venta debe ser mayor que cero.';
  end if;

  update public.ventas
  set total = v_total
  where id = v_sale_id;

  insert into public.movimientos (
    type, amount, payment_method, description, reference_type, reference_id
  )
  values (
    'sale', v_total, v_payment_method, format('Venta #%s', v_sale_id), 'sale', v_sale_id
  );

  select
    to_jsonb(sale_row) || jsonb_build_object(
      'detalle_ventas', coalesce(
        (
          select jsonb_agg(to_jsonb(detail_row) order by detail_row.id)
          from public.detalle_ventas as detail_row
          where detail_row.sale_id = v_sale_id
        ),
        '[]'::jsonb
      )
    )
  into v_order
  from public.ventas as sale_row
  where sale_row.id = v_sale_id;

  select to_jsonb(shift_row)
  into v_shift
  from public.arqueos as shift_row
  where shift_row.id = v_shift_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'product_id', product_row.id,
        'global_stock', product_row.stock,
        'local_id', v_local_id,
        'local_stock', local_stock_row.stock,
        'last_updated', product_row.last_updated
      )
      order by product_row.id
    ),
    '[]'::jsonb
  )
  into v_stock_updates
  from public.productos as product_row
  left join public.productos_stock_local as local_stock_row
    on local_stock_row.product_id = product_row.id
   and local_stock_row.local_id = v_local_id
  where product_row.sale_type <> 'variable'
    and product_row.id in (
      select distinct (item.value ->> 'product_id')::bigint
      from jsonb_array_elements(coalesce(p_payload -> 'items', '[]'::jsonb)) as item(value)
    );

  return jsonb_build_object(
    'order', v_order,
    'shift', v_shift,
    'stock_updates', v_stock_updates
  );
end;
$$;

revoke all on function public.create_sale_fast(jsonb) from public, anon, authenticated;
grant execute on function public.create_sale_fast(jsonb) to service_role;
