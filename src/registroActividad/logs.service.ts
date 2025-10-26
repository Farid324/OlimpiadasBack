import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateLogDto } from './dto/create-log.dto';

@Injectable()
export class LogsService {
  constructor(private prisma: PrismaService) {}

  /** Crear un nuevo log de cambios */
  async create(createDto: CreateLogDto) {
    return this.prisma.log_cambios_nota.create({
      data: {
        id_evaluacion: createDto.id_evaluacion,
        id_usuario: createDto.id_usuario,
        accion: createDto.accion,
        valor_anterior: createDto.valor_anterior ?? null,
        valor_nuevo: createDto.valor_nuevo ?? null,
      },
    });
  }

  /** Obtener logs con filtros y paginación */
  async findAll(query: any) {
    const {
      id_evaluacion,
      id_usuario,
      accion,
      fecha_inicio,
      fecha_fin,
      page = 1,
      perPage = 20,
    } = query;

    const where: any = {};
    if (id_evaluacion) where.id_evaluacion = Number(id_evaluacion);
    if (id_usuario) where.id_usuario = Number(id_usuario);
    if (accion) where.accion = accion;
    if (fecha_inicio || fecha_fin) {
      where.ts = {};
      if (fecha_inicio) where.ts.gte = new Date(fecha_inicio);
      if (fecha_fin) where.ts.lte = new Date(fecha_fin);
    }

    const skip = (page - 1) * perPage;

    // Traemos los logs con los datos del usuario
    const [total, logsRaw] = await Promise.all([
      this.prisma.log_cambios_nota.count({ where }),
      this.prisma.log_cambios_nota.findMany({
        where,
        orderBy: { ts: 'desc' },
        skip,
        take: Number(perPage),
        include: {
          usuario: true, // trae los datos del usuario
        },
      }),
    ]);

    // 🔹 Mapeo seguro al estilo ClasificadosService
    // logs.service.ts
    const items = logsRaw.map((log) => ({
      id_log: log.id_log,
      usuario: log.usuario ? `${log.usuario.nombre} ${log.usuario.apellido}` : `Usuario ${log.id_usuario}`,
      accion: log.accion,
      entidad: 'Evaluación',
      descripcion:
        log.valor_anterior != null || log.valor_nuevo != null
          ? `Valor anterior: ${log.valor_anterior ?? '—'}, Valor nuevo: ${log.valor_nuevo ?? '—'}`
          : undefined,
      fecha: log.ts.toISOString(),
    }));

    return { items, total, page, perPage };
  }

  /** Exportar logs a CSV */
  async exportCsv(query: any) {
    const logs = (await this.findAll({ ...query, perPage: 10000 })).items;

    const header = ['fecha', 'usuario', 'accion', 'entidad', 'descripcion'];
    const csv = [
      header.join(','),
      ...logs.map(l =>
        header
          .map(h => `"${String((l as any)[h] ?? '')}"`)
          .join(',')
      ),
    ].join('\n');

    return csv;
  }
}

