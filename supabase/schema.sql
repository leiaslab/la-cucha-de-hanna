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

create table if not exists public.locales (
  id bigserial primary key,
  name text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.app_users (
  id bigserial primary key,
  full_name text not null,
  username text not null unique,
  password_hash text not null,
  role text not null check (role in ('admin', 'cajero')),
  locale_id bigint references public.locales(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.arqueos (
  id bigserial primary key,
  status text not null check (status in ('open', 'closed')),
  opened_at timestamptz not null default timezone('utc', now()),
  opened_by_user_id bigint references public.app_users(id) on delete set null,
  local_id bigint references public.locales(id) on delete set null,
  opening_cash double precision not null default 0,
  opening_note text,
  closed_at timestamptz,
  closed_by_user_id bigint references public.app_users(id) on delete set null,
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
  user_id bigint references public.app_users(id) on delete set null,
  local_id bigint references public.locales(id) on delete set null,
  total double precision not null,
  status text not null default 'synced' check (status in ('pending', 'synced')),
  created_at timestamptz not null default timezone('utc', now()),
  notes text,
  payment_method text check (payment_method in ('cash', 'mercado_pago', 'transfer')),
  shift_id bigint references public.arqueos(id) on delete set null
);

alter table public.arqueos
  add column if not exists opened_by_user_id bigint references public.app_users(id) on delete set null;

alter table public.arqueos
  add column if not exists closed_by_user_id bigint references public.app_users(id) on delete set null;

alter table public.ventas
  add column if not exists user_id bigint references public.app_users(id) on delete set null;

alter table public.app_users
  add column if not exists locale_id bigint references public.locales(id) on delete set null;

alter table public.arqueos
  add column if not exists local_id bigint references public.locales(id) on delete set null;

alter table public.ventas
  add column if not exists local_id bigint references public.locales(id) on delete set null;

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

drop trigger if exists app_users_touch_updated_at on public.app_users;
create trigger app_users_touch_updated_at
before update on public.app_users
for each row
execute function public.touch_updated_at();

drop trigger if exists locales_touch_updated_at on public.locales;
create trigger locales_touch_updated_at
before update on public.locales
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
  v_user_id bigint;
  v_local_id bigint;
begin
  v_user_id := nullif((p_payload ->> 'user_id')::bigint, 0);

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
    client_id,
    user_id,
    local_id,
    total,
    status,
    notes,
    payment_method,
    shift_id
  )
  values (
    nullif((p_payload ->> 'client_id')::bigint, 0),
    v_user_id,
    v_local_id,
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

create or replace function public.open_shift(
  p_opening_cash double precision,
  p_opening_note text default null,
  p_user_id bigint default null
)
returns bigint
language plpgsql
security definer
as $$
declare
  v_shift_id bigint;
  v_local_id bigint;
begin
  if exists (
    select 1
    from public.arqueos
    where status = 'open'
      and (
        (p_user_id is null and opened_by_user_id is null)
        or opened_by_user_id = p_user_id
      )
  ) then
    raise exception 'Ya existe un turno abierto para este usuario.';
  end if;

  if p_user_id is not null then
    select locale_id
    into v_local_id
    from public.app_users
    where id = p_user_id;
  end if;

  insert into public.arqueos (
    status,
    opened_by_user_id,
    local_id,
    opening_cash,
    opening_note
  )
  values (
    'open',
    p_user_id,
    v_local_id,
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

create or replace function public.close_shift(
  p_shift_id bigint,
  p_closing_note text default null,
  p_user_id bigint default null
)
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
    and (
      (p_user_id is null and opened_by_user_id is null)
      or opened_by_user_id = p_user_id
    )
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
      closed_by_user_id = p_user_id,
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
