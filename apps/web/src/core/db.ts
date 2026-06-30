import { PrismaClient } from '@prisma/client';

/**
 * Prisma-Client als Singleton (vermeidet mehrfache Instanzen im Next.js-Dev-HMR).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
