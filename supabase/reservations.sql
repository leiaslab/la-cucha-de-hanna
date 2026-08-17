-- Planes de reserva para productos de Electronica.
-- Este archivo complementa schema.sql y coincide con la migracion add_reservation_plans.

alter table public.arqueos
  add column if not exists reservation_collections double precision not null default 0,
  add column if not exists reservation_cash double precision not null default 0,
  add column if not exists reservation_mercado_pago double precision not null default 0,
  add column if not exists reservation_transfer double precision not null default 0;

create table if not exists public.reservation_plans (
  id bigserial primary key,
  client_id bigint not null references public.clientes(id) on delete restrict,
  user_id bigint references public.app_users(id) on delete set null,
  local_id bigint references public.locales(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'paid', 'delivered', 'cancelled')),
  total_amount double precision not null check (total_amount > 0),
  paid_amount double precision not null default 0 check (paid_amount >= 0),
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  paid_at timestamptz,
  delivered_at timestamptz,
  check (paid_amount <= total_amount + 0.01)
);

create table if not exists public.reservation_plan_items (
  id bigserial primary key,
  plan_id bigint not null references public.reservation_plans(id) on delete cascade,
  product_id bigint references public.productos(id) on delete set null,
  name text not null,
  unit_price double precision not null check (unit_price >= 0),
  quantity double precision not null check (quantity > 0),
  line_total double precision not null check (line_total >= 0)
);

