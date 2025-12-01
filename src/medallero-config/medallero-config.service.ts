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

  /** Obtener todas las áreas/niveles con su medallero y participantes */
  async findAll(): Promise<MedalleroConfigWithDetails[]> {
    // 1. Obtener todas las inscripciones para agrupar por Area/Nivel y contar participantes.
    const inscripcionesAgrupadas = await this.prisma.inscripciones.groupBy({
      by: ['id_area', 'id_nivel'],
      _count: { id_competidor: true }, // Usamos id_competidor para contar participantes
    });

    this.logger.debug(
      `Encontradas ${inscripcionesAgrupadas.length} combinaciones Area/Nivel con participantes`,
    );

    const results: MedalleroConfigWithDetails[] = [];

    for (const grupo of inscripcionesAgrupadas) {
      const { id_area, id_nivel, _count } = grupo;

      // 2. Buscar el área y el nivel (para los nombres)
      const area = await this.prisma.areas.findUnique({
        where: { id_area },
        select: { nombre_area: true },
      });
      const nivel = await this.prisma.niveles.findUnique({
        where: { id_nivel },
        select: { nombre_nivel: true },
      });

      // ✨ AJUSTE para manejar áreas/niveles eliminados o no encontrados
      const areaNombre =
        area?.nombre_area ?? `[Área No Encontrada ID: ${id_area}]`;
      const nivelNombre =
        nivel?.nombre_nivel ?? `[Nivel No Encontrado ID: ${id_nivel}]`;

      // 3. Buscar la configuración de medallero para esta combinación Área/Nivel
      const config = await this.prisma.medallero_config.findFirst({
        where: { id_area, id_nivel },
        orderBy: { id_medallero: 'desc' },
      });

      const m = config;

      results.push({
        id_medallero: m?.id_medallero ?? 0, // CRÍTICO: 0 si no existe para indicar 'crear' en el frontend
        id_area: id_area,
        id_nivel: id_nivel,
        area_nombre: areaNombre, // Usamos el nombre seguro
        nivel_nombre: nivelNombre, // Usamos el nombre seguro
        participantes: _count.id_competidor,
        oros: m?.oros ?? 0,
        platas: m?.platas ?? 0,
        bronces: m?.bronces ?? 0,
        menciones: m?.menciones ?? 0,
        vigente_desde: m?.vigente_desde ?? null,
        vigente_hasta: m?.vigente_hasta ?? null,
      });
    }

    // Opcional: Ordenar por Área y luego por Nivel
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
    // CRÍTICO: Si el id es 0 o inválido, CREAMOS la configuración
    if (!id || id <= 0) {
      this.logger.debug(
        `ID de medallero es 0 o inválido. Creando nueva configuración para Area ${dto.id_area}/Nivel ${dto.id_nivel}...`,
      );

      const createDto: CreateMedalleroConfigDto = {
        id_area: dto.id_area,
        id_nivel: dto.id_nivel,
        oros: dto.oros ?? 0,
        platas: dto.platas ?? 0,
        bronces: dto.bronces ?? 0,
        menciones: dto.menciones ?? 0,
        // No pasamos las fechas aquí, ya que UpdateMedalleroConfigDto no las tiene.
      };

      // Usar create en lugar de updateOrCreate para que Prisma gestione la clave única
      try {
        return await this.create(createDto); // Reutilizamos la función de creación (que ya tiene la lógica de gestión)
      } catch (e) {
        this.logger.warn(
          `Intento de creación fallido para Area ${dto.id_area}/Nivel ${dto.id_nivel}. Buscando existente para actualizar...`,
        );

        // Si la creación falla por duplicado, intentamos actualizar el existente
        const existingConfig = await this.prisma.medallero_config.findFirst({
          where: { id_area: dto.id_area, id_nivel: dto.id_nivel },
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
        throw e; // Si aún falla, lanzamos el error original
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
