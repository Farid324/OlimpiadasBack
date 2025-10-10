// src/app.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';

// Auth
import { AuthController } from './auth/controllers/auth.controller';
import { AuthService } from './auth/services/auth.service';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './auth/strategies/jwt.strategy';

// Users
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';
import { AreasModule } from './areas/areas.module';

// Nuevos módulos
import { ResponsablesModule } from './responsables/responsables.module';
import { EvaluadoresModule } from './evaluadores/evaluadores.module';

//Olimpistas
import { OlimpistasModule } from './olimpistas/olimpistas.module';

//Grupos Olimpistas
import { GruposModule } from './grupos/grupos.module';

//Tutores
import { TutoresModule } from './tutores/tutores.module';

@Module({
  imports: [
    PrismaModule,
    AreasModule,
    OlimpistasModule,
    GruposModule,
    TutoresModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '1d' },
    }),
    EvaluadoresModule,
    ResponsablesModule, // 🔹 módulo de responsables
    AreasModule, // 🔹 módulo de áreas
  ],
  controllers: [AuthController, UsersController],
  providers: [AuthService, JwtStrategy, UsersService],
})
export class AppModule {}
