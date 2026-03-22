import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";

const CONTENT_TYPES = ["image", "video", "speech", "workflow", "image_understand", "speech_to_text"];

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const content_type = typeof body?.content_type === "string" ? body.content_type : "";
    const content_id = typeof body?.content_id === "string" ? body.content_id : "";

    if (!CONTENT_TYPES.includes(content_type)) {
      return NextResponse.json({ error: `Invalid content_type. Allowed: ${CONTENT_TYPES.join(", ")}` }, { status: 400 });
    }
    if (!content_id) {
      return NextResponse.json({ error: "content_id is required" }, { status: 400 });
    }

    const token = crypto.randomBytes(16).toString("hex");
    const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("share_links")
      .insert({ content_type, content_id, user_id: user.id, token, expires_at })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const host = req.headers.get("host") ?? "localhost:3000";
    const protocol = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
    const share_url = `${protocol}://${host}/share/${token}`;

    return NextResponse.json({ share_url, token, expires_at, id: data.id }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabase
      .from("share_links")
      .select("id, content_type, content_id, token, expires_at, view_count, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ shares: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const { error } = await supabase
      .from("share_links")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Server error" }, { status: 500 });
  }
}
