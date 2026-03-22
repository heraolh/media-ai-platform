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
import { ImageUnderstandPanel } from '@/components/ImageUnderstandPanel'
import { SpeechToTextPanel } from '@/components/SpeechToTextPanel'
import Link from 'next/link'
import { Zap, ExternalLink } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const email = (user as NonNullable<typeof user>).email

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">仪表盘</h1>
          <div className="flex items-center gap-3">
            <Link href="/dashboard/shares"
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg transition-colors">
              <ExternalLink className="w-4 h-4" />分享管理
            </Link>
            <Link href="/workflows/editor"
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-indigo-300 hover:text-white border border-indigo-700 hover:border-indigo-500 rounded-lg transition-colors">
              <Zap className="w-4 h-4" />工作流编辑器
            </Link>
            <LogoutButton />
          </div>
        </div>
        <p className="text-slate-300 mb-8">欢迎回来，{email}</p>

        <CreditSystem />
        <SmartKit />

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-slate-700" />
            <span className="text-sm font-medium text-slate-400 px-2">独立功能（高级模式）</span>
            <div className="flex-1 h-px bg-slate-700" />
          </div>

          <ImageGenerator />
          <SpeechGenerator />
          <VideoGenerator />

          {/* 图生文 */}
          <section className="mb-8 p-6 bg-slate-800 rounded-lg border border-slate-700">
            <h2 className="text-xl font-semibold mb-5 flex items-center gap-2">
              <span className="text-violet-400">■</span> 图片理解（图生文）
            </h2>
            <ImageUnderstandPanel />
          </section>

          {/* 语音转文字 */}
          <section className="mb-8 p-6 bg-slate-800 rounded-lg border border-slate-700">
            <h2 className="text-xl font-semibold mb-5 flex items-center gap-2">
              <span className="text-teal-400">■</span> 语音转文字（STT）
            </h2>
            <SpeechToTextPanel />
          </section>

          <UnifiedHistory />
          <MyAssets />
        </div>
      </div>
    </div>
  )
}
