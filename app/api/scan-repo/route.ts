import { NextRequest, NextResponse } from "next/server";
import { runFullScan } from "@/lib/scanner";
import { logScan } from "@/lib/logger/logger";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON in request body." }, { status: 400 });
    }

    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
    }

    const { repoUrl } = body as Record<string, unknown>;

    if (typeof repoUrl !== "string" || !repoUrl.trim()) {
      return NextResponse.json({ error: "Valid repoUrl string is required." }, { status: 400 });
    }

    // Extract owner/repo from URL
    // Examples: "github.com/owner/repo", "https://github.com/owner/repo", "owner/repo"
    const match = repoUrl.match(/(?:github\.com\/|^)?([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/?/);
    if (!match) {
      return NextResponse.json({ error: "Invalid GitHub repository URL format. Example: github.com/owner/repo" }, { status: 400 });
    }

    const owner = match[1];
    const repo = match[2];

    // Fetch README from GitHub API
    const headers: Record<string, string> = {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "Aegis-Scanner"
    };

    if (process.env.GITHUB_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    // Fetch README from GitHub API
    const githubRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
      headers
    });

    if (!githubRes.ok) {
      if (githubRes.status === 404) {
        return NextResponse.json({ error: "Repository or README not found. Ensure it is public." }, { status: 404 });
      } else if (githubRes.status === 403) {
        return NextResponse.json({ error: "GitHub API rate limit exceeded. Please try again later." }, { status: 403 });
      }
      return NextResponse.json({ error: `GitHub API error: ${githubRes.statusText}` }, { status: githubRes.status });
    }

    const githubData = await githubRes.json();
    
    if (githubData.encoding !== "base64" || typeof githubData.content !== "string") {
      return NextResponse.json({ error: "Unexpected encoding from GitHub API." }, { status: 500 });
    }

    // Decode base64 content
    let content = "";
    try {
      // GitHub base64 contains newlines, clean them first
      const b64 = githubData.content.replace(/\n/g, "");
      content = Buffer.from(b64, "base64").toString("utf8");
    } catch {
      return NextResponse.json({ error: "Failed to decode repository README content." }, { status: 500 });
    }

    // 0. Fetch Global Settings
    const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
    const strictMode = settings?.strictMode ?? false;
    const learningMode = settings?.learningMode ?? false;

    // 2. Run the full pipeline
    const result = runFullScan(content, { strictMode });

    // 3. Determine middleware decision
    let status: "Blocked" | "Allowed" = (result.riskLevel === "Medium" || result.riskLevel === "Critical") ? "Blocked" : "Allowed";
    if (learningMode) {
      status = "Allowed";
    }

    // 4. Persist to SQLite
    try {
      await logScan({
        toolName: "github",
        scenario: "live-repo",
        riskScore: result.riskScore,
        riskLevel: result.riskLevel,
        detectedPatterns: result.detectedPatterns,
        originalContent: result.originalContent,
        sanitizedContent: result.sanitizedContent,
        status,
      });
    } catch (logErr) {
      console.error("[Aegis /api/scan-repo] logScan failed:", logErr);
    }

    // 5. Return result
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    console.error("[Aegis /api/scan-repo] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error. Please try again." }, { status: 500 });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: "Method not allowed. Use POST." }, { status: 405 });
}
