import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { withRetry } from "@/lib/circuit-breaker";

export const runtime = "nodejs";

const IMAGE_UNDERSTAND_COST = 3;

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const image_url = typeof body?.image_url === "string" ? body.image_url.trim() : "";
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "详细描述这张图片的内容";

    if (!image_url) {
      return NextResponse.json({ error: "image_url is required" }, { status: 400 });
    }

    // Check credits
    const { data: creditRow, error: creditErr } = await supabase
      .from("credits")
      .select("amount")
      .eq("user_id", user.id)
      .single();

    if (creditErr && creditErr.code !== "PGRST116") {
      return NextResponse.json({ error: creditErr.message }, { status: 500 });
    }

    const currentCredits = creditRow?.amount ?? 0;
    if (currentCredits < IMAGE_UNDERSTAND_COST) {
      return NextResponse.json(
        { error: `积分不足，当前余额 ${currentCredits}，图片理解需要 ${IMAGE_UNDERSTAND_COST} 积分` },
        { status: 402 }
      );
    }

    // Deduct credits
    await supabase
      .from("credits")
      .upsert({ user_id: user.id, amount: currentCredits - IMAGE_UNDERSTAND_COST, updated_at: new Date().toISOString() }, { onConflict: "user_id" });

    // Record transaction
    await supabase.from("credit_transactions").insert({
      user_id: user.id,
      amount: -IMAGE_UNDERSTAND_COST,
      reason: "image_understand",
    });

    // Insert history record
    const { data: record, error: insertErr } = await supabase
      .from("image_understand_history")
      .insert({ user_id: user.id, input_image_url: image_url, prompt, status: "pending" })
      .select()
      .single();

    if (insertErr || !record) {
      // Refund
      await supabase.from("credits").upsert({ user_id: user.id, amount: currentCredits, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      return NextResponse.json({ error: insertErr?.message || "Failed to create record" }, { status: 500 });
    }

    try {
      const sfKey = process.env.SILICONFLOW_API_KEY;
      if (!sfKey) throw new Error("SILICONFLOW_API_KEY is not set");

      // Call SiliconFlow Qwen-VL with retry (1s/2s/4s)
      const resultText = await withRetry(async () => {
        const res = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${sfKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "Qwen/Qwen2.5-VL-72B-Instruct",
            messages: [
              {
                role: "user",
                content: [
                  { type: "image_url", image_url: { url: image_url } },
                  { type: "text", text: prompt },
                ],
              },
            ],
            max_tokens: 2048,
          }),
          signal: AbortSignal.timeout(60_000),
        });

        const txt = await res.text();
        if (!res.ok) {
          let msg = "Image understanding failed";
          try { msg = JSON.parse(txt)?.message || JSON.parse(txt)?.error?.message || msg; } catch { msg = txt || msg; }
          throw new Error(msg);
        }
        const data = JSON.parse(txt);
        const content = data?.choices?.[0]?.message?.content;
        if (!content) throw new Error("No content returned from model");
        return content as string;
      }, 3, 1000);

      // Update record
      await supabase
        .from("image_understand_history")
        .update({ status: "completed", result_text: resultText, updated_at: new Date().toISOString() })
        .eq("id", record.id);

      return NextResponse.json({ id: record.id, result_text: resultText });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Image understanding failed";
      console.error("[image-understand] error:", msg);

      await supabase
        .from("image_understand_history")
        .update({ status: "failed", updated_at: new Date().toISOString() })
        .eq("id", record.id);

      // Refund credits
      await supabase
        .from("credits")
        .upsert({ user_id: user.id, amount: currentCredits, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      await supabase.from("credit_transactions").insert({
        user_id: user.id,
        amount: IMAGE_UNDERSTAND_COST,
        reason: "image_understand_refund",
      });

      return NextResponse.json({ error: msg }, { status: 500 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
