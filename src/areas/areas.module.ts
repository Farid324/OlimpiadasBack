import { Module } from '@nestjs/common';
import { AreasController } from './controllers/areas.controller';
import { AreasService } from './services/areas.service';
import { PrismaModule } from '../prisma/prisma.module';
@Module({ imports: [PrismaModule], controllers: [AreasController], providers: [AreasService] })
export class AreasModule {}
