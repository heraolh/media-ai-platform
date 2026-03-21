import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-02-25.clover"
});

// 积分包配置：credits -> price_cents
const CREDIT_PACKAGES: Record<number, number> = {
  100: 1000,  // 100积分 = 10元 = 1000分
  500: 4500,  // 500积分 = 45元 = 4500分
};

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
    const credits = typeof body?.credits === "number" ? body.credits : 0;

    if (!CREDIT_PACKAGES[credits]) {
      return NextResponse.json(
        { error: `Invalid credits amount. Supported: ${Object.keys(CREDIT_PACKAGES).join(", ")}` },
        { status: 400 }
      );
    }

    const priceCents = CREDIT_PACKAGES[credits];
    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    // 先在数据库创建 pending 订单
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        credits_amount: credits,
        price_cents: priceCents,
        status: "pending",
      })
      .select()
      .single();

    if (orderError || !order) {
      throw new Error(orderError?.message || "Failed to create order");
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "cny",
            product_data: {
              name: `${credits} 积分`,
              description: `充值 ${credits} 积分到您的账户`,
            },
            unit_amount: priceCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/dashboard?payment=success&credits=${credits}`,
      cancel_url: `${origin}/dashboard?payment=cancelled`,
      metadata: {
        user_id: user.id,
        credits: credits.toString(),
        order_id: order.id,
      },
    });

    // 更新订单，保存 stripe_session_id
    await supabase
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", order.id);

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[stripe/checkout] 错误:", error);
    const message = error instanceof Error ? error.message : "Checkout failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
