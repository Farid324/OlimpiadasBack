-- CreateEnum
CREATE TYPE "public"."clasificacion_estado" AS ENUM ('CLASIFICADO', 'NO_CLASIFICADO', 'DESCALIFICADO');

-- AlterTable
ALTER TABLE "public"."inscripciones" ADD COLUMN     "clasificacion" "public"."clasificacion_estado" DEFAULT 'NO_CLASIFICADO',
ADD COLUMN     "puntaje_clasificacion" DECIMAL(5,2);

-- CreateIndex
CREATE INDEX "inscripciones_id_area_id_nivel_clasificacion_idx" ON "public"."inscripciones"("id_area", "id_nivel", "clasificacion");

-- CreateIndex
CREATE INDEX "inscripciones_id_area_id_nivel_puntaje_clasificacion_idx" ON "public"."inscripciones"("id_area", "id_nivel", "puntaje_clasificacion");
