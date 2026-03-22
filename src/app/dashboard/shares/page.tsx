"use client";

import { useState, useCallback, useEffect } from "react";
import { Eye, Image as ImageIcon, Mic, Film, Layers, Copy, Check, Trash2, ExternalLink, RefreshCw, Clock } from "lucide-react";
import { redirect } from "next/navigation";

interface ShareLink {
  id: string;
  content_type: string;
  content_id: string;
  token: string;
  expires_at: string;
  view_count: number;
  created_at: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  image: <ImageIcon className="w-4 h-4" />,
  video: <Film className="w-4 h-4" />,
  speech: <Mic className="w-4 h-4" />,
  workflow: <Layers className="w-4 h-4" />,
  image_understand: <ImageIcon className="w-4 h-4" />,
  speech_to_text: <Mic className="w-4 h-4" />,
};

const TYPE_LABELS: Record<string, string> = {
  image: "图片", video: "视频", speech: "语音",
  workflow: "工作流", image_understand: "图片理解", speech_to_text: "语音转文字",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function getExpiresIn(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "已过期";
  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

export default function SharesPage() {
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/share");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "获取失败");
      setShares(data.shares ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "获取失败");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/share?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "删除失败");
      setShares(prev => prev.filter(s => s.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    } finally { setDeletingId(null); }
  }

  async function handleCopy(token: string, id: string) {
    const url = `${location.origin}/share/${token}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">分享管理</h1>
            <p className="text-slate-400 text-sm mt-1">管理您创建的所有分享链接</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => window.history.back()}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg transition-colors">
              返回
            </button>
            <button onClick={load} disabled={loading}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors disabled:opacity-50">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {error && <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">{error}</div>}

        {loading && <div className="space-y-3">{[1,2,3].map(n => <div key={n} className="h-16 bg-slate-700/50 rounded-xl animate-pulse" />)}</div>}

        {!loading && shares.length === 0 && !error && (
          <div className="text-center py-20 text-slate-500">
            <ExternalLink className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p>暂无分享链接</p>
          </div>
        )}

        {!loading && shares.length > 0 && (
          <div className="space-y-3">
            {shares.map(share => {
              const expired = new Date(share.expires_at) < new Date();
              return (
                <div key={share.id} className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${
                  expired ? "bg-slate-900/30 border-slate-800 opacity-60" : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                }`}>
                  <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center border ${
                    expired ? "bg-slate-800 border-slate-700 text-slate-500" : "bg-indigo-500/20 border-indigo-500/30 text-indigo-400"
                  }`}>
                    {TYPE_ICONS[share.content_type] ?? <ExternalLink className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-200">{TYPE_LABELS[share.content_type] ?? share.content_type}</span>
                      {expired && <span className="text-xs px-1.5 py-0.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded">已过期</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                      <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{share.view_count}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{expired ? "已过期" : getExpiresIn(share.expires_at)}</span>
                      <span>{formatDate(share.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-1.5">
                    {!expired && (
                      <a href={`/share/${share.token}`} target="_blank" rel="noopener noreferrer"
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button onClick={() => handleCopy(share.token, share.id)}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
                      {copiedId === share.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button onClick={() => handleDelete(share.id)} disabled={deletingId === share.id}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
