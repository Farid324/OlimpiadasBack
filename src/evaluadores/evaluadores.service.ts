import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEvaluadorDto } from './dto/create-evaluador.dto';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';

@Injectable()
export class EvaluadoresService {
  constructor(private prisma: PrismaService) {}

  // Listado con búsqueda opcional
  async findAll(q?: string) {
    return this.prisma.usuarios.findMany({
      where: {
        rol: { nombre: 'EVALUADOR' },
        ...(q
          ? {
              OR: [
                { nombre: { contains: q, mode: 'insensitive' } },
                { apellido: { contains: q, mode: 'insensitive' } },
                { correo: { contains: q, mode: 'insensitive' } },
                { institucion: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id_usuario: true,
        nombre: true,
        apellido: true,
        correo: true,
        telefono: true,
        institucion: true,
        especialidad: true,
        experiencia: true,
        activo: true,
        evaluadores_area: {
          select: { area: { select: { id_area: true, nombre_area: true } } },
        },
      },
      orderBy: { id_usuario: 'desc' },
    });
  }

  async create(dto: CreateEvaluadorDto) {
    const {
      nombreCompleto,
      correo,
      telefono,
      institucion,
      especialidad,
      experiencia,
      id_areas,
      responsable = false,
    } = dto;

    // Reglas mínimas
    if (!nombreCompleto?.trim()) {
      throw new BadRequestException('El nombre completo es obligatorio.');
    }
    if (!correo?.trim()) {
      throw new BadRequestException('El correo es obligatorio.');
    }
    if (!id_areas?.length) {
      throw new BadRequestException('Debe seleccionar al menos un área.');
    }

    // Separar nombre/apellido
    const parts = nombreCompleto.trim().split(/\s+/);
    const nombre = parts.shift() ?? '';
    const apellido = parts.join(' ');

    // Rol EVALUADOR
    const rolEval = await this.prisma.roles.findFirst({
      where: { nombre: 'EVALUADOR' },
    });
    if (!rolEval) {
      throw new NotFoundException('Rol EVALUADOR no existe.');
    }

    // Validar que las áreas existan y estén activas
    const areas = await this.prisma.areas.findMany({
      where: { id_area: { in: id_areas }, activo: true },
      select: { id_area: true },
    });
    const noEncontradas = id_areas.filter(
      (id) => !areas.some((a) => a.id_area === id),
    );
    if (noEncontradas.length) {
      throw new BadRequestException(
        `Áreas inválidas o inactivas: [${noEncontradas.join(', ')}]`,
      );
    }

    // Password temporal
    const tempPass = process.env.EVAL_TEMP_PASSWORD ?? 'Olimpiadas2025!';
    const hash = await bcrypt.hash(tempPass, 10);

    try {
      // Transacción: crear usuario + vincular áreas + (opcional) responsables
      const [user] = await this.prisma.$transaction([
        this.prisma.usuarios.create({
          data: {
            correo,
            hash_password: hash,
            nombre,
            apellido,
            telefono: telefono || null,
            institucion: institucion || null,
            especialidad: especialidad || null,
            experiencia:
              typeof experiencia === 'number' && !Number.isNaN(experiencia)
                ? experiencia
                : 0,
            id_rol: rolEval.id_rol,
            activo: true,
          },
        }),

        // Nota: las relaciones se crean en pasos separados dentro de la misma tx (se usa el id resultante)
      ]);

      // Vincular áreas (fuera del array de la tx anterior porque requiere el id del user ya creado)
      await this.prisma.evaluadores_area.createMany({
        data: id_areas.map((id_area) => ({
          id_usuario: user.id_usuario,
          id_area,
          activo: true,
        })),
        skipDuplicates: true,
      });

      // (Opcional) también responsable en esas áreas
      if (responsable) {
        await this.prisma.responsables_area.createMany({
          data: id_areas.map((id_area) => ({
            id_usuario: user.id_usuario,
            id_area,
            activo: true,
          })),
          skipDuplicates: true,
        });
      }

      // Devolver con sus áreas
      return this.prisma.usuarios.findUnique({
        where: { id_usuario: user.id_usuario },
        select: {
          id_usuario: true,
          nombre: true,
          apellido: true,
          correo: true,
          telefono: true,
          institucion: true,
          especialidad: true,
          experiencia: true,
          activo: true,
          evaluadores_area: {
            select: {
              area: { select: { id_area: true, nombre_area: true } },
            },
          },
        },
      });
    } catch (err: any) {
      // Correo duplicado u otros errores de unicidad
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('El correo ya está registrado.');
      }
      // Por si llega como Postgres unique violation
      if (err?.code === 'P2002' || err?.code === '23505') {
        throw new ConflictException('El correo ya está registrado.');
      }
      throw err;
    }
  }
}
