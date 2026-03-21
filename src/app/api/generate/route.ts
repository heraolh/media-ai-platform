import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({} as { prompt?: unknown }));
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) {
      return NextResponse.json({ error: "Prompt required" }, { status: 400 });
    }

    const { data: record, error: insertError } = await supabase
      .from("generations")
      .insert({ user_id: user.id, prompt, status: "pending" })
      .select()
      .single();

    if (insertError || !record) {
      throw new Error(insertError?.message || "Failed to create generation record");
    }

    // 变量定义移到外层，确保 catch 块可以访问
    let siliconflowResponseText = "";
    let response: Response | null = null;

    try {
      const siliconflowApiKey = process.env.SILICONFLOW_API_KEY;
      if (!siliconflowApiKey) {
        throw new Error("SILICONFLOW_API_KEY is not set");
      }

      const modelName = "Qwen/Qwen-Image";

      console.log("使用的 API Key:", siliconflowApiKey.slice(0, 10) + "...");
      console.log("使用的模型:", modelName);

      response = await fetch(
        "https://api.siliconflow.cn/v1/images/generations",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${siliconflowApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: modelName,
            prompt,
            width: 1024,
            height: 1024,
          }),
        }
      );

      // 读取响应文本（只能读一次）
      siliconflowResponseText = await response.text();

      if (!response.ok) {
        let errMessage = "Generation failed";
        try {
          const errJson = JSON.parse(siliconflowResponseText);
          errMessage = errJson?.message || errJson?.error || errJson?.detail || errMessage;
        } catch {
          errMessage = siliconflowResponseText || errMessage;
        }
        throw new Error(errMessage);
      }

      let data: any = {};
      try {
        data = JSON.parse(siliconflowResponseText);
      } catch {
        throw new Error("Invalid JSON response from API");
      }

      const imageUrl = data?.images?.[0]?.url;
      if (!imageUrl) {
        throw new Error("No image url returned");
      }

      await supabase
        .from("generations")
        .update({ status: "completed", image_url: imageUrl })
        .eq("id", record.id);

      return NextResponse.json({ imageUrl, id: record.id });
    } catch (error) {
      // 打印详细错误日志
      console.error("生成错误详情:", error);
      console.error("SiliconFlow 响应内容:", siliconflowResponseText);

      const message = error instanceof Error ? error.message : "Generation failed";
      
      await supabase
        .from("generations")
        .update({ status: "failed", error_msg: message })
        .eq("id", record.id);

      return NextResponse.json({ error: message }, { status: 500 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}