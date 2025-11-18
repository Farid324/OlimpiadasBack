import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { ResponsablesService } from './responsables.service';
import { CreateResponsableDto } from './dto/create-responsable.dto';
import { UpdateResponsableDto } from './dto/update-responsable.dto';
import { FilterResponsableDto } from './dto/filter-responsable.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { ADMIN } from '../auth/constants';

@Controller('responsables')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ADMIN)
export class ResponsablesController {
  constructor(private readonly service: ResponsablesService) {}

  @Post()
  create(@Body() dto: CreateResponsableDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() filters: FilterResponsableDto) {
    return this.service.findAll(filters);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateResponsableDto) {
    return this.service.update(Number(id), dto);
  }

  @Patch(':id/toggle')
  toggle(@Param('id') id: string) {
    return this.service.toggleActivo(Number(id));
  }

  // ✔︎ verificaciones rápidas ya existentes
  @Get('check-telefono/:telefono')
  checkTelefono(@Param('telefono') telefono: string) {
    return this.service.checkTelefono(telefono);
  }

  @Get('check-ci/:ci')
  checkCi(@Param('ci') ci: string) {
    return this.service.checkCi(ci);
  }

  @Get('check-correo/:correo')
  checkCorreo(@Param('correo') correo: string) {
    return this.service.checkCorreo(correo);
  }

  // ✔︎ NUEVO: verificación de área ocupada (activo=true)
  @Get('check-area/:id_area')
  checkArea(@Param('id_area') id_area: string) {
    return this.service.checkArea(Number(id_area));
  }

  // (Si ya añadiste borrar anteriormente, mantenlo)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(Number(id));
  }
}
