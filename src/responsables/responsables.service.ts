// src/responsables/responsables.service.ts
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
  HttpException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateResponsableDto } from './dto/create-responsable.dto';
import { UpdateResponsableDto } from './dto/update-responsable.dto';
import { FilterResponsableDto } from './dto/filter-responsable.dto';
import * as bcrypt from 'bcrypt';
import { EmailService } from '../email/email.service';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

function isKnownPrismaError(e: unknown): e is PrismaClientKnownRequestError {
  return e instanceof PrismaClientKnownRequestError;
}

function hasCodeMeta(
  e: unknown,
): e is { code: string | number; meta?: Record<string, unknown> } {
  return typeof e === 'object' && e !== null && 'code' in e;
}

function hasHttpResponseMessage(
  e: unknown,
): e is { response: { message?: string | string[] } } {
  if (typeof e !== 'object' || e === null || !('response' in e)) return false;
  const r = (e as { response?: unknown }).response;
  return typeof r === 'object' && r !== null;
}

function errorToLog(e: unknown) {
  if (isKnownPrismaError(e)) {
    return { name: e.name, code: e.code, message: e.message, meta: e.meta };
  }
  if (e instanceof Error) return { name: e.name, message: e.message };
  return { value: String(e) };
}

function formatPrismaError(err: unknown): string {
  if (isKnownPrismaError(err)) {
    const metaObj = err.meta ?? {};
    const targetRaw = (metaObj as { target?: unknown }).target;
    const metaStr =
      Object.keys(metaObj).length > 0
        ? ` | meta: ${JSON.stringify(metaObj)}`
        : '';

    switch (err.code) {
      case 'P2002': {
        const target = Array.isArray(targetRaw)
          ? (targetRaw as string[])
          : ['campo único'];
        return `Duplicado en ${target.join(', ')}`;
      }
      case 'P2003':
        return `Violación de clave foránea${metaStr}`;
      case 'P2000':
        return `Valor demasiado largo para un campo${metaStr}`;
      case 'P2011':
        return `Hay un campo obligatorio sin valor${metaStr}`;
      case 'P2025':
        return `Registro relacionado no encontrado${metaStr}`;
      default:
        return `Error Prisma ${err.code}${metaStr}`;
    }
  }

  if (hasCodeMeta(err)) {
    const code = String(err.code);
    const metaObj = err.meta ?? {};
    const metaStr =
      Object.keys(metaObj).length > 0
        ? ` | meta: ${JSON.stringify(metaObj)}`
        : '';
    return `Error Prisma ${code}${metaStr}`;
  }

  if (hasHttpResponseMessage(err)) {
    const msg = (err as { response: { message?: string | string[] } }).response
      .message;
    if (Array.isArray(msg)) return msg.join(', ');
    if (typeof msg === 'string') return msg;
  }

  if (err instanceof Error) return err.message;
  return 'Error desconocido';
}

