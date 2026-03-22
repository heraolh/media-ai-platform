# Media AI Platform

基于 Next.js 16 构建的 AI 媒体生成平台，集成图片、视频、语音、图像理解、语音转文字、提示词优化等多项 AI 能力，支持素材库管理、工作流历史查看、积分购买消费、内容分享与健康监控。

## 功能模块

### SmartKit 智能营销套件（62 积分/次）
一键完成三步流水线，自动打包下载：
1. **AI 生图** — SiliconFlow `Qwen/Qwen-Image` 文生图
2. **图生视频** — MiniMax `MiniMax-Hailuo-02`，以生成图片作为首帧
3. **语音合成** — SiliconFlow `CosyVoice2-0.5B`，朗读产品描述

### 我的素材库
作为 AI 功能的输入素材管理中心：
- **图片**：上传/预览（灯箱）/删除，支持 PNG / JPG / GIF / WebP
- **音频**：上传/在线播放/删除，支持 MP3 / WAV / OGG / AAC
- **视频**：上传/内嵌播放/删除，支持 MP4 / MOV / AVI / WebM
- 文件自动按类型分类存入 R2（路径：`uploads/{user_id}/{type}/{timestamp}_{filename}`）
- 上传后自动写入 `user_assets` 表，支持刷新与管理

### 生成历史（四标签页）
| 标签 | 内容 |
|------|------|
| 图片 | AI 生图记录，含灯箱预览、删除 |
| 语音 | 语音合成记录，含在线播放、删除 |
| 视频 | 视频生成记录，含播放、下载、删除 |
| **工作流** | SmartKit 历史，含展开预览（图+视频+语音）、打包下载、删除 |

### 图像理解（Image Understand）
- 上传图片并提问，AI 分析图片内容并返回文字描述
- 历史记录查询与管理（`/api/image-understand/history`）

### 语音转文字（Speech to Text）
- 上传音频文件，AI 自动转录为文字
- 历史记录查询与管理（`/api/speech-to-text/history`）

### 提示词优化（Prompt Optimizer）
- 输入原始提示词，AI 给出优化建议与改写结果
- 结合用户历史低分记录提供个性化优化方向
- 自动记录优化历史，支持复用（`/api/optimize-prompt`）

### 提示词建议（Prompt Suggestions）
- 根据使用场景智能推荐提示词（`/api/prompt-suggestions`）

### 内容评分与收藏
- 对 AI 生成内容进行 1–5 星评分，可附带文字反馈
- 支持收藏操作（`/api/rate`）

### 内容分享
- 生成可公开访问的分享链接（`/api/share`）
- 支持分享详情页 `/share/[token]`
- 我的分享管理页 `/dashboard/shares`

### 工作流模板
- 内置常用工作流模板，快速启动标准化流程（`/api/workflow-templates`）

### 系统健康监控
- 服务健康状态检查接口（`/api/health`）

### 独立功能（高级模式）
- **AI 生图**（单独使用）
- **AI 语音合成**（单独使用，2 积分/次）
- **AI 视频生成**（单独使用）

### 积分系统
- 通过 Stripe 购买积分（测试模式）
- 积分不足时自动拦截并提示
- 工作流失败时自动退款（按已完成步骤退）

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router, Turbopack) |
| 数据库 | Supabase (PostgreSQL + RLS) |
| 对象存储 | Cloudflare R2 |
| 支付 | Stripe |
| AI 生图 | SiliconFlow — Qwen/Qwen-Image |
| AI 视频 | MiniMax — MiniMax-Hailuo-02 |
| AI 语音合成 | SiliconFlow — CosyVoice2-0.5B |
| AI 语音转文字 | SiliconFlow |
| AI 图像理解 | SiliconFlow |
| AI 提示词优化 | SiliconFlow — Qwen2.5-72B-Instruct |
| UI | Tailwind CSS v4 + lucide-react |

## 本地开发

```bash
npm install
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

## 环境变量

复制 `.env.local` 并填入以下变量：

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
R2_ENDPOINT=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=
SILICONFLOW_API_KEY=
MINIMAX_API_KEY=              # MiniMax 国内开放平台 key（sk-api- 开头）
INTERNAL_API_SECRET=          # 随机字符串，用于内部 API 鉴权
```

