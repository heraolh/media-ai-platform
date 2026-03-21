"use client";

import { useState } from "react";
import { Mic, Loader2, Download, Play } from "lucide-react";

const VOICE_OPTIONS = [
  { value: "alex", label: "Alex（男声）" },
  { value: "anna", label: "Anna（女声）" },
  { value: "jenny", label: "Jenny（女声·英文）" },
] as const;

type VoiceValue = (typeof VOICE_OPTIONS)[number]["value"];

interface SpeechResult {
  audioUrl: string;
  id: string;
}

export function SpeechGenerator() {
  const [text, setText] = useState("");
  const [voice, setVoice] = useState<VoiceValue>("anna");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SpeechResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onGenerate() {
    const trimmed = text.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/generate-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed, voice }),
      });

      const rawText = await res.text();
      let data: { audioUrl?: string; id?: string; error?: string } = {};
      try {
        data = JSON.parse(rawText);
      } catch {
        // non-JSON response
      }

      if (!res.ok) {
        throw new Error(
          data?.error || rawText || `生成失败 (status ${res.status})`
        );
      }

      if (!data.audioUrl) throw new Error("未返回音频数据");

      setResult({ audioUrl: data.audioUrl, id: data.id ?? "" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "生成失败");
    } finally {
      setLoading(false);
    }
  }

  function downloadAudio() {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.audioUrl;
    a.download = result.id ? `speech-${result.id}.mp3` : "speech.mp3";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <section className="mb-8 p-6 bg-slate-800 rounded-lg border border-slate-700">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Mic className="w-5 h-5 text-purple-400" />
            语音合成
            <span className="text-xs font-normal px-1.5 py-0.5 bg-purple-500/20 text-purple-300 rounded border border-purple-500/30">语音</span>
            <span className="text-xs font-normal px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded border border-amber-500/30">消耗 2 积分</span>
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            输入文本，选择音色，生成 MP3 音频。
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Text input */}
        <div className="space-y-1">
          <label className="text-sm text-slate-300" htmlFor="speech-text">
            文本内容
          </label>
          <textarea
            id="speech-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="w-full h-32 bg-slate-950/30 border border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-blue-500 resize-none text-slate-100 placeholder:text-slate-500"
            placeholder="例如：你好，欢迎使用语音合成功能。"
          />
        </div>

        {/* Voice select */}
        <div className="space-y-1">
          <label className="text-sm text-slate-300" htmlFor="voice-select">
            音色选择
          </label>
          <select
            id="voice-select"
            value={voice}
            onChange={(e) => setVoice(e.target.value as VoiceValue)}
            className="w-full bg-slate-950/30 border border-slate-700 rounded-lg px-3 py-2 outline-none focus:border-blue-500 text-slate-100 appearance-none cursor-pointer"
          >
            {VOICE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-slate-800">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Generate button */}
        <button
          type="button"
          onClick={onGenerate}
          disabled={loading || text.trim().length === 0}
          className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Play className="w-5 h-5" />
          )}
          {loading ? "合成中..." : "生成语音"}
        </button>

        {/* Error */}
        {error && (
          <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-3">
            <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4">
              <p className="text-xs text-slate-400 mb-2">音频播放</p>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio
                controls
                src={result.audioUrl}
                className="w-full"
                style={{ accentColor: "#9333ea" }}
              />
            </div>

            <button
              type="button"
              onClick={downloadAudio}
              className="w-full px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              下载 MP3
            </button>

            {result.id && (
              <p className="text-xs text-slate-500">
                记录 ID：<span className="text-slate-300">{result.id}</span>
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
