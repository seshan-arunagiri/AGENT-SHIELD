-- CreateTable
CREATE TABLE "ScanLog" (
    "id" SERIAL NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "toolName" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "detectedPatterns" TEXT NOT NULL,
    "originalContent" TEXT NOT NULL,
    "sanitizedContent" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "aiVerdict" TEXT,

    CONSTRAINT "ScanLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "strictMode" BOOLEAN NOT NULL DEFAULT false,
    "learningMode" BOOLEAN NOT NULL DEFAULT false,
    "developerMode" BOOLEAN NOT NULL DEFAULT false,
    "darkMode" BOOLEAN NOT NULL DEFAULT true,
    "aiVerificationEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);
