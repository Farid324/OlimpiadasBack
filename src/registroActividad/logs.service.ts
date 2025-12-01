import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateLogDto } from './dto/create-log.dto';
import { QueryLogsDto } from './dto/query-logs.dto';

@Injectable()
export class LogsService {
  constructor(private prisma: PrismaService) {}

  /** 🔹 Crear un nuevo log de cambios */
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

  /** 🔹 Obtener logs con filtros y paginación */
  /** 🔹 Obtener logs con filtros y paginación */
  // LogsService.ts
async findAll(query: QueryLogsDto & { page?: number; perPage?: number }) {
  const {
    id_evaluacion,
    id_usuario,
    usuario, // <- nuevo
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

  // 🔹 Filtrado por nombre de usuario (si se manda usuario)
  if (usuario) {
    where.usuario = {
      OR: [
        { nombre: { contains: usuario, mode: 'insensitive' } },
        { apellido: { contains: usuario, mode: 'insensitive' } },
      ],
    };
  }

  const skip = (page - 1) * perPage;

  const [total, logsRaw] = await Promise.all([
    this.prisma.log_cambios_nota.count({ where }),
    this.prisma.log_cambios_nota.findMany({
      where,
      orderBy: { ts: 'desc' },
      skip,
      take: Number(perPage),
      include: {
        usuario: true,
        evaluacion: {
          include: {
            inscripcion: {
              include: {
                competidor: true,
                area: true,
                nivel: true,
              },
            },
            fase: true,
          },
        },
      },
    }),
  ]);

  const items = logsRaw.map((log) => {
    const comp = log.evaluacion?.inscripcion?.competidor;
    const area = log.evaluacion?.inscripcion?.area?.nombre_area;
    const nivel = log.evaluacion?.inscripcion?.nivel?.nombre_nivel;

    const objetivo = comp
      ? `${comp.nombres} ${comp.apellidos} (${area ?? 'Área desconocida'} - ${
          nivel ?? 'Nivel desconocido'
        })`
      : `Evaluación #${log.id_evaluacion}`;

    const descripcion =
      log.accion === 'REGISTRO' ? 'Se registró una nueva nota.' : 'Se modificó la nota.';

    const cambios =
      log.valor_anterior != null && log.valor_nuevo != null
        ? `De ${log.valor_anterior} → ${log.valor_nuevo}`
        : log.valor_nuevo != null
        ? `Nueva nota: ${log.valor_nuevo}`
        : '—';

    return {
      id: log.id_log,
      usuario: log.usuario
        ? `${log.usuario.nombre} ${log.usuario.apellido}`
        : `Usuario ${log.id_usuario}`,
      accion: log.accion,
      objetivo,
      descripcion,
      cambios,
      fecha: new Date(log.ts).toLocaleString('es-BO', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  });

  return { items, total, page, perPage };
}



  /** 🔹 Exportar logs a CSV */
  async exportCsv(query: QueryLogsDto) {
    const logs = (await this.findAll({ ...query, perPage: 10000 })).items;

    const header = ['fecha', 'usuario', 'accion', 'objetivo', 'descripcion', 'cambios'];
    const csv = [
      header.join(','),
      ...logs.map((l) =>
        header
          .map((h) => `"${String((l as any)[h] ?? '').replace(/"/g, '""')}"`)
          .join(',')
      ),
    ].join('\n');

    return csv;
  }
}
