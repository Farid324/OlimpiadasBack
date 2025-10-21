//src/niveles/niveles.service.ts

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NivelesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.niveles.findMany({
      orderBy: [{ orden: 'asc' }, { nombre_nivel: 'asc' }],
    });
  }
}