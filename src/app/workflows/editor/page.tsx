"use client";

import { useState, useCallback, useEffect } from "react";
import { Plus, Trash2, Save, Zap, ArrowUp, ArrowDown, Loader2, Check, ImageIcon, Film, Mic, Eye, FileText } from "lucide-react";

interface StepDef {
  type: string; label: string; model: string;
  params: Record<string, unknown>; credits: number;
}
interface Template {
  id: string; name: string; description: string | null;
  steps: StepDef[]; total_credits: number; is_system: boolean;
}

const STEP_TYPES: StepDef[] = [
  { type: "image", label: "AI 生图", model: "Qwen/Qwen2.5-VL-72B-Instruct", params: { width: 1024, height: 1024 }, credits: 8 },
  { type: "video", label: "图生视频", model: "MiniMax-Hailuo-02", params: { duration: 5 }, credits: 52 },
  { type: "speech", label: "语音合成", model: "FunAudioLLM/CosyVoice2-0.5B", params: { voice: "alex", speed: 1.0 }, credits: 2 },
  { type: "image_understand", label: "图生文", model: "Qwen/Qwen2.5-VL-72B-Instruct", params: { prompt: "详细描述图片" }, credits: 3 },
  { type: "stt", label: "语音转文字", model: "FunAudioLLM/SenseVoiceSmall", params: {}, credits: 2 },
];

const ICONS: Record<string, React.ReactNode> = {
  image: <ImageIcon className="w-4 h-4" />,
  video: <Film className="w-4 h-4" />,
  speech: <Mic className="w-4 h-4" />,
  image_understand: <Eye className="w-4 h-4" />,
  stt: <FileText className="w-4 h-4" />,
};

const CLR: Record<string, string> = {
  image: "border-blue-500/40 bg-blue-500/10 text-blue-300",
  video: "border-purple-500/40 bg-purple-500/10 text-purple-300",
  speech: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  image_understand: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  stt: "border-teal-500/40 bg-teal-500/10 text-teal-300",
};

