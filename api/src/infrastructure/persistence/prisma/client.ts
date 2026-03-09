import { PrismaClient } from '@prisma/client';

// Singleton Prisma client instance
let prismaInstance: PrismaClient | null = null;

/**
 * Get the Prisma client singleton.
 * Creates a new instance on first call.
 */
export function getPrismaClient(): PrismaClient {
  if (prismaInstance === null) {
    prismaInstance = new PrismaClient({
      log: process.env['NODE_ENV'] === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
  }
  return prismaInstance;
}

/**
 * Disconnect Prisma client gracefully.
 * Call this on application shutdown.
 */
export async function disconnectPrisma(): Promise<void> {
  if (prismaInstance !== null) {
    await prismaInstance.$disconnect();
    prismaInstance = null;
  }
}
