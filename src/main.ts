import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'https://auth.lovig.in',   
      'https://learns1.nqstx.online',
      'http://localhost:3200'     // dev
    ],
    credentials: false
  });

  app.setGlobalPrefix('v1');
  await app.listen(process.env.PORT ?? 5500);
}
bootstrap();
