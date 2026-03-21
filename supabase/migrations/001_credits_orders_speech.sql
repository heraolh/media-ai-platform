-- ============================================================
-- 1. credits 表（用户积分余额）
-- ============================================================
create table if not exists public.credits (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  amount    integer not null default 0 check (amount >= 0),
  updated_at timestamptz not null default now()
);

alter table public.credits enable row level security;

create policy "users can read own credits"
  on public.credits for select
  using (auth.uid() = user_id);

create policy "users can update own credits"
  on public.credits for update
  using (auth.uid() = user_id);

create policy "users can insert own credits"
  on public.credits for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- 2. orders 表（Stripe 订单记录）
-- ============================================================
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  stripe_session_id text unique,
  credits_amount    integer not null,
  price_cents       integer not null,
  status            text not null default 'pending' check (status in ('pending','paid','failed')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists orders_stripe_session_idx on public.orders(stripe_session_id);

alter table public.orders enable row level security;

create policy "users can view own orders"
  on public.orders for select
  using (auth.uid() = user_id);

-- Service role (webhook) can insert/update orders
create policy "service role can manage orders"
  on public.orders for all
  using (true)
  with check (true);

-- ============================================================
-- 3. speech_generations 表（语音历史）
-- ============================================================
create table if not exists public.speech_generations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  text         text not null,
  voice        text,
  voice_id     text,
  status       text not null default 'pending',
  audio_url    text,
  storage_path text,
  error_msg    text,
  created_at   timestamptz not null default now()
);

create index if not exists speech_generations_user_id_idx on public.speech_generations(user_id);
create index if not exists speech_generations_created_at_idx on public.speech_generations(created_at desc);

alter table public.speech_generations enable row level security;

create policy "users can view own speech_generations"
  on public.speech_generations for select
  using (auth.uid() = user_id);

create policy "users can insert own speech_generations"
  on public.speech_generations for insert
  with check (auth.uid() = user_id);

create policy "users can update own speech_generations"
  on public.speech_generations for update
  using (auth.uid() = user_id);
