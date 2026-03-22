import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const WORKFLOW_COST = 62;

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
    const name = typeof body?.name === "string" ? body.name.trim() : undefined;

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    // 检查积分是否充足
    const { data: creditRow } = await supabase
      .from("credits")
      .select("amount")
      .eq("user_id", user.id)
      .single();

    const currentCredits = creditRow?.amount ?? 0;
    if (currentCredits < WORKFLOW_COST) {
      return NextResponse.json(
        { error: `积分不足，当前余额 ${currentCredits}，需要 ${WORKFLOW_COST} 积分` },
        { status: 402 }
      );
    }

    // 原子操作：预扣积分 + 创建 workflow
    const { data: workflowId, error: rpcError } = await supabase.rpc(
      "create_workflow_with_credits",
      {
        p_user_id: user.id,
        p_prompt: prompt,
        p_name: name ?? null,
      }
    );

    if (rpcError) {
      if (rpcError.message?.includes("INSUFFICIENT_CREDITS")) {
        return NextResponse.json(
          { error: "积分不足" },
          { status: 402 }
        );
      }
      console.error("[workflows] RPC error:", rpcError);
      return NextResponse.json({ error: rpcError.message }, { status: 500 });
    }

    const id = workflowId as string;

    // 异步触发 execute（fire-and-forget）
    const executeUrl = new URL(
      `/api/workflows/${id}/execute`,
      req.url
    ).toString();

    fetch(executeUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.INTERNAL_API_SECRET}`,
        "Content-Type": "application/json",
      },
    }).catch((err) => {
      console.error("[workflows] Failed to trigger execute:", err);
    });

    return NextResponse.json({ workflow_id: id });
  } catch (error) {
    console.error("[workflows] Outer error:", error);
    const message = error instanceof Error ? error.message : "Failed to create workflow";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
