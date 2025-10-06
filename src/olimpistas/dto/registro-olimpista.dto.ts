import { IsIn, IsNotEmpty, IsString, Matches } from 'class-validator';

const TEXT_RX = /^[\p{L}\p{N}\s.\-']+$/u;
const NUM_RX = /^\d+$/;

export class RegistroOlimpistaDto {
  @IsString()
  @IsNotEmpty()
  @Matches(TEXT_RX)
  nombreCompleto!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(NUM_RX)
  ci!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(NUM_RX)
  tutorContacto!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(TEXT_RX)
  unidadEducativa!: string;

  @IsString()
  @IsIn([
    'La Paz',
    'Pando',
    'Beni',
    'Santa Cruz',
    'Chuquisaca',
    'Oruro',
    'Potosí',
    'Cochabamba',
    'Tarija',
  ])
  departamento!: string;

  @IsString()
  @IsIn([
    '1ºP',
    '2ºP',
    '3ºP',
    '4ºP',
    '5ºP',
    '6ºP',
    '1ºS',
    '2ºS',
    '3ºS',
    '4ºS',
    '5ºS',
    '6ºS',
  ])
  gradoEscolar!: string;

  @IsString()
  @IsNotEmpty()
  areaId!: string;

  @IsString()
  @IsNotEmpty()
  nivelId!: string;
}

export class RegistroOlimpistaBulkDto {
  data!: RegistroOlimpistaDto[];
}
