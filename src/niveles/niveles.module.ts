//src/niveles/niveles.module.ts

import { Module } from '@nestjs/common';
import { NivelesService } from './niveles.service';
import { NivelesController } from './niveles.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [NivelesController],
  providers: [NivelesService],
  exports: [NivelesService],
})
export class NivelesModule {}

