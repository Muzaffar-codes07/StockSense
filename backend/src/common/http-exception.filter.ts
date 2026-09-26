import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

// Prisma errors a client caused (bad id, duplicate value) are 4xx, not crashes.
const PRISMA_ERRORS: Record<string, [HttpStatus, string]> = {
  P2002: [HttpStatus.CONFLICT, 'A record with this value already exists'],
  P2003: [
    HttpStatus.BAD_REQUEST,
    'A referenced record (product, location, category…) does not exist',
  ],
  P2025: [HttpStatus.NOT_FOUND, 'Record not found'],
};

// Consistent error envelope so the frontend can always render graceful,
// user-facing messages (required: "user errors must be handled gracefully").
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const [status, message] = this.describe(exception);

    res.status(status).json({
      success: false,
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  private describe(exception: unknown): [number, string | string[]] {
    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      const message =
        typeof payload === 'object' && payload && 'message' in payload
          ? (payload as { message: string | string[] }).message
          : exception.message;
      return [exception.getStatus(), message];
    }
    if (
      exception instanceof Prisma.PrismaClientKnownRequestError &&
      PRISMA_ERRORS[exception.code]
    ) {
      return PRISMA_ERRORS[exception.code];
    }
    // Unexpected: log the detail, never send it (may hold SQL or secrets).
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    return [HttpStatus.INTERNAL_SERVER_ERROR, 'Internal server error'];
  }
}
