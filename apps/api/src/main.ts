import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableCors({
    origin: config.get('CORS_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });

  const port = Number(config.get('PORT', 3001));
  await app.listen(port);
  console.log(`HookPilot API listening on http://localhost:${port}/api`);
}
bootstrap();
