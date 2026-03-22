-- ============================================================
-- 1. workflows 表
-- ============================================================
create table if not exists public.workflows (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text,
  prompt       text not null,
  status       text not null default 'pending'
               check (status in ('pending','image_done','video_done','completed','failed')),
  failed_step  text,
  results      jsonb not null default '{}',
  credits_used integer not null default 62,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists workflows_user_id_idx on public.workflows(user_id);
create index if not exists workflows_created_at_idx on public.workflows(created_at desc);

alter table public.workflows enable row level security;

create policy "users can view own workflows"
  on public.workflows for select
  using (auth.uid() = user_id);

create policy "users can insert own workflows"
  on public.workflows for insert
  with check (auth.uid() = user_id);

create policy "users can update own workflows"
  on public.workflows for update
  using (auth.uid() = user_id);

-- ============================================================
-- 2. credit_transactions 表
-- ============================================================
create table if not exists public.credit_transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  amount       integer not null,  -- 负数为扣除，正数为退款
  reason       text,
  ref_id       uuid,              -- 关联的 workflow id
  created_at   timestamptz not null default now()
);

create index if not exists credit_transactions_user_id_idx on public.credit_transactions(user_id);

alter table public.credit_transactions enable row level security;

create policy "users can view own credit_transactions"
  on public.credit_transactions for select
  using (auth.uid() = user_id);

-- ============================================================
-- 3. RPC: create_workflow_with_credits
--    预扣 62 积分并创建 workflow，原子操作
-- ============================================================
create or replace function public.create_workflow_with_credits(
  p_user_id   uuid,
  p_prompt    text,
  p_name      text default null
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_credits   integer;
  v_workflow_id uuid;
begin
  -- 锁定并读取积分
  select amount into v_credits
  from public.credits
  where user_id = p_user_id
  for update;

  if v_credits is null or v_credits < 62 then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  -- 扣除积分
  update public.credits
  set amount = amount - 62,
      updated_at = now()
  where user_id = p_user_id;

  -- 记录交易
  insert into public.credit_transactions(user_id, amount, reason)
  values (p_user_id, -62, 'workflow_create');

  -- 创建 workflow
  insert into public.workflows(user_id, prompt, name, status)
  values (p_user_id, p_prompt, p_name, 'pending')
  returning id into v_workflow_id;

  return v_workflow_id;
end;
$$;

-- ============================================================
-- 4. RPC: refund_workflow_credits
--    退款指定积分
-- ============================================================
create or replace function public.refund_workflow_credits(
  p_user_id     uuid,
  p_workflow_id uuid,
  p_amount      integer,
  p_reason      text default 'workflow_refund'
)
returns void
language plpgsql
security definer
as $$
begin
  update public.credits
  set amount = amount + p_amount,
      updated_at = now()
  where user_id = p_user_id;

  insert into public.credit_transactions(user_id, amount, reason, ref_id)
  values (p_user_id, p_amount, p_reason, p_workflow_id);
end;
$$;
