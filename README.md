# Media AI Platform

基于 Next.js 16 构建的 AI 媒体生成平台，集成图片、视频、语音三大 AI 能力，支持积分购买与消费。

## 功能模块

### SmartKit 智能营销套件（62 积分/次）
一键完成三步流水线，自动打包下载：
1. **AI 生图** — SiliconFlow `Qwen/Qwen-Image` 文生图
2. **图生视频** — MiniMax `MiniMax-Hailuo-02`，以生成图片作为首帧
3. **语音合成** — SiliconFlow `CosyVoice2-0.5B`，朗读产品描述

### 独立功能（高级模式）
- **AI 生图**（单独使用）
- **AI 语音合成**（单独使用，2 积分/次）
- **AI 视频生成**（单独使用）
- **文件上传**
- **生成历史**（图片 / 语音 / 视频统一查看）

### 积分系统
- 通过 Stripe 购买积分（测试模式）
- 积分不足时自动拦截并提示
- 工作流失败时自动退款

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) |
| 数据库 | Supabase (PostgreSQL + RLS) |
| 对象存储 | Cloudflare R2 |
| 支付 | Stripe |
| AI 生图 | SiliconFlow — Qwen/Qwen-Image |
| AI 视频 | MiniMax — MiniMax-Hailuo-02 |
| AI 语音 | SiliconFlow — CosyVoice2-0.5B |
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
MINIMAX_API_KEY=
INTERNAL_API_SECRET=          # 随机字符串，用于内部 API 鉴权
```

## 数据库迁移

在 Supabase SQL Editor 中按顺序执行：

```
supabase/migrations/001_credits_orders_speech.sql
supabase/migrations/002_add_missing_speech_columns.sql
supabase/migrations/003_workflows.sql   # workflows 表 + RPC 函数
```

## API 路由

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/credits` | 查询积分余额 |
| POST | `/api/credits` | 扣除积分 |
| POST | `/api/workflows` | 创建 SmartKit 工作流 |
| GET | `/api/workflows/[id]` | 查询工作流状态与进度 |
| POST | `/api/workflows/[id]/execute` | 内部执行流水线（需 Bearer secret）|
| POST | `/api/generate` | 单独 AI 生图 |
| POST | `/api/generate-video` | 单独 AI 视频提交 |
| POST | `/api/generate-speech` | 单独 AI 语音合成 |
| POST | `/api/stripe/checkout` | 创建 Stripe 结账会话 |
| POST | `/api/stripe/webhook` | Stripe 回调处理 |
