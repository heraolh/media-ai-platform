import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover",
});

// Webhook 必须用 service role key 绕过 RLS
function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, serviceKey);
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("[webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createServiceClient();

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;
    const credits = parseInt(session.metadata?.credits || "0", 10);
    const orderId = session.metadata?.order_id;

    console.log(`[webhook] checkout.session.completed: user=${userId}, credits=${credits}, order=${orderId}`);

    if (!userId || !credits) {
      console.error("[webhook] Missing metadata");
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    try {
      // 更新订单状态为 paid
      if (orderId) {
        await supabase
          .from("orders")
          .update({
            status: "paid",
            stripe_session_id: session.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", orderId);
      }

      // 给用户增加积分（upsert）
      const { error: creditError } = await supabase.rpc("increment_credits", {
        p_user_id: userId,
        p_amount: credits,
      });

      if (creditError) {
        // 如果没有 RPC 函数，fallback 到手动 upsert
        console.warn("[webhook] RPC increment_credits 不可用，使用手动 upsert:", creditError.message);

        const { data: existing } = await supabase
          .from("credits")
          .select("amount")
          .eq("user_id", userId)
          .single();

        const newAmount = (existing?.amount ?? 0) + credits;

        await supabase
          .from("credits")
          .upsert(
            { user_id: userId, amount: newAmount, updated_at: new Date().toISOString() },
            { onConflict: "user_id" }
          );
      }

      console.log(`[webhook] 积分已增加 ${credits} 给用户 ${userId}`);
    } catch (err) {
      console.error("[webhook] 处理失败:", err);
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
