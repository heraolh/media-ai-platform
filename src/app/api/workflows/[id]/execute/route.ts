import { uploadToR2 } from "@/lib/r2";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

export const runtime = "nodejs";
// Allow up to 5 minutes for the full pipeline
export const maxDuration = 300;

const MINIMAX_BASE = "https://api.minimaxi.chat";

function minimaxHeaders() {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error("MINIMAX_API_KEY is not set");
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

// Use service-role client for internal mutations (bypasses RLS)
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
  // ── Auth: internal secret ────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization") ?? "";
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const supabase = adminClient();

  // Fetch workflow record
  const { data: workflow, error: fetchError } = await supabase
    .from("workflows")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !workflow) {
    console.error("[execute] workflow not found:", id);
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  const userId: string = workflow.user_id;
  const prompt: string = workflow.prompt;

  // Helper: update workflow fields
  async function updateWorkflow(fields: Record<string, unknown>) {
    await supabase
      .from("workflows")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id);
  }

  // Helper: refund credits via RPC
  async function refund(amount: number, reason: string) {
    const { error } = await supabase.rpc("refund_workflow_credits", {
      p_user_id: userId,
      p_workflow_id: id,
      p_amount: amount,
      p_reason: reason,
    });
    if (error) console.error("[execute] refund error:", error);
  }

  // ── Step 1: Text → Image ─────────────────────────────────────────────────
  let imageUrl: string;
  try {
    console.log("[execute] Step 1: generating image for workflow", id);
    const sfKey = process.env.SILICONFLOW_API_KEY;
    if (!sfKey) throw new Error("SILICONFLOW_API_KEY is not set");

    const imgRes = await fetch("https://api.siliconflow.cn/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sfKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "Qwen/Qwen-Image",
        prompt,
        width: 1024,
        height: 1024,
      }),
    });

    const imgText = await imgRes.text();
    if (!imgRes.ok) {
      let msg = "Image generation failed";
      try { msg = JSON.parse(imgText)?.message || msg; } catch { msg = imgText || msg; }
      throw new Error(msg);
    }
    const imgData = JSON.parse(imgText);
    imageUrl = imgData?.images?.[0]?.url;
    if (!imageUrl) throw new Error("No image URL returned");

    await updateWorkflow({
      status: "image_done",
      results: { ...workflow.results, image: imageUrl },
    });
    console.log("[execute] Step 1 done:", imageUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Image generation failed";
    console.error("[execute] Step 1 failed:", msg);
    await updateWorkflow({ status: "failed", failed_step: "image" });
    await refund(62, "workflow_image_failed");
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // ── Step 2: Image → Video ────────────────────────────────────────────────
  let videoR2Url: string;
  try {
    console.log("[execute] Step 2: generating video for workflow", id);

    // Submit task
    const submitRes = await fetch(`${MINIMAX_BASE}/v1/video_generation`, {
      method: "POST",
      headers: minimaxHeaders(),
      body: JSON.stringify({
        model: "MiniMax-Hailuo-02",
        prompt,
        first_frame_image: imageUrl,
      }),
    });

    const submitText = await submitRes.text();
    console.log("[execute] MiniMax submit:", submitText);
    if (!submitRes.ok) {
      let msg = "Video submission failed";
      try { msg = JSON.parse(submitText)?.message || JSON.parse(submitText)?.base_resp?.status_msg || msg; } catch { msg = submitText || msg; }
      throw new Error(msg);
    }
    const submitData = JSON.parse(submitText);
    const taskId: string = submitData?.task_id || submitData?.data?.task_id || "";
    if (!taskId) throw new Error("No task_id returned from MiniMax");

    // Poll until complete
    let videoDownloadUrl: string | undefined;
    const pollStart = Date.now();
    const POLL_TIMEOUT = 4 * 60 * 1000; // 4 minutes

    while (true) {
      if (Date.now() - pollStart > POLL_TIMEOUT) {
        throw new Error("Video generation timed out");
      }

      await new Promise((r) => setTimeout(r, 5000));

      const statusRes = await fetch(
        `${MINIMAX_BASE}/v1/query/video_generation?task_id=${encodeURIComponent(taskId)}`,
        { headers: minimaxHeaders() }
      );
      const statusText = await statusRes.text();
      console.log("[execute] MiniMax poll:", statusText);

      if (!statusRes.ok) continue;

      const statusData = JSON.parse(statusText);
      const mmStatus: string =
        statusData?.status || statusData?.data?.status || "";

      if (mmStatus === "Success" || mmStatus === "success") {
        const fileId: string =
          statusData?.file_id || statusData?.data?.file_id || "";
        if (!fileId) throw new Error("No file_id in completed video response");

        // Get download URL
        const fileRes = await fetch(
          `${MINIMAX_BASE}/v1/files/retrieve?file_id=${encodeURIComponent(fileId)}`,
          { headers: minimaxHeaders() }
        );
        if (!fileRes.ok) throw new Error("Failed to retrieve video file info");
        const fileData = await fileRes.json();
        videoDownloadUrl =
          fileData?.file?.download_url || fileData?.download_url;
        if (!videoDownloadUrl) throw new Error("No download URL for video");
        break;
      }

      if (
        mmStatus === "Fail" ||
        mmStatus === "fail" ||
        mmStatus === "failed"
      ) {
        const errMsg =
          statusData?.base_resp?.status_msg || "Video generation failed";
        throw new Error(errMsg);
      }
      // Still processing — continue polling
    }

    // Download video and upload to R2
    console.log("[execute] Downloading video from:", videoDownloadUrl);
    const videoResp = await fetch(videoDownloadUrl!);
    if (!videoResp.ok)
      throw new Error(`Failed to download video: HTTP ${videoResp.status}`);
    const videoBuffer = await videoResp.arrayBuffer();
    const videoKey = `videos/${userId}/${taskId}.mp4`;
    videoR2Url = await uploadToR2(videoKey, videoBuffer, "video/mp4");
    console.log("[execute] Step 2 done, R2 URL:", videoR2Url);

    // Fetch latest results to merge
    const { data: wf2 } = await supabase
      .from("workflows")
      .select("results")
      .eq("id", id)
      .single();

    await updateWorkflow({
      status: "video_done",
      results: { ...(wf2?.results ?? {}), video: videoR2Url },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Video generation failed";
    console.error("[execute] Step 2 failed:", msg);
    await updateWorkflow({ status: "failed", failed_step: "video" });
    // Refund video cost (52 credits)
    await refund(52, "workflow_video_failed");
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // ── Step 3: Text → Speech ────────────────────────────────────────────────
  let speechR2Url: string;
  try {
    console.log("[execute] Step 3: generating speech for workflow", id);
    const sfKey = process.env.SILICONFLOW_API_KEY;
    if (!sfKey) throw new Error("SILICONFLOW_API_KEY is not set");

    const model = "FunAudioLLM/CosyVoice2-0.5B";
    const speechRes = await fetch("https://api.siliconflow.cn/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sfKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: prompt,
        voice: `${model}:alex`,
        response_format: "mp3",
        speed: 1.0,
      }),
    });

    if (!speechRes.ok) {
      const errText = await speechRes.text();
      let msg = "Speech generation failed";
      try { msg = JSON.parse(errText)?.message || msg; } catch { msg = errText || msg; }
      throw new Error(msg);
    }

    const speechBuffer = await speechRes.arrayBuffer();
    const speechKey = `audio/${userId}/${crypto.randomUUID()}.mp3`;
    speechR2Url = await uploadToR2(speechKey, speechBuffer, "audio/mpeg");
    console.log("[execute] Step 3 done, R2 URL:", speechR2Url);

    // Fetch latest results to merge
    const { data: wf3 } = await supabase
      .from("workflows")
      .select("results")
      .eq("id", id)
      .single();

    await updateWorkflow({
      status: "completed",
      results: { ...(wf3?.results ?? {}), speech: speechR2Url },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Speech generation failed";
    console.error("[execute] Step 3 failed:", msg);
    await updateWorkflow({ status: "failed", failed_step: "speech" });
    // Refund speech cost (2 credits)
    await refund(2, "workflow_speech_failed");
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  console.log("[execute] Workflow completed:", id);
  return NextResponse.json({ success: true, workflow_id: id });
}
