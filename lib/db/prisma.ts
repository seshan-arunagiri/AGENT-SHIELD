/**
 * AgentShield — Prisma Client Singleton
 *
 * In Next.js development mode, every hot-module reload creates a new module
 * scope, which would instantiate a new PrismaClient each time and quickly
 * exhaust the SQLite connection pool.
 *
 * The standard fix is to attach a single PrismaClient instance to the Node.js
 * `global` object so it survives HMR reloads. In production (where HMR doesn't
 * run) we always create a fresh instance normally.
 *
 * Reference: https://www.prisma.io/docs/guides/performance-and-optimization/connection-management#prevent-hot-reloading-from-creating-new-instances-of-prismaclient
 */

import { PrismaClient } from "@prisma/client";

// Extend the global type to carry our prisma instance.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
