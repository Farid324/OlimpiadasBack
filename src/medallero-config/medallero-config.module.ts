//src/medallero-config/medallero-config.module.ts
import { Module } from '@nestjs/common';
import { MedalleroConfigController } from './medallero-config.controller';
import { MedalleroConfigService } from './medallero-config.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MedalleroConfigController],
  providers: [MedalleroConfigService],
  exports: [MedalleroConfigService],
})
export class MedalleroConfigModule {}
