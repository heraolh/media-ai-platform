import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const TABLE_MAP: Record<string, string> = {
  image: "generations",
  video: "video_generations",
  speech: "speech_generations",
  workflow: "workflows",
  image_understand: "image_understand_history",
  speech_to_text: "speech_to_text_history",
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const type = typeof body?.type === "string" ? body.type : "";
    const id = typeof body?.id === "string" ? body.id : "";
    const rating = typeof body?.rating === "number" ? body.rating : null;
    const feedback_text = typeof body?.feedback_text === "string" ? body.feedback_text : null;
    const is_favorite = typeof body?.is_favorite === "boolean" ? body.is_favorite : undefined;

    const table = TABLE_MAP[type];
    if (!table) {
      return NextResponse.json({ error: `Invalid type. Allowed: ${Object.keys(TABLE_MAP).join(", ")}` }, { status: 400 });
    }
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    if (rating !== null && (rating < 1 || rating > 5)) {
      return NextResponse.json({ error: "rating must be 1-5" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (rating !== null) updates.rating = rating;
    if (feedback_text !== null) updates.feedback_text = feedback_text;
    if (is_favorite !== undefined) updates.is_favorite = is_favorite;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const { error } = await supabase
      .from(table)
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
