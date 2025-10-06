import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BigIntSerializerInterceptor } from './common/interceptors/bigint-serializer.interceptor'; // 👈 importa

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new BigIntSerializerInterceptor());
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
