-- CreateTable
CREATE TABLE "ScanLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "toolName" TEXT NOT NULL,
    "scenario" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "detectedPatterns" TEXT NOT NULL,
    "originalContent" TEXT NOT NULL,
    "sanitizedContent" TEXT NOT NULL,
    "status" TEXT NOT NULL
);
