// src/main.ts
import {
  BadRequestException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BigIntSerializerInterceptor } from './common/interceptors/bigint-serializer.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  app.enableCors({
    origin: true,
    credentials: false,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const messages: string[] = [];

        const walk = (errs: ValidationError[]) => {
          for (const e of errs) {
            if (e.constraints) {
              for (const k of Object.keys(e.constraints)) {
                messages.push(e.constraints[k]);
              }
            }
            if (e.children?.length) walk(e.children);
          }
        };
        walk(errors);

        if (messages.length === 0) messages.push('Datos inválidos.');
        return new BadRequestException(messages);
      },
    }),
  );
  app.useGlobalInterceptors(new BigIntSerializerInterceptor());
  console.log('[DBG] App DATABASE_URL =', process.env.DATABASE_URL);
  await app.listen(process.env.PORT || 3001);
  console.log(`[API] http://localhost:${process.env.PORT || 3001}`);
}
bootstrap();
