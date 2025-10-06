import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors({
    origin: [
      'https://auth.lovig.in',   
      'https://la.nqstx.online',
      'http://localhost:3200'     // dev
    ],
    credentials: false
  });

  // Раздаем статические файлы (аватарки)
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/uploads/',
  });

  app.setGlobalPrefix('v1');
  await app.listen(process.env.PORT ?? 5500);
}
bootstrap();
