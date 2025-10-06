import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get('db')
  async db() {
    const t0 = Date.now();
    await this.prisma.$queryRaw`SELECT 1`;
    const ms = Date.now() - t0;
    return { status: 'ok', db: 'connected', latencyMs: ms };
  }

  @Get()
  app() {
    return { status: 'ok', app: 'up' };
  }
}
