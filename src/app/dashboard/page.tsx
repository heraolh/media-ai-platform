import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MyAssets } from '@/components/MyAssets'
import { ImageGenerator } from '@/components/ImageGenerator'
import { SpeechGenerator } from '@/components/SpeechGenerator'
import { VideoGenerator } from '@/components/VideoGenerator'
import { UnifiedHistory } from '@/components/UnifiedHistory'
import { CreditSystem } from '@/components/CreditSystem'
import { LogoutButton } from '@/components/LogoutButton'
import { SmartKit } from '@/components/SmartKit'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const email = (user as NonNullable<typeof user>).email

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">仪表盘</h1>
          <LogoutButton />
        </div>
        <p className="text-slate-300 mb-8">欢迎回来，{email}</p>

        {/* 积分系统 */}
        <CreditSystem />

        {/* SmartKit 智能营销套件 */}
        <SmartKit />

        {/* 独立功能（高级模式） */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-slate-700" />
            <span className="text-sm font-medium text-slate-400 px-2">独立功能（高级模式）</span>
            <div className="flex-1 h-px bg-slate-700" />
          </div>

          {/* AI 生图 */}
          <ImageGenerator />

          {/* AI 语音 */}
          <SpeechGenerator />

          {/* AI 视频 */}
          <VideoGenerator />

          {/* 生成历史（图片 / 语音 / 视频统一标签页） */}
          <UnifiedHistory />

          {/* 我的素材库 */}
          <MyAssets />
        </div>
      </div>
    </div>
  )
}
