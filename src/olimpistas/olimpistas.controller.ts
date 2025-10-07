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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RegistroOlimpistaDto } from './dto/registro-olimpista.dto';
import { OlimpistasService } from './olimpistas.service';
import { BigIntSerializerInterceptor } from '../common/interceptors/bigint-serializer.interceptor';

@Controller('olimpistas')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(BigIntSerializerInterceptor)
export class OlimpistasController {
  constructor(private readonly service: OlimpistasService) {}

  @Post('register')
  @Roles('ADMINISTRADOR')
  @UseInterceptors(FileInterceptor('file'))
  async register(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
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
          userId: req.user?.sub ? BigInt(req.user.sub) : undefined,
          dryRun: false,
        },
      );
    }

    if (Array.isArray(body)) {
      return this.service.registerMany(
        body as RegistroOlimpistaDto[],
        req.user?.sub ? BigInt(req.user.sub) : undefined,
      );
    } else if (body?.data && Array.isArray(body.data)) {
      return this.service.registerMany(
        body.data as RegistroOlimpistaDto[],
        req.user?.sub ? BigInt(req.user.sub) : undefined,
      );
    } else {
      return this.service.registerOne(
        body as RegistroOlimpistaDto,
        req.user?.sub ? BigInt(req.user.sub) : undefined,
      );
    }
  }
}
