/**
 * AgentShield — POST /api/scan
 *
 * Next.js Route Handler that accepts a tool + scenario, fetches the
 * corresponding mock content, runs it through the full threat detection
 * pipeline, and returns a ScanResult as JSON.
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

const VALID_TOOLS = ["github", "database", "filesystem"] as const;
type Tool = (typeof VALID_TOOLS)[number];

const VALID_SCENARIOS = [
  "clean",
  "injection",
  "credential-theft",
  "destructive",
] as const;
type Scenario = (typeof VALID_SCENARIOS)[number];

function isValidTool(t: unknown): t is Tool {
  return VALID_TOOLS.includes(t as Tool);
}

function isValidScenario(s: unknown): s is Scenario {
  return VALID_SCENARIOS.includes(s as Scenario);
}

// ─── Mock Content Dispatcher ─────────────────────────────────────────────────

function getMockContent(tool: Tool, scenario: Scenario): string {
  switch (tool) {
    case "github":
      return getMockGithubResponse(scenario as GithubScenario);
    case "database":
      return getMockDatabaseResponse(scenario as DatabaseScenario);
    case "filesystem":
      return getMockFilesystemResponse(scenario as FilesystemScenario);
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

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

    const { tool, scenario } = body as Record<string, unknown>;

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

    // Fetch mock content and run the full scan pipeline.
    const content = getMockContent(tool, scenario);
    const result = runFullScan(content);

    // Return the full ScanResult as JSON.
    // The result is already serialisable (no RegExp or circular refs).
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    // Unexpected errors — log server-side, return generic message to client.
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
