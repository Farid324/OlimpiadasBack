import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
@Injectable()
export class AreasService {
  constructor(private prisma: PrismaService) {}
  findAllActive() {
    return this.prisma.areas.findMany({
      where: { activo: true },
      select: { id_area: true, nombre_area: true },
      orderBy: { nombre_area: 'asc' },
    });
  }
}
