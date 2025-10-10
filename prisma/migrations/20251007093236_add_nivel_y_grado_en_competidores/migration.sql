-- CreateEnum
CREATE TYPE "public"."ciclo_nivel" AS ENUM ('PRIMARIA', 'SECUNDARIA');

-- AlterTable
ALTER TABLE "public"."competidores" ADD COLUMN     "grado" INTEGER,
ADD COLUMN     "nivel" "public"."ciclo_nivel";
