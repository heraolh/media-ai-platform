import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function adminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const TABLE_MAP: Record<string, string> = {
  image: "generations",
  video: "video_generations",
  speech: "speech_generations",
  workflow: "workflows",
  image_understand: "image_understand_history",
  speech_to_text: "speech_to_text_history",
};

export async function GET(
  _req: NextRequest,
  ctx: RouteContext<"/api/share/[token]">
) {
  try {
    const { token } = await ctx.params;
    const supabase = adminClient();

    const { data: link, error: linkErr } = await supabase
      .from("share_links")
      .select("*")
      .eq("token", token)
      .single();

    if (linkErr || !link) {
      return NextResponse.json({ error: "Share link not found" }, { status: 404 });
    }

    if (new Date(link.expires_at) < new Date()) {
      return NextResponse.json({ error: "Share link has expired" }, { status: 410 });
    }

    await supabase
      .from("share_links")
      .update({ view_count: link.view_count + 1 })
      .eq("id", link.id);

    const table = TABLE_MAP[link.content_type];
    if (!table) {
      return NextResponse.json({ error: "Unknown content type" }, { status: 400 });
    }

    const { data: content, error: contentErr } = await supabase
      .from(table)
      .select("*")
      .eq("id", link.content_id)
      .single();

    if (contentErr || !content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    const expiresInHours = Math.max(
      0,
      Math.round((new Date(link.expires_at).getTime() - Date.now()) / 3_600_000)
    );

    return NextResponse.json({
      content_type: link.content_type,
      content,
      expires_in: expiresInHours,
      view_count: link.view_count + 1,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
