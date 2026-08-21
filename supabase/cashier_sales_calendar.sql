alter table public.app_users
  add column if not exists can_view_sales_calendar boolean not null default false;

comment on column public.app_users.can_view_sales_calendar is
  'Permite que un cajero consulte el almanaque con sus ventas y gastos.';
