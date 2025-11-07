/*
  Warnings:

  - A unique constraint covering the columns `[id_area,id_nivel]` on the table `medallero_config` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `id_nivel` to the `medallero_config` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."medallero_config" ADD COLUMN     "id_nivel" INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX "medallero_config_id_nivel_idx" ON "public"."medallero_config"("id_nivel");

-- CreateIndex
CREATE UNIQUE INDEX "medallero_config_id_area_id_nivel_key" ON "public"."medallero_config"("id_area", "id_nivel");

-- AddForeignKey
ALTER TABLE "public"."medallero_config" ADD CONSTRAINT "medallero_config_id_nivel_fkey" FOREIGN KEY ("id_nivel") REFERENCES "public"."niveles"("id_nivel") ON DELETE RESTRICT ON UPDATE CASCADE;
