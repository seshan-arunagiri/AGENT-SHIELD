/**
 * AgentShield — GET /api/analytics
 *
 * Returns aggregated statistics for the Analytics dashboard.
 * - riskTrend: last 14 days { date, avgRisk }
 * - threatTypes: count of detected pattern categories
 * - safeVsBlocked: { safe: count, blocked: count }
 * - dailyActivity: last 7 days { date, requestCount }
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // We will compute aggregations from the last 14 days of logs
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const logs = await prisma.scanLog.findMany({
      where: {
        timestamp: {
          gte: fourteenDaysAgo,
        },
      },
      select: {
        timestamp: true,
        riskScore: true,
        status: true,
        detectedPatterns: true,
      },
      orderBy: { timestamp: "asc" },
    });

    // In-memory aggregations for SQLite support
    const safeVsBlocked = { safe: 0, blocked: 0 };
    const threatTypesMap: Record<string, number> = {};
    const dailyMap: Record<string, { totalRisk: number; count: number }> = {};

    for (const log of logs) {
      // Safe vs Blocked
      if (log.status === "Blocked") safeVsBlocked.blocked++;
      else safeVsBlocked.safe++;

      // Daily stats aggregation
      const dateStr = log.timestamp.toISOString().split("T")[0]; // YYYY-MM-DD
      if (!dailyMap[dateStr]) {
        dailyMap[dateStr] = { totalRisk: 0, count: 0 };
      }
      dailyMap[dateStr].totalRisk += log.riskScore;
      dailyMap[dateStr].count++;

      // Threat Types aggregation
      if (log.detectedPatterns) {
        try {
          const patterns = JSON.parse(log.detectedPatterns);
          for (const p of patterns) {
            threatTypesMap[p.category] = (threatTypesMap[p.category] || 0) + 1;
          }
        } catch {
          // ignore parsing error
        }
      }
    }

    // Format riskTrend (last 14 days)
    const riskTrend = Object.entries(dailyMap).map(([date, data]) => ({
      date,
      avgRisk: Math.round(data.totalRisk / data.count),
    }));

    // Format dailyActivity (last 7 days)
    const sevenDaysAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const dailyActivity = Object.entries(dailyMap)
      .filter(([date]) => date >= sevenDaysAgoStr)
      .map(([date, data]) => ({
        date,
        requestCount: data.count,
      }));

    // Format threatTypes
    const threatTypes = Object.entries(threatTypesMap)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      riskTrend,
      threatTypes,
      safeVsBlocked,
      dailyActivity,
    }, { status: 200 });

  } catch (err) {
    console.error("[AgentShield /api/analytics] Error fetching analytics:", err);
    return NextResponse.json(
      { error: "Failed to fetch analytics." },
      { status: 500 }
    );
  }
}
