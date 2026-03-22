-- ============================================================
-- share_links 表
-- ============================================================
create table if not exists public.share_links (
  id             uuid primary key default gen_random_uuid(),
  content_type   text not null
                 check (content_type in ('image','video','speech','workflow','image_understand','speech_to_text')),
  content_id     uuid not null,
  user_id        uuid not null references auth.users(id) on delete cascade,
  token          text not null unique,
  expires_at     timestamptz not null default (now() + interval '24 hours'),
  view_count     int not null default 0,
  password_hash  text,
  created_at     timestamptz not null default now()
);

create unique index if not exists share_links_token_idx on public.share_links(token);
create index if not exists share_links_expires_at_idx on public.share_links(expires_at);
create index if not exists share_links_user_id_idx on public.share_links(user_id);

alter table public.share_links enable row level security;

-- 登录用户可查看自己的分享链接
create policy "users can view own share_links"
  on public.share_links for select
  using (auth.uid() = user_id);

-- 登录用户可创建自己的分享链接
create policy "users can create own share_links"
  on public.share_links for insert
  with check (auth.uid() = user_id);

-- 登录用户可删除自己的分享链接
create policy "users can delete own share_links"
  on public.share_links for delete
  using (auth.uid() = user_id);

-- 任何人（含匿名）可通过 token 查询（供分享页面使用）
create policy "public can read share_links by token"
  on public.share_links for select
  using (true);
