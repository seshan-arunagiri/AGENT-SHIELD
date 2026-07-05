/**
 * AgentShield — POST /api/scan
 *
 * Next.js Route Handler that accepts a tool + scenario, fetches the
 * corresponding mock content, runs it through the full threat detection
 * pipeline (scan → score → sanitise), persists the result to SQLite via
 * logScan(), and returns the ScanResult as JSON.
 *
 * Request body:
 *   { tool: "github" | "database" | "filesystem", scenario: string }
 *
 * Response:
 *   200 { ...ScanResult }
 *   400 { error: string }          — invalid tool or scenario
 *   405 { error: string }          — non-POST method
 *   500 { error: string }          — unexpected server error
 */

import { NextRequest, NextResponse } from "next/server";
import { runFullScan } from "@/lib/scanner";
import { logScan } from "@/lib/logger/logger";
import { verifyWithAI } from "@/lib/aiVerification";
import type { RiskLevel } from "@/types/types";
import {
  getMockGithubResponse,
  type GithubScenario,
} from "@/api/mockTools/github";
import {
  getMockDatabaseResponse,
  type DatabaseScenario,
} from "@/api/mockTools/database";
import {
  getMockFilesystemResponse,
  type FilesystemScenario,
} from "@/api/mockTools/filesystem";

// ─── Supported Tools and Scenarios ───────────────────────────────────────────

const VALID_TOOLS = ["github", "database", "filesystem", "upload", "manual-paste"] as const;
type Tool = (typeof VALID_TOOLS)[number];

const VALID_SCENARIOS = [
  "clean",
  "injection",
  "credential-theft",
  "destructive",
  "live",
] as const;
type Scenario = (typeof VALID_SCENARIOS)[number];

function isValidTool(t: unknown): t is Tool {
  return VALID_TOOLS.includes(t as Tool);
}

function isValidScenario(s: unknown): s is Scenario {
  return VALID_SCENARIOS.includes(s as Scenario);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map risk level to a middleware decision. */
function deriveStatus(riskLevel: RiskLevel): "Blocked" | "Allowed" {
  return riskLevel === "Medium" || riskLevel === "Critical"
    ? "Blocked"
    : "Allowed";
}

/** Dispatch to the appropriate mock content generator. */
function getMockContent(tool: Tool, scenario: Scenario): string {
  if (tool === "upload" || tool === "manual-paste") return ""; // Should be provided via body.content
  
  switch (tool) {
    case "github":
      return getMockGithubResponse(scenario as GithubScenario);
    case "database":
      return getMockDatabaseResponse(scenario as DatabaseScenario);
    case "filesystem":
      return getMockFilesystemResponse(scenario as FilesystemScenario);
    default:
      return "";
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

import { prisma } from "@/lib/db/prisma";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body — guard against malformed JSON.
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body." },
        { status: 400 }
      );
    }

    // Validate shape and values.
    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { error: "Request body must be a JSON object." },
        { status: 400 }
      );
    }

    const { tool, scenario, content: customContent } = body as Record<string, unknown>;

    if (!isValidTool(tool)) {
      return NextResponse.json(
        {
          error: `Invalid tool "${String(tool)}". Must be one of: ${VALID_TOOLS.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    if (!isValidScenario(scenario)) {
      return NextResponse.json(
        {
          error: `Invalid scenario "${String(scenario)}". Must be one of: ${VALID_SCENARIOS.join(", ")}.`,
        },
        { status: 400 }
      );
    }

    if ((tool === "upload" || tool === "manual-paste") && typeof customContent !== "string") {
      return NextResponse.json(
        { error: `Content string must be provided for ${tool} tool.` },
        { status: 400 }
      );
    }

    // 0. Fetch Global Settings
    const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
    const strictMode = settings?.strictMode ?? false;
    const learningMode = settings?.learningMode ?? false;
    const aiVerificationEnabled = settings?.aiVerificationEnabled ?? false;

    // 1. Fetch content (use provided content if exists, else mock).
    const content = typeof customContent === "string" ? customContent : getMockContent(tool, scenario);

    // 2. Run the full pipeline: detect → score → sanitise.
    const result = runFullScan(content, { strictMode });

    // 2.5. AI Verification (if enabled and risk level is Medium or Critical)
    if (aiVerificationEnabled && (result.riskLevel === "Medium" || result.riskLevel === "Critical")) {
      const aiResult = await verifyWithAI(result.originalContent, result.detectedPatterns);
      if (aiResult) {
        result.aiVerification = aiResult;
      }
    }

    // 3. Determine middleware decision.
    let status = deriveStatus(result.riskLevel);
    
    // Override status if Learning Mode is enabled
    if (learningMode) {
      status = "Allowed";
    }

    // 4. Persist to SQLite — fire-and-forget style: we await it so the log
    //    is written before we respond, but a logging failure does NOT cause
    //    the scan response to fail. The scan result is still returned to the
    //    client even if the DB write fails (e.g. DB locked, disk full).
    try {
      await logScan({
        toolName: tool,
        scenario,
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        detectedPatterns: result.detectedPatterns,
        originalContent: result.originalContent,
        sanitizedContent: result.sanitizedContent,
        status,
        aiVerdict: result.aiVerification ? JSON.stringify(result.aiVerification) : undefined,
      });
    } catch (logErr) {
      // Log the error server-side but don't surface it to the client.
      console.error("[AgentShield /api/scan] logScan failed:", logErr);
    }

    // 5. Return the full ScanResult as JSON.
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[AgentShield /api/scan] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error. Please try again." },
      { status: 500 }
    );
  }
}

// Reject non-POST methods with a clear error.
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: "Method not allowed. Use POST." },
    { status: 405 }
  );
}
