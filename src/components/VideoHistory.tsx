"use client";

import { useState, useEffect, useCallback } from "react";
import { Film, RefreshCw, Download, Play, Loader2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";

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
  processing: { label: "生成中",  color: "text-blue-400" },
  success:    { label: "已完成",  color: "text-green-400" },
  failed:     { label: "失败",    color: "text-red-400" },
};

function friendlyError(msg: string | null): string {
  if (!msg) return "视频生成失败，请重试";
  const m = msg.toLowerCase();
  if (m.includes("task_id") || m.includes("no task")) return "视频服务繁忙，请稍后重试";
  if (m.includes("timeout") || m.includes("超时")) return "生成超时，请重试";
  if (m.includes("content") || m.includes("audit") || m.includes("审核")) return "内容审核未通过，请修改描述后重试";
  if (m.includes("credit") || m.includes("积分")) return "积分不足，请充值后重试";
  if (m.includes("key") || m.includes("auth") || m.includes("unauthorized")) return "服务配置异常，请联系管理员";
  if (m.includes("network") || m.includes("fetch") || m.includes("连接")) return "网络异常，请检查连接后重试";
  return "视频生成失败，请重试";
}

export function VideoHistory() {
  const [history, setHistory] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
          <Film className="w-5 h-5 text-blue-400" />
          视频历史
          <span className="text-xs font-normal px-1.5 py-0.5 bg-red-500/20 text-red-300 rounded border border-red-500/30">视频</span>
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
        <div className="space-y-2">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-[68px] bg-slate-700/50 rounded-lg animate-pulse" />
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
        <div className="space-y-2">
          {history.map((record) => {
            const statusInfo = STATUS_MAP[record.status] ?? { label: record.status, color: "text-slate-400" };
            const isSuccess = record.status === "success";
            const isProcessing = record.status === "processing" || record.status === "pending";
            const isFailed = record.status === "failed";
            const isExpanded = expandedId === record.id;

            return (
              <div
                key={record.id}
                className="bg-slate-900/50 border border-slate-700 rounded-lg overflow-hidden hover:border-slate-600 transition-colors"
              >
                {/* 紧凑行 68px */}
                <div className="flex items-center gap-3 px-3" style={{ height: 68 }}>
                  {/* 状态图标 */}
                  <div className="flex-shrink-0 w-6 flex items-center justify-center">
                    {isProcessing && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
                    {isSuccess && <Play className="w-4 h-4 text-green-400" />}
                    {isFailed && <AlertCircle className="w-4 h-4 text-red-400" />}
                    {!isProcessing && !isSuccess && !isFailed && (
                      <Film className="w-4 h-4 text-slate-500" />
                    )}
                  </div>

                  {/* 文字内容 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-200 truncate" title={record.prompt}>
                      {record.prompt}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`text-xs font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatDate(record.created_at)}
                      </span>
                      {/* 失败时显示友好提示 */}
                      {isFailed && (
                        <span className="text-xs text-red-400">
                          · {friendlyError(record.error_msg)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex-shrink-0 flex items-center gap-1">
                    {isFailed && (
                      <button
                        onClick={fetchHistory}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 border border-slate-700 hover:border-blue-500/40 rounded transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        重试
                      </button>
                    )}
                    {isSuccess && record.video_url && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : record.id)}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700 rounded transition-colors"
                      >
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        {isExpanded ? "收起" : "播放"}
                      </button>
                    )}
                  </div>
                </div>

                {/* 展开区域：视频播放器 */}
                {isExpanded && isSuccess && record.video_url && (
                  <div className="border-t border-slate-700 p-3 space-y-2 bg-slate-950/30">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video
                      controls
                      autoPlay
                      src={record.video_url}
                      className="w-full rounded-lg max-h-[300px] bg-black"
                    />
                    <button
                      onClick={() => downloadVideo(record)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      下载视频
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
