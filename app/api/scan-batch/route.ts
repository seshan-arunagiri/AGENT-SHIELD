import { NextRequest, NextResponse } from "next/server";
import { runFullScan } from "@/lib/scanner";
import { logScan } from "@/lib/logger/logger";
import { verifyWithAI } from "@/lib/aiVerification";
import { prisma } from "@/lib/db/prisma";
import type { RiskLevel, BatchScanRequest, BatchScanResult } from "@/types/types";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Auth check: require x-aegis-token header matching AEGIS_CI_TOKEN env var
    const authToken = request.headers.get("x-aegis-token");
    
    if (!process.env.AEGIS_CI_TOKEN) {
      return NextResponse.json(
        { error: "Server configuration error: AEGIS_CI_TOKEN not set" },
        { status: 500 }
      );
    }

    if (!authToken || authToken !== process.env.AEGIS_CI_TOKEN) {
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing x-aegis-token header" },
        { status: 401 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { error: "Request body must be a JSON object" },
        { status: 400 }
      );
    }

    const { files } = body as Partial<BatchScanRequest>;

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: "files array is required and must not be empty" },
        { status: 400 }
      );
    }

    // Validate each file has path and content
    for (const file of files) {
      if (typeof file !== "object" || file === null) {
        return NextResponse.json(
          { error: "Each file must be an object with path and content" },
          { status: 400 }
        );
      }
      if (typeof file.path !== "string" || typeof file.content !== "string") {
        return NextResponse.json(
          { error: "Each file must have path (string) and content (string)" },
          { status: 400 }
        );
      }
    }

    // Fetch global settings
    const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });
    const strictMode = settings?.strictMode ?? false;
    const learningMode = settings?.learningMode ?? false;
    const aiVerificationEnabled = settings?.aiVerificationEnabled ?? false;

    // Scan each file individually
    const fileResults = [];
    let highestRiskScore = 0;
    let highestRiskLevel: RiskLevel = "Safe";

    for (const file of files) {
      const scanResult = runFullScan(file.content, { strictMode });
      
      // AI Verification (if enabled and risk level is Medium or Critical)
      if (aiVerificationEnabled && (scanResult.riskLevel === "Medium" || scanResult.riskLevel === "Critical")) {
        const aiResult = await verifyWithAI(file.content, scanResult.detectedPatterns);
        if (aiResult) {
          scanResult.aiVerification = aiResult;
        }
      }
      
      fileResults.push({
        path: file.path,
        riskScore: scanResult.riskScore,
        riskLevel: scanResult.riskLevel,
        detectedPatternsCount: scanResult.detectedPatterns.length,
        detectedPatterns: scanResult.detectedPatterns,
        aiVerification: scanResult.aiVerification
      });

      // Track highest risk
      if (scanResult.riskScore > highestRiskScore) {
        highestRiskScore = scanResult.riskScore;
        highestRiskLevel = scanResult.riskLevel;
      }
    }

    // Determine overall status based on highest risk
    let overallStatus: "Blocked" | "Allowed" = 
      (highestRiskLevel === "Medium" || highestRiskLevel === "Critical") 
        ? "Blocked" 
        : "Allowed";
    
    if (learningMode) {
      overallStatus = "Allowed";
    }

    // Log aggregate entry
    try {
      await logScan({
        toolName: "ci-pipeline",
        scenario: "github-action",
        riskScore: highestRiskScore,
        riskLevel: highestRiskLevel,
        detectedPatterns: fileResults.flatMap(f => f.detectedPatterns),
        originalContent: `Scanned ${fileResults.length} files`,
        sanitizedContent: `Scanned ${fileResults.length} files`,
        status: overallStatus,
      });
    } catch (logErr) {
      console.error("[Aegis /api/scan-batch] logScan failed:", logErr);
    }

    // Return results
    return NextResponse.json<BatchScanResult>({
      overallRiskScore: highestRiskScore,
      overallRiskLevel: highestRiskLevel,
      overallStatus,
      filesScanned: fileResults.length,
      files: fileResults.map(f => ({
        path: f.path,
        riskScore: f.riskScore,
        riskLevel: f.riskLevel,
        detectedPatternsCount: f.detectedPatternsCount
      }))
    }, { status: 200 });

  } catch (err) {
    console.error("[Aegis /api/scan-batch] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { error: "Method not allowed. Use POST." },
    { status: 405 }
  );
}