export default function WorkflowEditorPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tplLoading, setTplLoading] = useState(true);
  const [steps, setSteps] = useState<StepDef[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sel, setSel] = useState<number | null>(null);

  const loadTpls = useCallback(async () => {
    setTplLoading(true);
    try { const r = await fetch("/api/workflow-templates"); const d = await r.json(); setTemplates(d.templates ?? []); }
    catch { /* ignore */ } finally { setTplLoading(false); }
  }, []);

  useEffect(() => { loadTpls(); }, [loadTpls]);

  const add = (def: StepDef) => setSteps(p => [...p, { ...def }]);
  const rm = (i: number) => { setSteps(p => p.filter((_, j) => j !== i)); if (sel === i) setSel(null); };
  const mv = (i: number, d: -1 | 1) => {
    setSteps(p => { const a = [...p], t = i + d; if (t < 0 || t >= a.length) return a; [a[i], a[t]] = [a[t], a[i]]; return a; });
    setSel(i + d);
  };
  const loadTpl = (tpl: Template) => {
    setName(tpl.name + (tpl.is_system ? " (副本)" : "")); setDesc(tpl.description ?? "");
    setSteps(tpl.steps.map(s => ({ ...s }))); setSel(null);
  };
  const setParam = (i: number, k: string, v: unknown) =>
    setSteps(p => p.map((s, j) => j === i ? { ...s, params: { ...s.params, [k]: v } } : s));

  const save = async () => {
    if (!name.trim() || steps.length < 1) { setError("请填写名称并至少添加1步骤"); return; }
    setSaving(true); setError(null);
    try {
      const r = await fetch("/api/workflow-templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: desc, steps }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "保存失败");
      setSaved(true); setTimeout(() => setSaved(false), 2000); loadTpls();
    } catch (e) { setError(e instanceof Error ? e.message : "保存失败"); }
    finally { setSaving(false); }
  };

  const total = steps.reduce((s, st) => s + (st.credits ?? 0), 0);
  const selStep = sel !== null ? steps[sel] : null;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Zap className="w-6 h-6 text-indigo-400" />工作流编辑器</h1>
            <p className="text-slate-400 text-sm mt-1">组合 AI 步骤，打造专属流水线</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">预估：<span className="font-semibold text-white">{total}</span> 积分</span>
            <button onClick={() => window.history.back()} className="px-4 py-2 text-sm text-slate-400 border border-slate-700 rounded-lg">返回</button>
            <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-semibold flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saved ? "已保存" : "保存模板"}
            </button>
          </div>
        </div>
        {error && <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">{error}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Library */}
          <div className="lg:col-span-3 space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">步骤库</p>
            {STEP_TYPES.map(def => (
              <button key={def.type} onClick={() => add(def)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left hover:scale-[1.02] transition-all ${CLR[def.type] ?? "border-slate-600 bg-slate-800/50"}`}>
                {ICONS[def.type]}
                <div className="flex-1 min-w-0"><p className="text-sm font-medium">{def.label}</p><p className="text-xs opacity-70">{def.credits}积分</p></div>
                <Plus className="w-4 h-4 opacity-60" />
              </button>
            ))}
            <div className="pt-3 border-t border-slate-700">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">预设模板</p>
              {tplLoading && [1,2,3].map(n => <div key={n} className="h-12 bg-slate-700/50 rounded-lg animate-pulse mb-2" />)}
              {templates.map(tpl => (
                <button key={tpl.id} onClick={() => loadTpl(tpl)}
                  className="w-full text-left p-3 rounded-xl border border-slate-700 hover:border-indigo-500/50 bg-slate-800/50 hover:bg-indigo-500/10 mb-2 transition-all">
                  <p className="text-sm text-slate-200 font-medium">{tpl.name}</p>
                  <p className="text-xs text-slate-500">{tpl.total_credits}积分·{tpl.steps.length}步{tpl.is_system?"·系统":""}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div className="lg:col-span-5 space-y-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">流程时间线</p>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="模板名称"
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-indigo-500 w-36" />
            </div>
            {steps.length === 0 && <div className="border-2 border-dashed border-slate-700 rounded-2xl p-10 text-center text-slate-600">点击左侧步骤库添加步骤</div>}
            {steps.map((step, idx) => (
              <div key={idx} className="mt-2">
                <button onClick={() => setSel(idx === sel ? null : idx)}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border text-left transition-all ${sel === idx ? "border-indigo-500 bg-indigo-500/10" : (CLR[step.type] ?? "border-slate-600 bg-slate-800/50")}` }>
                  <div className="w-7 h-7 rounded-full bg-slate-900/60 flex items-center justify-center text-xs font-bold flex-shrink-0">{idx+1}</div>
                  {ICONS[step.type]}
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium text-slate-200">{step.label}</p><p className="text-xs text-slate-500">{step.credits}积分</p></div>
                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={() => mv(idx,-1)} disabled={idx===0} className="p-1 text-slate-500 hover:text-white disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5"/></button>
                    <button onClick={() => mv(idx,1)} disabled={idx===steps.length-1} className="p-1 text-slate-500 hover:text-white disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5"/></button>
                    <button onClick={() => rm(idx)} className="p-1 text-slate-500 hover:text-red-400"><Trash2 className="w-3.5 h-3.5"/></button>
                  </div>
                </button>
              </div>
            ))}
          </div>

          {/* Config */}
          <div className="lg:col-span-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">参数配置</p>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="模板描述（可选）" rows={2}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-indigo-500 resize-none mb-4" />
            {!selStep && <p className="text-sm text-slate-600 text-center py-10">点击时间线中的步骤进行配置</p>}
            {selStep && sel !== null && (
              <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-4">
                <p className="text-sm font-semibold text-slate-200">{selStep.label}</p>
                {selStep.type === "video" && (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">时长（秒）</label>
                    <input type="range" min={5} max={10} step={5}
                      value={(selStep.params.duration as number) ?? 5}
                      onChange={e => setParam(sel, "duration", parseInt(e.target.value))}
                      className="w-full" />
                    <p className="text-xs text-slate-400 text-right">{(selStep.params.duration as number) ?? 5}s</p>
                  </div>
                )}
                {selStep.type === "speech" && (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">音色</label>
                    <select value={(selStep.params.voice as string) ?? "alex"}
                      onChange={e => setParam(sel, "voice", e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none">
                      <option value="alex">Alex（男声）</option>
                      <option value="anna">Anna（女声）</option>
                      <option value="cherry">Cherry（女声·活泼）</option>
                    </select>
                  </div>
                )}
                {selStep.type === "image_understand" && (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">分析提示词</label>
                    <textarea rows={3} value={(selStep.params.prompt as string) ?? ""}
                      onChange={e => setParam(sel, "prompt", e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none resize-none" />
                  </div>
                )}
                {selStep.type === "image" && (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">尺寸</label>
                    <select
                      value={`${selStep.params.width ?? 1024}x${selStep.params.height ?? 1024}`}
                      onChange={e => {
                        const [w, h] = e.target.value.split("x").map(Number);
                        setParam(sel, "width", w); setParam(sel, "height", h);
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 outline-none">
                      <option value="1024x1024">1024×1024（正方形）</option>
                      <option value="1280x720">1280×720（横屏）</option>
                      <option value="720x1280">720×1280（竖屏）</option>
                    </select>
                  </div>
                )}
                {selStep.type === "stt" && (
                  <p className="text-xs text-slate-500">语音转文字暂无额外参数</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
