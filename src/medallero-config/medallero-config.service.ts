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

  /**
   * Obtener todas las combinaciones Área/Nivel habilitadas para la GESTIÓN ABIERTA,
   * con:
   * - participantes = inscripciones en esa gestión (si hay)
   * - configuración de medallero propia de esa gestión (si existe; si no, 0)
   *
   * Esto permite configurar medallas AUNQUE TODAVÍA NO HAYA INSCRIPCIONES.
   */
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

    // 1. Áreas activas (son las "vigentes" para la gestión abierta)
    const areasActivas = await this.prisma.areas.findMany({
      where: { activo: true },
      select: {
        id_area: true,
        nombre_area: true,
        niveles_target: true, // "Primaria, Secundaria", etc.
      },
      orderBy: { nombre_area: 'asc' },
    });

    if (areasActivas.length === 0) {
      this.logger.warn(
        `No hay áreas activas al consultar medallero para gestión ${gestion.id_gestion}`,
      );
      return [];
    }

    // 2. Todos los niveles disponibles
    const niveles = await this.prisma.niveles.findMany({
      select: {
        id_nivel: true,
        nombre_nivel: true,
      },
      orderBy: { orden: 'asc' },
    });

    // 3. Participantes por Área/Nivel en la gestión ABIERTA
    const inscripcionesAgrupadas = await this.prisma.inscripciones.groupBy({
      by: ['id_area', 'id_nivel'],
      where: { id_gestion: gestion.id_gestion },
      _count: { id_competidor: true },
    });

    const participantesMap = new Map<string, number>();
    for (const g of inscripcionesAgrupadas) {
      const key = `${g.id_area}-${g.id_nivel}`;
      participantesMap.set(key, g._count.id_competidor);
    }

    this.logger.debug(
      `findAll(): ${inscripcionesAgrupadas.length} combinaciones Área/Nivel con participantes para gestión ${gestion.id_gestion}`,
    );

    const results: MedalleroConfigWithDetails[] = [];

    const getNivelesParaArea = (nivelesTarget: string | null | undefined) => {
      if (!nivelesTarget || nivelesTarget.trim() === '') {
        // Sin filtro explícito -> todos los niveles definidos
        return niveles;
      }

      const tokens = nivelesTarget
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

      // Ejemplo: tokens = ["PRIMARIA", "SECUNDARIA"]
      return niveles.filter((n) => {
        const nombre = (n.nombre_nivel ?? '').toUpperCase();
        return tokens.some((t) => nombre.includes(t));
      });
    };

    // 4. Construir TODAS las combinaciones área/nivel según niveles_target
    for (const area of areasActivas) {
      const nivelesParaArea = getNivelesParaArea(area.niveles_target);

      for (const nivel of nivelesParaArea) {
        const key = `${area.id_area}-${nivel.id_nivel}`;
        const participantes = participantesMap.get(key) ?? 0;

        // 5. Configuración de medallero PARA ESTA GESTIÓN
        const config = await this.prisma.medallero_config.findFirst({
          where: {
            id_area: area.id_area,
            id_nivel: nivel.id_nivel,
            id_gestion: gestion.id_gestion,
          },
          orderBy: { id_medallero: 'desc' },
        });

        results.push({
          id_medallero: config?.id_medallero ?? 0,
          id_area: area.id_area,
          id_nivel: nivel.id_nivel,
          area_nombre: area.nombre_area,
          nivel_nombre: nivel.nombre_nivel,
          participantes,
          oros: config?.oros ?? 0,
          platas: config?.platas ?? 0,
          bronces: config?.bronces ?? 0,
          menciones: config?.menciones ?? 0,
          vigente_desde: config?.vigente_desde ?? null,
          vigente_hasta: config?.vigente_hasta ?? null,
        });
      }
    }

    // 6. Ordenar por Área y luego por Nivel
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

  async findOne(id: number) {
    return this.prisma.medallero_config.findUnique({
      where: { id_medallero: id },
    });
  }
}
