import { NextResponse } from "next/server";
import { getCircuitInfo } from "@/lib/circuit-breaker";

export const runtime = "nodejs";

async function checkSiliconFlow(): Promise<{ status: string; latency_ms: number }> {
  const start = Date.now();
  try {
    const sfKey = process.env.SILICONFLOW_API_KEY;
    if (!sfKey) return { status: "unconfigured", latency_ms: 0 };
    const res = await fetch("https://api.siliconflow.cn/v1/models", {
      headers: { Authorization: `Bearer ${sfKey}` },
      signal: AbortSignal.timeout(5000),
    });
    return { status: res.ok ? "up" : "degraded", latency_ms: Date.now() - start };
  } catch {
    return { status: "down", latency_ms: Date.now() - start };
  }
}

async function checkMiniMax(): Promise<{ status: string; latency_ms: number }> {
  const start = Date.now();
  try {
    const apiKey = process.env.MINIMAX_API_KEY;
    if (!apiKey) return { status: "unconfigured", latency_ms: 0 };
    const res = await fetch("https://api.minimaxi.com/v1/query/video_generation?task_id=health_check", {
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    // 404 or 400 is fine — means the service is reachable
    const ok = res.status < 500;
    return { status: ok ? "up" : "degraded", latency_ms: Date.now() - start };
  } catch {
    return { status: "down", latency_ms: Date.now() - start };
  }
}

async function checkR2(): Promise<{ status: string }> {
  try {
    const endpoint = process.env.R2_ENDPOINT;
    if (!endpoint) return { status: "unconfigured" };
    const res = await fetch(endpoint, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    // R2 endpoint returns 403/400 for unauthenticated HEAD — that's fine, it means it's reachable
    return { status: res.status < 500 ? "up" : "degraded" };
  } catch {
    return { status: "down" };
  }
}

export async function GET() {
  const [sfResult, mmResult, r2Result] = await Promise.all([
    checkSiliconFlow(),
    checkMiniMax(),
    checkR2(),
  ]);

  const sfCircuit = getCircuitInfo("siliconflow");
  const mmCircuit = getCircuitInfo("minimax");

  const allStatuses = [sfResult.status, mmResult.status, r2Result.status];
  const overallStatus = allStatuses.every((s) => s === "up" || s === "unconfigured")
    ? "healthy"
    : allStatuses.some((s) => s === "down")
    ? "unhealthy"
    : "degraded";

  return NextResponse.json({
    status: overallStatus,
    services: {
      siliconflow: {
        status: sfResult.status,
        latency_ms: sfResult.latency_ms,
        circuit_state: sfCircuit.state,
      },
      minimax: {
        status: mmResult.status,
        latency_ms: mmResult.latency_ms,
        circuit_state: mmCircuit.state,
      },
      r2: { status: r2Result.status },
    },
    timestamp: new Date().toISOString(),
  });
}
