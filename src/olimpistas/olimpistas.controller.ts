///src/olimpistas/olimpistas.controller.ts
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
import { Request } from 'express'; // 1️⃣ Importamos Request de express
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RegistroOlimpistaDto } from './dto/registro-olimpista.dto';
import { OlimpistasService } from './olimpistas.service';
import { BigIntSerializerInterceptor } from 'src/common/interceptors/bigint-serializer.interceptor';
import { GetOlimpistasQueryDto } from './dto/get-olimpistas.query';
import { UpdateOlimpistaDto } from './dto/update-olimpista.dto';

// 2️⃣ Definimos la interfaz para extender Request con el usuario
interface RequestWithUser extends Request {
  user?: {
    sub: number;
    email?: string;
    role?: string;
    rol?: string; // Por si acaso usas 'rol' en el payload del JWT
  };
}

// 3️⃣ Interfaz auxiliar para el body cuando viene data envuelta
interface BodyWithData {
  data?: RegistroOlimpistaDto[];
}

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
    @Body() body: unknown, // Mantenemos unknown para validar runtime
    @Req() req: RequestWithUser,
    @Query('dryRun') dryRun?: string,
  ) {
    const contentType = (req.headers['content-type'] as string) || '';

    // Normalizamos dryRun (acepta ?dryRun=true / ?dryRun=TRUE, etc.)
    const isDryRun = String(dryRun).toLowerCase() === 'true';

    // Lógica para CSV (Multipart)
    if (contentType.includes('multipart/form-data')) {
      if (!file)
        throw new BadRequestException('Archivo CSV requerido en campo "file".');

      return this.service.registerCsv(
        file.buffer,
        file.originalname ?? 'upload.csv',
        {
          userId: req.user?.sub ? Number(req.user.sub) : undefined,
          dryRun: isDryRun,
        },
      );
    }

    // Lógica para JSON (Array directo)
    if (Array.isArray(body)) {
      return this.service.registerMany(
        body as RegistroOlimpistaDto[],
        req.user?.sub ? Number(req.user.sub) : undefined,
      );
    }
    // Lógica para JSON ({ data: [...] })
    // Validación de tipos segura para evitar 'unsafe member access'
    if (
      typeof body === 'object' &&
      body !== null &&
      'data' in body &&
      Array.isArray((body as BodyWithData).data)
    ) {
      return this.service.registerMany(
        (body as BodyWithData).data as RegistroOlimpistaDto[],
        req.user?.sub ? Number(req.user.sub) : undefined,
      );
    }
    // Lógica para JSON (Objeto único)
    else {
      return this.service.registerOne(
        body as RegistroOlimpistaDto,
        req.user?.sub ? Number(req.user.sub) : undefined,
      );
    }
  }

  @Get()
  @Roles('ADMINISTRADOR', 'RESPONSABLE_DE_AREA')
  list(@Query() query: GetOlimpistasQueryDto) {
    // 6️⃣ Eliminadas variables userId/isAdmin no usadas
    return this.service.listOlimpistas({
      area: query.area,
      q: query.q,
    });
  }

  @Get('areas-counters')
  @Roles('ADMINISTRADOR', 'RESPONSABLE_DE_AREA')
  areasCounters() {
    // 7️⃣ Eliminadas variables userId/isAdmin no usadas
    // Pasamos null explícitamente ya que quitamos la lógica de restricción
    return this.service.getAreasCounters(null);
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
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user?.sub ? Number(req.user.sub) : undefined;
    return this.service.updateOlimpista(id, body, userId);
  }

  // NUEVO: eliminación de olimpista por id_inscripcion
  @Delete(':id')
  @Roles('ADMINISTRADOR', 'RESPONSABLE_DE_AREA')
  async deleteOlimpista(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user?.sub ? Number(req.user.sub) : undefined;
    return this.service.removeOlimpista(id, userId);
  }
}
