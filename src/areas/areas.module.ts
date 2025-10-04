import { Module } from '@nestjs/common';
import { AreasService } from './services/areas.service';
import { AreasController } from './controllers/areas.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [AreasController],
  providers: [AreasService, PrismaService],
})
export class AreasModule {}
