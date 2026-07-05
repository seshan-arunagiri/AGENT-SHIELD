/**
 * AgentShield — Scan Logger
 *
 * Thin abstraction over Prisma for writing and reading ScanLog records.
 * All database interaction is isolated here so that:
 *   - Route handlers and the scanner remain agnostic of the ORM.
 *   - Swapping the database (e.g. Postgres in production) only requires
 *     changing the Prisma schema and this file.
 *   - Unit tests can mock this module without touching Prisma at all.
 */

import { prisma } from "@/lib/db/prisma";
import type { ScanLog } from "@prisma/client";
import type { ThreatPattern } from "@/types/types";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The data required to create a new ScanLog row.
 * Omits `id` (auto-incremented) and `timestamp` (database default).
 */
export type CreateScanLogInput = {
  toolName: string;
  scenario: string;
  riskScore: number;
  riskLevel: string;
  /** Pass the ThreatPattern[] directly — we JSON.stringify it internally. */
  detectedPatterns: ThreatPattern[];
  originalContent: string;
  sanitizedContent: string;
  /** "Blocked" if riskLevel is Medium or Critical, "Allowed" otherwise. */
  status: "Blocked" | "Allowed";
  /** Optional AI verification verdict (JSON stringified). */
  aiVerdict?: string;
};

/** Aggregate stats for the dashboard. */
export interface LogStats {
  totalRequests: number;
  blocked: number;
  allowed: number;
  averageRisk: number;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Write a new ScanLog record to the database.
 *
 * @param entry - All fields except id and timestamp.
 * @returns      The created ScanLog row (including assigned id and timestamp).
 */
export async function logScan(entry: CreateScanLogInput): Promise<ScanLog> {
  return prisma.scanLog.create({
    data: {
      toolName: entry.toolName,
      scenario: entry.scenario,
      riskScore: entry.riskScore,
      riskLevel: entry.riskLevel,
      // Serialise the ThreatPattern array to a JSON string for storage.
      // The consumer (getRecentLogs) deserialises it back on read.
      detectedPatterns: JSON.stringify(entry.detectedPatterns),
      originalContent: entry.originalContent,
      sanitizedContent: entry.sanitizedContent,
      status: entry.status,
      aiVerdict: entry.aiVerdict,
    },
  });
}

/**
 * Fetch ScanLog records with pagination and server-side filtering.
 *
 * @param options - Pagination and filter parameters.
 * @returns      Array of ScanLog rows ordered by timestamp DESC.
 *
 * Note: detectedPatterns is returned as a raw JSON string — callers should
 * JSON.parse it if they need the structured ThreatPattern array.
 */
export async function getRecentLogs(options: {
  skip?: number;
  take?: number;
  toolName?: string;
  status?: string;
  riskLevel?: string;
} = {}): Promise<ScanLog[]> {
  const { skip = 0, take = 50, toolName, status, riskLevel } = options;

  const where: any = {};
  if (toolName && toolName !== "All") where.toolName = toolName;
  if (status && status !== "All") where.status = status;
  if (riskLevel && riskLevel !== "All") where.riskLevel = riskLevel;

  return prisma.scanLog.findMany({
    where,
    orderBy: { timestamp: "desc" },
    skip,
    take,
  });
}

/**
 * Get the total count of ScanLog records matching the given filters.
 *
 * @param filters - The same filter parameters used in getRecentLogs.
 * @returns Total count of matching records.
 */
export async function getTotalLogsCount(filters: {
  toolName?: string;
  status?: string;
  riskLevel?: string;
} = {}): Promise<number> {
  const { toolName, status, riskLevel } = filters;

  const where: any = {};
  if (toolName && toolName !== "All") where.toolName = toolName;
  if (status && status !== "All") where.status = status;
  if (riskLevel && riskLevel !== "All") where.riskLevel = riskLevel;

  return prisma.scanLog.count({ where });
}

/**
 * Compute aggregate statistics across all stored scan logs.
 *
 * Used by the dashboard to display summary metrics:
 *   - totalRequests: total number of scans ever logged
 *   - blocked: count of scans with status "Blocked"
 *   - allowed: count of scans with status "Allowed"
 *   - averageRisk: mean riskScore across all scans (0 if no logs)
 *
 * @returns LogStats — always resolves; returns all-zero values if empty.
 */
export async function getLogStats(): Promise<LogStats> {
  // Run all three aggregates in parallel — no sequential dependency.
  const [totalRequests, blocked, riskAggregate] = await Promise.all([
    prisma.scanLog.count(),
    prisma.scanLog.count({ where: { status: "Blocked" } }),
    prisma.scanLog.aggregate({ _avg: { riskScore: true } }),
  ]);

  return {
    totalRequests,
    blocked,
    allowed: totalRequests - blocked,
    // _avg.riskScore is null when the table is empty — default to 0.
    averageRisk: Math.round(riskAggregate._avg.riskScore ?? 0),
  };
}

/**
 * Compute the top threat patterns from the last 100 logs.
 * This satisfies the "Top Threats" dashboard requirement.
 * 
 * @param sampleSize - How many recent logs to analyze (default 100).
 * @returns Array of { category, count } representing the most frequent threats.
 */
export async function getTopThreats(sampleSize: number = 100): Promise<{ category: string; count: number }[]> {
  const recentLogs = await prisma.scanLog.findMany({
    orderBy: { timestamp: "desc" },
    take: sampleSize,
    select: { detectedPatterns: true }
  });

  const categoryCounts: Record<string, number> = {};

  for (const log of recentLogs) {
    if (!log.detectedPatterns) continue;
    try {
      const patterns: ThreatPattern[] = JSON.parse(log.detectedPatterns);
      for (const p of patterns) {
        categoryCounts[p.category] = (categoryCounts[p.category] || 0) + 1;
      }
    } catch {
      // Ignore parse errors on individual rows
    }
  }

  // Convert to array and sort descending by count
  return Object.entries(categoryCounts)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5); // Return top 5
}

