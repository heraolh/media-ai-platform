import { createClient } from "@/lib/supabase/server";
import { uploadToR2 } from "@/lib/r2";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const SPEECH_CREDIT_COST = 2;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    const voice = typeof body?.voice === "string" ? body.voice.trim() : "alex";
    const speed = typeof body?.speed === "number" ? body.speed : 1.0;

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    // 检查并扣除积分
    const { data: creditRow, error: creditFetchError } = await supabase
      .from("credits")
      .select("amount")
      .eq("user_id", user.id)
      .single();

    if (creditFetchError && creditFetchError.code !== "PGRST116") {
      return NextResponse.json({ error: creditFetchError.message }, { status: 500 });
    }

    const currentCredits = creditRow?.amount ?? 0;
    if (currentCredits < SPEECH_CREDIT_COST) {
      return NextResponse.json(
        { error: `积分不足，当前余额 ${currentCredits}，生成语音需要 ${SPEECH_CREDIT_COST} 积分` },
        { status: 402 }
      );
    }

    // 插入数据库记录（pending）
    const { data: record, error: insertError } = await supabase
      .from("speech_generations")
      .insert({
        user_id: user.id,
        text,
        voice,
        voice_id: voice,
        status: "pending",
      })
      .select()
      .single();

    if (insertError || !record) {
      throw new Error(insertError?.message || "Failed to create speech record");
    }

    let apiResponseText = "";

    try {
      const apiKey = process.env.SILICONFLOW_API_KEY;
      if (!apiKey) {
        throw new Error("SILICONFLOW_API_KEY is not set");
      }

      const model = "FunAudioLLM/CosyVoice2-0.5B";
      console.log("语音合成模型:", model, "音色:", voice);

      const response = await fetch("https://api.siliconflow.cn/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          input: text,
          voice: `${model}:${voice}`,
          response_format: "mp3",
          speed,
        }),
      });

      if (!response.ok) {
        apiResponseText = await response.text();
        let errMessage = "Speech generation failed";
        try {
          const errJson = JSON.parse(apiResponseText);
          errMessage = errJson?.message || errJson?.error || errJson?.detail || errMessage;
        } catch {
          errMessage = apiResponseText || errMessage;
        }
        throw new Error(errMessage);
      }

      const arrayBuffer = await response.arrayBuffer();

      // 上传到 R2
      const storageKey = `audio/${user.id}/${record.id}.mp3`;
      const audioUrl = await uploadToR2(storageKey, arrayBuffer, "audio/mpeg");
      console.log("[generate-speech] 音频已保存到 R2:", audioUrl);

      // 扣除积分
      const newCredits = currentCredits - SPEECH_CREDIT_COST;
      await supabase
        .from("credits")
        .upsert(
          { user_id: user.id, amount: newCredits, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );

      // 更新数据库记录（completed）
      await supabase
        .from("speech_generations")
        .update({
          status: "completed",
          audio_url: audioUrl,
          storage_path: storageKey,
        })
        .eq("id", record.id);

      return NextResponse.json({ audioUrl, id: record.id, creditsRemaining: newCredits });
    } catch (error) {
      console.error("语音合成错误:", error);
      console.error("API 响应内容:", apiResponseText);

      const message = error instanceof Error ? error.message : "Speech generation failed";

      await supabase
        .from("speech_generations")
        .update({ status: "failed", error_msg: message })
        .eq("id", record.id);

      return NextResponse.json({ error: message }, { status: 500 });
    }
  } catch (error) {
    console.error("外层错误:", error);
    const message = error instanceof Error ? error.message : "Speech generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
