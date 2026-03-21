import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FileUpload } from '@/components/FileUpload'
import { ImageGenerator } from '@/components/ImageGenerator'
import { SpeechGenerator } from '@/components/SpeechGenerator'
import { VideoGenerator } from '@/components/VideoGenerator'
import { UnifiedHistory } from '@/components/UnifiedHistory'
import { CreditSystem } from '@/components/CreditSystem'
import { LogoutButton } from '@/components/LogoutButton'

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

        {/* AI 生图 */}
        <ImageGenerator />

        {/* AI 语音 */}
        <SpeechGenerator />

        {/* AI 视频 */}
        <VideoGenerator />

        {/* 生成历史（图片 / 语音 / 视频统一标签页） */}
        <UnifiedHistory />

        {/* 文件上传 */}
        <div className="mb-8 p-6 bg-slate-800 rounded-lg border border-slate-700">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span>📁</span> 文件上传
          </h2>
          <FileUpload />
        </div>
      </div>
    </div>
  )
}
