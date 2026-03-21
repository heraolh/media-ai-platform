import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FileUpload } from '@/components/FileUpload'
import { ImageGenerator } from '@/components/ImageGenerator'
import { GenerationHistory } from '@/components/GenerationHistory'
import { SpeechGenerator } from '@/components/SpeechGenerator'
import { SpeechHistory } from '@/components/SpeechHistory'
import { VideoGenerator } from '@/components/VideoGenerator'
import { CreditSystem } from '@/components/CreditSystem'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">仪表盘</h1>
        <p className="text-slate-300 mb-8">欢迎回来，{user.email}</p>

        {/* 积分系统 */}
        <CreditSystem />

        {/* 天文生图（图片生成） */}
        <ImageGenerator />

        {/* 语音合成 */}
        <SpeechGenerator />

        {/* 语音历史 */}
        <SpeechHistory />

        {/* 视频生成 */}
        <VideoGenerator />

        {/* 生成历史 */}
        <GenerationHistory />

        {/* 文件上传区域 */}
        <div className="mb-8 p-6 bg-slate-800 rounded-lg border border-slate-700">
          <h2 className="text-xl font-semibold mb-4">📁 文件上传</h2>
          <FileUpload />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
            <h3 className="text-lg font-semibold mb-2">🎨 图片生成</h3>
            <p className="text-sm text-slate-400">使用 AI 生成图片</p>
          </div>
          <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
            <h3 className="text-lg font-semibold mb-2">🎬 视频处理</h3>
            <p className="text-sm text-slate-400">视频生成与编辑</p>
          </div>
          <div className="p-6 bg-slate-800 rounded-lg border border-slate-700">
            <h3 className="text-lg font-semibold mb-2">🎵 语音合成</h3>
            <p className="text-sm text-slate-400">文本转语音</p>
          </div>
        </div>
      </div>
    </div>
  )
}