create table if not exists public.reservation_payments (
  id bigserial primary key,
  plan_id bigint not null references public.reservation_plans(id) on delete restrict,
  shift_id bigint references public.arqueos(id) on delete set null,
  user_id bigint references public.app_users(id) on delete set null,
  local_id bigint references public.locales(id) on delete set null,
  amount double precision not null check (amount > 0),
  payment_method text not null check (payment_method in ('cash', 'mercado_pago', 'transfer')),
  notes text,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists reservation_plans_status_created_idx on public.reservation_plans (status, created_at desc);
create index if not exists reservation_plans_client_idx on public.reservation_plans (client_id, created_at desc);
create index if not exists reservation_plans_local_idx on public.reservation_plans (local_id, created_at desc);
create index if not exists reservation_plan_items_plan_idx on public.reservation_plan_items (plan_id);
create index if not exists reservation_payments_plan_idx on public.reservation_payments (plan_id, created_at desc);
create index if not exists reservation_payments_shift_idx on public.reservation_payments (shift_id, created_at desc);

drop trigger if exists reservation_plans_touch_updated_at on public.reservation_plans;
create trigger reservation_plans_touch_updated_at
before update on public.reservation_plans
for each row execute function public.touch_updated_at();

create or replace function public.create_reservation_plan(p_payload jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_plan_id bigint;
  v_shift_id bigint;
  v_user_id bigint;
  v_local_id bigint;
  v_client_id bigint;
  v_initial_payment double precision;
  v_payment_method text;
  v_total double precision := 0;
  v_item jsonb;
  v_product_id bigint;
  v_quantity double precision;
  v_product public.productos%rowtype;
  v_stock_updates jsonb;
begin
  v_user_id := nullif((p_payload ->> 'user_id')::bigint, 0);
  v_client_id := nullif((p_payload ->> 'client_id')::bigint, 0);
  v_initial_payment := coalesce((p_payload ->> 'initial_payment')::double precision, 0);
  v_payment_method := coalesce(nullif(p_payload ->> 'payment_method', ''), 'cash');

  if v_client_id is null or not exists (select 1 from public.clientes where id = v_client_id) then
    raise exception 'Selecciona un cliente valido para la reserva.';
  end if;
  if v_payment_method not in ('cash', 'mercado_pago', 'transfer') then
    raise exception 'La forma de pago no es valida.';
  end if;

  select id, local_id into v_shift_id, v_local_id
  from public.arqueos
  where status = 'open'
    and ((v_user_id is null and opened_by_user_id is null) or opened_by_user_id = v_user_id)
  order by opened_at desc limit 1 for update;

  if v_shift_id is null then raise exception 'No hay turno abierto para este usuario.'; end if;
  if jsonb_array_length(coalesce(p_payload -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'Agrega al menos un producto de electronica.';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_payload -> 'items', '[]'::jsonb)) loop
    v_product_id := (v_item ->> 'product_id')::bigint;
    v_quantity := coalesce((v_item ->> 'quantity')::double precision, 0);
    if v_quantity <= 0 then raise exception 'La cantidad reservada debe ser mayor a cero.'; end if;

    select * into v_product from public.productos where id = v_product_id for update;
    if not found then raise exception 'No se encontro el producto ID %.', v_product_id; end if;
    if lower(btrim(v_product.category)) not in ('electronica', 'electrónica') then
      raise exception 'El plan de reserva solo admite productos de electronica.';
    end if;
    if v_product.sale_type <> 'fixed' or v_product.stock_unit <> 'unit' then
      raise exception 'Los productos reservados deben venderse por unidad.';
    end if;
    if abs(v_quantity - round(v_quantity)) > 0.000001 then
      raise exception 'La cantidad reservada debe ser un numero entero.';
    end if;
    if v_product.price <= 0 then
      raise exception 'El producto % no tiene un precio de venta valido.', v_product.name;
    end if;
    v_total := v_total + (v_product.price * v_quantity);
  end loop;

  if v_initial_payment < 0 or v_initial_payment > v_total + 0.01 then
    raise exception 'La entrega inicial debe estar entre cero y el total de la reserva.';
  end if;

  insert into public.reservation_plans
    (client_id, user_id, local_id, status, total_amount, paid_amount, notes, paid_at)
  values
    (v_client_id, v_user_id, v_local_id,
     case when v_initial_payment >= v_total - 0.01 then 'paid' else 'active' end,
     v_total, least(v_initial_payment, v_total), nullif(p_payload ->> 'notes', ''),
     case when v_initial_payment >= v_total - 0.01 then timezone('utc', now()) else null end)
  returning id into v_plan_id;

  for v_item in select value from jsonb_array_elements(coalesce(p_payload -> 'items', '[]'::jsonb)) loop
    v_product_id := (v_item ->> 'product_id')::bigint;
    v_quantity := coalesce((v_item ->> 'quantity')::double precision, 0);
    select * into v_product from public.productos where id = v_product_id for update;

    if v_local_id is not null then
      update public.productos_stock_local
      set stock = stock - v_quantity, updated_at = timezone('utc', now())
      where product_id = v_product_id and local_id = v_local_id and stock >= v_quantity;
      if not found then raise exception 'Stock insuficiente en el local para %.', v_product.name; end if;
    end if;

    update public.productos
    set stock = stock - v_quantity, last_updated = timezone('utc', now())
    where id = v_product_id and stock >= v_quantity;
    if not found then raise exception 'Stock global insuficiente para %.', v_product.name; end if;

    insert into public.reservation_plan_items (plan_id, product_id, name, unit_price, quantity, line_total)
    values (v_plan_id, v_product_id, v_product.name, v_product.price, v_quantity, v_product.price * v_quantity);
  end loop;

  if v_initial_payment > 0 then
    insert into public.reservation_payments
      (plan_id, shift_id, user_id, local_id, amount, payment_method, notes)
    values
      (v_plan_id, v_shift_id, v_user_id, v_local_id, least(v_initial_payment, v_total), v_payment_method, 'Entrega inicial');

    update public.arqueos
    set reservation_collections = reservation_collections + least(v_initial_payment, v_total),
        reservation_cash = reservation_cash + case when v_payment_method = 'cash' then least(v_initial_payment, v_total) else 0 end,
        reservation_mercado_pago = reservation_mercado_pago + case when v_payment_method = 'mercado_pago' then least(v_initial_payment, v_total) else 0 end,
        reservation_transfer = reservation_transfer + case when v_payment_method = 'transfer' then least(v_initial_payment, v_total) else 0 end
    where id = v_shift_id;

    insert into public.movimientos (type, amount, payment_method, description, reference_type, reference_id)
    values ('reservation_payment', least(v_initial_payment, v_total), v_payment_method,
            format('Entrega inicial de reserva #%s', v_plan_id), 'reservation', v_plan_id);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'product_id', p.id, 'global_stock', p.stock, 'local_id', v_local_id,
    'local_stock', ls.stock, 'last_updated', p.last_updated) order by p.id), '[]'::jsonb)
  into v_stock_updates
  from public.productos p
  left join public.productos_stock_local ls on ls.product_id = p.id and ls.local_id = v_local_id
  where p.id in (select distinct (i.value ->> 'product_id')::bigint
                 from jsonb_array_elements(coalesce(p_payload -> 'items', '[]'::jsonb)) i(value));

  return jsonb_build_object('plan_id', v_plan_id, 'shift_id', v_shift_id, 'stock_updates', v_stock_updates);
