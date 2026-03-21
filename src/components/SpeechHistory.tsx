"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { History, Play, Pause, Clock, Mic, RefreshCw } from "lucide-react";

interface SpeechRecord {
  id: string;
  text: string;
  voice: string | null;
  voice_id: string | null;
  audio_url: string | null;
  storage_path: string | null;
  created_at: string;
}

const VOICE_LABELS: Record<string, string> = {
  alex: "Alex（男声）",
  anna: "Anna（女声）",
  jenny: "Jenny（女声·英文）",
};

export function SpeechHistory() {
  const [history, setHistory] = useState<SpeechRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/speech/history");
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

  function togglePlay(record: SpeechRecord) {
    if (!record.audio_url) return;

    Object.entries(audioRefs.current).forEach(([id, audio]) => {
      if (id !== record.id) {
        audio.pause();
        audio.currentTime = 0;
      }
    });

    if (playingId === record.id) {
      audioRefs.current[record.id]?.pause();
      setPlayingId(null);
      return;
    }

    if (!audioRefs.current[record.id]) {
      const audio = new Audio(record.audio_url);
      audio.onended = () => setPlayingId(null);
      audioRefs.current[record.id] = audio;
    }

    audioRefs.current[record.id].play();
    setPlayingId(record.id);
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const voiceLabel = (r: SpeechRecord) =>
    VOICE_LABELS[r.voice || r.voice_id || ""] || r.voice || r.voice_id || "未知音色";

  return (
    <section className="mb-8 p-6 bg-slate-800 rounded-lg border border-slate-700">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <History className="w-5 h-5 text-purple-400" />
          语音历史
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
            <div key={n} className="h-16 bg-slate-700/50 rounded-lg animate-pulse" />
          ))}
        </div>
      )}

      {!loading && history.length === 0 && !error && (
        <div className="text-center py-12 text-slate-400">
          <Mic className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>暂无语音记录，快去合成吧！</p>
        </div>
      )}

      {!loading && history.length > 0 && (
        <div className="space-y-2">
          {history.map((record) => (
            <div
              key={record.id}
              className="flex items-center gap-3 p-3 bg-slate-900/50 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors"
            >
              {/* Play button */}
              <button
                onClick={() => togglePlay(record)}
                disabled={!record.audio_url}
                className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                  record.audio_url
                    ? "bg-purple-600 hover:bg-purple-500"
                    : "bg-slate-700 opacity-50 cursor-not-allowed"
                }`}
              >
                {playingId === record.id ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </button>

              {/* Text + meta */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 truncate" title={record.text}>
                  {record.text.length > 50 ? record.text.slice(0, 50) + "..." : record.text}
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-xs text-purple-400 flex items-center gap-1">
                    <Mic className="w-3 h-3" />
                    {voiceLabel(record)}
                  </span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(record.created_at)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
