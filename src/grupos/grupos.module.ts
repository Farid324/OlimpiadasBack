// src/grupos/grupos.module.ts

import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GruposController } from './grupos.controller';
import { GruposService } from './grupos.service';

@Module({
  controllers: [GruposController],
  providers: [GruposService, PrismaService],
})
export class GruposModule {}
