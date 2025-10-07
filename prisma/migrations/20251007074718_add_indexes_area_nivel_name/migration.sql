-- AlterTable
ALTER TABLE "public"."competidores" ADD COLUMN     "tutor_contacto" TEXT;

-- CreateIndex
CREATE INDEX "areas_nombre_area_idx" ON "public"."areas"("nombre_area");

-- CreateIndex
CREATE INDEX "niveles_nombre_nivel_idx" ON "public"."niveles"("nombre_nivel");
