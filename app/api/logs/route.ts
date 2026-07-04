/**
 * AgentShield — GET /api/logs
 *
 * Returns recent ScanLog records for the Logs UI page.
 *
 * Query parameters:
 *   page      (optional, default 1)
 *   pageSize  (optional, default 20)
 *   tool      (optional, filters by toolName)
 *   status    (optional, filters by status)
 *   riskLevel (optional, filters by riskLevel)
 *
 * Response:
 *   200 { logs: ScanLog[], total: number, page: number, pageSize: number }
 *   500 { error: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getRecentLogs, getTotalLogsCount } from "@/lib/logger/logger";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    
    // Pagination params
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)),
      100 // Cap max page size to 100
    );
    const skip = (page - 1) * pageSize;

    // Filter params
    const toolName = searchParams.get("tool") || undefined;
    const status = searchParams.get("status") || undefined;
    const riskLevel = searchParams.get("riskLevel") || undefined;

    const filters = { toolName, status, riskLevel };

    // Fetch data and count in parallel
    const [logs, total] = await Promise.all([
      getRecentLogs({ skip, take: pageSize, ...filters }),
      getTotalLogsCount(filters),
    ]);

    // Parse detectedPatterns from JSON string back to array for the client.
    const parsed = logs.map((log) => ({
      ...log,
      detectedPatterns: (() => {
        try {
          return JSON.parse(log.detectedPatterns);
        } catch {
          return [];
        }
      })(),
      timestamp: log.timestamp.toISOString(),
    }));

    return NextResponse.json({ logs: parsed, total, page, pageSize }, { status: 200 });
  } catch (err) {
    console.error("[AgentShield /api/logs] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch logs." },
      { status: 500 }
    );
  }
}

