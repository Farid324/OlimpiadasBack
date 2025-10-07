// src/olimpistas/olimpistas.module.ts

import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OlimpistasController } from './olimpistas.controller';
import { OlimpistasService } from './olimpistas.service';

@Module({
  controllers: [OlimpistasController],
  providers: [OlimpistasService, PrismaService],
})
export class OlimpistasModule {}
