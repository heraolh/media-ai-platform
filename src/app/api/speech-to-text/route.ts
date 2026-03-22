import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { withRetry } from "@/lib/circuit-breaker";

export const runtime = "nodejs";

const STT_COST = 2;
const MAX_FILE_MB = 10;

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const audio_asset_id = typeof body?.audio_asset_id === "string" ? body.audio_asset_id.trim() : "";

    if (!audio_asset_id) {
      return NextResponse.json({ error: "audio_asset_id is required" }, { status: 400 });
    }

    // Validate asset belongs to user
    const { data: asset, error: assetErr } = await supabase
      .from("user_assets")
      .select("id, url, name, size, type")
      .eq("id", audio_asset_id)
      .eq("user_id", user.id)
      .single();

    if (assetErr || !asset) {
      return NextResponse.json({ error: "Audio asset not found or unauthorized" }, { status: 404 });
    }

    if (asset.type !== "audio") {
      return NextResponse.json({ error: "Asset is not an audio file" }, { status: 400 });
    }

    // File size check
    const fileSizeMb = asset.size ? asset.size / 1_048_576 : 0;
    if (fileSizeMb > MAX_FILE_MB) {
      return NextResponse.json(
        { error: `文件大小超限，最大支持 ${MAX_FILE_MB}MB，当前文件 ${fileSizeMb.toFixed(1)}MB` },
        { status: 413 }
      );
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
    if (currentCredits < STT_COST) {
      return NextResponse.json(
        { error: `积分不足，当前余额 ${currentCredits}，语音转文字需要 ${STT_COST} 积分` },
        { status: 402 }
      );
    }

    // Insert history record (pending)
    const { data: record, error: insertErr } = await supabase
      .from("speech_to_text_history")
      .insert({
        user_id: user.id,
        audio_url: asset.url,
        audio_filename: asset.name,
        file_size_mb: fileSizeMb,
        status: "pending",
        credits_consumed: STT_COST,
      })
      .select()
      .single();

    if (insertErr || !record) {
      return NextResponse.json({ error: insertErr?.message || "Failed to create record" }, { status: 500 });
    }

    try {
      const sfKey = process.env.SILICONFLOW_API_KEY;
      if (!sfKey) throw new Error("SILICONFLOW_API_KEY is not set");

      // Download audio from R2
      const audioResp = await fetch(asset.url, { signal: AbortSignal.timeout(30_000) });
      if (!audioResp.ok) throw new Error(`Failed to download audio: HTTP ${audioResp.status}`);
      const audioBuffer = await audioResp.arrayBuffer();

      // Double-check size after download
      if (audioBuffer.byteLength > MAX_FILE_MB * 1_048_576) {
        throw new Error(`文件大小超限 ${MAX_FILE_MB}MB`);
      }

      // Prepare multipart form data for SiliconFlow
      const formData = new FormData();
      const blob = new Blob([audioBuffer], { type: "audio/mpeg" });
      formData.append("file", blob, asset.name || "audio.mp3");
      formData.append("model", "FunAudioLLM/SenseVoiceSmall");

      const transcript = await withRetry(async () => {
        const res = await fetch("https://api.siliconflow.cn/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${sfKey}` },
          body: formData,
          signal: AbortSignal.timeout(60_000),
        });
        const txt = await res.text();
        if (!res.ok) {
          let msg = "Speech-to-text failed";
          try { msg = JSON.parse(txt)?.message || JSON.parse(txt)?.error?.message || msg; } catch { msg = txt || msg; }
          throw new Error(msg);
        }
        const data = JSON.parse(txt);
        return (data?.text || data?.transcript || "") as string;
      }, 3, 1000);

      // Deduct credits
      await supabase
        .from("credits")
        .upsert({ user_id: user.id, amount: currentCredits - STT_COST, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
      await supabase.from("credit_transactions").insert({
        user_id: user.id,
        amount: -STT_COST,
        reason: "speech_to_text",
      });

      // Update record
      await supabase
        .from("speech_to_text_history")
        .update({ status: "completed", transcript, updated_at: new Date().toISOString() })
        .eq("id", record.id);

      return NextResponse.json({ id: record.id, transcript, credits_remaining: currentCredits - STT_COST });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "STT failed";
      console.error("[speech-to-text] error:", msg);
      await supabase
        .from("speech_to_text_history")
        .update({ status: "failed" })
        .eq("id", record.id);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
