/*
  Warnings:

  - You are about to drop the `phases_events` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `phases_state` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[id_fase,id_area,id_nivel]` on the table `cierres_fase` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `id_nivel` to the `cierres_fase` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."clasificacion_estado" AS ENUM ('CLASIFICADO', 'NO_CLASIFICADO', 'DESCALIFICADO');

-- DropIndex
DROP INDEX "public"."cierres_fase_id_fase_id_area_key";

-- AlterTable
ALTER TABLE "public"."cierres_fase" ADD COLUMN     "id_nivel" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "public"."inscripciones" ADD COLUMN     "clasificacion" "public"."clasificacion_estado" DEFAULT 'NO_CLASIFICADO',
ADD COLUMN     "puntaje_clasificacion" DECIMAL(5,2);

-- DropTable
DROP TABLE "public"."phases_events";

-- DropTable
DROP TABLE "public"."phases_state";

-- DropEnum
DROP TYPE "public"."phase_event_type";

-- DropEnum
DROP TYPE "public"."phase_status";

-- DropEnum
DROP TYPE "public"."phase_type";

-- CreateIndex
CREATE INDEX "cierres_fase_id_nivel_idx" ON "public"."cierres_fase"("id_nivel");

-- CreateIndex
CREATE UNIQUE INDEX "cierres_fase_id_fase_id_area_id_nivel_key" ON "public"."cierres_fase"("id_fase", "id_area", "id_nivel");

-- CreateIndex
CREATE INDEX "inscripciones_id_area_id_nivel_clasificacion_idx" ON "public"."inscripciones"("id_area", "id_nivel", "clasificacion");

-- CreateIndex
CREATE INDEX "inscripciones_id_area_id_nivel_puntaje_clasificacion_idx" ON "public"."inscripciones"("id_area", "id_nivel", "puntaje_clasificacion");

-- AddForeignKey
ALTER TABLE "public"."cierres_fase" ADD CONSTRAINT "cierres_fase_id_nivel_fkey" FOREIGN KEY ("id_nivel") REFERENCES "public"."niveles"("id_nivel") ON DELETE RESTRICT ON UPDATE CASCADE;
