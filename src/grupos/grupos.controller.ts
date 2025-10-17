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
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GruposService } from './grupos.service';
import { CreateGrupoDto } from './dto/create-grupo.dto';
import { parseCsvToDtos } from '../common/utils/csv.util';


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
  @Roles('ADMINISTRADOR')
  async findOne(@Param('id') id: string) {
    const grupoId = Number(id);
    return this.service.getGrupoDetalle(grupoId);
  }

  @Post('register')
  @Roles('ADMINISTRADOR')
  async register(@Body() body: CreateGrupoDto, @Req() req: any) {
    return this.service.registerGrupo(
      body,
      req.user?.sub ? Number(req.user.sub) : undefined,
    );
  }

  @Post('register-csv')
  @Roles('ADMINISTRADOR')
  @UseInterceptors(FileInterceptor('file'))
  async registerCsv(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: Omit<CreateGrupoDto, 'miembros'>,
    @Req() req: any,
  ) {
    if (!file)
      throw new BadRequestException('Archivo CSV requerido en "file".');
    const miembros = (await parseCsvToDtos(file.buffer)) as any[];
    const dto: CreateGrupoDto = { ...body, miembros } as any;
    return this.service.registerGrupo(
      dto,
      req.user?.sub ? Number(req.user.sub) : undefined,
    );
  }
}
