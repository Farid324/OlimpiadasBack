// src/NewPassword/new-password.module.ts
import { Module } from '@nestjs/common';
import { NewPasswordController } from './new-password.controller';
import { NewPasswordService } from './new-password.service';
import { PrismaModule } from '../prisma/prisma.module'; // si existe

@Module({
  imports: [PrismaModule],
  controllers: [NewPasswordController],
  providers: [NewPasswordService],
})
export class NewPasswordModule {}
