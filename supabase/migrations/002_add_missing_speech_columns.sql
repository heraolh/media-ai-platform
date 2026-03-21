-- ============================================================
-- 补充 speech_generations 表中可能缺失的列
-- 如果列已存在则跳过（IF NOT EXISTS）
-- ============================================================
alter table public.speech_generations
  add column if not exists voice_id     text,
  add column if not exists voice        text,
  add column if not exists audio_url    text,
  add column if not exists storage_path text,
  add column if not exists error_msg    text;
