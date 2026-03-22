-- ============================================================
-- 修复 workflows 表缺少列的问题
-- ============================================================

-- 补充 credits_used 列（如不存在）
alter table public.workflows
  add column if not exists credits_used integer not null default 62;

-- 补充 failed_step 列（如不存在）
alter table public.workflows
  add column if not exists failed_step text;

-- 补充 name 列（如不存在）
alter table public.workflows
  add column if not exists name text;

-- 补充 updated_at 列（如不存在）
alter table public.workflows
  add column if not exists updated_at timestamptz not null default now();
