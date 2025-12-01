/*
  Warnings:

  - You are about to drop the column `anio` on the `premios_otorgados` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[id_fase,id_area,id_nivel,id_gestion]` on the table `cierres_fase` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id_usuario,id_area,id_gestion]` on the table `evaluadores_area` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id_competidor,id_area,id_nivel,id_gestion]` on the table `inscripciones` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id_area,id_nivel,id_gestion]` on the table `medallero_config` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id_inscripcion,id_area,id_nivel,id_gestion]` on the table `premios_otorgados` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id_usuario,id_area,id_gestion]` on the table `responsables_area` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `id_gestion` to the `cierres_fase` table without a default value. This is not possible if the table is not empty.
  - Added the required column `id_gestion` to the `evaluadores_area` table without a default value. This is not possible if the table is not empty.
  - Added the required column `id_gestion` to the `inscripciones` table without a default value. This is not possible if the table is not empty.
  - Added the required column `id_gestion` to the `listas_generadas` table without a default value. This is not possible if the table is not empty.
  - Added the required column `id_gestion` to the `medallero_config` table without a default value. This is not possible if the table is not empty.
  - Added the required column `id_gestion` to the `premios_otorgados` table without a default value. This is not possible if the table is not empty.
  - Added the required column `id_gestion` to the `responsables_area` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."estado_gestion" AS ENUM ('ABIERTA', 'CERRADA');

-- DropIndex
DROP INDEX "public"."cierres_fase_id_fase_id_area_id_nivel_key";

-- DropIndex
DROP INDEX "public"."evaluadores_area_id_usuario_id_area_key";

-- DropIndex
DROP INDEX "public"."inscripciones_id_competidor_id_area_id_nivel_key";

-- DropIndex
DROP INDEX "public"."medallero_config_id_area_id_nivel_key";

-- DropIndex
DROP INDEX "public"."premios_otorgados_id_area_id_nivel_anio_idx";

-- DropIndex
DROP INDEX "public"."premios_otorgados_id_inscripcion_id_area_id_nivel_anio_key";

-- DropIndex
DROP INDEX "public"."responsables_area_id_usuario_id_area_key";

-- AlterTable
ALTER TABLE "public"."cierres_fase" ADD COLUMN     "id_gestion" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."evaluadores_area" ADD COLUMN     "id_gestion" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."inscripciones" ADD COLUMN     "id_gestion" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."listas_generadas" ADD COLUMN     "id_gestion" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."medallero_config" ADD COLUMN     "id_gestion" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."premios_otorgados" DROP COLUMN "anio",
ADD COLUMN     "id_gestion" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."responsables_area" ADD COLUMN     "id_gestion" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "public"."gestiones" (
    "id_gestion" SERIAL NOT NULL,
    "anio" INTEGER NOT NULL,
    "nombre" TEXT,
    "estado" "public"."estado_gestion" NOT NULL DEFAULT 'ABIERTA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gestiones_pkey" PRIMARY KEY ("id_gestion")
);

-- CreateIndex
CREATE INDEX "gestiones_anio_idx" ON "public"."gestiones"("anio");

-- CreateIndex
CREATE INDEX "gestiones_estado_idx" ON "public"."gestiones"("estado");

-- CreateIndex
CREATE INDEX "gestiones_anio_estado_idx" ON "public"."gestiones"("anio", "estado");

-- CreateIndex
CREATE INDEX "cierres_fase_id_gestion_idx" ON "public"."cierres_fase"("id_gestion");

-- CreateIndex
CREATE UNIQUE INDEX "cierres_fase_id_fase_id_area_id_nivel_id_gestion_key" ON "public"."cierres_fase"("id_fase", "id_area", "id_nivel", "id_gestion");

-- CreateIndex
CREATE INDEX "evaluadores_area_id_gestion_idx" ON "public"."evaluadores_area"("id_gestion");

-- CreateIndex
CREATE UNIQUE INDEX "evaluadores_area_id_usuario_id_area_id_gestion_key" ON "public"."evaluadores_area"("id_usuario", "id_area", "id_gestion");

-- CreateIndex
CREATE INDEX "inscripciones_id_gestion_id_area_id_nivel_idx" ON "public"."inscripciones"("id_gestion", "id_area", "id_nivel");

-- CreateIndex
CREATE INDEX "inscripciones_id_gestion_estado_inscripcion_idx" ON "public"."inscripciones"("id_gestion", "estado_inscripcion");

-- CreateIndex
CREATE UNIQUE INDEX "inscripciones_id_competidor_id_area_id_nivel_id_gestion_key" ON "public"."inscripciones"("id_competidor", "id_area", "id_nivel", "id_gestion");

-- CreateIndex
CREATE INDEX "listas_generadas_id_gestion_idx" ON "public"."listas_generadas"("id_gestion");

-- CreateIndex
CREATE INDEX "medallero_config_id_gestion_idx" ON "public"."medallero_config"("id_gestion");

-- CreateIndex
CREATE UNIQUE INDEX "medallero_config_id_area_id_nivel_id_gestion_key" ON "public"."medallero_config"("id_area", "id_nivel", "id_gestion");

-- CreateIndex
CREATE INDEX "premios_otorgados_id_area_id_nivel_id_gestion_idx" ON "public"."premios_otorgados"("id_area", "id_nivel", "id_gestion");

-- CreateIndex
CREATE UNIQUE INDEX "premios_otorgados_id_inscripcion_id_area_id_nivel_id_gestio_key" ON "public"."premios_otorgados"("id_inscripcion", "id_area", "id_nivel", "id_gestion");

-- CreateIndex
CREATE INDEX "responsables_area_id_gestion_idx" ON "public"."responsables_area"("id_gestion");

-- CreateIndex
CREATE UNIQUE INDEX "responsables_area_id_usuario_id_area_id_gestion_key" ON "public"."responsables_area"("id_usuario", "id_area", "id_gestion");

-- AddForeignKey
ALTER TABLE "public"."premios_otorgados" ADD CONSTRAINT "premios_otorgados_id_gestion_fkey" FOREIGN KEY ("id_gestion") REFERENCES "public"."gestiones"("id_gestion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."inscripciones" ADD CONSTRAINT "inscripciones_id_gestion_fkey" FOREIGN KEY ("id_gestion") REFERENCES "public"."gestiones"("id_gestion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."responsables_area" ADD CONSTRAINT "responsables_area_id_gestion_fkey" FOREIGN KEY ("id_gestion") REFERENCES "public"."gestiones"("id_gestion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."evaluadores_area" ADD CONSTRAINT "evaluadores_area_id_gestion_fkey" FOREIGN KEY ("id_gestion") REFERENCES "public"."gestiones"("id_gestion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."medallero_config" ADD CONSTRAINT "medallero_config_id_gestion_fkey" FOREIGN KEY ("id_gestion") REFERENCES "public"."gestiones"("id_gestion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cierres_fase" ADD CONSTRAINT "cierres_fase_id_gestion_fkey" FOREIGN KEY ("id_gestion") REFERENCES "public"."gestiones"("id_gestion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."listas_generadas" ADD CONSTRAINT "listas_generadas_id_gestion_fkey" FOREIGN KEY ("id_gestion") REFERENCES "public"."gestiones"("id_gestion") ON DELETE RESTRICT ON UPDATE CASCADE;
