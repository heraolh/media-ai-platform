import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_TYPES = ["image", "video", "speech", "stt", "image_understand"];

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("workflow_templates")
      .select("id, user_id, name, description, steps, total_credits, is_public, is_system, created_at")
      .or(`is_system.eq.true,is_public.eq.true,user_id.eq.${user.id}`)
      .order("is_system", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ templates: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    const steps = Array.isArray(body?.steps) ? body.steps : [];

    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
    if (steps.length < 1) return NextResponse.json({ error: "At least 1 step required" }, { status: 400 });

    // Validate step types
    for (const step of steps) {
      if (!ALLOWED_TYPES.includes(step?.type)) {
        return NextResponse.json(
          { error: `Invalid step type: ${step?.type}. Allowed: ${ALLOWED_TYPES.join(", ")}` },
          { status: 400 }
        );
      }
    }

    const total_credits = steps.reduce((sum: number, s: { credits?: number }) => sum + (s.credits ?? 0), 0);

    const { data, error } = await supabase
      .from("workflow_templates")
      .insert({
        user_id: user.id,
        name,
        description,
        steps,
        total_credits,
        is_public: false,
        is_system: false,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ template: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
