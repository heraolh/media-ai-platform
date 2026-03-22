-- ============================================================
-- 修复 credit_transactions 表缺少列的问题
-- 如果表已存在但缺少 reason / ref_id 列，则补充添加
-- ============================================================
alter table public.credit_transactions
  add column if not exists reason text,
  add column if not exists ref_id uuid;

-- 同时确保 RPC 函数是最新版本（幂等重建）
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
  select amount into v_credits
  from public.credits
  where user_id = p_user_id
  for update;

  if v_credits is null or v_credits < 62 then
    raise exception 'INSUFFICIENT_CREDITS';
  end if;

  update public.credits
  set amount = amount - 62,
      updated_at = now()
  where user_id = p_user_id;

  insert into public.credit_transactions(user_id, amount, reason)
  values (p_user_id, -62, 'workflow_create');

  insert into public.workflows(user_id, prompt, name, status)
  values (p_user_id, p_prompt, p_name, 'pending')
  returning id into v_workflow_id;

  return v_workflow_id;
end;
$$;

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