@Injectable()
export class ResponsablesService {
  private readonly logger = new Logger(ResponsablesService.name);
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}
  private async getResponsableRoleId(): Promise<number> {
    try {
      const rol = await this.prisma.roles.findUnique({
        where: { nombre: 'RESPONSABLE_DE_AREA' },
        select: { id_rol: true },
      });
      if (!rol?.id_rol) {
        throw new NotFoundException('Rol "RESPONSABLE_DE_AREA" no encontrado.');
      }
      return rol.id_rol;
    } catch (e) {
      this.logger.error(
        'Error al buscar el rol RESPONSABLE_DE_AREA',
        e instanceof Error ? e.stack : e,
      );
      throw new BadRequestException(
        `Error interno al buscar rol: ${formatPrismaError(e)}`,
      );
    }
  }
  async create(dto: CreateResponsableDto) {
    try {
      // Envuelve en try...catch para loggear errores
      // Validar duplicados (tu código existente)
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
        if (exists.correo === dto.correo)
          throw new BadRequestException('El correo ya está registrado');
        if (exists.ci === dto.ci)
          throw new BadRequestException('El CI ya está registrado');
        if (exists.telefono === dto.telefono)
          throw new BadRequestException('El teléfono ya está registrado');
      }

      // AÑADE: Validar que el CI exista (es la contraseña)
      if (!dto.ci || !dto.ci.trim()) {
        throw new BadRequestException(
          'El CI es obligatorio para la contraseña inicial.',
        );
      }
      const tempPassword = dto.ci.trim();
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(tempPassword, saltRounds);

      // AÑADE: Obtener ID del rol dinámicamente
      const idRolResponsable = await this.getResponsableRoleId();

      // Crear usuario
      const usuario = await this.prisma.usuarios.create({
        data: {
          nombre: dto.nombre,
          apellido: dto.apellido,
          correo: dto.correo,
          hash_password: hashedPassword, // MODIFICA: Usa contraseña hasheada
          telefono: dto.telefono,
          institucion: dto.institucion,
          experiencia: dto.experiencia,
          especialidad: dto.especialidad,
          ci: tempPassword, // Guarda el CI
          rol: { connect: { id_rol: idRolResponsable } }, // MODIFICA: Usa el ID obtenido
        },
        // AÑADE: Pide datos para el email
        select: { id_usuario: true, nombre: true, correo: true },
      });

      // Crear relación responsable_area (tu código existente)
      await this.prisma.responsables_area.create({
        data: {
          id_usuario: usuario.id_usuario,
          id_area: dto.id_area,
          // activo: true // Prisma lo pone por defecto si está en el schema
        },
      });
      // AÑADE: Enviar correo (sin esperar y capturando errores)
      this.emailService
        .sendResponsableWelcomeEmail(
          // Asegúrate que este método exista en EmailService
          usuario.correo,
          usuario.nombre,
          tempPassword, // CI sin hashear
        )
        .catch((emailError) => {
          this.logger.error(
            `FALLO al enviar email de bienvenida a Responsable ${usuario.correo} (ID: ${usuario.id_usuario})`,
            emailError instanceof Error ? emailError.stack : String(emailError),
          );
        });

      // Devuelve solo el ID o un objeto simple, no toda la data sensible
      return { ok: true, id_usuario: usuario.id_usuario };
    } catch (err: unknown) {
      // Log detallado del error original
      this.logger.error('Error en create responsable:', errorToLog(err));

      // Mantiene tu lógica actual para devolver errores específicos al frontend
      if (isKnownPrismaError(err))
        throw new BadRequestException(formatPrismaError(err));
      if (err instanceof HttpException) throw err; // Re-lanza errores HTTP
      // Error genérico si no es de Prisma ni HTTP
      throw new BadRequestException(
        formatPrismaError(err) || 'No se pudo registrar el responsable',
      );
    }
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

    // Validar duplicados
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
        if (dto.correo && exists.correo === dto.correo)
          throw new BadRequestException('El correo ya está registrado');
        if (dto.ci && exists.ci === dto.ci)
          throw new BadRequestException('El CI ya está registrado');
        if (dto.telefono && exists.telefono === dto.telefono)
          throw new BadRequestException('El teléfono ya está registrado');
      }
    }

    // Actualizar usuario
    const updated = await this.prisma.usuarios.update({
      where: { id_usuario: id },
      data: {
        nombre: dto.nombre,
        apellido: dto.apellido,
        correo: dto.correo,
        telefono: dto.telefono,
        ci: dto.ci,
        institucion: dto.institucion,
        especialidad: dto.especialidad,
        experiencia: dto.experiencia,
      },
    });

    // Actualizar área si se envía
    if (dto.id_area) {
      await this.prisma.responsables_area.updateMany({
        where: { id_usuario: id },
        data: { id_area: dto.id_area },
      });
    }

    return updated;
  }

  async delete(id: number) {
    const responsable = await this.prisma.usuarios.findUnique({
      where: { id_usuario: id },
    });
    if (!responsable) throw new NotFoundException('Responsable no encontrado');

    // Eliminar la relación primero
    await this.prisma.responsables_area.deleteMany({
      where: { id_usuario: id },
    });

    // Luego eliminar el usuario
    await this.prisma.usuarios.delete({
      where: { id_usuario: id },
    });

    return { message: 'Responsable eliminado correctamente' };
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

  async checkTelefono(telefono: string) {
    const exists = await this.prisma.usuarios.findFirst({
      where: { telefono },
    });
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
