"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Film, Loader2, RefreshCw, Download, Upload, X } from "lucide-react";

type TaskStatus = "idle" | "submitting" | "processing" | "success" | "failed";

interface VideoTask {
  id: string;
  task_id: string;
}

export function VideoGenerator() {
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [status, setStatus] = useState<TaskStatus>("idle");
  const [task, setTask] = useState<VideoTask | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setPolling(false);
  }, []);

  const checkStatus = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/video-status?id=${encodeURIComponent(id)}`);
        const data = await res.json();

        if (data.status === "success") {
          stopPolling();
          setStatus("success");
          setVideoUrl(data.video_url || null);
          setProgress(100);
        } else if (data.status === "failed") {
          stopPolling();
          setStatus("failed");
          setError(data.error_msg || "视频生成失败");
        } else {
          setProgress(typeof data.progress === "number" ? data.progress : 0);
        }
      } catch (e) {
        console.error("轮询出错:", e);
      }
    },
    [stopPolling]
  );

  const startPolling = useCallback(
    (id: string) => {
      stopPolling();
      setPolling(true);
      // 立即查一次
      checkStatus(id);
      pollingRef.current = setInterval(() => checkStatus(id), 3000);
    },
    [stopPolling, checkStatus]
  );

  // 清理定时器
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImageUrl(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  function removeImage() {
    setImageFile(null);
    setImageUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onSubmit() {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setStatus("submitting");
    setError(null);
    setVideoUrl(null);
    setProgress(0);
    setTask(null);
    stopPolling();

    try {
      const body: Record<string, unknown> = { prompt: trimmed };
      if (imageUrl) body.first_frame_image = imageUrl;

      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const rawText = await res.text();
      let data: { id?: string; task_id?: string; error?: string } = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        // non-JSON
      }

      if (!res.ok) {
        throw new Error(data?.error || rawText || `提交失败 (${res.status})`);
      }

      if (!data.id) throw new Error("未返回任务 ID");

      const newTask: VideoTask = {
        id: data.id,
        task_id: data.task_id ?? "",
      };
      setTask(newTask);
      setStatus("processing");
      startPolling(newTask.id);
    } catch (e) {
      setStatus("failed");
      setError(e instanceof Error ? e.message : "提交失败");
    }
  }

  function onManualRefresh() {
    if (task?.id) checkStatus(task.id);
  }

  function downloadVideo() {
    if (!videoUrl) return;
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = task?.id ? `video-${task.id}.mp4` : "video.mp4";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  const isSubmitting = status === "submitting";
  const isProcessing = status === "processing";
  const isSuccess = status === "success";
  const isFailed = status === "failed";

  return (
    <section className="mb-8 p-6 bg-slate-800 rounded-lg border border-slate-700">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Film className="w-5 h-5 text-orange-400" />
            视频生成
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            输入描述，AI 生成视频（约需 1–3 分钟）。可选上传参考图实现图生视频。
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Prompt */}
        <div className="space-y-1">
          <label className="text-sm text-slate-300" htmlFor="video-prompt">
            视频描述
          </label>
          <textarea
            id="video-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            disabled={isSubmitting || isProcessing}
            className="w-full bg-slate-950/30 border border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-orange-500 resize-none text-slate-100 placeholder:text-slate-500 disabled:opacity-50"
            placeholder="例如：一只橘猫在樱花树下慵懒地伸展，阳光洒落，花瓣飘舞"
          />
        </div>

        {/* Optional image upload */}
        <div className="space-y-1">
          <p className="text-sm text-slate-300">参考图（可选，用于图生视频）</p>
          {imageUrl ? (
            <div className="relative inline-block">
              <img
                src={imageUrl}
                alt="参考图"
                className="h-24 w-auto rounded-lg border border-slate-600 object-cover"
              />
              <button
                onClick={removeImage}
                className="absolute -top-2 -right-2 w-5 h-5 bg-slate-700 hover:bg-red-600 border border-slate-500 rounded-full flex items-center justify-center transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
              {imageFile && (
                <p className="text-xs text-slate-500 mt-1 truncate max-w-[180px]">
                  {imageFile.name}
                </p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting || isProcessing}
              className="flex items-center gap-2 px-4 py-2 border border-dashed border-slate-600 hover:border-orange-500 rounded-lg text-sm text-slate-400 hover:text-orange-400 transition-colors disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              上传参考图
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageChange}
          />
        </div>

        {/* Submit button */}
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || isProcessing || prompt.trim().length === 0}
          className="w-full px-6 py-3 bg-orange-600 hover:bg-orange-700 rounded-lg font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              提交中...
            </>
          ) : (
            <>
              <Film className="w-5 h-5" />
              生成视频
            </>
          )}
        </button>

        {/* Processing state */}
        {isProcessing && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-orange-300 text-sm font-medium">
                <Loader2 className="w-4 h-4 animate-spin" />
                生成中...（约需 1–3 分钟）
              </div>
              <button
                onClick={onManualRefresh}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                title="手动刷新状态"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            {progress > 0 && (
              <div className="w-full bg-slate-700 rounded-full h-1.5">
                <div
                  className="bg-orange-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
            {task?.task_id && (
              <p className="text-xs text-slate-500 mt-2">
                Task ID: <span className="text-slate-400">{task.task_id}</span>
              </p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              {polling ? "自动轮询中（每 3 秒）" : ""}
            </p>
          </div>
        )}

        {/* Error */}
        {isFailed && error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            {error}
          </div>
        )}

        {/* Success — video player */}
        {isSuccess && videoUrl && (
          <div className="space-y-3">
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-2">视频播放</p>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                controls
                src={videoUrl}
                className="w-full rounded-md max-h-[480px]"
              />
            </div>
            <button
              type="button"
              onClick={downloadVideo}
              className="w-full px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              下载视频
            </button>
            {task?.id && (
              <p className="text-xs text-slate-500">
                记录 ID：<span className="text-slate-300">{task.id}</span>
              </p>
            )}
          </div>
        )}

        {/* Success but no video URL yet */}
        {isSuccess && !videoUrl && (
          <div className="text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            视频已生成，但暂未获取到下载链接。请稍后刷新页面查看。
          </div>
        )}
      </div>
    </section>
  );
}
