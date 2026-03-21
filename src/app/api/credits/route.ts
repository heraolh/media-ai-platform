import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// GET /api/credits — 查询当前用户积分余额
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("credits")
      .select("amount")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = row not found（新用户还没有积分记录）
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ amount: data?.amount ?? 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch credits";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/credits — 扣除积分
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
    const amount = typeof body?.amount === "number" ? body.amount : 0;

    if (amount <= 0) {
      return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });
    }

    // 查询当前余额
    const { data: creditRow, error: fetchError } = await supabase
      .from("credits")
      .select("amount")
      .eq("user_id", user.id)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const currentAmount = creditRow?.amount ?? 0;

    if (currentAmount < amount) {
      return NextResponse.json(
        { error: `积分不足，当前余额 ${currentAmount}，需要 ${amount}` },
        { status: 402 }
      );
    }

    const newAmount = currentAmount - amount;

    const { error: updateError } = await supabase
      .from("credits")
      .upsert(
        { user_id: user.id, amount: newAmount, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, amount: newAmount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to deduct credits";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
