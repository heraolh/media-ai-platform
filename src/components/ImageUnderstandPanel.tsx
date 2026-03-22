"use client";

import { useState, useCallback, useEffect } from "react";
import { ImageIcon, Copy, Check, RefreshCw, Trash2, Clock, Loader2, Sparkles } from "lucide-react";

interface Asset {
  id: string; name: string; url: string;
}

interface HistoryItem {
  id: string; input_image_url: string; prompt: string;
  result_text: string | null; status: string; created_at: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function ImageUnderstandPanel() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [prompt, setPrompt] = useState("描述这张图片的产品特点、颜色和构图");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [histLoading, setHistLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    setAssetsLoading(true);
    try {
      const res = await fetch("/api/assets?type=image");
      const data = await res.json();
      setAssets(data.assets ?? []);
    } catch { /* ignore */ } finally { setAssetsLoading(false); }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const res = await fetch("/api/image-understand/history");
      const data = await res.json();
      setHistory(data.history ?? []);
    } catch { /* ignore */ } finally { setHistLoading(false); }
  }, []);

  useEffect(() => { loadAssets(); loadHistory(); }, [loadAssets, loadHistory]);

  async function handleAnalyze() {
    if (!selectedAsset) return;
    setLoading(true); setError(null); setResult(null);
    try {
      const res = await fetch("/api/image-understand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: selectedAsset.url, prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "分析失败");
      setResult(data.result_text);
      loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "分析失败");
    } finally { setLoading(false); }
  }

  async function handleCopy() {
    if (!result) return;
    await navigator.clipboard.writeText(result).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/image-understand/history?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) setHistory(prev => prev.filter(h => h.id !== id));
    } catch { /* ignore */ } finally { setDeletingId(null); }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: asset selector */}
        <div className="lg:col-span-1 bg-slate-900/50 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-slate-300">选择图片</p>
              {selectedAsset && (
                <button onClick={() => setSelectedAsset(null)} className="text-xs text-slate-500 hover:text-white transition-colors px-1.5 py-0.5 rounded bg-slate-700/50 hover:bg-slate-700">✕ 取消选择</button>
              )}
            </div>
            <button onClick={loadAssets} disabled={assetsLoading} className="p-1 text-slate-400 hover:text-white transition-colors disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${assetsLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
          {assetsLoading && <div className="grid grid-cols-2 gap-2">{[1,2,3,4].map(n => <div key={n} className="aspect-square rounded-lg bg-slate-700/50 animate-pulse" />)}</div>}
          {!assetsLoading && assets.length === 0 && (
            <div className="text-center py-8 text-slate-500"><ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-xs">素材库暂无图片</p></div>
          )}
          {!assetsLoading && assets.length > 0 && (
            <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
              {assets.map(a => (
                <button key={a.id} onClick={() => setSelectedAsset(a)}
                  className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                    selectedAsset?.id === a.id ? "border-violet-500 ring-2 ring-violet-500/30" : "border-slate-700 hover:border-slate-500"
                  }`}>
                  <img src={a.url} alt={a.name} className="w-full aspect-square object-cover" />
                  {selectedAsset?.id === a.id && (
                    <div className="absolute inset-0 bg-violet-500/20 flex items-center justify-center">
                      <Check className="w-5 h-5 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Middle: prompt + button */}
        <div className="lg:col-span-1 flex flex-col gap-3">
          <p className="text-sm font-medium text-slate-300">分析提示</p>
          <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={5}
            className="w-full rounded-xl bg-slate-950/60 border border-slate-700 focus:border-violet-500 px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none resize-none transition-colors text-sm"
            placeholder="输入分析提示词..."
          />
          {selectedAsset && (
            <div className="rounded-lg overflow-hidden border border-slate-700">
              <img src={selectedAsset.url} alt={selectedAsset.name} className="w-full h-28 object-cover" />
            </div>
          )}
          <button onClick={handleAnalyze} disabled={!selectedAsset || loading || !prompt.trim()}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />分析中...</> : <><Sparkles className="w-4 h-4" />开始分析（3积分）</>}
          </button>
          {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">{error}</div>}
        </div>

        {/* Right: result */}
        <div className="lg:col-span-1 bg-slate-900/50 rounded-xl border border-slate-700 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-300">分析结果</p>
            {result && (
              <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "已复制" : "复制"}
              </button>
            )}
          </div>
          {loading && <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-violet-400" /></div>}
          {!loading && result && (
            <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{result}</p>
          )}
          {!loading && !result && (
            <div className="flex-1 flex items-center justify-center text-slate-600 text-sm text-center">
              <p>选择图片并输入提示词，点击"开始分析"</p>
            </div>
          )}
        </div>
      </div>

      {/* History */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-slate-300">历史记录</p>
          <button onClick={loadHistory} disabled={histLoading} className="p-1 text-slate-400 hover:text-white transition-colors disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${histLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
        {histLoading && <div className="space-y-2">{[1,2].map(n => <div key={n} className="h-16 bg-slate-700/50 rounded-lg animate-pulse" />)}</div>}
        {!histLoading && history.length === 0 && <p className="text-sm text-slate-500 text-center py-8">暂无历史记录</p>}
        {!histLoading && history.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {history.map(h => (
              <div key={h.id} className="flex gap-3 p-3 bg-slate-900/50 border border-slate-700 rounded-xl hover:border-slate-600 transition-colors">
                <img src={h.input_image_url} alt="" className="w-14 h-14 object-cover rounded-lg flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-400 truncate">{h.prompt.slice(0, 20)}{h.prompt.length > 20 ? "..." : ""}</p>
                  <p className="text-sm text-slate-200 mt-1 line-clamp-2">{h.result_text ?? "处理中..."}</p>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-1"><Clock className="w-3 h-3" />{formatDate(h.created_at)}</p>
                </div>
                <button onClick={() => handleDelete(h.id)} disabled={deletingId === h.id}
                  className="flex-shrink-0 p-1.5 text-slate-500 hover:text-red-400 transition-colors disabled:opacity-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
