// src/reportes/certificados.controller.ts
import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CertificadosService } from './certificados.service';
import { FasesService } from '../fases/fases.service';
import { PhaseType } from '../fases/dto/close-phase.dto';
import { ADMIN } from '../auth/constants';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ADMIN) // exclusivo admin por ahora
@Controller('reportes/certificados')
export class CertificadosController {
  constructor(
    private readonly service: CertificadosService,
    private readonly fases: FasesService,
  ) {}

  // ================= PREMIADOS =================
  @Get('premiados/export')
  async exportPremiados(
    @Res() res: Response,
    @Query('id_area') id_area?: string,
    @Query('id_nivel') id_nivel?: string,
    @Query('anio') anio?: string,
  ) {
    const area = id_area ? Number(id_area) : undefined;
    const nivel = id_nivel ? Number(id_nivel) : undefined;

    // mismo candado que en clasificados: solo si la fase está cerrada/validada
    if (area && nivel) {
      const st = await this.fases.getStatus(area, nivel, PhaseType.FINAL);
      if (st !== 'VALIDADA') {
        throw new HttpException(
          'Fase Bloqueada. La fase final aún no ha sido aprobada.',
          HttpStatus.LOCKED,
        );
      }
    }

    const buffer = await this.service.exportarExcelPremiados({
      id_area: area,
      id_nivel: nivel,
      anio: anio ? Number(anio) : undefined,
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="certificados-premiados.xlsx"',
    );
    res.send(buffer);
  }

  // ================= PARTICIPACIÓN =================
  @Get('participacion/export')
  async exportParticipacion(
    @Res() res: Response,
    @Query('id_area') id_area?: string,
    @Query('id_nivel') id_nivel?: string,
    @Query('anio') anio?: string,
  ) {
    const area = id_area ? Number(id_area) : undefined;
    const nivel = id_nivel ? Number(id_nivel) : undefined;

    if (area && nivel) {
      const st = await this.fases.getStatus(
        area,
        nivel,
        PhaseType.CLASIFICACION,
      );
      if (st !== 'CERRADA' && st !== 'VALIDADA') {
        throw new HttpException(
          'Fase Bloqueada. La fase de clasificación aún no ha sido aprobada.',
          HttpStatus.LOCKED,
        );
      }
    }

    const buffer = await this.service.exportarExcelParticipacion({
      id_area: area,
      id_nivel: nivel,
      anio: anio ? Number(anio) : undefined,
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="certificados-participacion.xlsx"',
    );
    res.send(buffer);
  }
}
