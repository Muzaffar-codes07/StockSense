import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

async function bootstrap() {
  // Fail fast on missing secrets — an unset JWT_SECRET would sign/verify tokens
  // with `undefined`, which is a silent security hole.
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is required — refusing to start without it.');
  }

  const app = configureApp(await NestFactory.create(AppModule));

  const port = process.env.API_PORT ? Number(process.env.API_PORT) : 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`StockSense API running on http://localhost:${port}`);
}
bootstrap();
