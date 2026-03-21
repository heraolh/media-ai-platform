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

// GET /api/video-status?id=xxx
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
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    // 从数据库获取记录（校验属于当前用户）
    const { data: record, error: dbError } = await supabase
      .from("video_generations")
      .select("id, task_id, status, video_url, error_msg")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (dbError || !record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    // 如果已失败，直接返回
    if (record.status === "failed") {
      return NextResponse.json({
        status: record.status,
        video_url: record.video_url,
        error_msg: record.error_msg,
      });
    }

    // 如果已成功，检查 video_url 是否为永久 URL（Supabase 存储）
    // 若是 MiniMax 临时 URL 则继续往下重新转存
    if (record.status === "success") {
      const url = record.video_url ?? "";
      const isPersistent = url.includes(".supabase.co") || url.includes(".supabase.in");
      if (isPersistent) {
        return NextResponse.json({
          status: record.status,
          video_url: record.video_url,
          error_msg: record.error_msg,
        });
      }
      // 临时 URL：继续执行下方转存逻辑
      console.log("[video-status] 检测到临时 URL，尝试重新转存...");
    }

    // 还在处理中：查询 MiniMax API
    const taskId: string = record.task_id || "";
    if (!taskId) {
      return NextResponse.json({ status: record.status, progress: 0 });
    }

    let minimaxStatus = "unknown";
    let videoUrl: string | undefined;
    let progress = 0;

    try {
      const response = await fetch(
        `${MINIMAX_BASE}/v1/query/video_generation?task_id=${encodeURIComponent(taskId)}`,
        { headers: minimaxHeaders() }
      );

      const responseText = await response.text();
      console.log(`[video-status] task_id=${taskId} 响应:`, responseText);

      if (response.ok) {
        const data = JSON.parse(responseText);
        minimaxStatus = data?.status || data?.data?.status || "unknown";
        progress = typeof data?.progress === "number" ? data.progress : 0;
        const fileId: string = data?.file_id || data?.data?.file_id || "";

        if (
          (minimaxStatus === "Success" || minimaxStatus === "success") &&
          fileId
        ) {
          // 获取 MiniMax 下载 URL
          const fileResp = await fetch(
            `${MINIMAX_BASE}/v1/files/retrieve?file_id=${encodeURIComponent(fileId)}`,
            { headers: minimaxHeaders() }
          );
          if (fileResp.ok) {
            const fileData = await fileResp.json();
            videoUrl =
              fileData?.file?.download_url ||
              fileData?.download_url ||
              undefined;
            console.log("[video-status] 视频下载 URL:", videoUrl);
          }

          // 尝试将视频下载并永久保存到 Supabase Storage
          let persistentUrl: string | undefined;
          if (videoUrl) {
            try {
              console.log("[video-status] 开始下载视频到 Supabase Storage...");
              const videoResp = await fetch(videoUrl);
              if (!videoResp.ok) {
                throw new Error(`下载视频失败: HTTP ${videoResp.status}`);
              }
              const videoBuffer = await videoResp.arrayBuffer();
              const storagePath = `videos/${user.id}/${taskId}.mp4`;

              const { error: uploadError } = await supabase.storage
                .from("media-files")
                .upload(storagePath, videoBuffer, {
                  contentType: "video/mp4",
                  upsert: true,
                });

              if (uploadError) {
                throw new Error(`上传到 Supabase 失败: ${uploadError.message}`);
              }

              const { data: publicUrlData } = supabase.storage
                .from("media-files")
                .getPublicUrl(storagePath);

              persistentUrl = publicUrlData?.publicUrl;
              console.log("[video-status] 视频已保存到 Supabase:", persistentUrl);
            } catch (storageErr) {
              // 存储失败不影响主流程，保留原始 MiniMax URL
              console.error("[video-status] 保存到 Supabase 失败，使用原始 URL:", storageErr);
            }
          }

          const finalUrl = persistentUrl ?? videoUrl ?? null;

          await supabase
            .from("video_generations")
            .update({ status: "success", video_url: finalUrl })
            .eq("id", id);

          return NextResponse.json({
            status: "success",
            video_url: finalUrl,
            progress: 100,
          });
        }

        if (
          minimaxStatus === "Fail" ||
          minimaxStatus === "fail" ||
          minimaxStatus === "failed"
        ) {
          const errMsg =
            data?.base_resp?.status_msg || "Video generation failed";
          await supabase
            .from("video_generations")
            .update({ status: "failed", error_msg: errMsg })
            .eq("id", id);

          return NextResponse.json({ status: "failed", error_msg: errMsg });
        }
      }
    } catch (err) {
      console.error("[video-status] MiniMax 查询异常:", err);
    }

    return NextResponse.json({
      status: "processing",
      minimax_status: minimaxStatus,
      progress,
    });
  } catch (error) {
    console.error("[video-status] 外层错误:", error);
    const message =
      error instanceof Error ? error.message : "Status query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
