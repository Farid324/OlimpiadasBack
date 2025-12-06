// src/medallero-config/medallero-config.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateMedalleroConfigDto } from './dto/update-medallero-config.dto';
import { CreateMedalleroConfigDto } from './dto/create-medallero-config.dto';

// Tipo auxiliar para la respuesta de findAll, incluyendo Nivel y Participantes
type MedalleroConfigWithDetails = {
  id_medallero: number;
  id_area: number;
  id_nivel: number;
  area_nombre: string;
  nivel_nombre: string;
  participantes: number;
  oros: number;
  platas: number;
  bronces: number;
  menciones: number;
  vigente_desde: Date | null;
  vigente_hasta: Date | null;
};

@Injectable()
export class MedalleroConfigService {
  private readonly logger = new Logger(MedalleroConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Obtener todas las áreas/niveles con su medallero y participantes de la gestión ABIERTA */
  async findAll(): Promise<MedalleroConfigWithDetails[]> {
    // 0. Gestión actual
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: 'ABIERTA' },
      orderBy: { created_at: 'desc' },
    });

    if (!gestion) {
      this.logger.warn(
        'No hay gestión ABIERTA. Devolviendo medallero vacío en findAll().',
      );
      return [];
    }

    // 1. Obtener todas las inscripciones de la gestión para agrupar por Area/Nivel
    const inscripcionesAgrupadas = await this.prisma.inscripciones.groupBy({
      by: ['id_area', 'id_nivel'],
      where: { id_gestion: gestion.id_gestion }, // ← clave
      _count: { id_competidor: true },
    });

    this.logger.debug(
      `Encontradas ${inscripcionesAgrupadas.length} combinaciones Area/Nivel con participantes para gestión ${gestion.id_gestion}`,
    );

    const results: MedalleroConfigWithDetails[] = [];

    for (const grupo of inscripcionesAgrupadas) {
      const { id_area, id_nivel, _count } = grupo;

      const area = await this.prisma.areas.findUnique({
        where: { id_area },
        select: { nombre_area: true },
      });
      const nivel = await this.prisma.niveles.findUnique({
        where: { id_nivel },
        select: { nombre_nivel: true },
      });

      const areaNombre =
        area?.nombre_area ?? `[Área No Encontrada ID: ${id_area}]`;
      const nivelNombre =
        nivel?.nombre_nivel ?? `[Nivel No Encontrado ID: ${id_nivel}]`;

      // 3. Configuración de medallero PARA ESTA GESTIÓN
      const config = await this.prisma.medallero_config.findFirst({
        where: {
          id_area,
          id_nivel,
          id_gestion: gestion.id_gestion,
        },
        orderBy: { id_medallero: 'desc' },
      });

      const m = config;

      results.push({
        id_medallero: m?.id_medallero ?? 0,
        id_area,
        id_nivel,
        area_nombre: areaNombre,
        nivel_nombre: nivelNombre,
        participantes: _count.id_competidor,
        oros: m?.oros ?? 0,
        platas: m?.platas ?? 0,
        bronces: m?.bronces ?? 0,
        menciones: m?.menciones ?? 0,
        vigente_desde: m?.vigente_desde ?? null,
        vigente_hasta: m?.vigente_hasta ?? null,
      });
    }

    return results.sort((a, b) => {
      if (a.area_nombre < b.area_nombre) return -1;
      if (a.area_nombre > b.area_nombre) return 1;
      if (a.nivel_nombre < b.nivel_nombre) return -1;
      if (a.nivel_nombre > b.nivel_nombre) return 1;
      return 0;
    });
  }

  /** Crear nueva configuración */
  async create(dto: CreateMedalleroConfigDto) {
    this.logger.debug(
      `Creando medallero para area ${dto.id_area} y nivel ${dto.id_nivel}`,
    );

    // 1️⃣ Obtener gestión abierta
    const gestion = await this.prisma.gestiones.findFirst({
      where: { estado: 'ABIERTA' },
    });
    if (!gestion) {
      throw new BadRequestException(
        'No hay una gestión abierta para configurar el medallero.',
      );
    }

    return this.prisma.medallero_config.create({
      data: {
        id_area: dto.id_area,
        id_nivel: dto.id_nivel,
        id_gestion: gestion.id_gestion, // <--- 2️⃣ Inyectar gestión
        oros: dto.oros ?? 0,
        platas: dto.platas ?? 0,
        bronces: dto.bronces ?? 0,
        menciones: dto.menciones ?? 0,
        vigente_desde: dto.vigente_desde ?? undefined,
        vigente_hasta: dto.vigente_hasta ?? undefined,
      },
    });
  }

  /** Actualizar medallero de un área/nivel O CREAR si no existe (id <= 0) */
  async update(id: number, dto: UpdateMedalleroConfigDto) {
    // CRÍTICO: Si el id es 0 o inválido, CREAMOS la configuración para la gestión ABIERTA
    if (!id || id <= 0) {
      this.logger.debug(
        `ID de medallero es 0 o inválido. Creando nueva configuración para Area ${dto.id_area}/Nivel ${dto.id_nivel}...`,
      );

      const gestion = await this.prisma.gestiones.findFirst({
        where: { estado: 'ABIERTA' },
        orderBy: { created_at: 'desc' },
      });
      if (!gestion) {
        throw new BadRequestException(
          'No hay una gestión abierta para configurar el medallero.',
        );
      }

      try {
        return await this.prisma.medallero_config.create({
          data: {
            id_area: dto.id_area,
            id_nivel: dto.id_nivel,
            id_gestion: gestion.id_gestion,
            oros: dto.oros ?? 0,
            platas: dto.platas ?? 0,
            bronces: dto.bronces ?? 0,
            menciones: dto.menciones ?? 0,
          },
        });
      } catch (e) {
        this.logger.warn(
          `Intento de creación fallido para Area ${dto.id_area}/Nivel ${dto.id_nivel}. Buscando existente para actualizar...`,
        );

        const existingConfig = await this.prisma.medallero_config.findFirst({
          where: {
            id_area: dto.id_area,
            id_nivel: dto.id_nivel,
            id_gestion: gestion.id_gestion,
          },
        });

        if (existingConfig) {
          return this.prisma.medallero_config.update({
            where: { id_medallero: existingConfig.id_medallero },
            data: {
              oros: dto.oros ?? undefined,
              platas: dto.platas ?? undefined,
              bronces: dto.bronces ?? undefined,
              menciones: dto.menciones ?? undefined,
            },
          });
        }
        throw e;
      }
    }

    // Flujo normal de actualización si id_medallero > 0
    this.logger.debug(`Actualizando medallero con id ${id}`);
    try {
      return await this.prisma.medallero_config.update({
        where: { id_medallero: id },
        data: {
          oros: dto.oros ?? undefined,
          platas: dto.platas ?? undefined,
          bronces: dto.bronces ?? undefined,
          menciones: dto.menciones ?? undefined,
        },
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`Error al actualizar medallero con ID ${id}: ${msg}`);
      throw new NotFoundException(
        `Configuración de medallero con ID ${id} no encontrada.`,
      );
    }
  }

  // Puedes dejar findOne si es necesario
  async findOne(id: number) {
    return this.prisma.medallero_config.findUnique({
      where: { id_medallero: id },
      // include: { area: true, nivel: true },
    });
  }
}
