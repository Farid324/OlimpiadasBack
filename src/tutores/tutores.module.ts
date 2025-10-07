//src/tutores/tutores.module.ts
import { Module } from '@nestjs/common';
import { TutoresController } from './tutores.controller';
import { TutoresService } from './tutores.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [TutoresController],
  providers: [TutoresService, PrismaService],
  exports: [TutoresService],
})
export class TutoresModule {}
