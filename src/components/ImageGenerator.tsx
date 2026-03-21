"use client";

import { useState } from "react";
import { Download, Image as ImageIcon, Loader2, Sparkles } from "lucide-react";

export function ImageGenerator() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);

  async function onGenerate() {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setImageUrl(null);
    setGenerationId(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });

      const rawText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        // 非 JSON 响应，直接用原文报错
      }

      if (!res.ok) {
        const message =
          data?.error ||
          data?.message ||
          rawText ||
          `Generation failed (status ${res.status})`;
        throw new Error(message);
      }

      setImageUrl(data.imageUrl || null);
      setGenerationId(data.id || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  }

  async function downloadImage() {
    if (!imageUrl) return;

    try {
      const resp = await fetch(imageUrl);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = generationId ? `generation-${generationId}.png` : "image.png";
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    }
  }

  return (
    <section className="mb-8 p-6 bg-slate-800 rounded-lg border border-slate-700">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-400" />
            AI 生图
            <span className="text-xs font-normal px-1.5 py-0.5 bg-blue-500/20 text-blue-300 rounded border border-blue-500/30">图片</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            输入提示词，AI 生成图片并自动保存。
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <div className="space-y-1">
          <label className="text-sm text-slate-300" htmlFor="prompt">
            提示词
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className="w-full bg-slate-950/30 border border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-blue-500 resize-none text-slate-100"
            placeholder="例如：a cat wearing sunglasses"
          />
        </div>

        <button
          type="button"
          onClick={onGenerate}
          disabled={loading || prompt.trim().length === 0}
          className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImageIcon className="w-5 h-5" />}
          {loading ? "生成中..." : "生成图片"}
        </button>

        {error ? (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            {error}
          </div>
        ) : null}

        {imageUrl ? (
          <div className="mt-2 space-y-3">
            <div className="bg-slate-900/40 border border-slate-700 rounded-lg p-3">
              <img src={imageUrl} alt="generated" className="w-full rounded-md" />
            </div>

            <button
              type="button"
              onClick={downloadImage}
              className="w-full px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              下载图片
            </button>

            {generationId ? (
              <div className="text-xs text-slate-400">
                生成记录 ID：<span className="text-slate-200">{generationId}</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

