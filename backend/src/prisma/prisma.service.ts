import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  // Connect eagerly, but don't crash boot if the DB isn't up yet — Prisma
  // reconnects lazily on the first query. Keeps the API startable before the
  // database (and lets GET /health report db:false gracefully).
  async onModuleInit() {
    try {
      await this.$connect();
    } catch (err) {
      this.logger.warn(
        `Database not reachable at startup; will connect on first query. (${
          err instanceof Error ? err.message : err
        })`,
      );
    }
  }
}
