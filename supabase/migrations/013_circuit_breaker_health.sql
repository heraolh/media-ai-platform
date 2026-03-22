-- ============================================================
-- service_health_logs 表（可选监控分析）
-- ============================================================
create table if not exists public.service_health_logs (
  id                uuid primary key default gen_random_uuid(),
  service_name      text not null,
  endpoint          text,
  status            text not null check (status in ('up','down','degraded')),
  response_time_ms  int,
  error_rate        numeric(5,2),
  checked_at        timestamptz not null default now()
);

create index if not exists shl_service_name_idx on public.service_health_logs(service_name);
create index if not exists shl_checked_at_idx on public.service_health_logs(checked_at desc);

-- No RLS needed — read by internal health check only

-- ============================================================
-- workflows 表添加熔断/重试字段
-- ============================================================
alter table public.workflows
  add column if not exists fallback_used  boolean not null default false,
  add column if not exists retry_count    int not null default 0,
  add column if not exists error_details  jsonb not null default '{}';
