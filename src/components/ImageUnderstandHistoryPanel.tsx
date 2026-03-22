"use client";
import { useEffect, useState, useCallback } from "react";
import { Trash2, RefreshCw, Clock, Loader2, Eye, Copy, Check } from "lucide-react";

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
interface ImageUnderstandRecord { id: string; input_image_url: string; prompt: string; result_text: string | null; status: string; created_at: string; }
export function ImageUnderstandHistoryPanel() {
  const [items, setItems] = useState<ImageUnderstandRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/image-understand/history");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "获取失败");
      setItems(data.history ?? []);
    } catch (e) { setError(e instanceof Error ? e.message : "获取失败"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/image-understand/history?id=${encodeURIComponent(id)}`, { method: "DELETE" });
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
  return (
    <div>
      {confirmDeleteId && <ConfirmDialog message="确定要删除这条图片理解记录吗？" onConfirm={() => handleDelete(confirmDeleteId)} onCancel={() => setConfirmDeleteId(null)} loading={deletingId === confirmDeleteId} />}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-slate-400">{items.length} 条记录</span>
        <button onClick={load} disabled={loading} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /></button>
      </div>
      {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">{error}</div>}
      {loading && <div className="space-y-2">{[1,2,3].map(n => <div key={n} className="h-20 bg-slate-700/50 rounded-lg animate-pulse" />)}</div>}
      {!loading && items.length === 0 && !error && (<div className="text-center py-16 text-slate-400"><Eye className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>暂无图片理解记录</p></div>)}
      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map(r => {
            const isExpanded = expandedId === r.id;
            return (
              <div key={r.id} className="bg-slate-900/50 border border-slate-700 rounded-xl overflow-hidden hover:border-slate-600 transition-colors">
                <div className="flex items-start gap-3 p-3">
                  <img src={r.input_image_url} alt="" className="w-16 h-16 object-cover rounded-lg flex-shrink-0 border border-slate-700" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-violet-400 truncate mb-1">{r.prompt}</p>
                    <p className={`text-sm text-slate-200 leading-relaxed ${isExpanded ? "" : "line-clamp-2"}`}>{r.result_text ?? (r.status === "failed" ? "分析失败" : "处理中...")}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-xs text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(r.created_at)}</span>
                      {r.result_text && r.result_text.length > 80 && (<button onClick={() => setExpandedId(isExpanded ? null : r.id)} className="text-xs text-violet-400 hover:text-violet-300 transition-colors">{isExpanded ? "收起" : "展开全文"}</button>)}
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex flex-col gap-1">
                    {r.result_text && (<button onClick={() => handleCopy(r.result_text!, r.id)} className="p-1.5 text-slate-500 hover:text-white transition-colors">{copiedId === r.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}</button>)}
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