end;
$$;

create or replace function public.add_reservation_payment(
  p_plan_id bigint,
  p_amount double precision,
  p_payment_method text,
  p_user_id bigint default null,
  p_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_plan public.reservation_plans%rowtype;
  v_shift_id bigint;
  v_shift_local_id bigint;
  v_new_paid double precision;
begin
  if p_amount <= 0 then raise exception 'El pago debe ser mayor a cero.'; end if;
  if p_payment_method not in ('cash', 'mercado_pago', 'transfer') then raise exception 'La forma de pago no es valida.'; end if;

  select * into v_plan from public.reservation_plans where id = p_plan_id for update;
  if not found then raise exception 'No se encontro el plan de reserva.'; end if;
  if v_plan.status <> 'active' then raise exception 'Este plan ya no admite nuevos pagos.'; end if;

  select id, local_id into v_shift_id, v_shift_local_id
  from public.arqueos
  where status = 'open'
    and ((p_user_id is null and opened_by_user_id is null) or opened_by_user_id = p_user_id)
  order by opened_at desc limit 1 for update;

  if v_shift_id is null then raise exception 'Abre un turno antes de registrar el pago.'; end if;
  if v_plan.local_id is distinct from v_shift_local_id then raise exception 'La reserva pertenece a otro local.'; end if;
  if p_amount > (v_plan.total_amount - v_plan.paid_amount) + 0.01 then raise exception 'El pago supera el saldo pendiente.'; end if;

  v_new_paid := least(v_plan.total_amount, v_plan.paid_amount + p_amount);
  insert into public.reservation_payments (plan_id, shift_id, user_id, local_id, amount, payment_method, notes)
  values (p_plan_id, v_shift_id, p_user_id, v_shift_local_id, p_amount, p_payment_method, nullif(p_notes, ''));

  update public.reservation_plans
  set paid_amount = v_new_paid,
      status = case when v_new_paid >= total_amount - 0.01 then 'paid' else 'active' end,
      paid_at = case when v_new_paid >= total_amount - 0.01 then timezone('utc', now()) else paid_at end
  where id = p_plan_id;

  update public.arqueos
  set reservation_collections = reservation_collections + p_amount,
      reservation_cash = reservation_cash + case when p_payment_method = 'cash' then p_amount else 0 end,
      reservation_mercado_pago = reservation_mercado_pago + case when p_payment_method = 'mercado_pago' then p_amount else 0 end,
      reservation_transfer = reservation_transfer + case when p_payment_method = 'transfer' then p_amount else 0 end
  where id = v_shift_id;

  insert into public.movimientos (type, amount, payment_method, description, reference_type, reference_id)
  values ('reservation_payment', p_amount, p_payment_method, format('Pago de reserva #%s', p_plan_id), 'reservation', p_plan_id);

  return jsonb_build_object('plan_id', p_plan_id, 'shift_id', v_shift_id);
end;
$$;

create or replace function public.deliver_reservation_plan(p_plan_id bigint, p_user_id bigint default null)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_local_id bigint;
  v_plan_local_id bigint;
  v_status text;
begin
  select locale_id into v_user_local_id from public.app_users where id = p_user_id;
  select local_id, status into v_plan_local_id, v_status
  from public.reservation_plans where id = p_plan_id for update;
  if not found then raise exception 'No se encontro el plan de reserva.'; end if;
  if v_status <> 'paid' then raise exception 'El producto solo puede entregarse cuando el saldo esta completamente pagado.'; end if;
  if p_user_id is not null and v_user_local_id is distinct from v_plan_local_id then raise exception 'La reserva pertenece a otro local.'; end if;

  update public.reservation_plans set status = 'delivered', delivered_at = timezone('utc', now()) where id = p_plan_id;
  insert into public.movimientos (type, amount, description, reference_type, reference_id)
  values ('reservation_delivery', 0, format('Entrega de reserva #%s', p_plan_id), 'reservation', p_plan_id);
  return p_plan_id;
end;
$$;

create or replace function public.close_shift(
  p_shift_id bigint,
  p_closing_note text default null,
  p_user_id bigint default null
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cash_sales double precision;
  v_mp_sales double precision;
  v_transfer_sales double precision;
  v_total_sales double precision;
  v_order_count integer;
  v_opening_cash double precision;
  v_pending_sales_count integer;
  v_reservation_total double precision;
  v_reservation_cash double precision;
  v_reservation_mp double precision;
  v_reservation_transfer double precision;
begin
  select count(*) into v_pending_sales_count
  from public.ventas where shift_id = p_shift_id and status = 'pending';
  if v_pending_sales_count > 0 then
    raise exception 'No se puede cerrar el turno porque hay % ventas pendientes de sincronizar.', v_pending_sales_count;
  end if;

  select opening_cash into v_opening_cash
  from public.arqueos
  where id = p_shift_id and status = 'open'
    and ((p_user_id is null and opened_by_user_id is null) or opened_by_user_id = p_user_id)
  for update;
  if not found then raise exception 'No se encontro un turno abierto con id %', p_shift_id; end if;

  select count(*)::integer, coalesce(sum(total), 0),
         coalesce(sum(case when payment_method = 'cash' then total else 0 end), 0),
         coalesce(sum(case when payment_method = 'mercado_pago' then total else 0 end), 0),
         coalesce(sum(case when payment_method = 'transfer' then total else 0 end), 0)
  into v_order_count, v_total_sales, v_cash_sales, v_mp_sales, v_transfer_sales
  from public.ventas where shift_id = p_shift_id;

  select coalesce(sum(amount), 0),
         coalesce(sum(case when payment_method = 'cash' then amount else 0 end), 0),
         coalesce(sum(case when payment_method = 'mercado_pago' then amount else 0 end), 0),
         coalesce(sum(case when payment_method = 'transfer' then amount else 0 end), 0)
  into v_reservation_total, v_reservation_cash, v_reservation_mp, v_reservation_transfer
  from public.reservation_payments where shift_id = p_shift_id;

  update public.arqueos
  set status = 'closed', closed_at = timezone('utc', now()), closed_by_user_id = p_user_id,
      closing_note = nullif(p_closing_note, ''), order_count = v_order_count,
      total_sales = v_total_sales, cash_sales = v_cash_sales,
      mercado_pago_sales = v_mp_sales, transfer_sales = v_transfer_sales,
      reservation_collections = v_reservation_total, reservation_cash = v_reservation_cash,
      reservation_mercado_pago = v_reservation_mp, reservation_transfer = v_reservation_transfer,
      expected_cash = coalesce(v_opening_cash, 0) + coalesce(v_cash_sales, 0) + coalesce(v_reservation_cash, 0)
  where id = p_shift_id;

  insert into public.movimientos (type, amount, description, reference_type, reference_id)
  values ('closing', coalesce(v_opening_cash, 0) + coalesce(v_cash_sales, 0) + coalesce(v_reservation_cash, 0),
          'Cierre de turno', 'shift', p_shift_id);
  return p_shift_id;
end;
$$;

alter table public.reservation_plans enable row level security;
alter table public.reservation_plan_items enable row level security;
alter table public.reservation_payments enable row level security;

revoke all privileges on public.reservation_plans, public.reservation_plan_items, public.reservation_payments from public, anon, authenticated;
revoke all on function public.create_reservation_plan(jsonb) from public, anon, authenticated;
revoke all on function public.add_reservation_payment(bigint, double precision, text, bigint, text) from public, anon, authenticated;
revoke all on function public.deliver_reservation_plan(bigint, bigint) from public, anon, authenticated;

grant all privileges on public.reservation_plans, public.reservation_plan_items, public.reservation_payments to service_role;
grant all privileges on sequence public.reservation_plans_id_seq, public.reservation_plan_items_id_seq, public.reservation_payments_id_seq to service_role;
grant execute on function public.create_reservation_plan(jsonb) to service_role;
grant execute on function public.add_reservation_payment(bigint, double precision, text, bigint, text) to service_role;
grant execute on function public.deliver_reservation_plan(bigint, bigint) to service_role;
