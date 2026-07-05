/**
 * AgentShield — GET /api/settings
 *
 * Retrieves the global AppSettings. If none exist, initializes default settings (id = 1).
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    let settings = await prisma.appSettings.findUnique({
      where: { id: 1 },
    });

    if (!settings) {
      settings = await prisma.appSettings.create({
        data: {
          id: 1,
          strictMode: false,
          learningMode: false,
          developerMode: false,
          darkMode: true,
          aiVerificationEnabled: false,
        },
      });
    }

    return NextResponse.json(settings, { status: 200 });
  } catch (err) {
    console.error("[AgentShield /api/settings] Error fetching settings:", err);
    return NextResponse.json(
      { error: "Failed to fetch settings." },
      { status: 500 }
    );
  }
}

/**
 * AgentShield — PATCH /api/settings
 *
 * Updates the global AppSettings.
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    
    // Only extract the valid fields
    const { strictMode, learningMode, developerMode, darkMode, aiVerificationEnabled } = body;
    const dataToUpdate: any = {};
    if (strictMode !== undefined) dataToUpdate.strictMode = strictMode;
    if (learningMode !== undefined) dataToUpdate.learningMode = learningMode;
    if (developerMode !== undefined) dataToUpdate.developerMode = developerMode;
    if (darkMode !== undefined) dataToUpdate.darkMode = darkMode;
    if (aiVerificationEnabled !== undefined) dataToUpdate.aiVerificationEnabled = aiVerificationEnabled;

    const updatedSettings = await prisma.appSettings.upsert({
      where: { id: 1 },
      update: dataToUpdate,
      create: {
        id: 1,
        strictMode: strictMode ?? false,
        learningMode: learningMode ?? false,
        developerMode: developerMode ?? false,
        darkMode: darkMode ?? true,
        aiVerificationEnabled: aiVerificationEnabled ?? false,
      },
    });

    return NextResponse.json(updatedSettings, { status: 200 });
  } catch (err) {
    console.error("[AgentShield /api/settings] Error updating settings:", err);
    return NextResponse.json(
      { error: "Failed to update settings." },
      { status: 500 }
    );
  }
}
