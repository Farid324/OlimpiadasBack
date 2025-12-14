// src/responsables/responsables.module.ts
import { Module } from '@nestjs/common';
import { ResponsablesService } from './responsables.service';
import { ResponsablesController } from './responsables.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from 'src/email/email.module';

@Module({
  imports: [PrismaModule, EmailModule],
  controllers: [ResponsablesController],
  providers: [ResponsablesService],
})
export class ResponsablesModule {}
