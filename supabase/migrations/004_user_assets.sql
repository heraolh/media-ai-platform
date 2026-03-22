-- ============================================================
-- user_assets 表：用户上传的素材库（图片 / 音频 / 视频）
-- ============================================================
create table if not exists public.user_assets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null,
  type         text not null check (type in ('image', 'audio', 'video')),
  url          text not null,
  r2_key       text not null,
  size         bigint,
  mime_type    text,
  created_at   timestamptz not null default now()
);

create index if not exists user_assets_user_id_idx on public.user_assets(user_id);
create index if not exists user_assets_type_idx on public.user_assets(type);
create index if not exists user_assets_created_at_idx on public.user_assets(created_at desc);

alter table public.user_assets enable row level security;

create policy "users can view own assets"
  on public.user_assets for select
  using (auth.uid() = user_id);

create policy "users can insert own assets"
  on public.user_assets for insert
  with check (auth.uid() = user_id);

create policy "users can delete own assets"
  on public.user_assets for delete
  using (auth.uid() = user_id);
