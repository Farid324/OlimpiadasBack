import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { RegistrarNotaDto } from './dto/registrar-nota.dto';

@Injectable()
export class EvaluacionesService {
  constructor(private prisma: PrismaService) {}

  // 📋 Obtener lista de olimpistas asignados a un evaluador
  async obtenerAsignados(idEvaluador: number) {
    return this.prisma.evaluaciones.findMany({
      where: { id_evaluador: idEvaluador },
      include: {
        inscripcion: {
          include: { competidor: true, area: true, nivel: true },
        },
        fase: true,
      },
      orderBy: { id_evaluacion: 'asc' },
    });
  }

  // 📝 Registrar o editar nota
  async registrarNota(
    idEvaluacion: number,
    idUsuario: number,
    dto: RegistrarNotaDto,
  ) {
    const evaluacion = await this.prisma.evaluaciones.findUnique({
      where: { id_evaluacion: idEvaluacion },
    });

    if (!evaluacion) throw new NotFoundException('Evaluación no encontrada');
    if (evaluacion.id_evaluador !== idUsuario)
      throw new ForbiddenException('No puedes modificar esta evaluación');

    const notaAnterior = evaluacion.nota;
    const nuevaNota = dto.nota;

    // ✅ Actualiza la nota
    const actualizada = await this.prisma.evaluaciones.update({
      where: { id_evaluacion },
      data: {
        nota: nuevaNota,
        comentario: dto.comentario || null,
        fecha_registro: new Date(),
        estado_registro: 'FINALIZADO',
      },
    });

    // 💾 Registra log de cambios
    await this.prisma.log_cambios_nota.create({
      data: {
        id_evaluacion,
        id_usuario: idUsuario,
        accion: notaAnterior === null ? 'CREAR' : 'EDITAR',
        valor_anterior: notaAnterior,
        valor_nuevo: nuevaNota,
      },
    });

    // ⚖️ Actualiza la clasificación del competidor
    await this.actualizarClasificacion(actualizada.id_inscripcion);

    return actualizada;
  }

  // ⚖️ Calcula CLASIFICADO / NO_CLASIFICADO automáticamente
  private async actualizarClasificacion(idInscripcion: number) {
    const evaluaciones = await this.prisma.evaluaciones.findMany({
      where: { id_inscripcion: idInscripcion },
      select: { nota: true },
    });

    const promedio =
      evaluaciones.reduce((acc, e) => acc + Number(e.nota || 0), 0) /
      evaluaciones.length;

    await this.prisma.inscripciones.update({
      where: { id_inscripcion: idInscripcion },
      data: {
        puntaje_clasificacion: promedio,
        clasificacion: promedio >= 70 ? 'CLASIFICADO' : 'NO_CLASIFICADO',
      },
    });
  }
}
