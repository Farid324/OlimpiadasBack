import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { PasswordRecoveryService } from './password-recovery.service';
import { RecoverByDataDto } from './dto/recover-by-data.dto';
import { RecoverByEmailDto } from './dto/recover-by-email.dto';

@Controller('auth')
export class PasswordRecoveryController {
  constructor(private readonly service: PasswordRecoveryService) {}

  // POST /auth/recover/by-data
  @Post('recover/by-data')
  @HttpCode(200)
  async recoverByData(@Body() dto: RecoverByDataDto) {
    return this.service.recoverByData(dto);
  }

  // POST /auth/recover/by-email
  @Post('recover/by-email')
  @HttpCode(200)
  async recoverByEmail(@Body() dto: RecoverByEmailDto) {
    return this.service.recoverByEmail(dto);
  }
}
