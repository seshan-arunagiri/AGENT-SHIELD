/**
 * AgentShield — GET /api/top-threats
 *
 * Returns the most frequently detected threat categories across recent logs.
 *
 * Query parameters:
 *   limit (optional, default 100) — sample size of recent logs to analyze
 *
 * Response:
 *   200 { threats: { category: string, count: number }[] }
 *   500 { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getTopThreats } from "@/lib/logger/logger";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const rawLimit = searchParams.get("limit");
    const limit = rawLimit ? Math.min(parseInt(rawLimit, 10) || 100, 1000) : 100;

    const threats = await getTopThreats(limit);

    return NextResponse.json({ threats }, { status: 200 });
  } catch (err) {
    console.error("[AgentShield /api/top-threats] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch top threats." },
      { status: 500 }
    );
  }
}
