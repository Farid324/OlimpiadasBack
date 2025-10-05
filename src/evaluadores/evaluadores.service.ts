import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEvaluadorDto } from './dto/create-evaluador.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class EvaluadoresService {
  constructor(private prisma: PrismaService) {}

  // ya lo tienes para listar, lo dejo por claridad
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

    if (!id_areas?.length) {
      throw new BadRequestException('Debe seleccionar al menos un área.');
    }

    // separar "Nombre Completo" => nombre + apellido
    const parts = nombreCompleto.trim().split(/\s+/);
    const nombre = parts.shift() ?? '';
    const apellido = parts.join(' ');

    const rolEval = await this.prisma.roles.findUnique({
      where: { nombre: 'EVALUADOR' },
    });
    if (!rolEval) throw new BadRequestException('Rol EVALUADOR no existe.');

    // password temporal desde env o por defecto
    const tempPass = process.env.EVAL_TEMP_PASSWORD ?? 'Olimpiadas2025!';
    const hash = await bcrypt.hash(tempPass, 10);

    const user = await this.prisma.usuarios.create({
      data: {
        correo,
        hash_password: hash,
        nombre,
        apellido,
        telefono: telefono || null,
        institucion: institucion || null,
        especialidad: especialidad || null,
        experiencia: typeof experiencia === 'number' ? experiencia : null,
        id_rol: rolEval.id_rol,
        activo: true,
      },
    });

    // relacionar como evaluador en las áreas
    await this.prisma.evaluadores_area.createMany({
      data: id_areas.map((id_area) => ({
        id_usuario: user.id_usuario,
        id_area,
      })),
      skipDuplicates: true,
    });

    // opcional: también responsable en las mismas áreas
    if (responsable) {
      await this.prisma.responsables_area.createMany({
        data: id_areas.map((id_area) => ({
          id_usuario: user.id_usuario,
          id_area,
        })),
        skipDuplicates: true,
      });
    }

    // devolver con sus áreas
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
          select: { area: { select: { id_area: true, nombre_area: true } } },
        },
      },
    });
  }
}
