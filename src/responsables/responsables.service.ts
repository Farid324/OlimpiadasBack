import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateResponsableDto } from './dto/create-responsable.dto';
import { UpdateResponsableDto } from './dto/update-responsable.dto';
import { FilterResponsableDto } from './dto/filter-responsable.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class ResponsablesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateResponsableDto) {
    // Duplicados por correo/CI/teléfono
    const exists = await this.prisma.usuarios.findFirst({
      where: {
        OR: [{ correo: dto.correo }, { ci: dto.ci }, { telefono: dto.telefono }],
      },
    });

    if (exists) {
      if (exists.correo === dto.correo) throw new BadRequestException('El correo ya está registrado');
      if (exists.ci === dto.ci) throw new BadRequestException('El CI ya está registrado');
      if (exists.telefono === dto.telefono) throw new BadRequestException('El teléfono ya está registrado');
    }

    // ✔︎ Regla de negocio: sólo un responsable ACTIVO por área
    const ocupada = await this.prisma.responsables_area.findFirst({
      where: { id_area: dto.id_area, activo: true },
    });
    if (ocupada) {
      throw new BadRequestException('El área ya tiene un responsable asignado');
    }

    const hashedPassword = await bcrypt.hash('123456', 10);

    // Crear usuario
    const usuario = await this.prisma.usuarios.create({
      data: {
        nombre: dto.nombre,
        apellido: dto.apellido,
        correo: dto.correo,
        hash_password: hashedPassword,
        telefono: dto.telefono,
        institucion: dto.institucion,
        experiencia: dto.experiencia,
        especialidad: dto.especialidad,
        ci: dto.ci,
        id_rol: 3, // Responsable de Área
      },
    });

    // Crear relación responsable-area (activo=true por defecto si tu schema lo define así)
    await this.prisma.responsables_area.create({
      data: {
        id_usuario: usuario.id_usuario,
        id_area: dto.id_area,
        // activo: true  // si tu modelo lo requiere explícito
      },
    });

    return usuario;
  }

  async findAll(filters: FilterResponsableDto) {
    return this.prisma.responsables_area.findMany({
      where: {
        id_area: filters.id_area,
        activo: filters.activo,
      },
      include: {
        usuario: true,
        area: true,
      },
    });
  }

  async update(id: number, dto: UpdateResponsableDto) {
    const usuario = await this.prisma.usuarios.findUnique({ where: { id_usuario: id } });
    if (!usuario) throw new NotFoundException('Responsable no encontrado');

    // Validar duplicados en update (para campos que cambian)
    if (dto.correo || dto.ci || dto.telefono) {
      const dup = await this.prisma.usuarios.findFirst({
        where: {
          AND: [
            { id_usuario: { not: id } },
            {
              OR: [
                dto.correo ? { correo: dto.correo } : undefined,
                dto.ci ? { ci: dto.ci } : undefined,
                dto.telefono ? { telefono: dto.telefono } : undefined,
              ].filter(Boolean) as any,
            },
          ],
        },
      });

      if (dup) {
        if (dto.correo && dup.correo === dto.correo) throw new BadRequestException('El correo ya está registrado');
        if (dto.ci && dup.ci === dto.ci) throw new BadRequestException('El CI ya está registrado');
        if (dto.telefono && dup.telefono === dto.telefono) throw new BadRequestException('El teléfono ya está registrado');
      }
    }

    // ✔︎ Si se solicita cambio de área, validar "área única"
    if (typeof dto.id_area === 'number') {
      // Relación actual del usuario
      const relacionActual = await this.prisma.responsables_area.findFirst({
        where: { id_usuario: id },
      });

      // Si cambia el área (o no tenía y ahora tendrá), validar que la nueva no esté ocupada
      if (!relacionActual || relacionActual.id_area !== dto.id_area) {
        const ocupada = await this.prisma.responsables_area.findFirst({
          where: { id_area: dto.id_area, activo: true },
        });
        if (ocupada) {
          throw new BadRequestException('El área ya tiene un responsable asignado');
        }

        if (relacionActual) {
          // actualizar a nueva área
          await this.prisma.responsables_area.update({
            where: { id_responsable_area: relacionActual.id_responsable_area },
            data: { id_area: dto.id_area },
          });
        } else {
          // crear relación si no existía
          await this.prisma.responsables_area.create({
            data: { id_usuario: id, id_area: dto.id_area },
          });
        }
      }
    }

    // Actualizar datos de usuario
    return this.prisma.usuarios.update({
      where: { id_usuario: id },
      data: {
        nombre: dto.nombre ?? undefined,
        apellido: dto.apellido ?? undefined,
        correo: dto.correo ?? undefined,
        telefono: dto.telefono ?? undefined,
        institucion: dto.institucion ?? undefined,
        experiencia: dto.experiencia ?? undefined,
        especialidad: dto.especialidad ?? undefined,
        ci: dto.ci ?? undefined,
      },
    });
  }

  async toggleActivo(id_responsable_area: number) {
    const responsable = await this.prisma.responsables_area.findUnique({
      where: { id_responsable_area },
    });
    if (!responsable) throw new NotFoundException('Responsable no encontrado');

    return this.prisma.responsables_area.update({
      where: { id_responsable_area },
      data: { activo: !responsable.activo },
    });
  }

  async remove(id_usuario: number) {
    // elimina relación y usuario (ajústalo si prefieres desactivar en vez de borrar)
    const rel = await this.prisma.responsables_area.findFirst({ where: { id_usuario } });

    if (rel) {
      await this.prisma.responsables_area.delete({
        where: { id_responsable_area: rel.id_responsable_area },
      });
    }

    await this.prisma.usuarios.delete({
      where: { id_usuario },
    });

    return { ok: true };
  }

  // --- Checkers para el frontend ---
  async checkTelefono(telefono: string) {
    const exists = await this.prisma.usuarios.findFirst({ where: { telefono } });
    return { exists: !!exists };
  }

  async checkCi(ci: string) {
    const exists = await this.prisma.usuarios.findFirst({ where: { ci } });
    return { exists: !!exists };
  }

  async checkCorreo(correo: string) {
    const exists = await this.prisma.usuarios.findFirst({ where: { correo } });
    return { exists: !!exists };
  }

  // ✔︎ NUEVO: verificar si un área ya tiene responsable activo
  async checkArea(id_area: number) {
    const exists = await this.prisma.responsables_area.findFirst({
      where: { id_area, activo: true },
    });
    return { exists: !!exists };
  }
}
