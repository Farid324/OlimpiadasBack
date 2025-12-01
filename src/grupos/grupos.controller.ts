// src/grupos/dto/create-grupo.dto.ts

import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Get,
  Param,
  Query,
} from '@nestjs/common';
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GruposService } from './grupos.service';
import { CreateGrupoDto, MiembroGrupoDto } from './dto/create-grupo.dto';
import { parseCsvToDtos } from '../common/utils/csv.util';

interface RequestWithUser extends Request {
  user?: {
    sub: number;
    email?: string;
    rol?: string;
  };
}
@Controller('grupos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class GruposController {
  constructor(private readonly service: GruposService) {}

  @Get('check-miembro')
  async checkMiembro(@Query('ci') ci?: string) {
    if (!ci) throw new BadRequestException('Parámetro "ci" es requerido');
    return this.service.checkMiembroPorCI(ci.trim());
  }

  @Get(':id')
  @Roles('ADMINISTRADOR', 'RESPONSABLE_DE_AREA')
  async findOne(@Param('id') id: string) {
    const grupoId = Number(id);
    return this.service.getGrupoDetalle(grupoId);
  }

  @Post('register')
  @Roles('ADMINISTRADOR', 'RESPONSABLE_DE_AREA')
  async register(@Body() body: CreateGrupoDto, @Req() req: RequestWithUser) {
    return this.service.registerGrupo(
      body,
      req.user?.sub ? Number(req.user.sub) : undefined,
    );
  }

  @Post('register-csv')
  @Roles('ADMINISTRADOR', 'RESPONSABLE_DE_AREA')
  @UseInterceptors(FileInterceptor('file'))
  async registerCsv(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: Omit<CreateGrupoDto, 'miembros'>,
    @Req() req: RequestWithUser,
  ) {
    if (!file)
      throw new BadRequestException('Archivo CSV requerido en "file".');
    const rawRows = await parseCsvToDtos(file.buffer);
    const miembros = rawRows as unknown as MiembroGrupoDto[];

    const dto: CreateGrupoDto = {
      ...body,
      miembros,
    };
    return this.service.registerGrupo(
      dto,
      req.user?.sub ? Number(req.user.sub) : undefined,
    );
  }
}
