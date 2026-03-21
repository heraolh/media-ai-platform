"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  ImageIcon, Mic, Film, Trash2, RefreshCw, Clock,
  Play, Pause, Download, ChevronDown, ChevronUp,
  Loader2, AlertCircle, ExternalLink,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────
interface Generation {
  id: string;
  prompt: string;
  image_url: string;
  created_at: string;
}

interface SpeechRecord {
  id: string;
  text: string;
  voice: string | null;
  voice_id: string | null;
  audio_url: string | null;
  storage_path: string | null;
  created_at: string;
}

interface VideoRecord {
  id: string;
  prompt: string;
  status: string;
  video_url: string | null;
  task_id: string | null;
  error_msg: string | null;
  created_at: string;
}

type Tab = "image" | "speech" | "video";

// ─── Helpers ─────────────────────────────────────────────────
function formatDate(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const VOICE_LABELS: Record<string, string> = {
  alex: "Alex（男声）",
  anna: "Anna（女声）",
  jenny: "Jenny（女声·英文）",
};

const VIDEO_STATUS: Record<string, { label: string; color: string }> = {
  pending:    { label: "等待中", color: "text-slate-400" },
  processing: { label: "生成中", color: "text-blue-400" },
  success:    { label: "已完成", color: "text-green-400" },
  failed:     { label: "失败",   color: "text-red-400" },
};

function friendlyErr(msg: string | null): string {
  if (!msg) return "视频生成失败，请重试";
  const m = msg.toLowerCase();
  if (m.includes("task_id") || m.includes("no task")) return "视频服务繁忙，请稍后重试";
  if (m.includes("timeout") || m.includes("超时")) return "生成超时，请重试";
  if (m.includes("content") || m.includes("audit") || m.includes("审核")) return "内容审核未通过";
  if (m.includes("credit") || m.includes("积分")) return "积分不足，请充值后重试";
  if (m.includes("key") || m.includes("auth") || m.includes("unauthorized")) return "服务配置异常";
  return "视频生成失败，请重试";
}

// ─── Confirm Dialog ────────────────────────────────
function ConfirmDialog({ message, onConfirm, onCancel, loading }: {
  message: string; onConfirm: () => void; onCancel: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-6 max-w-sm w-full">
        <p className="text-sm text-slate-200 mb-5 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={loading} className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors disabled:opacity-50">
            取消
          </button>
          <button onClick={onConfirm} disabled={loading} className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            确认删除
          </button>
        </div>
      </div>
    </div>
  );
}
// ─── Image Panel ─────────────────────────────────────────────
function ImagePanel() {
  const [items, setItems] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const fetch$ = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/generations");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "获取失败");
      setItems(data.generations ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "获取失败");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch$(); }, [fetch$]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/generations?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "删除失败");
      setItems(prev => prev.filter(g => g.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    } finally { setDeletingId(null); setConfirmDeleteId(null); }
  }

  return (
    <div>
      {confirmDeleteId && (
        <ConfirmDialog
          message="确定要删除这张图片吗？此操作不可撤销。"
          onConfirm={() => handleDelete(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
          loading={deletingId === confirmDeleteId}
        />
      )}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-slate-400">{items.length} 张图片</span>
        <button onClick={fetch$} disabled={loading} title="刷新"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">{error}</div>}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(n => (
            <div key={n} className="rounded-lg bg-slate-700/50 border border-slate-700 overflow-hidden animate-pulse">
              <div className="w-full h-[180px] bg-slate-700" />
              <div className="p-3 space-y-2"><div className="h-3 bg-slate-700 rounded w-3/4" /><div className="h-3 bg-slate-700 rounded w-1/2" /></div>
            </div>
          ))}
        </div>
      )}
      {!loading && items.length === 0 && !error && (
        <div className="text-center py-16 text-slate-400">
          <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>暂无图片记录，快去生成吧！</p>
        </div>
      )}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(g => (
            <div key={g.id} className="group rounded-lg bg-slate-900/50 border border-slate-700 overflow-hidden flex flex-col hover:border-slate-500 transition-colors">
              <button className="block w-full overflow-hidden bg-slate-950 relative" onClick={() => setLightboxUrl(g.image_url)} title="点击查看大图">
                <img src={g.image_url} alt={g.prompt} className="w-full object-cover transition-transform duration-300 group-hover:scale-105" style={{ height: "180px" }} />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-white bg-black/60 px-2 py-1 rounded">查看大图</span>
                </div>
              </button>
              <div className="p-3 flex flex-col gap-2 flex-1">
                <p className="text-sm text-slate-200 leading-snug line-clamp-2" title={g.prompt}>{g.prompt}</p>
                <div className="flex items-center gap-1 text-xs text-slate-500 mt-auto">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  <span>{formatDate(g.created_at)}</span>
                </div>
              </div>
              <div className="px-3 pb-3">
                <button onClick={() => setConfirmDeleteId(g.id)} disabled={deletingId === g.id}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-slate-700 hover:border-red-500/40 rounded-lg transition-colors disabled:opacity-50">
                  <Trash2 className="w-3.5 h-3.5" />
                  {deletingId === g.id ? "删除中..." : "删除"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {lightboxUrl && (
        <dialog open className="fixed inset-0 z-50 w-full h-full bg-black/80 flex items-center justify-center p-4 m-0 max-w-none max-h-none border-0" onClick={() => setLightboxUrl(null)}>
          <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <img src={lightboxUrl} alt="大图预览" className="w-full rounded-xl shadow-2xl max-h-[85vh] object-contain" />
            <button onClick={() => setLightboxUrl(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full flex items-center justify-center text-slate-300 hover:text-white transition-colors font-bold">✕</button>
          </div>
        </dialog>
      )}
    </div>
  );
}

// ─── Speech Panel ────────────────────────────────────────────
function SpeechPanel() {
  const [items, setItems] = useState<SpeechRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  const fetch$ = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/speech/history");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "获取失败");
      setItems(data.history ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "获取失败");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch$(); }, [fetch$]);

  function togglePlay(record: SpeechRecord) {
    if (!record.audio_url) return;
    Object.entries(audioRefs.current).forEach(([id, audio]) => {
      if (id !== record.id) { audio.pause(); audio.currentTime = 0; }
    });
    if (playingId === record.id) {
      audioRefs.current[record.id]?.pause();
      setPlayingId(null);
      return;
    }
    if (!audioRefs.current[record.id]) {
      const audio = new Audio(record.audio_url);
      audio.onended = () => setPlayingId(null);
      audioRefs.current[record.id] = audio;
    }
    audioRefs.current[record.id].play();
    setPlayingId(record.id);
  }

  async function handleDelete(id: string) {
    if (audioRefs.current[id]) { audioRefs.current[id].pause(); delete audioRefs.current[id]; }
    if (playingId === id) setPlayingId(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/speech/history?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "删除失败");
      setItems(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    } finally { setDeletingId(null); setConfirmDeleteId(null); }
  }

  const voiceLabel = (r: SpeechRecord) =>
    VOICE_LABELS[r.voice || r.voice_id || ""] || r.voice || r.voice_id || "未知音色";

  return (
    <div>
      {confirmDeleteId && (
        <ConfirmDialog
          message="确定要删除这条语音吗？此操作不可撤销。"
          onConfirm={() => handleDelete(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
          loading={deletingId === confirmDeleteId}
        />
      )}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-slate-400">{items.length} 条语音</span>
        <button onClick={fetch$} disabled={loading} title="刷新"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">{error}</div>}
      {loading && (
        <div className="space-y-2">
          {[1,2,3].map(n => <div key={n} className="h-16 bg-slate-700/50 rounded-lg animate-pulse" />)}
        </div>
      )}
      {!loading && items.length === 0 && !error && (
        <div className="text-center py-16 text-slate-400">
          <Mic className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>暂无语音记录，快去合成吧！</p>
        </div>
      )}
      {!loading && items.length > 0 && (
        <div className="space-y-2">
          {items.map(record => (
            <div key={record.id} className="flex items-center gap-3 p-3 bg-slate-900/50 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors">
              <button onClick={() => togglePlay(record)} disabled={!record.audio_url}
                className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                  record.audio_url ? "bg-purple-600 hover:bg-purple-500" : "bg-slate-700 opacity-50 cursor-not-allowed"
                }`}>
                {playingId === record.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 truncate" title={record.text}>
                  {record.text.length > 50 ? record.text.slice(0, 50) + "..." : record.text}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-purple-400 flex items-center gap-1">
                    <Mic className="w-3 h-3" />{voiceLabel(record)}
                  </span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />{formatDate(record.created_at)}
                  </span>
                </div>
              </div>
              <button onClick={() => setConfirmDeleteId(record.id)} disabled={deletingId === record.id}
                className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-slate-700 hover:border-red-500/40 rounded-lg transition-colors disabled:opacity-50">
                <Trash2 className="w-3.5 h-3.5" />
                {deletingId === record.id ? "删除中..." : "删除"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
// ─── Video Panel ─────────────────────────────────────────────
function VideoPanel() {
  const [items, setItems] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [videoErrors, setVideoErrors] = useState<Record<string, boolean>>({});

  const fetch$ = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/video/history");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "获取失败");
      setItems(data.history ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "获取失败");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch$(); }, [fetch$]);

  async function handleDelete(id: string) {
    if (expandedId === id) setExpandedId(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/video/history?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "删除失败");
      setItems(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    } finally { setDeletingId(null); setConfirmDeleteId(null); }
  }

  function downloadVideo(record: VideoRecord) {
    if (!record.video_url) return;
    const a = document.createElement("a");
    a.href = record.video_url;
    a.download = `video-${record.id}.mp4`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <div>
      {confirmDeleteId && (
        <ConfirmDialog
          message="确定要删除这条视频记录吗？此操作不可撤销。"
          onConfirm={() => handleDelete(confirmDeleteId)}
          onCancel={() => setConfirmDeleteId(null)}
          loading={deletingId === confirmDeleteId}
        />
      )}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-slate-400">{items.length} 条视频</span>
        <button onClick={fetch$} disabled={loading} title="刷新"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>
      {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">{error}</div>}
      {loading && (
        <div className="space-y-2">
          {[1,2,3].map(n => <div key={n} className="h-[68px] bg-slate-700/50 rounded-lg animate-pulse" />)}
        </div>
      )}
      {!loading && items.length === 0 && !error && (
        <div className="text-center py-16 text-slate-400">
          <Film className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>暂无视频记录，快去生成吧！</p>
        </div>
      )}
      {!loading && items.length > 0 && (
        <div className="space-y-2">
          {items.map(record => {
            const st = VIDEO_STATUS[record.status] ?? { label: record.status, color: "text-slate-400" };
            const isSuccess = record.status === "success";
            const isProcessing = record.status === "processing" || record.status === "pending";
            const isFailed = record.status === "failed";
            const isExpanded = expandedId === record.id;
            return (
              <div key={record.id} className="bg-slate-900/50 border border-slate-700 rounded-lg overflow-hidden hover:border-slate-600 transition-colors">
                <div className="flex items-center gap-3 px-3" style={{ height: 68 }}>
                  <div className="flex-shrink-0 w-6 flex items-center justify-center">
                    {isProcessing && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
                    {isSuccess && <Play className="w-4 h-4 text-green-400" />}
                    {isFailed && <AlertCircle className="w-4 h-4 text-red-400" />}
                    {!isProcessing && !isSuccess && !isFailed && <Film className="w-4 h-4 text-slate-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate" title={record.prompt}>{record.prompt}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
                      <span className="text-xs text-slate-500">{formatDate(record.created_at)}</span>
                      {isFailed && <span className="text-xs text-red-400">· {friendlyErr(record.error_msg)}</span>}
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-1">
                    {isSuccess && record.video_url && (
                      <button onClick={() => setExpandedId(isExpanded ? null : record.id)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700 rounded transition-colors">
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {isExpanded ? "收起" : "播放"}
                      </button>
                    )}
                    <button onClick={() => setConfirmDeleteId(record.id)} disabled={deletingId === record.id}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-slate-700 hover:border-red-500/40 rounded transition-colors disabled:opacity-50">
                      <Trash2 className="w-3.5 h-3.5" />
                      {deletingId === record.id ? "删除中..." : "删除"}
                    </button>
                  </div>
                </div>
                {isExpanded && isSuccess && record.video_url && (
                  <div className="border-t border-slate-700 p-3 space-y-2 bg-slate-950/30">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    {videoErrors[record.id] ? (
                      <div className="w-full rounded-lg bg-slate-900 border border-slate-700 p-6 text-center space-y-3">
                        <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                        <p className="text-sm text-slate-400">视频链接已过期，请尝试在新窗口打开</p>
                        <a href={record.video_url ?? ''}
                          target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-400 hover:text-blue-300 border border-blue-500/40 rounded-lg transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          在新窗口打开
                        </a>
                      </div>
                    ) : (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <video controls autoPlay src={record.video_url ?? ''}
                        className="w-full rounded-lg max-h-[300px] bg-black"
                        onError={() => setVideoErrors(prev => ({ ...prev, [record.id]: true }))}
                      />
                    )}
                    <button onClick={() => downloadVideo(record)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors">
                      <Download className="w-3.5 h-3.5" />下载视频
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
// ─── Main Export ─────────────────────────────────────────────
export function UnifiedHistory() {
  const [activeTab, setActiveTab] = useState<Tab>("image");

  const tabs: { id: Tab; label: string; icon: React.ReactNode; badgeCls: string }[] = [
    { id: "image",  label: "图片", icon: <ImageIcon className="w-4 h-4" />, badgeCls: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
    { id: "speech", label: "语音", icon: <Mic className="w-4 h-4" />,      badgeCls: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
    { id: "video",  label: "视频", icon: <Film className="w-4 h-4" />,     badgeCls: "bg-red-500/20 text-red-300 border-red-500/30" },
  ];

  return (
    <section className="mb-8 p-6 bg-slate-800 rounded-lg border border-slate-700">
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <h2 className="text-xl font-semibold">生成历史</h2>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-5 bg-slate-900/50 p-1 rounded-lg border border-slate-700">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-slate-700 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
            }`}
          >
            {tab.icon}
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded border ${tab.badgeCls}`}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* Panel */}
      {activeTab === "image"  && <ImagePanel />}
      {activeTab === "speech" && <SpeechPanel />}
      {activeTab === "video"  && <VideoPanel />}
    </section>
  );
}
