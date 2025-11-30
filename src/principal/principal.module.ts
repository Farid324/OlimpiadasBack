import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service'; // Asume que tienes un PrismaService
import { PrincipalController } from './principal.controller';
import { PrincipalService } from './principal.service';

@Module({
  imports: [],
  controllers: [PrincipalController],
  providers: [PrincipalService, PrismaService],
})
export class PrincipalModule {}