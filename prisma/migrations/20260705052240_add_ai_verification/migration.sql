-- AlterTable
ALTER TABLE "ScanLog" ADD COLUMN "aiVerdict" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AppSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "strictMode" BOOLEAN NOT NULL DEFAULT false,
    "learningMode" BOOLEAN NOT NULL DEFAULT false,
    "developerMode" BOOLEAN NOT NULL DEFAULT false,
    "darkMode" BOOLEAN NOT NULL DEFAULT true,
    "aiVerificationEnabled" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_AppSettings" ("darkMode", "developerMode", "id", "learningMode", "strictMode") SELECT "darkMode", "developerMode", "id", "learningMode", "strictMode" FROM "AppSettings";
DROP TABLE "AppSettings";
ALTER TABLE "new_AppSettings" RENAME TO "AppSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
