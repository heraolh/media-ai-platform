"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import JSZip from "jszip";
import {
  Loader2,
  CheckCircle2,
  Circle,
  XCircle,
  Download,
  Image as ImageIcon,
  Video,
  Mic,
  Zap,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type StepStatus = "idle" | "running" | "done" | "failed";

interface WorkflowResults {
  image?: string;
  video?: string;
  speech?: string;
}

interface WorkflowData {
  id: string;
  status: string;
  failed_step?: string;
  results: WorkflowResults;
  progress: number | null;
  current_step: number;
  total_steps: number;
  prompt: string;
}

// ─── Step definitions ────────────────────────────────────────────────────────
const STEPS = [
  { key: "image", label: "AI 生图", icon: ImageIcon, cost: 8 },
  { key: "video", label: "图生视频", icon: Video, cost: 52 },
  { key: "speech", label: "语音合成", icon: Mic, cost: 2 },
] as const;

function getStepStatus(
  stepIndex: number, // 0-based
  workflowStatus: string,
  failedStep: string | undefined,
  currentStep: number // from API (0=pending,1=image_done,2=video_done,3=completed)
): StepStatus {
  if (workflowStatus === "failed") {
    const failedIdx = STEPS.findIndex((s) => s.key === failedStep);
    if (failedIdx === stepIndex) return "failed";
    if (stepIndex < failedIdx) return "done";
    return "idle";
  }
  if (stepIndex < currentStep) return "done";
  if (stepIndex === currentStep && workflowStatus !== "completed") return "running";
  return "idle";
}

// ─── Compact Step Indicator ───────────────────────────────────────────────────
function StepIndicator({
  label,
  icon: Icon,
  status,
}: {
  label: string;
  icon: React.ElementType;
  status: StepStatus;
}) {
  const base = "flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg border transition-all duration-500";
  const variants: Record<StepStatus, string> = {
    idle: "border-zinc-700 text-zinc-500 bg-zinc-900",
    running: "border-amber-500/60 text-amber-300 bg-amber-500/10 animate-pulse",
    done: "border-emerald-500/50 text-emerald-300 bg-emerald-500/10",
    failed: "border-red-500/50 text-red-400 bg-red-500/10",
  };
  return (
    <div className={`${base} ${variants[status]}`}>
      {status === "running" && <Loader2 className="w-4 h-4 animate-spin" />}
      {status === "done" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
      {status === "failed" && <XCircle className="w-4 h-4 text-red-400" />}
      {status === "idle" && <Circle className="w-4 h-4" />}
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function SmartKit() {
  const [prompt, setPrompt] = useState("");
  const [credits, setCredits] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowData | null>(null);
  const [downloading, setDownloading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch current credits
  const fetchCredits = useCallback(async () => {
    try {
      const res = await fetch("/api/credits");
      const data = await res.json();
      if (res.ok) setCredits(data.amount ?? 0);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  // Poll workflow status
  const pollWorkflow = useCallback(async (wfId: string) => {
    try {
      const res = await fetch(`/api/workflows/${wfId}`);
      if (!res.ok) return;
      const data: WorkflowData = await res.json();
      setWorkflow(data);

      if (data.status === "completed" || data.status === "failed") {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        // Refresh credits after completion
        fetchCredits();
      }
    } catch {
      /* ignore */
    }
  }, [fetchCredits]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleStart() {
    const trimmed = prompt.trim();
    if (!trimmed) return;
    if ((credits ?? 0) < 62) {
      setError("积分不足，需要 62 积分才能启动智能套件");
      return;
    }
    setSubmitting(true);
    setError(null);
    setWorkflow(null);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "创建工作流失败");
      const wfId: string = data.workflow_id;
      const initRes = await fetch(`/api/workflows/${wfId}`);
      if (initRes.ok) {
        const initData: WorkflowData = await initRes.json();
        setWorkflow(initData);
      }
      pollRef.current = setInterval(() => pollWorkflow(wfId), 3000);
      fetchCredits();
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建工作流失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownload() {
    if (!workflow?.results) return;
    const { image, video, speech } = workflow.results;
    if (!image && !video && !speech) return;
    setDownloading(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder("smartkit")!;
      const readme = [
        "SmartKit 智能营销套件 — 生成结果",
        `提示词: ${workflow.prompt}`,
        `工作流 ID: ${workflow.id}`,
        "",
        "文件说明:",
        "  image.png  — AI 生成图片",
        "  video.mp4  — AI 生成视频",
        "  speech.mp3 — AI 语音合成",
      ].join("\n");
      folder.file("README.txt", readme);
      async function fetchBuf(url: string) {
        const r = await fetch(url);
        return r.arrayBuffer();
      }
      if (image) folder.file("image.png", await fetchBuf(image));
      if (video) folder.file("video.mp4", await fetchBuf(video));
      if (speech) folder.file("speech.mp3", await fetchBuf(speech));
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `smartkit-${workflow.id.slice(0, 8)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "下载失败");
    } finally {
      setDownloading(false);
    }
  }

  const isRunning = workflow !== null && workflow.status !== "completed" && workflow.status !== "failed";
  const isDone = workflow?.status === "completed";
  const isFailed = workflow?.status === "failed";
  const progress = workflow?.progress ?? 0;

  return (
    <section className="mb-10 rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/60 via-slate-900 to-slate-900 p-6 shadow-xl shadow-indigo-950/40">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-white tracking-tight">
            <Zap className="w-5 h-5 text-indigo-400" />
            SmartKit 智能营销套件
            <span className="ml-1 text-xs font-semibold px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full border border-indigo-500/30">
              62 积分
            </span>
          </h2>
          <p className="mt-1 text-sm text-slate-400">一键生成：产品图 · 宣传视频 · 语音解说，自动打包下载</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-500">当前积分</p>
          <p className="text-lg font-bold text-white">
            {credits === null ? <Loader2 className="w-4 h-4 animate-spin inline" /> : credits}
          </p>
        </div>
      </div>

      {/* Input */}
      <div className="space-y-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          disabled={isRunning || submitting}
          className="w-full rounded-xl bg-slate-950/60 border border-slate-700 focus:border-indigo-500 px-4 py-3 text-slate-100 placeholder:text-slate-500 outline-none resize-none transition-colors disabled:opacity-60 text-sm"
          placeholder="输入产品描述...（例如：一款高端护肤精华液，质地轻盈，玻璃瓶装）"
        />
        <button
          onClick={handleStart}
          disabled={!prompt.trim() || isRunning || submitting || (credits ?? 0) < 62}
          className="w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-900/40"
        >
          {submitting || isRunning ? (
            <><Loader2 className="w-4 h-4 animate-spin" />{submitting ? "提交中..." : "生成中..."}</>
          ) : (
            <><Zap className="w-4 h-4" />开始生成</>
          )}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">{error}</div>
      )}

      {/* Progress & Steps */}
      {workflow && (
        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-slate-400">
              <span>{isDone ? "全部完成" : isFailed ? `步骤失败：${workflow.failed_step ?? ""}` : "处理中..."}</span>
              <span>{isDone ? 100 : isFailed ? "-" : progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${isFailed ? "bg-red-500" : isDone ? "bg-emerald-500" : "bg-indigo-500"}`}
                style={{ width: `${isDone ? 100 : progress}%` }}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {STEPS.map((step, idx) => (
              <StepIndicator
                key={step.key}
                label={step.label}
                icon={step.icon}
                status={getStepStatus(idx, workflow.status, workflow.failed_step, workflow.current_step)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {workflow?.results && (workflow.results.image || workflow.results.video || workflow.results.speech) && (
        <div className="mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Image */}
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-700 text-xs font-medium text-slate-400">
                <ImageIcon className="w-3.5 h-3.5" /> 生成图片
              </div>
              <div className="p-2">
                {workflow.results.image ? (
                  <img src={workflow.results.image} alt="generated" className="w-full rounded-lg object-cover aspect-square" />
                ) : (
                  <div className="aspect-square flex items-center justify-center text-slate-600">
                    {isRunning && workflow.current_step === 0 ? <Loader2 className="w-6 h-6 animate-spin" /> : <ImageIcon className="w-6 h-6" />}
                  </div>
                )}
              </div>
            </div>
            {/* Video */}
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-700 text-xs font-medium text-slate-400">
                <Video className="w-3.5 h-3.5" /> 生成视频
              </div>
              <div className="p-2">
                {workflow.results.video ? (
                  <video src={workflow.results.video} controls className="w-full rounded-lg aspect-square object-cover" />
                ) : (
                  <div className="aspect-square flex items-center justify-center text-slate-600">
                    {isRunning && workflow.current_step === 1 ? <Loader2 className="w-6 h-6 animate-spin" /> : <Video className="w-6 h-6" />}
                  </div>
                )}
              </div>
            </div>
            {/* Speech */}
            <div className="rounded-xl border border-slate-700 bg-slate-800/50 overflow-hidden">
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-700 text-xs font-medium text-slate-400">
                <Mic className="w-3.5 h-3.5" /> 语音合成
              </div>
              <div className="p-2">
                {workflow.results.speech ? (
                  <div className="aspect-square flex flex-col items-center justify-center gap-3 px-2">
                    <Mic className="w-8 h-8 text-indigo-400" />
                    <audio src={workflow.results.speech} controls className="w-full" />
                  </div>
                ) : (
                  <div className="aspect-square flex items-center justify-center text-slate-600">
                    {isRunning && workflow.current_step === 2 ? <Loader2 className="w-6 h-6 animate-spin" /> : <Mic className="w-6 h-6" />}
                  </div>
                )}
              </div>
            </div>
          </div>
          {isDone && (
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="mt-4 w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-60 shadow-lg shadow-emerald-900/30"
            >
              {downloading ? <><Loader2 className="w-4 h-4 animate-spin" />打包中...</> : <><Download className="w-4 h-4" />打包下载（图片 + 视频 + 音频）</>}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
 