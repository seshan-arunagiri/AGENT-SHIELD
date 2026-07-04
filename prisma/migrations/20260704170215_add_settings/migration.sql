-- CreateTable
CREATE TABLE "AppSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "strictMode" BOOLEAN NOT NULL DEFAULT false,
    "learningMode" BOOLEAN NOT NULL DEFAULT false,
    "developerMode" BOOLEAN NOT NULL DEFAULT false,
    "darkMode" BOOLEAN NOT NULL DEFAULT true
);
