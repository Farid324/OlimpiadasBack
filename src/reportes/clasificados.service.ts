//src/reportes/clasificados.service.ts

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type Estado = 'CLASIFICADO' | 'NO_CLASIFICADO' | 'DESCALIFICADO';
type Filtros = { id_area?: number; id_nivel?: number; estado?: Estado };

// Fila que devuelve el servicio y consume el front
type Row = {
  id_inscripcion: number;
  posicion: number | null;
  nombreCompleto: string;
  area: string;
  nivel: string;
  puntaje: number;
  unidadEducativa: string;
  departamento: string;
};

@Injectable()
export class ClasificadosService {
  constructor(private prisma: PrismaService) {}

  private buildWhere(f: Filtros): Prisma.inscripcionesWhereInput {
    const where: Prisma.inscripcionesWhereInput = {};
    if (f.id_area)  where.id_area  = f.id_area;
    if (f.id_nivel) where.id_nivel = f.id_nivel;
    if (f.estado)   where.clasificacion = f.estado as any;
    return where;
  }

  /** Lista con joins y posiciones calculadas por área+nivel */
  async list(f: Filtros) {
    const where = this.buildWhere(f);

    const items = await this.prisma.inscripciones.findMany({
      where,
      include: {
        competidor: true,
        area:       true,
        nivel:      true,
      },
      orderBy: [
        { id_area: 'asc' },
        { id_nivel: 'asc' },
        { puntaje_clasificacion: 'desc' },
        { id_inscripcion: 'asc' },
      ],
    });

    // Tipamos correctamente el Map de agrupación
    type Item = typeof items[number];
    const groups = new Map<string, Item[]>();
    for (const it of items) {
      const k = `${it.id_area}|${it.id_nivel}`;
      const arr = groups.get(k);
      if (arr) arr.push(it);
      else groups.set(k, [it]);
    }