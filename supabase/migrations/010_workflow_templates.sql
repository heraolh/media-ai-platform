-- ============================================================
-- workflow_templates 表
-- ============================================================
create table if not exists public.workflow_templates (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references auth.users(id) on delete cascade,
  name          text not null,
  description   text,
  steps         jsonb not null default '[]',
  total_credits int not null default 0,
  is_public     boolean not null default false,
  is_system     boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists wf_templates_user_id_idx on public.workflow_templates(user_id);
create index if not exists wf_templates_is_system_idx on public.workflow_templates(is_system);
create index if not exists wf_templates_is_public_idx on public.workflow_templates(is_public);

alter table public.workflow_templates enable row level security;

-- 用户可查看系统模板、公开模板、自己的模板
create policy "users can view templates"
  on public.workflow_templates for select
  using (is_system = true or is_public = true or auth.uid() = user_id);

create policy "users can insert own templates"
  on public.workflow_templates for insert
  with check (auth.uid() = user_id and is_system = false);

create policy "users can update own templates"
  on public.workflow_templates for update
  using (auth.uid() = user_id and is_system = false);

create policy "users can delete own templates"
  on public.workflow_templates for delete
  using (auth.uid() = user_id and is_system = false);

-- ============================================================
-- workflows 表添加新字段
-- ============================================================
alter table public.workflows
  add column if not exists template_id         uuid references public.workflow_templates(id),
  add column if not exists current_step_index  int not null default 0,
  add column if not exists step_results        jsonb not null default '[]';

-- ============================================================
-- 插入系统预设模板
-- ============================================================
insert into public.workflow_templates
  (id, user_id, name, description, steps, total_credits, is_public, is_system)
values
  (
    'aaaaaaaa-0000-0000-0000-000000000001',
    null,
    '产品营销',
    '文生图 → 图生视频（5s）→ 语音合成（激昂）',
    '[
      {"type":"image","label":"AI生图","model":"Qwen/Qwen2.5-VL-72B-Instruct","params":{"width":1024,"height":1024},"credits":8},
      {"type":"video","label":"图生视频","model":"MiniMax-Hailuo-02","params":{"duration":5},"credits":52},
      {"type":"speech","label":"语音合成","model":"FunAudioLLM/CosyVoice2-0.5B","params":{"voice":"alex","speed":1.0},"credits":2}
    ]',
    62,
    true,
    true
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000002',
    null,
    '短视频故事',
    '文生图 → 图生视频（10s）→ 图生文（生成标题）',
    '[
      {"type":"image","label":"AI生图","model":"Qwen/Qwen2.5-VL-72B-Instruct","params":{"width":1024,"height":1024},"credits":8},
      {"type":"video","label":"图生视频","model":"MiniMax-Hailuo-02","params":{"duration":10},"credits":52},
      {"type":"image_understand","label":"图生文","model":"Qwen/Qwen2.5-VL-72B-Instruct","params":{"prompt":"为这张图片生成一个吸引眼球的短视频标题"},"credits":3}
    ]',
    63,
    true,
    true
  ),
  (
    'aaaaaaaa-0000-0000-0000-000000000003',
    null,
    '播客配图',
    '语音转文字（提取摘要）→ 文生图（生成封面）',
    '[
      {"type":"stt","label":"语音转文字","model":"FunAudioLLM/SenseVoiceSmall","params":{},"credits":2},
      {"type":"image","label":"AI生图","model":"Qwen/Qwen2.5-VL-72B-Instruct","params":{"width":1024,"height":1024},"credits":8}
    ]',
    10,
    true,
    true
  )
on conflict (id) do nothing;
