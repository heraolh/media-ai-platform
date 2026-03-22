"use client";

import { useState } from "react";
import { Star, Heart, Share2, Copy, Check, Zap, X, Loader2 } from "lucide-react";

interface RatingWidgetProps {
  type: string;
  id: string;
  initialRating?: number | null;
  initialFavorite?: boolean;
  onOptimize?: (prompt: string) => void;
  prompt?: string;
}

export function RatingWidget({ type, id, initialRating, initialFavorite, onOptimize, prompt }: RatingWidgetProps) {
  const [rating, setRating] = useState<number | null>(initialRating ?? null);
  const [hover, setHover] = useState<number | null>(null);
  const [favorite, setFavorite] = useState(initialFavorite ?? false);
  const [saving, setSaving] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showShare, setShowShare] = useState(false);

  async function submitRating(r: number) {
    setRating(r); setSaving(true);
    try {
      await fetch("/api/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, rating: r }),
      });
    } catch { /* ignore */ } finally { setSaving(false); }
  }

  async function toggleFavorite() {
    const next = !favorite; setFavorite(next);
    try {
      await fetch("/api/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, is_favorite: next }),
      });
    } catch { setFavorite(!next); }
  }

  async function handleShare() {
    setShareLoading(true);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content_type: type, content_id: id }),
      });
      const data = await res.json();
      if (res.ok) { setShareUrl(data.share_url); setShowShare(true); }
    } catch { /* ignore */ } finally { setShareLoading(false); }
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  async function handleOptimize() {
    if (!prompt || !onOptimize) return;
    try {
      const res = await fetch("/api/optimize-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (res.ok && data.optimized_prompt) onOptimize(data.optimized_prompt);
    } catch { /* ignore */ }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Stars */}
      <div className="flex items-center gap-0.5">
        {[1,2,3,4,5].map(s => (
          <button key={s}
            onMouseEnter={() => setHover(s)}
            onMouseLeave={() => setHover(null)}
            onClick={() => submitRating(s)}
            disabled={saving}
            className="transition-transform hover:scale-110 disabled:opacity-50"
          >
            <Star className={`w-4 h-4 ${
              (hover ?? rating ?? 0) >= s ? "fill-amber-400 text-amber-400" : "text-slate-600"
            }`} />
          </button>
        ))}
      </div>

      {/* Favorite */}
      <button onClick={toggleFavorite} className="transition-transform hover:scale-110">
        <Heart className={`w-4 h-4 ${favorite ? "fill-rose-500 text-rose-500" : "text-slate-600"}`} />
      </button>

      {/* Share */}
      <button onClick={handleShare} disabled={shareLoading}
        className="p-1 text-slate-500 hover:text-indigo-400 transition-colors disabled:opacity-50">
        {shareLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
      </button>

      {/* Optimize */}
      {prompt && onOptimize && (
        <button onClick={handleOptimize}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-amber-400 transition-colors">
          <Zap className="w-3.5 h-3.5" />优化
        </button>
      )}

      {/* Share modal */}
      {showShare && shareUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-600 rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">分享链接</h3>
              <button onClick={() => setShowShare(false)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex gap-2 mb-3">
              <input readOnly value={shareUrl}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none" />
              <button onClick={copyShareUrl}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition-colors">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500">链接有效期 24 小时</p>
          </div>
        </div>
      )}
    </div>
  );
}
