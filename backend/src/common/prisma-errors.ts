import { Prisma } from '@prisma/client';

/** A write hit a unique constraint (Prisma P2002). */
export function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

/** A write referenced a row that does not exist (Prisma P2003). */
export function isForeignKeyViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003';
}
