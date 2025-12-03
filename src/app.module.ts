// src/app.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
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
import { FasesModule } from './fases/fases.module';
import { PasswordRecoveryModule } from './ContraseñaRecuperada/password-recovery.module';
//import { FasesController } from './fases/fases.controller';

// NUEVOS
import { NivelesModule } from './niveles/niveles.module';
import { ReportesModule } from './reportes/reportes.module';
import { EvaluacionesAdminModule } from './evaluaciones/evaluaciones-admin.module';
import { NewPasswordModule } from './NewPassword/new-password.module';

import { ControlFasesModule } from './controlFases/controlFases.module';

import { LogsModule } from './registroActividad/logs.module';
import { MedalleroConfigModule } from './medallero-config/medallero-config.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // Hace que ConfigService esté disponible en toda la app
    }),
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
    MedalleroConfigModule,

    ControlFasesModule, 
    FasesModule,
    EvaluacionesAdminModule,
    NewPasswordModule,
    PasswordRecoveryModule,

    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '2h' },
    }),
  ],
  controllers: [AuthController, UsersController],
  providers: [AuthService, JwtStrategy, UsersService],
})
export class AppModule {}
