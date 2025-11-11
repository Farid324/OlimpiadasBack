// src/reportes/premiados.controller.ts
import {
  Controller,
  Get,
  Query,
  HttpException,
  HttpStatus,
  UseGuards,
  Post,
  Param,
  Body,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ADMIN, RESPONSABLE } from '../auth/constants';
import { PremiadosService } from './premiados.service';
import { User } from '../common/decorators/user.decorator';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';

type EstadoMedalla = 'ORO' | 'PLATA' | 'BRONCE' | 'MENCION' | 'TODOS';

@UseGuards(JwtAuthGuard, RolesGuard)
// por ahora exclusivo admin pero esta RESPONSABLE para lectura por si se usa en un futuro
@Roles(ADMIN, RESPONSABLE)
@Controller('reportes/premiados')
export class PremiadosController {
  constructor(private readonly service: PremiadosService) {}

  @Get()
  async list(
    @Query('id_area') id_area?: string,
    @Query('id_nivel') id_nivel?: string,
    @Query('estado') estado?: EstadoMedalla,
    @User() user?: JwtPayload,
  ) {
    const area = id_area ? Number(id_area) : undefined;
    const nivel = id_nivel ? Number(id_nivel) : undefined;

    // area+nivel entonces hay que validar fase final
    return this.service.list({
      id_area: area,
      id_nivel: nivel,
      estado: estado && estado !== 'TODOS' ? estado : undefined,
      actorId: user ? Number(user.sub) : undefined,
    });
  }

  @Get('resumen')
  async resumen(
    @Query('id_area') id_area?: string,
    @Query('id_nivel') id_nivel?: string,
  ) {
    const area = id_area ? Number(id_area) : undefined;
    const nivel = id_nivel ? Number(id_nivel) : undefined;
    return this.service.resumen({ id_area: area, id_nivel: nivel });
  }

  @Get('web')
  async web(
    @Query('id_area') id_area?: string,
    @Query('id_nivel') id_nivel?: string,
  ) {
    const area = id_area ? Number(id_area) : undefined;
    const nivel = id_nivel ? Number(id_nivel) : undefined;
    const html = await this.service.buildHtmlTable({ id_area: area, id_nivel: nivel });
    // formato publicable
    return { html };
  }

  //guardar nuevo orden
  @Post(':id_area/:id_nivel/reordenar')
  async reordenar(
    @Param('id_area') id_area: string,
    @Param('id_nivel') id_nivel: string,
    @Body()
    body: {
      orden: Array<{ id_inscripcion: number; posicion: number }>;
      nombreVista?: string;
    },
    @User() user: JwtPayload,
  ) {
    // solo admin o responsable autorizado
    const actorId = Number(user.sub);
    if (!body?.orden?.length) {
      throw new HttpException('El orden no puede estar vacío.', HttpStatus.BAD_REQUEST);
    }

    return this.service.saveReorder({
      id_area: Number(id_area),
      id_nivel: Number(id_nivel),
      orden: body.orden,
      actorId,
      nombreVista: body.nombreVista,
    });
  }

  @Get(':id_area/:id_nivel/historial')
  async historial(
    @Param('id_area') id_area: string,
    @Param('id_nivel') id_nivel: string,
  ) {
    return this.service.getReorderHistory({
      id_area: Number(id_area),
      id_nivel: Number(id_nivel),
    });
  }
}
