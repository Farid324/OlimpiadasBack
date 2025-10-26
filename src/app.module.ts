// src/app.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';

// Auth
import { AuthController } from './auth/controllers/auth.controller';
import { AuthService } from './auth/services/auth.service';
import { JwtStrategy } from './auth/strategies/jwt.strategy';

// Users
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';

// Módulos
import { AreasModule } from './areas/areas.module';
import { ResponsablesModule } from './responsables/responsables.module';
import { EvaluadoresModule } from './evaluadores/evaluadores.module';
import { OlimpistasModule } from './olimpistas/olimpistas.module';
import { GruposModule } from './grupos/grupos.module';
import { TutoresModule } from './tutores/tutores.module';

// NUEVOS
import { NivelesModule } from './niveles/niveles.module';
import { ReportesModule } from './reportes/reportes.module';
import { LogsModule } from './registroActividad/logs.module';
@Module({
  imports: [
    PrismaModule,
    AreasModule,
    OlimpistasModule,
    GruposModule,
    TutoresModule,
    EvaluadoresModule,
    ResponsablesModule,

    NivelesModule,
    ReportesModule,
    LogsModule,

    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '1d' },
    }),
  ],
  controllers: [AuthController, UsersController],
  providers: [AuthService, JwtStrategy, UsersService],
})
export class AppModule {}
