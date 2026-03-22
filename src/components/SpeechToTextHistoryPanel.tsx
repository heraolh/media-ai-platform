"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { Trash2, RefreshCw, Clock, Loader2, FileText, Copy, Check, Play, Pause } from "lucide-react";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function ConfirmDialog({ message, onConfirm, onCancel, loading }: { message: string; onConfirm: () => void; onCancel: () => void; loading: boolean; }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl p-6 max-w-sm w-full">
        <p className="text-sm text-slate-200 mb-5 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={loading} className="px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-600 rounded-lg transition-colors disabled:opacity-50">取消</button>
          <button onClick={onConfirm} disabled={loading} className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-500 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2">
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}确认删除
          </button>
        </div>
      </div>
    </div>
  );
}
interface SpeechToTextRecord { id: string; audio_url: string; audio_filename: string | null; transcript: string | null; file_size_mb: number | null; status: string; created_at: string; }
export function SpeechToTextHistoryPanel() {
  const [items, setItems] = useState<SpeechToTextRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/speech-to-text/history");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "获取失败");
      setItems(data.history ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "获取失败"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  function togglePlay(r: SpeechToTextRecord) {
    Object.entries(audioRefs.current).forEach(([id, audio]) => { if (id !== r.id) { audio.pause(); audio.currentTime = 0; } });
    if (playingId === r.id) { audioRefs.current[r.id]?.pause(); setPlayingId(null); return; }
    if (!audioRefs.current[r.id]) { const audio = new Audio(r.audio_url); audio.onended = () => setPlayingId(null); audioRefs.current[r.id] = audio; }
    audioRefs.current[r.id].play(); setPlayingId(r.id);
  }
  async function handleDelete(id: string) {
    if (audioRefs.current[id]) { audioRefs.current[id].pause(); delete audioRefs.current[id]; }
    if (playingId === id) setPlayingId(null);
    setDeletingId(id);
    try {
      const res = await fetch(`/api/speech-to-text/history?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "删除失败");
      setItems(prev => prev.filter(r => r.id !== id));
    } catch (e) { setError(e instanceof Error ? e.message : "删除失败"); }
    finally { setDeletingId(null); setConfirmDeleteId(null); }
  }
  async function handleCopy(text: string, id: string) {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id); setTimeout(() => setCopiedId(null), 2000);
  }
  function exportTxt(r: SpeechToTextRecord) {
    if (!r.transcript) return;
    const blob = new Blob([r.transcript], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `transcript-${r.id.slice(0, 8)}.txt`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }
  return (
    <div>
      {confirmDeleteId && <ConfirmDialog message="确定要删除这条语音转文字记录吗？" onConfirm={() => handleDelete(confirmDeleteId)} onCancel={() => setConfirmDeleteId(null)} loading={deletingId === confirmDeleteId} />}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-slate-400">{items.length} 条记录</span>
        <button onClick={load} disabled={loading} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></button>
      </div>
      {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">{error}</div>}
      {loading && <div className="space-y-2">{[1,2,3].map(n => <div key={n} className="h-20 bg-slate-700/50 rounded-lg animate-pulse" />)}</div>}
      {!loading && items.length === 0 && !error && (<div className="text-center py-16 text-slate-400"><FileText className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>暂无语音转文字记录</p></div>)}
      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map(r => {
            const isExpanded = expandedId === r.id;
            return (
              <div key={r.id} className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden hover:border-slate-600 transition-colors">
                <div className="flex items-start gap-3 p-3">
                  <button onClick={() => togglePlay(r)} className="flex-shrink-0 w-10 h-10 rounded-full bg-teal-600 hover:bg-teal-500 flex items-center justify-center transition-colors mt-0.5">
                    {playingId === r.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-teal-400 truncate mb-1">{r.audio_filename ?? "音频文件"}{r.file_size_mb ? ` · ${r.file_size_mb.toFixed(1)}MB` : ""}</p>
                    <p className={`text-sm text-slate-200 leading-relaxed ${isExpanded ? "" : "line-clamp-2"}`}>{r.transcript ?? (r.status === "failed" ? "转写失败" : "处理中...")}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-xs text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(r.created_at)}</span>
                      {r.transcript && r.transcript.length > 80 && (<button onClick={() => setExpandedId(isExpanded ? null : r.id)} className="text-xs text-teal-400 hover:text-teal-300 transition-colors">{isExpanded ? "收起" : "展开全文"}</button>)}
                      {r.transcript && (<button onClick={() => exportTxt(r)} className="text-xs text-slate-400 hover:text-white transition-colors">导出 TXT</button>)}
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex flex-col gap-1">
                    {r.transcript && (<button onClick={() => handleCopy(r.transcript!, r.id)} className="p-1.5 text-slate-500 hover:text-white transition-colors">{copiedId === r.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}</button>)}
                    <button onClick={() => setConfirmDeleteId(r.id)} disabled={deletingId === r.id} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
