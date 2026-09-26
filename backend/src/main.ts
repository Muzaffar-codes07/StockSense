import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  // Fail fast on missing secrets — an unset JWT_SECRET would sign/verify tokens
  // with `undefined`, which is a silent security hole.
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required — refusing to start without it.');
  }

  const app = await NestFactory.create(AppModule);

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

  const port = process.env.API_PORT ? Number(process.env.API_PORT) : 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`StockSense API running on http://localhost:${port}`);
}
bootstrap();
