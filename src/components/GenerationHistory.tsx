"use client";

import { useEffect, useState, useCallback } from "react";
import { Trash2, ImageIcon, Clock, RefreshCw } from "lucide-react";

export interface Generation {
  id: string;
  prompt: string;
  image_url: string;
  created_at: string;
}

export function GenerationHistory() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const fetchGenerations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generations");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "获取记录失败");
      setGenerations(data.generations ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "获取记录失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGenerations();
  }, [fetchGenerations]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/generations?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "删除失败");
      setGenerations((prev) => prev.filter((g) => g.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeletingId(null);
    }
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <section className="mb-8 p-6 bg-slate-800 rounded-lg border border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-blue-300" />
          生成历史
        </h2>
        <button
          onClick={fetchGenerations}
          disabled={loading}
          title="刷新"
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="rounded-lg bg-slate-700/50 border border-slate-700 overflow-hidden animate-pulse"
            >
              <div className="w-full h-[200px] bg-slate-700" />
              <div className="p-3 space-y-2">
                <div className="h-3 bg-slate-700 rounded w-3/4" />
                <div className="h-3 bg-slate-700 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && generations.length === 0 && !error && (
        <div className="text-center py-16 text-slate-400">
          <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-base">暂无生成记录，快去创作吧！</p>
        </div>
      )}

      {/* Grid */}
      {!loading && generations.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {generations.map((g) => (
            <div
              key={g.id}
              className="group rounded-lg bg-slate-900/50 border border-slate-700 overflow-hidden flex flex-col hover:border-slate-500 transition-colors"
            >
              {/* Thumbnail */}
              <button
                className="block w-full overflow-hidden bg-slate-950 relative"
                onClick={() => setLightboxUrl(g.image_url)}
                title="点击查看大图"
              >
                <img
                  src={g.image_url}
                  alt={g.prompt}
                  className="w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  style={{ height: "200px" }}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-white bg-black/60 px-2 py-1 rounded">
                    查看大图
                  </span>
                </div>
              </button>

              {/* Info */}
              <div className="p-3 flex flex-col gap-2 flex-1">
                <p
                  className="text-sm text-slate-200 leading-snug line-clamp-2"
                  title={g.prompt}
                >
                  {g.prompt}
                </p>
                <div className="flex items-center gap-1 text-xs text-slate-500 mt-auto">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  <span>{formatDate(g.created_at)}</span>
                </div>
              </div>

              {/* Delete button */}
              <div className="px-3 pb-3">
                <button
                  onClick={() => handleDelete(g.id)}
                  disabled={deletingId === g.id}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-slate-700 hover:border-red-500/40 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {deletingId === g.id ? "删除中..." : "删除"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <dialog
          open
          className="fixed inset-0 z-50 w-full h-full bg-black/80 flex items-center justify-center p-4 m-0 max-w-none max-h-none border-0 backdrop:bg-black/80"
          onClick={() => setLightboxUrl(null)}
        >
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxUrl}
              alt="预览"
              className="w-full rounded-xl shadow-2xl max-h-[85vh] object-contain"
            />
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-full flex items-center justify-center text-slate-300 hover:text-white transition-colors text-sm font-bold"
            >
              ✕
            </button>
          </div>
        </dialog>
      )}
    </section>
  );
}
