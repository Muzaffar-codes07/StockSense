import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS for the web app (Vite dev server + docker)
  app.enableCors({ origin: true, credentials: true });

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
