/**
 * AgentShield — GET /api/stats
 *
 * Returns aggregate scan statistics for the Dashboard page.
 *
 * Response:
 *   200 { totalRequests, blocked, allowed, averageRisk }
 *   500 { error: string }
 */

import { NextResponse } from "next/server";
import { getLogStats } from "@/lib/logger/logger";

export async function GET(): Promise<NextResponse> {
  try {
    const stats = await getLogStats();
    return NextResponse.json(stats, { status: 200 });
  } catch (err) {
    console.error("[AgentShield /api/stats] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch stats." },
      { status: 500 }
    );
  }
}
