import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// A working endpoint out of the box so `docker compose up` proves the stack is
// wired end-to-end: GET /health should return { status: 'ok', db: true }.
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    let db = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = true;
    } catch {
      db = false;
    }
    return { status: 'ok', db, timestamp: new Date().toISOString() };
  }
}
