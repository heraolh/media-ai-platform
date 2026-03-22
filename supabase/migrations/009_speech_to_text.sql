-- ============================================================
-- speech_to_text_history 表
-- ============================================================
create table if not exists public.speech_to_text_history (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  audio_url        text not null,
  audio_filename   text,
  transcript       text,
  duration_seconds int,
  file_size_mb     numeric(10,2),
  status           text not null default 'pending'
                   check (status in ('pending','completed','failed')),
  credits_consumed int not null default 2,
  created_at       timestamptz not null default now()
);

create index if not exists stt_user_id_idx on public.speech_to_text_history(user_id);
create index if not exists stt_created_at_idx on public.speech_to_text_history(created_at desc);

alter table public.speech_to_text_history enable row level security;

create policy "users can view own stt_history"
  on public.speech_to_text_history for select
  using (auth.uid() = user_id);

create policy "users can insert own stt_history"
  on public.speech_to_text_history for insert
  with check (auth.uid() = user_id);

create policy "users can update own stt_history"
  on public.speech_to_text_history for update
  using (auth.uid() = user_id);

create policy "users can delete own stt_history"
  on public.speech_to_text_history for delete
  using (auth.uid() = user_id);
