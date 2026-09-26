import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  // Interactive-transaction timeout; Prisma's 5s default is too short against a
  // far-away hosted database (e.g. seeding it from a laptop).
  constructor() {
    super({
      transactionOptions: {
        timeout: Number(process.env.PRISMA_TX_TIMEOUT_MS ?? 5000),
        maxWait: Number(process.env.PRISMA_TX_MAX_WAIT_MS ?? 2000),
      },
    });
  }

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
