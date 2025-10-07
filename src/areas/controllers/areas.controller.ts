import { Controller, Get, UseGuards } from '@nestjs/common';
import { AreasService } from '../services/areas.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ADMIN } from '../../auth/constants';

@Controller('areas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ADMIN)
export class AreasController {
  constructor(private s: AreasService) {}
  @Get() findAll() { return this.s.findAllActive(); }
}
