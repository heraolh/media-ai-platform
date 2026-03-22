import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const TOTAL_STEPS = 3;

function statusToStep(status: string): number {
  switch (status) {
    case "pending":    return 0;
    case "image_done": return 1;
    case "video_done": return 2;
    case "completed":  return 3;
    case "failed":     return -1;
    default:           return 0;
  }
}

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/workflows/[id]">
) {
  try {
    const { id } = await ctx.params;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: workflow, error } = await supabase
      .from("workflows")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !workflow) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const currentStep = statusToStep(workflow.status);
    const progress =
      workflow.status === "failed"
        ? null
        : Math.round((currentStep / TOTAL_STEPS) * 100);

    return NextResponse.json({
      ...workflow,
      progress,
      current_step: currentStep,
      total_steps: TOTAL_STEPS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch workflow";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
