/*
  Warnings:

  - You are about to drop the column `id_gestion` on the `areas` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[nombre_area]` on the table `areas` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "public"."areas" DROP CONSTRAINT "areas_id_gestion_fkey";

-- DropIndex
DROP INDEX "public"."areas_id_gestion_idx";

-- DropIndex
DROP INDEX "public"."areas_nombre_area_id_gestion_key";

-- AlterTable
ALTER TABLE "public"."areas" DROP COLUMN "id_gestion";

-- CreateTable
CREATE TABLE "public"."areas_gestion" (
    "id_area_gestion" SERIAL NOT NULL,
    "id_gestion" INTEGER NOT NULL,
    "nombre_area" TEXT NOT NULL,
    "nota_aprobacion" INTEGER,
    "tipo" "public"."tipo_area_config" NOT NULL DEFAULT 'INDIVIDUAL',
    "niveles_target" TEXT,
    "archived_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "areas_gestion_pkey" PRIMARY KEY ("id_area_gestion")
);

-- CreateIndex
CREATE INDEX "areas_gestion_id_gestion_idx" ON "public"."areas_gestion"("id_gestion");

-- CreateIndex
CREATE INDEX "areas_gestion_archived_at_idx" ON "public"."areas_gestion"("archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "areas_nombre_area_key" ON "public"."areas"("nombre_area");

-- AddForeignKey
ALTER TABLE "public"."areas_gestion" ADD CONSTRAINT "areas_gestion_id_gestion_fkey" FOREIGN KEY ("id_gestion") REFERENCES "public"."gestiones"("id_gestion") ON DELETE CASCADE ON UPDATE CASCADE;
