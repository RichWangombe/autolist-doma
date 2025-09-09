import { PrismaClient } from '@prisma/client'

// Prevent multiple instances in development (Next.js hot-reload)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma

// Start auto-settle cron in dev/offline mode (side effect)
if (process.env.NODE_ENV !== 'production') {
  // fire-and-forget dynamic import to avoid circular dependency at build time
  import('./settleCron').catch(() => {})
}
