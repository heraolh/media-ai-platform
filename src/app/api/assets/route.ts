import { createClient } from "@/lib/supabase/server";
import { r2Client } from "@/lib/r2";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type"); // image | audio | video | null (all)

    let query = supabase
      .from("user_assets")
      .select("id, name, type, url, r2_key, size, mime_type, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (type && ["image", "audio", "video"].includes(type)) {
      query = query.eq("type", type);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ assets: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch assets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    // Fetch asset to get r2_key
    const { data: asset, error: fetchError } = await supabase
      .from("user_assets")
      .select("r2_key")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Delete from R2
    try {
      await r2Client.send(
        new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME!,
          Key: asset.r2_key,
        })
      );
    } catch (r2Err) {
      console.error("[assets] R2 delete error:", r2Err);
      // continue — delete DB record even if R2 fails
    }

    // Delete from DB
    const { error: dbError } = await supabase
      .from("user_assets")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete asset";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
