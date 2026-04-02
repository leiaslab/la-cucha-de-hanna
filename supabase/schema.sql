create table if not exists public.clientes (
  id bigserial primary key,
  full_name text not null,
  phone text,
  email text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.productos (
  id bigserial primary key,
  name text not null,
  price double precision not null,
  cost double precision not null,
  stock double precision not null default 0,
  low_stock_alert_threshold double precision not null default 5,
  category text not null,
  slug text not null unique,
  sale_type text not null check (sale_type in ('fixed', 'weight')),
  stock_unit text not null check (stock_unit in ('unit', 'kg', 'liter')),
  description text,
  image_url text,
  last_updated timestamptz not null default timezone('utc', now())
);

create table if not exists public.arqueos (
  id bigserial primary key,
  status text not null check (status in ('open', 'closed')),
  opened_at timestamptz not null default timezone('utc', now()),
  opening_cash double precision not null default 0,
  opening_note text,
  closed_at timestamptz,
  closing_note text,
  order_count integer,
  total_sales double precision,
  cash_sales double precision,
  mercado_pago_sales double precision,
  transfer_sales double precision,
  expected_cash double precision
);

create table if not exists public.ventas (
  id bigserial primary key,
  client_id bigint references public.clientes(id) on delete set null,
  total double precision not null,
  status text not null default 'synced' check (status in ('pending', 'synced')),
  created_at timestamptz not null default timezone('utc', now()),
  notes text,
  payment_method text check (payment_method in ('cash', 'mercado_pago', 'transfer')),
  shift_id bigint references public.arqueos(id) on delete set null
);

create table if not exists public.detalle_ventas (
  id bigserial primary key,
  sale_id bigint not null references public.ventas(id) on delete cascade,
  product_id bigint references public.productos(id) on delete set null,
  name text not null,
  price double precision not null,
  quantity double precision not null,
  category text not null,
  sale_type text not null check (sale_type in ('fixed', 'weight')),
  stock_unit text not null check (stock_unit in ('unit', 'kg', 'liter')),
  step double precision not null default 1
);

create table if not exists public.movimientos (
  id bigserial primary key,
  type text not null,
  amount double precision not null,
  payment_method text,
  description text,
  reference_type text,
  reference_id bigint,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.pdfs (
  id bigserial primary key,
  entity_type text not null check (entity_type in ('sale', 'shift')),
  entity_id bigint not null,
  file_name text not null,
  drive_file_id text not null,
  drive_url text not null,
  mime_type text not null default 'application/pdf',
  created_at timestamptz not null default timezone('utc', now())
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists clientes_touch_updated_at on public.clientes;
create trigger clientes_touch_updated_at
before update on public.clientes
for each row
execute function public.touch_updated_at();

create or replace function public.create_sale(p_payload jsonb)
returns bigint
language plpgsql
security definer
as $$
declare
  v_sale_id bigint;
  v_item jsonb;
  v_shift_id bigint;
  v_product_id bigint;
  v_quantity double precision;
  v_payment_method text;
begin
  select id
  into v_shift_id
  from public.arqueos
  where status = 'open'
  order by opened_at desc
  limit 1;

  insert into public.ventas (
    client_id,
    total,
    status,
    notes,
    payment_method,
    shift_id
  )
  values (
    nullif((p_payload ->> 'client_id')::bigint, 0),
    coalesce((p_payload ->> 'total')::double precision, 0),
    'synced',
    nullif(p_payload ->> 'notes', ''),
    nullif(p_payload ->> 'payment_method', ''),
    v_shift_id
  )
  returning id into v_sale_id;

  for v_item in
    select value from jsonb_array_elements(coalesce(p_payload -> 'items', '[]'::jsonb))
  loop
    v_product_id := (v_item ->> 'product_id')::bigint;
    v_quantity := coalesce((v_item ->> 'quantity')::double precision, 0);

    perform 1
    from public.productos
    where id = v_product_id
      and stock >= v_quantity
    for update;

    if not found then
      raise exception 'Stock insuficiente o producto inexistente para el item %', v_product_id;
    end if;

    update public.productos
    set stock = stock - v_quantity,
        last_updated = timezone('utc', now())
    where id = v_product_id;

    insert into public.detalle_ventas (
      sale_id,
      product_id,
      name,
      price,
      quantity,
      category,
      sale_type,
      stock_unit,
      step
    )
    values (
      v_sale_id,
      v_product_id,
      coalesce(v_item ->> 'name', ''),
      coalesce((v_item ->> 'price')::double precision, 0),
      v_quantity,
      coalesce(v_item ->> 'category', 'Varios'),
      coalesce(v_item ->> 'sale_type', 'fixed'),
      coalesce(v_item ->> 'stock_unit', 'unit'),
      coalesce((v_item ->> 'step')::double precision, 1)
    );
  end loop;

  v_payment_method := nullif(p_payload ->> 'payment_method', '');

  insert into public.movimientos (
    type,
    amount,
    payment_method,
    description,
    reference_type,
    reference_id
  )
  values (
    'sale',
    coalesce((p_payload ->> 'total')::double precision, 0),
    v_payment_method,
    format('Venta #%s', v_sale_id),
    'sale',
    v_sale_id
  );

  return v_sale_id;
end;
$$;

create or replace function public.open_shift(p_opening_cash double precision, p_opening_note text default null)
returns bigint
language plpgsql
security definer
as $$
declare
  v_shift_id bigint;
begin
  if exists (select 1 from public.arqueos where status = 'open') then
    raise exception 'Ya existe un turno abierto.';
  end if;

  insert into public.arqueos (
    status,
    opening_cash,
    opening_note
  )
  values (
    'open',
    coalesce(p_opening_cash, 0),
    nullif(p_opening_note, '')
  )
  returning id into v_shift_id;

  insert into public.movimientos (
    type,
    amount,
    description,
    reference_type,
    reference_id
  )
  values (
    'opening',
    coalesce(p_opening_cash, 0),
    'Apertura de turno',
    'shift',
    v_shift_id
  );

  return v_shift_id;
end;
$$;

create or replace function public.close_shift(p_shift_id bigint, p_closing_note text default null)
returns bigint
language plpgsql
security definer
as $$
declare
  v_cash_sales double precision;
  v_mp_sales double precision;
  v_transfer_sales double precision;
  v_total_sales double precision;
  v_order_count integer;
  v_opening_cash double precision;
begin
  select opening_cash
  into v_opening_cash
  from public.arqueos
  where id = p_shift_id
    and status = 'open'
  for update;

  if not found then
    raise exception 'No se encontro un turno abierto con id %', p_shift_id;
  end if;

  select
    count(*)::integer,
    coalesce(sum(total), 0),
    coalesce(sum(case when payment_method = 'cash' then total else 0 end), 0),
    coalesce(sum(case when payment_method = 'mercado_pago' then total else 0 end), 0),
    coalesce(sum(case when payment_method = 'transfer' then total else 0 end), 0)
  into
    v_order_count,
    v_total_sales,
    v_cash_sales,
    v_mp_sales,
    v_transfer_sales
  from public.ventas
  where shift_id = p_shift_id;

  update public.arqueos
  set status = 'closed',
      closed_at = timezone('utc', now()),
      closing_note = nullif(p_closing_note, ''),
      order_count = v_order_count,
      total_sales = v_total_sales,
      cash_sales = v_cash_sales,
      mercado_pago_sales = v_mp_sales,
      transfer_sales = v_transfer_sales,
      expected_cash = coalesce(v_opening_cash, 0) + coalesce(v_cash_sales, 0)
  where id = p_shift_id;

  insert into public.movimientos (
    type,
    amount,
    description,
    reference_type,
    reference_id
  )
  values (
    'closing',
    coalesce(v_opening_cash, 0) + coalesce(v_cash_sales, 0),
    'Cierre de turno',
    'shift',
    p_shift_id
  );

  return p_shift_id;
end;
$$;
