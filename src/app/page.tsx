import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">
          多媒体智能应用平台
        </h1>
        <p className="text-xl text-slate-300">
          基于 Next.js + Supabase + Cloudflare R2 的 AI 多媒体处理平台
        </p>
        <div className="flex gap-4 justify-center mt-8">
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
          >
            开始体验
          </Link>
          <Link
            href="https://github.com/heraolh/media-ai-platform#readme"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-colors"
          >
            查看文档
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-3 gap-4 text-sm text-slate-400">
          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            🎨 图片生成
          </div>
          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            🎬 视频处理
          </div>
          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            🎵 语音合成
          </div>
        </div>
      </div>
    </main>
  );
}
