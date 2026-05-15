import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/** FRONTEND_URL : une origine ou plusieurs séparées par des virgules (sans espace autour si une seule). */
function corsOrigins(): boolean | string[] {
  const raw = process.env.FRONTEND_URL?.trim();
  if (!raw) return true;
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list : true;
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
  });
  app.setGlobalPrefix('api');
  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
}
bootstrap();
