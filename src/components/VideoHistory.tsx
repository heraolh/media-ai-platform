"use client";

import { useState, useEffect, useCallback } from "react";
import { Film, Clock, RefreshCw, Download, Play, Loader2, AlertCircle } from "lucide-react";

interface VideoRecord {
  id: string;
  prompt: string;
  status: string;
  video_url: string | null;
  task_id: string | null;
  error_msg: string | null;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:    { label: "等待中",  color: "text-slate-400" },
  processing: { label: "生成中",  color: "text-orange-400" },
  success:    { label: "已完成",  color: "text-green-400" },
  failed:     { label: "失败",    color: "text-red-400" },
};

export function VideoHistory() {
  const [history, setHistory] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/video/history");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "获取历史失败");
      setHistory(data.history ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "获取历史失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
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
    <section className="mb-8 p-6 bg-slate-800 rounded-lg border border-slate-700">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Film className="w-5 h-5 text-orange-400" />
          视频历史
        </h2>
        <button
          onClick={fetchHistory}
          disabled={loading}
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
          title="刷新"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 bg-slate-700/50 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {!loading && history.length === 0 && !error && (
        <div className="text-center py-12 text-slate-400">
          <Film className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>暂无视频记录，快去生成吧！</p>
        </div>
      )}

      {!loading && history.length > 0 && (
        <div className="space-y-3">
          {history.map((record) => {
            const statusInfo = STATUS_MAP[record.status] ?? { label: record.status, color: "text-slate-400" };
            const isSuccess = record.status === "success";
            const isProcessing = record.status === "processing" || record.status === "pending";
            const isFailed = record.status === "failed";

            return (
              <div
                key={record.id}
                className="p-4 bg-slate-900/50 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* 状态图标 */}
                  <div className="flex-shrink-0 mt-0.5">
                    {isProcessing && <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />}
                    {isSuccess && <Play className="w-5 h-5 text-green-400" />}
                    {isFailed && <AlertCircle className="w-5 h-5 text-red-400" />}
                    {!isProcessing && !isSuccess && !isFailed && (
                      <Film className="w-5 h-5 text-slate-500" />
                    )}
                  </div>

                  {/* 内容 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 line-clamp-2" title={record.prompt}>
                      {record.prompt}
                    </p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className={`text-xs font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDate(record.created_at)}
                      </span>
                    </div>

                    {/* 失败原因 */}
                    {isFailed && record.error_msg && (
                      <p className="text-xs text-red-400 mt-1 truncate" title={record.error_msg}>
                        {record.error_msg}
                      </p>
                    )}

                    {/* 视频播放器（成功时） */}
                    {isSuccess && record.video_url && (
                      <div className="mt-3 space-y-2">
                        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                        <video
                          controls
                          src={record.video_url}
                          className="w-full rounded-lg max-h-[300px] bg-black"
                        />
                        <button
                          onClick={() => downloadVideo(record)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-orange-400 hover:bg-orange-500/10 border border-slate-700 hover:border-orange-500/40 rounded-lg transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          下载视频
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
