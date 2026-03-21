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
          setError(data.error_msg || "\u89c6\u9891\u751f\u6210\u5931\u8d25");
        } else {
          setProgress(typeof data.progress === "number" ? data.progress : 0);
        }
      } catch (e) {
        console.error("\u8f6e\u8be2\u51fa\u9519:", e);
      }
    },
    [stopPolling]
  );

  const startPolling = useCallback(
    (id: string) => {
      stopPolling();
      setPolling(true);
      checkStatus(id);
      pollingRef.current = setInterval(() => checkStatus(id), 3000);
    },
    [stopPolling, checkStatus]
  );

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
      try { data = JSON.parse(rawText); } catch { /* non-JSON */ }
      if (!res.ok) throw new Error(data?.error || rawText || `\u63d0\u4ea4\u5931\u8d25 (${res.status})`);
      if (!data.id) throw new Error("\u672a\u8fd4\u56de\u4efb\u52a1 ID");
      const newTask: VideoTask = { id: data.id, task_id: data.task_id ?? "" };
      setTask(newTask);
      setStatus("processing");
      startPolling(newTask.id);
    } catch (e) {
      setStatus("failed");
      setError(e instanceof Error ? e.message : "\u63d0\u4ea4\u5931\u8d25");
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
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Film className="w-5 h-5 text-blue-400" />
            AI \u89c6\u9891
            <span className="text-xs font-normal px-1.5 py-0.5 bg-red-500/20 text-red-300 rounded border border-red-500/30">\u89c6\u9891</span>
            <span className="text-xs font-normal px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">\u6d88\u8017 50 \u79ef\u5206</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            \u8f93\u5165\u63cf\u8ff0\uff0cAI \u751f\u6210\u89c6\u9891\uff08\u7ea6\u9700 1\u20133 \u5206\u949f\uff09\u3002\u53ef\u9009\u4e0a\u4f20\u53c2\u8003\u56fe\u5b9e\u73b0\u56fe\u751f\u89c6\u9891\u3002
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-sm text-slate-300" htmlFor="video-prompt">\u89c6\u9891\u63cf\u8ff0</label>
          <textarea
            id="video-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            disabled={isSubmitting || isProcessing}
            className="w-full bg-slate-950/30 border border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-blue-500 resize-none text-slate-100 placeholder:text-slate-500 disabled:opacity-50"
            placeholder="\u4f8b\u5982\uff1a\u4e00\u53ea\u6a58\u732b\u5728\u6?\u82b1\u6811\u4e0b\u6175\u61d2\u5730\u4f38\u5c55\uff0c\u9633\u5149\u6d12\u843d\uff0c\u82b1\u74e3\u98d8\u821e"
          />
        </div>

        <div className="space-y-1">
          <p className="text-sm text-slate-300">\u53c2\u8003\u56fe\uff08\u53ef\u9009\uff0c\u7528\u4e8e\u56fe\u751f\u89c6\u9891\uff09</p>
          {imageUrl ? (
            <div className="relative inline-block">
              <img src={imageUrl} alt="\u53c2\u8003\u56fe" className="h-24 w-auto rounded-lg border border-slate-600 object-cover" />
              <button
                onClick={removeImage}
                className="absolute -top-2 -right-2 w-5 h-5 bg-slate-700 hover:bg-red-600 border border-slate-500 rounded-full flex items-center justify-center transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
              {imageFile && (
                <p className="text-xs text-slate-500 mt-1 truncate max-w-[180px]">{imageFile.name}</p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting || isProcessing}
              className="flex items-center gap-2 px-4 py-2 border border-dashed border-slate-600 hover:border-blue-500 rounded-lg text-sm text-slate-400 hover:text-blue-400 transition-colors disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              \u4e0a\u4f20\u53c2\u8003\u56fe
            </button>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
        </div>

        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || isProcessing || prompt.trim().length === 0}
          className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <><Loader2 className="w-5 h-5 animate-spin" />\u63d0\u4ea4\u4e2d...</>
          ) : (
            <><Film className="w-5 h-5" />\u751f\u6210\u89c6\u9891</>
          )}
        </button>

        {isProcessing && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-blue-300 text-sm font-medium">
                <Loader2 className="w-4 h-4 animate-spin" />
                \u751f\u6210\u4e2d\u2026\u2026\uff08\u7ea6\u9700 1\u20133 \u5206\u949f\uff09
              </div>
              <button
                onClick={onManualRefresh}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                title="\u624b\u52a8\u5237\u65b0\u72b6\u6001"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
            {progress > 0 && (
              <div className="w-full bg-slate-700 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
            {task?.task_id && (
              <p className="text-xs text-slate-500 mt-2">
                Task ID: <span className="text-slate-400">{task.task_id}</span>
              </p>
            )}
            <p className="text-xs text-slate-500 mt-1">{polling ? "\u81ea\u52a8\u8f6e\u8be2\u4e2d\uff08\u6bcf 3 \u79d2\uff09" : ""}</p>
          </div>
        )}

        {isFailed && error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            {error}
          </div>
        )}

        {isSuccess && videoUrl && (
          <div className="space-y-3">
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-2">\u89c6\u9891\u64ad\u653e</p>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video controls src={videoUrl} className="w-full rounded-md max-h-[480px]" />
            </div>
            <button
              type="button"
              onClick={downloadVideo}
              className="w-full px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              \u4e0b\u8f7d\u89c6\u9891
            </button>
            {task?.id && (
              <p className="text-xs text-slate-500">
                \u8bb0\u5f55 ID\uff1a<span className="text-slate-300">{task.id}</span>
              </p>
            )}
          </div>
        )}

        {isSuccess && !videoUrl && (
          <div className="text-sm text-slate-400 bg-slate-700/30 border border-slate-600 rounded-lg p-3">
            \u89c6\u9891\u5df2\u751f\u6210\uff0c\u4f46\u6682\u672a\u83b7\u53d6\u5230\u4e0b\u8f7d\u94fe\u63a5\u3002\u8bf7\u7a0d\u540e\u5237\u65b0\u9875\u9762\u67e5\u770b\u3002
          </div>
        )}
      </div>
    </section>
  );
}
