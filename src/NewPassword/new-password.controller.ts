// src/NewPassword/new-password.controller.ts
import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { NewPasswordService } from './new-password.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('auth')
export class NewPasswordController {
  constructor(private readonly newPasswordService: NewPasswordService) {}

  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  async changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    // depende de cómo armes el payload del JWT
    const userId: number | undefined = Number(
      req.user?.id_usuario ?? req.user?.sub ?? req.user?.id,
    );

    return this.newPasswordService.changePassword(
      userId,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
