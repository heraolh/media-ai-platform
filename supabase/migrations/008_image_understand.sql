-- ============================================================
-- image_understand_history 表
-- ============================================================
create table if not exists public.image_understand_history (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  input_image_url   text not null,
  prompt            text not null default '详细描述这张图片的内容',
  result_text       text,
  status            text not null default 'pending'
                    check (status in ('pending','completed','failed')),
  credits_consumed  int not null default 3,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists image_understand_user_id_idx on public.image_understand_history(user_id);
create index if not exists image_understand_created_at_idx on public.image_understand_history(created_at desc);

alter table public.image_understand_history enable row level security;

create policy "users can view own image_understand_history"
  on public.image_understand_history for select
  using (auth.uid() = user_id);

create policy "users can insert own image_understand_history"
  on public.image_understand_history for insert
  with check (auth.uid() = user_id);

create policy "users can update own image_understand_history"
  on public.image_understand_history for update
  using (auth.uid() = user_id);

create policy "users can delete own image_understand_history"
  on public.image_understand_history for delete
  using (auth.uid() = user_id);
