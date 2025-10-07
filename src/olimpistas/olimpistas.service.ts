// src/olimpistas/olimpistas.service.ts

import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegistroOlimpistaDto } from './dto/registro-olimpista.dto';
import { splitNombreCompleto } from '../utils/name.util';

@Injectable()
export class OlimpistasService {
  constructor(private prisma: PrismaService) {}

  private async getAreaIdByName(nombre: string): Promise<bigint> {
    const area = await this.prisma.areas.findFirst({
      where: {
        nombre_area: { equals: nombre, mode: 'insensitive' },
        activo: true,
      },
      select: { id_area: true },
    });
    if (!area)
      throw new BadRequestException(
        `Área no encontrada o inactiva: "${nombre}"`,
      );
    return area.id_area;
  }

  private async getNivelIdByName(nombre: string): Promise<bigint> {
    const nivel = await this.prisma.niveles.findFirst({
      where: { nombre_nivel: { equals: nombre, mode: 'insensitive' } },
      select: { id_nivel: true },
    });
    if (!nivel)
      throw new BadRequestException(`Nivel no encontrado: "${nombre}"`);
    return nivel.id_nivel;
  }

  async registerOne(dto: RegistroOlimpistaDto, userId?: bigint) {
    const [idArea, idNivel] = await Promise.all([
      this.getAreaIdByName(dto.area),
      this.getNivelIdByName(dto.nivel),
    ]);

    const { nombres, apellidos } = splitNombreCompleto(dto.nombreCompleto);

    const existing = await this.prisma.competidores.findFirst({
      where: { ci: dto.ci },
    });

    const competidor = existing
      ? await this.prisma.competidores.update({
          where: { id_competidor: existing.id_competidor },
          data: {
            nombres,
            apellidos,
            escuela: dto.unidadEducativa,
            departamento: dto.departamento,
            tutorContacto: dto.tutorContacto,
          },
        })
      : await this.prisma.competidores.create({
          data: {
            ci: dto.ci,
            nombres,
            apellidos,
            escuela: dto.unidadEducativa,
            departamento: dto.departamento,
            tutorContacto: dto.tutorContacto,
            activo: true,
          },
        });

    const insc = await this.prisma.inscripciones.findUnique({
      where: {
        uq_insc_unica: {
          id_competidor: competidor.id_competidor,
          id_area: idArea,
          id_nivel: idNivel,
        },
      },
      select: { id_inscripcion: true },
    });

    if (!insc) {
      await this.prisma.inscripciones.create({
        data: {
          id_competidor: competidor.id_competidor,
          id_area: idArea,
          id_nivel: idNivel,
          estado_inscripcion: 'INSCRITO',
          observaciones: null,
        },
      });
      return {
        created: true,
        skippedInsc: false,
        competidorId: competidor.id_competidor,
        area: dto.area,
        nivel: dto.nivel,
      };
    }

    return {
      created: false,
      skippedInsc: true,
      competidorId: competidor.id_competidor,
      area: dto.area,
      nivel: dto.nivel,
    };
  }

  async registerMany(list: RegistroOlimpistaDto[], userId?: bigint) {
    if (!list?.length) throw new BadRequestException('Lista vacía.');
    const summary = {
      total: list.length,
      ok: 0,
      createdInsc: 0,
      skippedInsc: 0,
      errors: [] as string[],
    };
    for (let i = 0; i < list.length; i++) {
      try {
        const res = await this.registerOne(list[i], userId);
        summary.ok++;
        res.skippedInsc ? summary.skippedInsc++ : summary.createdInsc++;
      } catch (e: any) {
        summary.errors.push(
          `Fila ${i + 1} (ci=${list[i]?.ci}): ${e?.message ?? 'Error'}`,
        );
      }
    }
    return summary;
  }
}
