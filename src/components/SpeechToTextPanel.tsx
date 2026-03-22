"use client";

import { useState, useCallback, useEffect } from "react";
import { Mic, Copy, Check, RefreshCw, Trash2, Clock, Loader2, Play, Pause } from "lucide-react";

interface Asset {
  id: string; name: string; url: string; size: number | null;
}

interface HistoryItem {
  id: string; audio_url: string; audio_filename: string | null;
  transcript: string | null; file_size_mb: number | null;
  status: string; created_at: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function formatBytes(b: number | null): string {
  if (!b) return "";
  return b < 1048576 ? `${(b/1024).toFixed(1)} KB` : `${(b/1048576).toFixed(1)} MB`;
}

const MAX_MB = 10;

export function SpeechToTextPanel() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [histLoading, setHistLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);

  const loadAssets = useCallback(async () => {
    setAssetsLoading(true);
    try {
      const res = await fetch("/api/assets?type=audio");
      const data = await res.json();
      setAssets(data.assets ?? []);
    } catch { /* ignore */ } finally { setAssetsLoading(false); }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const res = await fetch("/api/speech-to-text/history");
      const data = await res.json();
      setHistory(data.history ?? []);
    } catch { /* ignore */ } finally { setHistLoading(false); }
  }, []);

  useEffect(() => { loadAssets(); loadHistory(); }, [loadAssets, loadHistory]);

  function selectAsset(a: Asset) {
    const sizeMb = a.size ? a.size / 1_048_576 : 0;
    if (sizeMb > MAX_MB) {
      setError(`文件 ${a.name} 超过 ${MAX_MB}MB 限制（${sizeMb.toFixed(1)}MB）`);
      return;
    }
    setError(null); setTranscript(null); setSelectedAsset(a);
    if (audioEl) { audioEl.pause(); setAudioEl(null); setPlaying(false); }
  }

  function togglePlay() {
    if (!selectedAsset) return;
    if (playing && audioEl) { audioEl.pause(); setPlaying(false); return; }
    const a = new Audio(selectedAsset.url);
    a.onended = () => setPlaying(false);
    a.play(); setAudioEl(a); setPlaying(true);
  }

  async function handleTranscribe() {
    if (!selectedAsset) return;
    setLoading(true); setError(null); setTranscript(null);
    try {
      const res = await fetch("/api/speech-to-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_asset_id: selectedAsset.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "转写失败");
      setTranscript(data.transcript);
      loadHistory();
    } catch (e) {
      setError(e instanceof Error ? e.message : "转写失败");
    } finally { setLoading(false); }
  }

  async function handleCopy() {
    if (!transcript) return;
    await navigator.clipboard.writeText(transcript).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  function exportTxt() {
    if (!transcript) return;
    const blob = new Blob([transcript], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "transcript.txt";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/speech-to-text/history?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) setHistory(prev => prev.filter(h => h.id !== id));
    } catch { /* ignore */ } finally { setDeletingId(null); }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Audio selector */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-slate-300">选择音频素材</p>
              {selectedAsset && (
                <button onClick={() => { setSelectedAsset(null); if (audioEl) { audioEl.pause(); setAudioEl(null); setPlaying(false); } setTranscript(null); setError(null); }} className="text-xs text-slate-500 hover:text-white transition-colors px-1.5 py-0.5 rounded bg-slate-700/50 hover:bg-slate-700">✕ 取消选择</button>
              )}
            </div>
            <button onClick={loadAssets} disabled={assetsLoading} className="p-1 text-slate-400 hover:text-white transition-colors disabled:opacity-50">
              <RefreshCw className={`w-3.5 h-3.5 ${assetsLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
          {assetsLoading && <div className="space-y-2">{[1,2,3].map(n => <div key={n} className="h-12 bg-slate-700/50 rounded-lg animate-pulse" />)}</div>}
          {!assetsLoading && assets.length === 0 && (
            <div className="text-center py-8 text-slate-500"><Mic className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-xs">素材库暂无音频</p></div>
          )}
          {!assetsLoading && assets.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {assets.map(a => {
                const sizeMb = a.size ? a.size / 1_048_576 : 0;
                const overLimit = sizeMb > MAX_MB;
                return (
                  <button key={a.id} onClick={() => selectAsset(a)} disabled={overLimit}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                      selectedAsset?.id === a.id
                        ? "border-teal-500 bg-teal-500/10"
                        : overLimit
                        ? "border-slate-700 opacity-40 cursor-not-allowed"
                        : "border-slate-700 hover:border-slate-500"
                    }`}>
                    <Mic className="w-4 h-4 text-teal-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 truncate">{a.name}</p>
                      <p className="text-xs text-slate-500">{formatBytes(a.size)}{overLimit ? " — 超限" : ""}</p>
                    </div>
                    {selectedAsset?.id === a.id && <Check className="w-4 h-4 text-teal-400" />}
                  </button>
                );
              })}
            </div>
          )}
          {selectedAsset && (
            <div className="mt-3 pt-3 border-t border-slate-700">
              <p className="text-xs text-slate-400 mb-2">预览</p>
              <div className="flex items-center gap-2">
                <button onClick={togglePlay}
                  className="w-8 h-8 rounded-full bg-teal-600 hover:bg-teal-500 flex items-center justify-center flex-shrink-0">
                  {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
                </button>
                <p className="text-sm text-slate-300 truncate">{selectedAsset.name}</p>
              </div>
            </div>
          )}
        </div>

        {/* Result area */}
        <div className="flex flex-col gap-3">
          <button onClick={handleTranscribe} disabled={!selectedAsset || loading}
            className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" />转写中...</> : <><Mic className="w-4 h-4" />开始转写（2积分）</>}
          </button>
          {error && <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">{error}</div>}
          <div className="flex-1 bg-slate-900/50 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-300">转写结果</p>
              {transcript && (
                <div className="flex items-center gap-2">
                  <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors">
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "已复制" : "复制"}
                  </button>
                  <button onClick={exportTxt} className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors">
                    导出 TXT
                  </button>
                </div>
              )}
            </div>
            {loading && <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-teal-400" /></div>}
            {!loading && transcript && <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{transcript}</p>}
            {!loading && !transcript && <p className="text-sm text-slate-500 text-center py-8">选择音频素材后点击开始转写</p>}
          </div>
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
        {histLoading && <div className="space-y-2">{[1,2].map(n => <div key={n} className="h-14 bg-slate-700/50 rounded-lg animate-pulse" />)}</div>}
        {!histLoading && history.length === 0 && <p className="text-sm text-slate-500 text-center py-8">暂无历史记录</p>}
        {!histLoading && history.length > 0 && (
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="flex items-start gap-3 p-3 bg-slate-900/50 border border-slate-700 rounded-xl">
                <Mic className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 line-clamp-2">{h.transcript ?? "处理中..."}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <span>{h.audio_filename ?? "音频"}</span>
                    {h.file_size_mb && <span>{h.file_size_mb.toFixed(1)} MB</span>}
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDate(h.created_at)}</span>
                  </div>
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
