import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MINIMAX_BASE = "https://api.minimaxi.com";

function minimaxHeaders() {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error("MINIMAX_API_KEY is not set");
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

// POST /api/generate-video — 提交视频生成任务
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
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const firstFrameImage =
      typeof body?.first_frame_image === "string"
        ? body.first_frame_image.trim()
        : undefined;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // 插入数据库记录（pending）
    const { data: record, error: insertError } = await supabase
      .from("video_generations")
      .insert({
        user_id: user.id,
        prompt,
        status: "pending",
      })
      .select()
      .single();

    if (insertError || !record) {
      throw new Error(insertError?.message || "Failed to create video record");
    }

    let apiResponseText = "";

    try {
      const requestBody: Record<string, unknown> = {
        model: "MiniMax-Hailuo-2.3",
        prompt,
      };
      if (firstFrameImage) {
        requestBody.first_frame_image = firstFrameImage;
      }

      console.log("视频生成请求体:", JSON.stringify(requestBody));

      const response = await fetch(`${MINIMAX_BASE}/v1/video_generation`, {
        method: "POST",
        headers: minimaxHeaders(),
        body: JSON.stringify(requestBody),
      });

      apiResponseText = await response.text();
      console.log("MiniMax 提交响应:", apiResponseText);

      if (!response.ok) {
        let errMessage = "Video generation submission failed";
        try {
          const errJson = JSON.parse(apiResponseText);
          errMessage =
            errJson?.message || errJson?.error || errJson?.base_resp?.status_msg || errMessage;
        } catch {
          errMessage = apiResponseText || errMessage;
        }
        throw new Error(errMessage);
      }

      const data = JSON.parse(apiResponseText);
      const taskId: string =
        data?.task_id || data?.data?.task_id || "";

      if (!taskId) {
        throw new Error("No task_id returned from MiniMax");
      }

      // 更新数据库记录，保存 task_id，状态改为 processing
      await supabase
        .from("video_generations")
        .update({ task_id: taskId, status: "processing" })
        .eq("id", record.id);

      return NextResponse.json({ id: record.id, task_id: taskId, status: "processing" });
    } catch (error) {
      console.error("视频提交错误:", error);
      console.error("API 响应内容:", apiResponseText);

      const message =
        error instanceof Error ? error.message : "Video generation failed";

      await supabase
        .from("video_generations")
        .update({ status: "failed", error_msg: message })
        .eq("id", record.id);

      return NextResponse.json({ error: message }, { status: 500 });
    }
  } catch (error) {
    console.error("外层错误:", error);
    const message =
      error instanceof Error ? error.message : "Video generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/generate-video?task_id=xxx — 直接用 task_id 查询状态（轮询备用）
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("task_id");

    if (!taskId) {
      return NextResponse.json({ error: "Missing task_id" }, { status: 400 });
    }

    const response = await fetch(
      `${MINIMAX_BASE}/v1/query/video_generation?task_id=${encodeURIComponent(taskId)}`,
      { headers: minimaxHeaders() }
    );

    const responseText = await response.text();
    console.log("MiniMax 状态查询响应:", responseText);

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to query status" }, { status: 500 });
    }

    const data = JSON.parse(responseText);
    const status: string = data?.status || data?.data?.status || "unknown";
    const fileId: string = data?.file_id || data?.data?.file_id || "";

    let videoUrl: string | undefined;

    if (status === "Success" && fileId) {
      // 通过 file_id 获取下载 URL
      const fileResp = await fetch(
        `${MINIMAX_BASE}/v1/files/retrieve?file_id=${encodeURIComponent(fileId)}`,
        { headers: minimaxHeaders() }
      );
      if (fileResp.ok) {
        const fileData = await fileResp.json();
        videoUrl = fileData?.file?.download_url || fileData?.download_url;
        console.log("视频下载 URL:", videoUrl);
      }
    }

    return NextResponse.json({ status, video_url: videoUrl, file_id: fileId });
  } catch (error) {
    console.error("状态查询错误:", error);
    const message = error instanceof Error ? error.message : "Status query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
