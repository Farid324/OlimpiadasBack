// src/olimpistas/olimpistas.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Req,
  Get,
  Query,
  Param,
  Patch,
  Delete,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RegistroOlimpistaDto } from './dto/registro-olimpista.dto';
import { OlimpistasService } from './olimpistas.service';
import { BigIntSerializerInterceptor } from 'src/common/interceptors/bigint-serializer.interceptor';
import { GetOlimpistasQueryDto } from './dto/get-olimpistas.query';
import { UpdateOlimpistaDto } from './dto/update-olimpista.dto';

@Controller('olimpistas')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(BigIntSerializerInterceptor)
export class OlimpistasController {
  constructor(private readonly service: OlimpistasService) {}

  @Post('register')
  @Roles('ADMINISTRADOR', 'RESPONSABLE_DE_AREA')
  @UseInterceptors(FileInterceptor('file'))
  async register(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const contentType = (req.headers['content-type'] as string) || '';

    if (contentType.includes('multipart/form-data')) {
      if (!file)
        throw new BadRequestException('Archivo CSV requerido en campo "file".');

      return this.service.registerCsv(
        file.buffer,
        file.originalname ?? 'upload.csv',
        {
          userId: req.user?.sub ? Number(req.user.sub) : undefined,
          dryRun: false,
        },
      );
    }

    if (Array.isArray(body)) {
      return this.service.registerMany(
        body as RegistroOlimpistaDto[],
        req.user?.sub ? Number(req.user.sub) : undefined,
      );
    } else if ((body as any)?.data && Array.isArray((body as any).data)) {
      return this.service.registerMany(
        (body as any).data as RegistroOlimpistaDto[],
        req.user?.sub ? Number(req.user.sub) : undefined,
      );
    } else {
      return this.service.registerOne(
        body as RegistroOlimpistaDto,
        req.user?.sub ? Number(req.user.sub) : undefined,
      );
    }
  }

  // PERMITIR también RESPONSABLE_DE_AREA y filtrar en el service
  @Get()
  @Roles('ADMINISTRADOR', 'RESPONSABLE_DE_AREA')
  list(@Query() query: GetOlimpistasQueryDto, @Req() req: any) {
    const userId = req.user?.sub ? Number(req.user.sub) : null;
    const role = String(req.user?.role ?? req.user?.rol ?? '').toUpperCase();
    const isAdmin = role === 'ADMINISTRADOR';

    return this.service.listOlimpistas({
      area: query.area,
      q: query.q,
      //limitToUserAreasOf: isAdmin ? null : userId,
    });
  }

  @Get('areas-counters')
  @Roles('ADMINISTRADOR', 'RESPONSABLE_DE_AREA')
  areasCounters(@Req() req: any) {
    const userId = req.user?.sub ? Number(req.user.sub) : null;
    const role = String(req.user?.role ?? req.user?.rol ?? '').toUpperCase();
    const isAdmin = role === 'ADMINISTRADOR';

    return this.service.getAreasCounters(isAdmin ? null : userId);
  }

  // Solo admin: verificación de CI duplicado
  @Get('check-ci/:ci')
  @Roles('ADMINISTRADOR')
  async checkCi(@Param('ci') ci: string) {
    const exists = await this.service.existsByCi(ci?.trim() ?? '');
    return { exists };
  }

  // NUEVO: obtener un olimpista por id_inscripcion (para edición)
  @Get(':id')
  @Roles('ADMINISTRADOR', 'RESPONSABLE_DE_AREA')
  async getOlimpistaById(@Param('id', ParseIntPipe) id: number) {
    return this.service.getOlimpistaById(id);
  }

  // NUEVO: actualización de olimpista por id_inscripcion
  @Patch(':id')
  @Roles('ADMINISTRADOR', 'RESPONSABLE_DE_AREA')
  async updateOlimpista(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateOlimpistaDto,
    @Req() req: any,
  ) {
    const userId = req.user?.sub ? Number(req.user.sub) : null;
    return this.service.updateOlimpista(id, body, userId ?? undefined);
  }

  // NUEVO: eliminación de olimpista por id_inscripcion
  @Delete(':id')
  @Roles('ADMINISTRADOR', 'RESPONSABLE_DE_AREA')
  async deleteOlimpista(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: any,
  ) {
    const userId = req.user?.sub ? Number(req.user.sub) : null;
    return this.service.removeOlimpista(id, userId ?? undefined);
  }
}
