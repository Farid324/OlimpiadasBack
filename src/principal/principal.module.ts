// src/principal/principal.module.ts

import { Module } from '@nestjs/common';
import { PrincipalController } from './principal.controller';
import { PrincipalService } from './principal.service';
import { PrismaModule } from '../prisma/prisma.module'; // Importante para usar PrismaService

@Module({
  imports: [PrismaModule],
  controllers: [PrincipalController],
  providers: [PrincipalService],
})
export class PrincipalModule {}