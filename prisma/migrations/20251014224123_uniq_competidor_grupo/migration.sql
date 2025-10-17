/*
  Warnings:

  - A unique constraint covering the columns `[id_competidor]` on the table `grupo_miembros` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "grupo_miembros_id_competidor_key" ON "public"."grupo_miembros"("id_competidor");
