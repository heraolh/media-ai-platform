import { uploadToR2 } from "@/lib/r2";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { withRetry, withCircuitBreaker, CircuitOpenError } from "@/lib/circuit-breaker";

export const runtime = "nodejs";
export const maxDuration = 300;

const MINIMAX_BASE = "https://api.minimaxi.com";

function minimaxHeaders() {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error("MINIMAX_API_KEY is not set");
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

function adminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  req: NextRequest,
  ctx: RouteContext<"/api/workflows/[id]/execute">
) {
  const authHeader = req.headers.get("authorization") ?? "";
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const supabase = adminClient();

  const { data: workflow, error: fetchError } = await supabase
    .from("workflows")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const userId: string = workflow.user_id;
  const prompt: string = workflow.prompt;

  async function updateWorkflow(fields: Record<string, unknown>) {
    await supabase.from("workflows")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id);
  }

  async function refund(amount: number, reason: string) {
    const { error } = await supabase.rpc("refund_workflow_credits", {
      p_user_id: userId, p_workflow_id: id, p_amount: amount, p_reason: reason,
    });
    if (error) console.error("[execute] refund error:", error);
  }

  async function incrementRetry() {
    await supabase.from("workflows")
      .update({ retry_count: (workflow.retry_count ?? 0) + 1 })
      .eq("id", id);
  }

  // ── Step 1: Text → Image ────────────────────────────────────────────────
  let imageUrl: string;
  try {
    console.log("[execute] Step 1: image", id);
    const sfKey = process.env.SILICONFLOW_API_KEY;
    if (!sfKey) throw new Error("SILICONFLOW_API_KEY is not set");

    imageUrl = await withCircuitBreaker("siliconflow", () =>
      withRetry(async () => {
        const res = await fetch("https://api.siliconflow.cn/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${sfKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "Qwen/Qwen2.5-VL-72B-Instruct", prompt, width: 1024, height: 1024 }),
          signal: AbortSignal.timeout(60_000),
        });
        const txt = await res.text();
        if (!res.ok) { let m = "Image failed"; try { m = JSON.parse(txt)?.message || m; } catch { m = txt || m; } throw new Error(m); }
        const url = JSON.parse(txt)?.images?.[0]?.url;
        if (!url) throw new Error("No image URL returned");
        return url as string;
      }, 3, 1000)
    );

    await updateWorkflow({ status: "image_done", results: { ...workflow.results, image: imageUrl } });
    console.log("[execute] Step 1 done:", imageUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Image generation failed";
    const fallbackUsed = err instanceof CircuitOpenError;
    console.error("[execute] Step 1 failed:", msg);
    await incrementRetry();
    await updateWorkflow({ status: "failed", failed_step: "image", fallback_used: fallbackUsed, error_details: { step: "image", error: msg } });
    await refund(62, "workflow_image_failed");
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // ── Step 2: Image → Video ────────────────────────────────────────────────
  let videoR2Url: string;
  try {
    console.log("[execute] Step 2: video", id);

    videoR2Url = await withCircuitBreaker("minimax", async () => {
      // Submit with retry
      const taskId = await withRetry(async () => {
        const res = await fetch(`${MINIMAX_BASE}/v1/video_generation`, {
          method: "POST",
          headers: minimaxHeaders(),
          body: JSON.stringify({ model: "MiniMax-Hailuo-02", prompt, first_frame_image: imageUrl }),
          signal: AbortSignal.timeout(30_000),
        });
        const txt = await res.text();
        if (!res.ok) { let m = "Video submit failed"; try { m = JSON.parse(txt)?.base_resp?.status_msg || m; } catch { m = txt || m; } throw new Error(m); }
        const tid = JSON.parse(txt)?.task_id || JSON.parse(txt)?.data?.task_id || "";
        if (!tid) throw new Error("No task_id");
        return tid as string;
      }, 3, 2000);

      // Poll with exponential backoff up to 5 minutes
      const pollStart = Date.now();
      let pollInterval = 5000;
      let videoDownloadUrl = "";
      while (true) {
        if (Date.now() - pollStart > 4 * 60 * 1000) throw new Error("Video generation timed out");
        await new Promise(r => setTimeout(r, pollInterval));
        pollInterval = Math.min(pollInterval * 1.5, 30_000);

        const statusRes = await fetch(
          `${MINIMAX_BASE}/v1/query/video_generation?task_id=${encodeURIComponent(taskId)}`,
          { headers: minimaxHeaders(), signal: AbortSignal.timeout(10_000) }
        );
        if (!statusRes.ok) continue;
        const sd = await statusRes.json();
        const st: string = sd?.status || sd?.data?.status || "";

        if (st === "Success" || st === "success") {
          const fileId = sd?.file_id || sd?.data?.file_id || "";
          if (!fileId) throw new Error("No file_id");
          const fileRes = await fetch(`${MINIMAX_BASE}/v1/files/retrieve?file_id=${encodeURIComponent(fileId)}`, { headers: minimaxHeaders() });
          if (!fileRes.ok) throw new Error("Failed to retrieve video file");
          const fd = await fileRes.json();
          videoDownloadUrl = fd?.file?.download_url || fd?.download_url || "";
          if (!videoDownloadUrl) throw new Error("No download URL");
          break;
        }
        if (st === "Fail" || st === "fail" || st === "failed") {
          throw new Error(sd?.base_resp?.status_msg || "Video generation failed");
        }
      }

      const videoResp = await fetch(videoDownloadUrl, { signal: AbortSignal.timeout(120_000) });
      if (!videoResp.ok) throw new Error(`Download failed: HTTP ${videoResp.status}`);
      const buf = await videoResp.arrayBuffer();
      const key = `videos/${userId}/${taskId}.mp4`;
      return await uploadToR2(key, buf, "video/mp4");
    });

    const { data: wf2 } = await supabase.from("workflows").select("results").eq("id", id).single();
    await updateWorkflow({ status: "video_done", results: { ...(wf2?.results ?? {}), video: videoR2Url } });
    console.log("[execute] Step 2 done:", videoR2Url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Video generation failed";
    const isCircuitOpen = err instanceof CircuitOpenError;
    console.error("[execute] Step 2 failed:", msg);

    // Degradation: skip video, mark as fallback and continue with speech only
    if (isCircuitOpen) {
      console.warn("[execute] MiniMax circuit OPEN — skipping video step (degraded mode)");
      await updateWorkflow({ fallback_used: true, error_details: { step: "video", error: msg, skipped: true } });
      await refund(52, "workflow_video_skipped_circuit_open");
      videoR2Url = ""; // will be empty in results
    } else {
      await incrementRetry();
      await updateWorkflow({ status: "failed", failed_step: "video", fallback_used: false, error_details: { step: "video", error: msg } });
      await refund(52, "workflow_video_failed");
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  // ── Step 3: Text → Speech ────────────────────────────────────────────────
  let speechR2Url: string;
  try {
    console.log("[execute] Step 3: speech", id);
    const sfKey = process.env.SILICONFLOW_API_KEY;
    if (!sfKey) throw new Error("SILICONFLOW_API_KEY is not set");

    speechR2Url = await withCircuitBreaker("siliconflow", () =>
      withRetry(async () => {
        const model = "FunAudioLLM/CosyVoice2-0.5B";
        const res = await fetch("https://api.siliconflow.cn/v1/audio/speech", {
          method: "POST",
          headers: { Authorization: `Bearer ${sfKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, input: prompt, voice: `${model}:alex`, response_format: "mp3", speed: 1.0 }),
          signal: AbortSignal.timeout(60_000),
        });
        if (!res.ok) { const t = await res.text(); let m = "Speech failed"; try { m = JSON.parse(t)?.message || m; } catch { m = t || m; } throw new Error(m); }
        const buf = await res.arrayBuffer();
        const key = `audio/${userId}/${crypto.randomUUID()}.mp3`;
        return await uploadToR2(key, buf, "audio/mpeg");
      }, 3, 1000)
    );

    const { data: wf3 } = await supabase.from("workflows").select("results").eq("id", id).single();
    const results = { ...(wf3?.results ?? {}), speech: speechR2Url };
    if (videoR2Url) results.video = videoR2Url;
    await updateWorkflow({ status: "completed", results });
    console.log("[execute] Step 3 done. Workflow completed:", id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Speech generation failed";
    const isCircuitOpen = err instanceof CircuitOpenError;
    console.error("[execute] Step 3 failed:", msg);

    // Degradation: if circuit open, mark completed with what we have
    if (isCircuitOpen) {
      console.warn("[execute] SiliconFlow circuit OPEN — completing without speech (degraded mode)");
      const { data: wf3 } = await supabase.from("workflows").select("results").eq("id", id).single();
      await updateWorkflow({ status: "completed", fallback_used: true, results: wf3?.results ?? {}, error_details: { step: "speech", error: msg, skipped: true } });
      await refund(2, "workflow_speech_skipped_circuit_open");
    } else {
      await incrementRetry();
      await updateWorkflow({ status: "failed", failed_step: "speech", error_details: { step: "speech", error: msg } });
      await refund(2, "workflow_speech_failed");
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, workflow_id: id });
}
