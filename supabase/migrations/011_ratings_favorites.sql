-- ============================================================
-- 为各生成表添加评分、收藏、反馈字段
-- ============================================================

-- generations (文生图)
alter table public.generations
  add column if not exists rating         int check (rating between 1 and 5),
  add column if not exists feedback_text  text,
  add column if not exists is_favorite    boolean not null default false,
  add column if not exists original_prompt text;

-- speech_generations
alter table public.speech_generations
  add column if not exists rating         int check (rating between 1 and 5),
  add column if not exists feedback_text  text,
  add column if not exists is_favorite    boolean not null default false,
  add column if not exists original_prompt text;

-- video_generations
alter table public.video_generations
  add column if not exists rating         int check (rating between 1 and 5),
  add column if not exists feedback_text  text,
  add column if not exists is_favorite    boolean not null default false,
  add column if not exists original_prompt text;

-- workflows
alter table public.workflows
  add column if not exists rating         int check (rating between 1 and 5),
  add column if not exists feedback_text  text,
  add column if not exists is_favorite    boolean not null default false,
  add column if not exists original_prompt text;

-- image_understand_history
alter table public.image_understand_history
  add column if not exists rating         int check (rating between 1 and 5),
  add column if not exists feedback_text  text,
  add column if not exists is_favorite    boolean not null default false;

-- speech_to_text_history
alter table public.speech_to_text_history
  add column if not exists rating         int check (rating between 1 and 5),
  add column if not exists feedback_text  text,
  add column if not exists is_favorite    boolean not null default false;

-- ============================================================
-- prompt_optimizations 表
-- ============================================================
create table if not exists public.prompt_optimizations (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  original_prompt   text not null,
  optimized_prompt  text not null,
  suggestions       jsonb not null default '[]',
  usage_count       int not null default 1,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists prompt_opt_user_id_idx on public.prompt_optimizations(user_id);
create index if not exists prompt_opt_usage_count_idx on public.prompt_optimizations(usage_count desc);

alter table public.prompt_optimizations enable row level security;

create policy "users can manage own prompt_optimizations"
  on public.prompt_optimizations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
