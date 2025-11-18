-- CreateEnum
CREATE TYPE "public"."tipo_area" AS ENUM ('INDIVIDUAL', 'GRUPAL');

-- AlterTable
ALTER TABLE "public"."areas" ADD COLUMN     "nota_aprobacion" INTEGER NOT NULL DEFAULT 51,
ADD COLUMN     "tipo" "public"."tipo_area" NOT NULL DEFAULT 'INDIVIDUAL';

-- CreateTable
CREATE TABLE "public"."_areas_niveles_config" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_areas_niveles_config_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_areas_niveles_config_B_index" ON "public"."_areas_niveles_config"("B");

-- AddForeignKey
ALTER TABLE "public"."_areas_niveles_config" ADD CONSTRAINT "_areas_niveles_config_A_fkey" FOREIGN KEY ("A") REFERENCES "public"."areas"("id_area") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."_areas_niveles_config" ADD CONSTRAINT "_areas_niveles_config_B_fkey" FOREIGN KEY ("B") REFERENCES "public"."niveles"("id_nivel") ON DELETE CASCADE ON UPDATE CASCADE;
