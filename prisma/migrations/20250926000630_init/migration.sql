-- CreateEnum
CREATE TYPE "public"."estado_inscripcion" AS ENUM ('INSCRITO', 'CLASIFICADO', 'FINALISTA', 'PREMIADO', 'DESCALIFICADO');

-- CreateEnum
CREATE TYPE "public"."estado_registro" AS ENUM ('BORRADOR', 'FIRMADA');

-- CreateEnum
CREATE TYPE "public"."estado_validacion" AS ENUM ('PENDIENTE', 'VALIDADO');

-- CreateEnum
CREATE TYPE "public"."tipo_lista" AS ENUM ('POR_AREA_Y_NIVEL', 'CLASIFICADOS', 'PREMIADOS', 'EXCEL_CERTIFICADOS', 'WEB');

-- CreateEnum
CREATE TYPE "public"."fuente_lista" AS ENUM ('CLASIFICATORIA', 'FINAL');

-- CreateEnum
CREATE TYPE "public"."accion_log" AS ENUM ('CREAR', 'EDITAR', 'BORRAR', 'FIRMAR');

-- CreateTable
CREATE TABLE "public"."roles" (
    "id_rol" BIGSERIAL NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id_rol")
);

-- CreateTable
CREATE TABLE "public"."usuarios" (
    "id_usuario" BIGSERIAL NOT NULL,
    "correo" TEXT NOT NULL,
    "hash_password" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "id_rol" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "public"."areas" (
    "id_area" BIGSERIAL NOT NULL,
    "nombre_area" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id_area")
);

-- CreateTable
CREATE TABLE "public"."niveles" (
    "id_nivel" BIGSERIAL NOT NULL,
    "nombre_nivel" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "niveles_pkey" PRIMARY KEY ("id_nivel")
);

-- CreateTable
CREATE TABLE "public"."competidores" (
    "id_competidor" BIGSERIAL NOT NULL,
    "nombres" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "ci" TEXT NOT NULL,
    "escuela" TEXT,
    "departamento" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competidores_pkey" PRIMARY KEY ("id_competidor")
);

-- CreateTable
CREATE TABLE "public"."inscripciones" (
    "id_inscripcion" BIGSERIAL NOT NULL,
    "id_competidor" BIGINT NOT NULL,
    "id_area" BIGINT NOT NULL,
    "id_nivel" BIGINT NOT NULL,
    "estado_inscripcion" "public"."estado_inscripcion" NOT NULL DEFAULT 'INSCRITO',
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inscripciones_pkey" PRIMARY KEY ("id_inscripcion")
);

-- CreateTable
CREATE TABLE "public"."fases" (
    "id_fase" BIGSERIAL NOT NULL,
    "nombre_fase" TEXT NOT NULL,
    "orden_fase" INTEGER NOT NULL,

    CONSTRAINT "fases_pkey" PRIMARY KEY ("id_fase")
);

-- CreateTable
CREATE TABLE "public"."evaluaciones" (
    "id_evaluacion" BIGSERIAL NOT NULL,
    "id_inscripcion" BIGINT NOT NULL,
    "id_fase" BIGINT NOT NULL,
    "id_evaluador" BIGINT NOT NULL,
    "nota" DECIMAL(5,2) NOT NULL,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado_registro" "public"."estado_registro" NOT NULL DEFAULT 'BORRADOR',
    "comentario" TEXT,

    CONSTRAINT "evaluaciones_pkey" PRIMARY KEY ("id_evaluacion")
);

-- CreateTable
CREATE TABLE "public"."log_cambios_nota" (
    "id_log" BIGSERIAL NOT NULL,
    "id_evaluacion" BIGINT NOT NULL,
    "id_usuario" BIGINT NOT NULL,
    "accion" "public"."accion_log" NOT NULL,
    "valor_anterior" DECIMAL(5,2),
    "valor_nuevo" DECIMAL(5,2),
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_cambios_nota_pkey" PRIMARY KEY ("id_log")
);

-- CreateTable
CREATE TABLE "public"."responsables_area" (
    "id_responsable_area" BIGSERIAL NOT NULL,
    "id_usuario" BIGINT NOT NULL,
    "id_area" BIGINT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "responsables_area_pkey" PRIMARY KEY ("id_responsable_area")
);

-- CreateTable
CREATE TABLE "public"."evaluadores_area" (
    "id_evaluador_area" BIGSERIAL NOT NULL,
    "id_usuario" BIGINT NOT NULL,
    "id_area" BIGINT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "evaluadores_area_pkey" PRIMARY KEY ("id_evaluador_area")
);

-- CreateTable
CREATE TABLE "public"."medallero_config" (
    "id_medallero" BIGSERIAL NOT NULL,
    "id_area" BIGINT NOT NULL,
    "oros" INTEGER NOT NULL DEFAULT 0,
    "platas" INTEGER NOT NULL DEFAULT 0,
    "bronces" INTEGER NOT NULL DEFAULT 0,
    "menciones" INTEGER NOT NULL DEFAULT 0,
    "vigente_desde" DATE,
    "vigente_hasta" DATE,

    CONSTRAINT "medallero_config_pkey" PRIMARY KEY ("id_medallero")
);

-- CreateTable
CREATE TABLE "public"."cierres_fase" (
    "id_cierre" BIGSERIAL NOT NULL,
    "id_fase" BIGINT NOT NULL,
    "id_area" BIGINT NOT NULL,
    "cerrado_por" BIGINT NOT NULL,
    "fecha_cierre" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado_validacion" "public"."estado_validacion" NOT NULL DEFAULT 'PENDIENTE',
    "validado_por" BIGINT,
    "fecha_validacion" TIMESTAMP(3),

    CONSTRAINT "cierres_fase_pkey" PRIMARY KEY ("id_cierre")
);

-- CreateTable
CREATE TABLE "public"."listas_generadas" (
    "id_lista" BIGSERIAL NOT NULL,
    "tipo_lista" "public"."tipo_lista" NOT NULL,
    "id_area" BIGINT NOT NULL,
    "id_nivel" BIGINT,
    "fuente" "public"."fuente_lista",
    "criterios_orden" JSONB,
    "contenido_snapshot" JSONB,
    "generado_por" BIGINT NOT NULL,
    "fecha_generacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "listas_generadas_pkey" PRIMARY KEY ("id_lista")
);

-- CreateTable
CREATE TABLE "public"."reordenamientos" (
    "id_reorden" BIGSERIAL NOT NULL,
    "id_lista" BIGINT NOT NULL,
    "id_usuario" BIGINT NOT NULL,
    "nueva_posicion" JSONB NOT NULL,
    "fecha_reorden" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reordenamientos_pkey" PRIMARY KEY ("id_reorden")
);

-- CreateTable
CREATE TABLE "public"."import_csv" (
    "id_import" BIGSERIAL NOT NULL,
    "archivo_nombre" TEXT NOT NULL,
    "total_registros" INTEGER NOT NULL DEFAULT 0,
    "ok" INTEGER NOT NULL DEFAULT 0,
    "con_error" INTEGER NOT NULL DEFAULT 0,
    "mapeo_campos" JSONB,
    "ejecutado_por" BIGINT NOT NULL,
    "fecha_ejecucion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "detalle_errores" JSONB,

    CONSTRAINT "import_csv_pkey" PRIMARY KEY ("id_import")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_nombre_key" ON "public"."roles"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_correo_key" ON "public"."usuarios"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "areas_nombre_area_key" ON "public"."areas"("nombre_area");

-- CreateIndex
CREATE UNIQUE INDEX "niveles_nombre_nivel_key" ON "public"."niveles"("nombre_nivel");

-- CreateIndex
CREATE INDEX "inscripciones_id_competidor_idx" ON "public"."inscripciones"("id_competidor");

-- CreateIndex
CREATE INDEX "inscripciones_id_area_idx" ON "public"."inscripciones"("id_area");

-- CreateIndex
CREATE INDEX "inscripciones_id_nivel_idx" ON "public"."inscripciones"("id_nivel");

-- CreateIndex
CREATE UNIQUE INDEX "inscripciones_id_competidor_id_area_id_nivel_key" ON "public"."inscripciones"("id_competidor", "id_area", "id_nivel");

-- CreateIndex
CREATE UNIQUE INDEX "fases_nombre_fase_key" ON "public"."fases"("nombre_fase");

-- CreateIndex
CREATE INDEX "evaluaciones_id_inscripcion_idx" ON "public"."evaluaciones"("id_inscripcion");

-- CreateIndex
CREATE INDEX "evaluaciones_id_fase_idx" ON "public"."evaluaciones"("id_fase");

-- CreateIndex
CREATE INDEX "evaluaciones_id_evaluador_idx" ON "public"."evaluaciones"("id_evaluador");

-- CreateIndex
CREATE UNIQUE INDEX "evaluaciones_id_inscripcion_id_fase_id_evaluador_key" ON "public"."evaluaciones"("id_inscripcion", "id_fase", "id_evaluador");

-- CreateIndex
CREATE INDEX "log_cambios_nota_id_evaluacion_idx" ON "public"."log_cambios_nota"("id_evaluacion");

-- CreateIndex
CREATE INDEX "log_cambios_nota_id_usuario_idx" ON "public"."log_cambios_nota"("id_usuario");

-- CreateIndex
CREATE INDEX "responsables_area_id_usuario_idx" ON "public"."responsables_area"("id_usuario");

-- CreateIndex
CREATE INDEX "responsables_area_id_area_idx" ON "public"."responsables_area"("id_area");

-- CreateIndex
CREATE UNIQUE INDEX "responsables_area_id_usuario_id_area_key" ON "public"."responsables_area"("id_usuario", "id_area");

-- CreateIndex
CREATE INDEX "evaluadores_area_id_usuario_idx" ON "public"."evaluadores_area"("id_usuario");

-- CreateIndex
CREATE INDEX "evaluadores_area_id_area_idx" ON "public"."evaluadores_area"("id_area");

-- CreateIndex
CREATE UNIQUE INDEX "evaluadores_area_id_usuario_id_area_key" ON "public"."evaluadores_area"("id_usuario", "id_area");

-- CreateIndex
CREATE INDEX "medallero_config_id_area_idx" ON "public"."medallero_config"("id_area");

-- CreateIndex
CREATE INDEX "cierres_fase_id_area_idx" ON "public"."cierres_fase"("id_area");

-- CreateIndex
CREATE INDEX "cierres_fase_id_fase_idx" ON "public"."cierres_fase"("id_fase");

-- CreateIndex
CREATE UNIQUE INDEX "cierres_fase_id_fase_id_area_key" ON "public"."cierres_fase"("id_fase", "id_area");

-- CreateIndex
CREATE INDEX "listas_generadas_id_area_idx" ON "public"."listas_generadas"("id_area");

-- CreateIndex
CREATE INDEX "listas_generadas_id_nivel_idx" ON "public"."listas_generadas"("id_nivel");

-- CreateIndex
CREATE INDEX "listas_generadas_tipo_lista_idx" ON "public"."listas_generadas"("tipo_lista");

-- CreateIndex
CREATE INDEX "reordenamientos_id_lista_idx" ON "public"."reordenamientos"("id_lista");

-- CreateIndex
CREATE INDEX "import_csv_ejecutado_por_idx" ON "public"."import_csv"("ejecutado_por");

-- AddForeignKey
ALTER TABLE "public"."usuarios" ADD CONSTRAINT "usuarios_id_rol_fkey" FOREIGN KEY ("id_rol") REFERENCES "public"."roles"("id_rol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inscripciones" ADD CONSTRAINT "inscripciones_id_competidor_fkey" FOREIGN KEY ("id_competidor") REFERENCES "public"."competidores"("id_competidor") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inscripciones" ADD CONSTRAINT "inscripciones_id_area_fkey" FOREIGN KEY ("id_area") REFERENCES "public"."areas"("id_area") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inscripciones" ADD CONSTRAINT "inscripciones_id_nivel_fkey" FOREIGN KEY ("id_nivel") REFERENCES "public"."niveles"("id_nivel") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."evaluaciones" ADD CONSTRAINT "evaluaciones_id_inscripcion_fkey" FOREIGN KEY ("id_inscripcion") REFERENCES "public"."inscripciones"("id_inscripcion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."evaluaciones" ADD CONSTRAINT "evaluaciones_id_fase_fkey" FOREIGN KEY ("id_fase") REFERENCES "public"."fases"("id_fase") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."evaluaciones" ADD CONSTRAINT "evaluaciones_id_evaluador_fkey" FOREIGN KEY ("id_evaluador") REFERENCES "public"."usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."log_cambios_nota" ADD CONSTRAINT "log_cambios_nota_id_evaluacion_fkey" FOREIGN KEY ("id_evaluacion") REFERENCES "public"."evaluaciones"("id_evaluacion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."log_cambios_nota" ADD CONSTRAINT "log_cambios_nota_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."responsables_area" ADD CONSTRAINT "responsables_area_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."responsables_area" ADD CONSTRAINT "responsables_area_id_area_fkey" FOREIGN KEY ("id_area") REFERENCES "public"."areas"("id_area") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."evaluadores_area" ADD CONSTRAINT "evaluadores_area_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."usuarios"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."evaluadores_area" ADD CONSTRAINT "evaluadores_area_id_area_fkey" FOREIGN KEY ("id_area") REFERENCES "public"."areas"("id_area") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."medallero_config" ADD CONSTRAINT "medallero_config_id_area_fkey" FOREIGN KEY ("id_area") REFERENCES "public"."areas"("id_area") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cierres_fase" ADD CONSTRAINT "cierres_fase_id_fase_fkey" FOREIGN KEY ("id_fase") REFERENCES "public"."fases"("id_fase") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cierres_fase" ADD CONSTRAINT "cierres_fase_id_area_fkey" FOREIGN KEY ("id_area") REFERENCES "public"."areas"("id_area") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cierres_fase" ADD CONSTRAINT "cierres_fase_cerrado_por_fkey" FOREIGN KEY ("cerrado_por") REFERENCES "public"."usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cierres_fase" ADD CONSTRAINT "cierres_fase_validado_por_fkey" FOREIGN KEY ("validado_por") REFERENCES "public"."usuarios"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."listas_generadas" ADD CONSTRAINT "listas_generadas_id_area_fkey" FOREIGN KEY ("id_area") REFERENCES "public"."areas"("id_area") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."listas_generadas" ADD CONSTRAINT "listas_generadas_id_nivel_fkey" FOREIGN KEY ("id_nivel") REFERENCES "public"."niveles"("id_nivel") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."listas_generadas" ADD CONSTRAINT "listas_generadas_generado_por_fkey" FOREIGN KEY ("generado_por") REFERENCES "public"."usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reordenamientos" ADD CONSTRAINT "reordenamientos_id_lista_fkey" FOREIGN KEY ("id_lista") REFERENCES "public"."listas_generadas"("id_lista") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reordenamientos" ADD CONSTRAINT "reordenamientos_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."import_csv" ADD CONSTRAINT "import_csv_ejecutado_por_fkey" FOREIGN KEY ("ejecutado_por") REFERENCES "public"."usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
