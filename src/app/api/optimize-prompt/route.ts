import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) return NextResponse.json({ error: "prompt is required" }, { status: 400 });

    const sfKey = process.env.SILICONFLOW_API_KEY;
    if (!sfKey) return NextResponse.json({ error: "SILICONFLOW_API_KEY not set" }, { status: 500 });

    // Fetch recent low-rated records for context
    const tables = [
      { table: "generations", promptField: "prompt" },
      { table: "speech_generations", promptField: "text" },
      { table: "video_generations", promptField: "prompt" },
    ];

    const lowRatedSamples: string[] = [];
    for (const { table, promptField } of tables) {
      const { data } = await supabase
        .from(table)
        .select(`${promptField}, feedback_text, rating`)
        .eq("user_id", user.id)
        .lte("rating", 2)
        .not("rating", "is", null)
        .limit(3);
      if (data) {
        for (const row of data) {
          const r = row as unknown as Record<string, unknown>;
          const p = r[promptField] as string | undefined;
          const fb = r["feedback_text"] as string | null;
          if (p) lowRatedSamples.push(`原始提示词: "${p}"${fb ? `，用户反馈: "${fb}"` : ""}`);
        }
      }
    }

    const contextStr = lowRatedSamples.length > 0
      ? `\n\n参考用户历史低分案例（用于理解改进方向）:\n${lowRatedSamples.slice(0, 5).join("\n")}`
      : "";

    const systemPrompt = `你是一个专业的 AI 提示词优化师。用户会给你一段提示词，你需要：
1. 分析当前提示词的不足
2. 给出 3 条具体的优化建议
3. 给出一个综合优化后的提示词

请用 JSON 格式回复，结构如下：
{
  "suggestions": ["建议1", "建议2", "建议3"],
  "optimized_prompt": "优化后的完整提示词"
}`;

    const userMsg = `请优化以下提示词：\n"${prompt}"${contextStr}`;

    const res = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${sfKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "Qwen/Qwen2.5-72B-Instruct",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMsg },
        ],
        max_tokens: 1024,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    const txt = await res.text();
    if (!res.ok) {
      let msg = "Optimization failed";
      try { msg = JSON.parse(txt)?.message || msg; } catch { msg = txt || msg; }
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const data = JSON.parse(txt);
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: { suggestions?: string[]; optimized_prompt?: string } = {};
    try { parsed = JSON.parse(content); } catch { parsed = {}; }

    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];
    const optimized_prompt = typeof parsed.optimized_prompt === "string" ? parsed.optimized_prompt : prompt;

    // Upsert to prompt_optimizations
    const { data: existing } = await supabase
      .from("prompt_optimizations")
      .select("id, usage_count")
      .eq("user_id", user.id)
      .eq("original_prompt", prompt)
      .single();

    if (existing) {
      await supabase
        .from("prompt_optimizations")
        .update({ optimized_prompt, suggestions, usage_count: existing.usage_count + 1, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("prompt_optimizations")
        .insert({ user_id: user.id, original_prompt: prompt, optimized_prompt, suggestions });
    }

    return NextResponse.json({ suggestions, optimized_prompt });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
