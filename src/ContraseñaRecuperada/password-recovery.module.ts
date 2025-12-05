import { Module } from '@nestjs/common';
import { PasswordRecoveryController } from './password-recovery.controller';
import { PasswordRecoveryService } from './password-recovery.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailerModule } from '@nestjs-modules/mailer';

@Module({
  imports: [
    MailerModule,
  ],
  controllers: [PasswordRecoveryController],
  providers: [PasswordRecoveryService, PrismaService],
})
export class PasswordRecoveryModule {}
