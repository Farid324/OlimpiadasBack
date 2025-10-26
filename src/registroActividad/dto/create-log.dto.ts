export enum AccionLog { REGISTRO = 'REGISTRO', MODIFICACION = 'MODIFICACION' }

export class CreateLogDto {
  id_evaluacion!: number;
  id_usuario!: number;
  accion!: AccionLog;
  valor_anterior?: number | null;
  valor_nuevo?: number | null;
}
