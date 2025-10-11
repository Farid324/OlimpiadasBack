// src/responsables/responsables.service.ts
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
    //Validar duplicados: correo, CI o teléfono
    const exists = await this.prisma.usuarios.findFirst({
      where: {
        OR: [
          { correo: dto.correo },
          { ci: dto.ci },
          { telefono: dto.telefono },
        ],
      },
    });

    if (exists) {
      if (exists.correo === dto.correo) {
        throw new BadRequestException('El correo ya está registrado');
      }
      if (exists.ci === dto.ci) {
        throw new BadRequestException('El CI ya está registrado');
      }
      if (exists.telefono === dto.telefono) {
        throw new BadRequestException('El teléfono ya está registrado');
      }
    }

    //Password inicial por defecto
    const hashedPassword = await bcrypt.hash('123456', 10);

    //Crear usuario
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
        id_rol: 3, // ID de Responsable de Área (ajustar según tu seed)
      },
    });

    //Crear relación en responsables_area
    await this.prisma.responsables_area.create({
      data: {
        id_usuario: usuario.id_usuario,
        id_area: dto.id_area,
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
    const responsable = await this.prisma.usuarios.findUnique({
      where: { id_usuario: id },
    });
    if (!responsable) throw new NotFoundException('Responsable no encontrado');

    //Validar duplicados en update
    if (dto.correo || dto.ci || dto.telefono) {
      const exists = await this.prisma.usuarios.findFirst({
        where: {
          AND: [
            { id_usuario: { not: id } },
            {
              OR: [
                { correo: dto.correo || undefined },
                { ci: dto.ci || undefined },
                { telefono: dto.telefono || undefined },
              ],
            },
          ],
        },
      });

      if (exists) {
        if (dto.correo && exists.correo === dto.correo) {
          throw new BadRequestException('El correo ya está registrado');
        }
        if (dto.ci && exists.ci === dto.ci) {
          throw new BadRequestException('El CI ya está registrado');
        }
        if (dto.telefono && exists.telefono === dto.telefono) {
          throw new BadRequestException('El teléfono ya está registrado');
        }
      }
    }

    return this.prisma.usuarios.update({
      where: { id_usuario: id },
      data: { ...dto },
    });
  }

  async toggleActivo(id: number) {
    const responsable = await this.prisma.responsables_area.findUnique({
      where: { id_responsable_area: id },
    });
    if (!responsable) throw new NotFoundException('Responsable no encontrado');

    return this.prisma.responsables_area.update({
      where: { id_responsable_area: id },
      data: { activo: !responsable.activo },
    });
  }
  //Endpoint de validación rápida para frontend
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
}
