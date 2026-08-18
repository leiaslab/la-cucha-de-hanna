-- Adds cashier expenses and a per-local switch for stock visibility/decrement.

alter table public.locales
  add column if not exists stock_control_enabled boolean not null default true;

alter table public.arqueos
  add column if not exists cash_expenses numeric(14, 2) not null default 0;

create table if not exists public.gastos_caja (
  id bigint generated always as identity primary key,
  shift_id bigint not null references public.arqueos(id) on delete cascade,
  user_id bigint references public.app_users(id) on delete set null,
  local_id bigint references public.locales(id) on delete set null,
  amount numeric(14, 2) not null check (amount > 0),
  reason text not null check (char_length(btrim(reason)) between 1 and 300),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists gastos_caja_shift_created_idx
on public.gastos_caja (shift_id, created_at desc);

create index if not exists gastos_caja_local_created_idx
on public.gastos_caja (local_id, created_at desc);

create index if not exists gastos_caja_user_created_idx
on public.gastos_caja (user_id, created_at desc);

alter table public.gastos_caja enable row level security;
revoke all privileges on public.gastos_caja from public, anon, authenticated;
grant all privileges on public.gastos_caja to service_role;
grant usage, select on sequence public.gastos_caja_id_seq to service_role;

create or replace function public.register_cash_expense(
  p_shift_id bigint,
  p_user_id bigint,
  p_amount numeric,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_shift public.arqueos%rowtype;
  v_expense public.gastos_caja%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if p_amount is null or p_amount <= 0 or p_amount > 1000000000000 then
    raise exception 'El gasto debe tener un importe mayor que cero.';
  end if;

  if char_length(v_reason) = 0 or char_length(v_reason) > 300 then
    raise exception 'El motivo del gasto debe tener entre 1 y 300 caracteres.';
  end if;

  select * into v_shift
  from public.arqueos
  where id = p_shift_id
    and status = 'open'
    and ((p_user_id is null and opened_by_user_id is null) or opened_by_user_id = p_user_id)
  for update;

  if not found then
    raise exception 'No se encontro un turno abierto para registrar el gasto.';
  end if;

  insert into public.gastos_caja (shift_id, user_id, local_id, amount, reason)
  values (v_shift.id, p_user_id, v_shift.local_id, round(p_amount, 2), v_reason)
  returning * into v_expense;

  update public.arqueos
  set cash_expenses = cash_expenses + v_expense.amount,
      expected_cash = opening_cash
        + coalesce((select sum(total) from public.ventas where shift_id = v_shift.id and payment_method = 'cash'), 0)
        + coalesce((select sum(amount) from public.reservation_payments where shift_id = v_shift.id and payment_method = 'cash'), 0)
        - (cash_expenses + v_expense.amount)
  where id = v_shift.id
  returning * into v_shift;

  insert into public.movimientos (type, amount, description, reference_type, reference_id)
  values ('expense', -v_expense.amount, v_expense.reason, 'shift', v_shift.id);

  return jsonb_build_object('expense', to_jsonb(v_expense), 'shift', to_jsonb(v_shift));
end;
$$;

revoke all on function public.register_cash_expense(bigint, bigint, numeric, text)
from public, anon, authenticated;
grant execute on function public.register_cash_expense(bigint, bigint, numeric, text)
to service_role;

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
  v_cash_expenses numeric(14, 2);
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

  select opening_cash, cash_expenses into v_opening_cash, v_cash_expenses
  from public.arqueos
  where id = p_shift_id and status = 'open'
    and ((p_user_id is null and opened_by_user_id is null) or opened_by_user_id = p_user_id)
  for update;

  if not found then
    raise exception 'No se encontro un turno abierto con id %', p_shift_id;
  end if;

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
      cash_expenses = coalesce(v_cash_expenses, 0),
      expected_cash = coalesce(v_opening_cash, 0) + coalesce(v_cash_sales, 0)
        + coalesce(v_reservation_cash, 0) - coalesce(v_cash_expenses, 0)
  where id = p_shift_id;

  insert into public.movimientos (type, amount, description, reference_type, reference_id)
  values ('closing', coalesce(v_opening_cash, 0) + coalesce(v_cash_sales, 0)
          + coalesce(v_reservation_cash, 0) - coalesce(v_cash_expenses, 0),
          'Cierre de turno', 'shift', p_shift_id);

  return p_shift_id;
end;
$$;

revoke all on function public.close_shift(bigint, text, bigint) from public, anon, authenticated;
grant execute on function public.close_shift(bigint, text, bigint) to service_role;

-- Reapply supabase/variable_price_products.sql after this file so checkout
-- reads stock_control_enabled and skips stock changes when the local disables it.
