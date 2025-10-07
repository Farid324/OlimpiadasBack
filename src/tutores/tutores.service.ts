//src/tutores/tutores.service.ts

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTutorDto } from './dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class TutoresService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTutorDto) {
    const data: Prisma.tutoresUncheckedCreateInput = {
      nombre_completo: dto.nombreCompleto.trim(),
      ci: dto.ci?.trim(),
      correo: dto.correo?.trim(),
      telefono: dto.telefono.trim(),
      unidad_educativa: dto.unidadEducativa?.trim(),
      activo: true,
    };

    const tutor = await this.prisma.tutores.upsert({
      where: { telefono: data.telefono },
      update: {
        nombre_completo: data.nombre_completo,
        ci: data.ci,
        correo: data.correo,
        unidad_educativa: data.unidad_educativa,
        activo: true,
      },
      create: data,
    });

    const linkRes = await this.prisma.competidores.updateMany({
      where: {
        tutorContacto: tutor.telefono,
        OR: [{ id_tutor: null }, { id_tutor: { equals: undefined as any } }],
      },
      data: { id_tutor: tutor.id_tutor },
    });

    return { tutorId: tutor.id_tutor, linked: linkRes.count };
  }

  async list(params: { q?: string }) {
    const { q } = params ?? {};
    const where: Prisma.tutoresWhereInput = {
      ...(q
        ? {
            OR: [
              { nombre_completo: { contains: q, mode: 'insensitive' } },
              { ci: { contains: q, mode: 'insensitive' } },
              { correo: { contains: q, mode: 'insensitive' } },
              { telefono: { contains: q, mode: 'insensitive' } },
              { unidad_educativa: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
      activo: true,
    };

    const items = await this.prisma.tutores.findMany({
      where,
      select: {
        id_tutor: true,
        nombre_completo: true,
        ci: true,
        correo: true,
        telefono: true,
        unidad_educativa: true,
        _count: { select: { competidores: true } },
      },
      orderBy: { nombre_completo: 'asc' },
    });

    return items.map((t) => ({
      id: t.id_tutor,
      nombreCompleto: t.nombre_completo,
      ci: t.ci,
      correo: t.correo,
      telefono: t.telefono,
      unidadEducativa: t.unidad_educativa,
      relacionados: t._count.competidores,
    }));
  }

  async findOne(id: number) {
    const tutor = await this.prisma.tutores.findUnique({
      where: { id_tutor: id },
      include: {
        competidores: {
          select: {
            id_competidor: true,
            nombres: true,
            apellidos: true,
            ci: true,
            escuela: true,
            departamento: true,
          },
          orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
        },
      },
    });
    if (!tutor) throw new NotFoundException('Tutor no encontrado');

    return {
      id: tutor.id_tutor,
      nombreCompleto: tutor.nombre_completo,
      ci: tutor.ci,
      correo: tutor.correo,
      telefono: tutor.telefono,
      unidadEducativa: tutor.unidad_educativa,
      relacionados: tutor.competidores.length,
      competidores: tutor.competidores.map((c) => ({
        id: c.id_competidor,
        nombreCompleto: `${c.nombres} ${c.apellidos}`.trim(),
        ci: c.ci,
        unidadEducativa: c.escuela ?? '',
        departamento: c.departamento ?? '',
      })),
    };
  }
}