## 数据库迁移

在 Supabase SQL Editor 中**按顺序**执行以下迁移文件：

```
supabase/migrations/001_credits_orders_speech.sql          # 积分/订单/语音表
supabase/migrations/002_add_missing_speech_columns.sql
supabase/migrations/003_workflows.sql                      # workflows 表 + RPC 函数
supabase/migrations/004_user_assets.sql                    # 素材库表
supabase/migrations/005_fix_credit_transactions.sql        # 补充 reason/ref_id 列
supabase/migrations/006_fix_credit_transactions_type.sql   # 补充 type 列 + 重建 RPC
supabase/migrations/007_fix_workflows_columns.sql          # 补充 workflows 缺失列
supabase/migrations/008_image_understand.sql               # 图像理解历史表
supabase/migrations/009_speech_to_text.sql                 # 语音转文字历史表
supabase/migrations/010_workflow_templates.sql             # 工作流模板表
supabase/migrations/011_ratings_favorites.sql              # 评分与收藏表
supabase/migrations/012_share_links.sql                    # 内容分享链接表
supabase/migrations/013_circuit_breaker_health.sql         # 熔断器/健康监控表
```

> 如果数据库是全新创建，按顺序执行 001–013 即可；如已有旧库，从缺失的迁移编号开始补执行。

## API 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/credits` | 查询积分余额 |
| POST | `/api/credits` | 扣除积分 |
| GET | `/api/assets` | 查询素材库（支持 ?type=image\|audio\|video） |
| DELETE | `/api/assets` | 删除素材（同步删除 R2 + DB） |
| POST | `/api/upload` | 上传文件（自动分类写入 user_assets） |
| POST | `/api/workflows` | 创建 SmartKit 工作流 |
| GET | `/api/workflows` | 查询工作流历史列表 |
| GET | `/api/workflows/[id]` | 查询工作流状态与进度 |
| DELETE | `/api/workflows/[id]` | 删除工作流记录 |
| POST | `/api/workflows/[id]/execute` | 内部执行流水线（需 Bearer secret）|
| GET | `/api/workflow-templates` | 获取工作流模板列表 |
| GET | `/api/generations` | 查询 AI 生图历史 |
| DELETE | `/api/generations` | 删除生图记录 |
| GET | `/api/speech/history` | 查询语音合成历史 |
| DELETE | `/api/speech/history` | 删除语音记录 |
| GET | `/api/video/history` | 查询视频生成历史 |
| DELETE | `/api/video/history` | 删除视频记录 |
| POST | `/api/image-understand` | 图像理解（上传图片+提问） |
| GET | `/api/image-understand/history` | 图像理解历史 |
| POST | `/api/speech-to-text` | 语音转文字 |
| GET | `/api/speech-to-text/history` | 语音转文字历史 |
| POST | `/api/optimize-prompt` | 提示词优化 |
| GET | `/api/prompt-suggestions` | 提示词建议 |
| POST | `/api/rate` | 内容评分/收藏 |
| POST | `/api/share` | 创建分享链接 |
| GET | `/api/share/[token]` | 获取分享内容 |
| GET | `/api/health` | 系统健康检查 |
| POST | `/api/generate` | 单独 AI 生图 |
| POST | `/api/generate-video` | 单独 AI 视频提交 |
| POST | `/api/generate-speech` | 单独 AI 语音合成 |
| GET | `/api/video-status` | 查询视频生成状态 |
| POST | `/api/stripe/checkout` | 创建 Stripe 结账会话 |
| POST | `/api/stripe/webhook` | Stripe 回调处理 |

## 注意事项

- MiniMax API Key 需使用**国内开放平台**（`api.minimax.chat`）的 key，格式为 `sk-api-...`
- `INTERNAL_API_SECRET` 用于保护 `/api/workflows/[id]/execute` 内部接口，请使用随机强密码
- Stripe 当前为测试模式，使用测试卡号 `4242 4242 4242 4242` 支付
- TypeScript 严格模式：Supabase 动态查询字段需通过 `as unknown as Record<string, unknown>` 转型
