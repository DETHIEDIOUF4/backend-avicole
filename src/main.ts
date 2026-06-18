import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/** FRONTEND_URL : une origine ou plusieurs séparées par des virgules. */
function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function corsOrigins(): boolean | string[] {
  const raw = process.env.FRONTEND_URL?.trim();
  if (!raw) return true;
  const list = raw
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
  if (!list.length) return true;
  const expanded = new Set<string>();
  for (const origin of list) {
    expanded.add(origin);
    try {
      const url = new URL(origin);
      if (url.hostname.startsWith('www.')) {
        expanded.add(`${url.protocol}//${url.hostname.slice(4)}${url.port ? `:${url.port}` : ''}`);
      } else if (!url.hostname.includes('localhost')) {
        expanded.add(`${url.protocol}//www.${url.hostname}${url.port ? `:${url.port}` : ''}`);
      }
    } catch {
      /* origine mal formée — ignorée pour l’expansion www */
    }
  }
  return [...expanded];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: corsOrigins(),
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });
  app.setGlobalPrefix('api');
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
}
bootstrap();
