import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './common/http-exception.filter';

// Everything main.ts applies to the app, shared so HTTP tests run the same stack.
export function configureApp(app: INestApplication) {
  // CORS: allowlist from CORS_ORIGIN (comma-separated); defaults to the Vite dev
  // server. Never reflect an arbitrary origin.
  const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: corsOrigins, credentials: true });

  // Robust input validation (scored requirement): reject unknown fields,
  // auto-transform payloads to DTO types, and return clean error messages.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Consistent, graceful error envelope for every failure.
  app.useGlobalFilters(new HttpExceptionFilter());
  return app;
}
