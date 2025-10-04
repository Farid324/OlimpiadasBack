-- CreateEnum
CREATE TYPE "public"."estado_area" AS ENUM ('EVALUANDO', 'CLASIFICANDO', 'COMPLETADO');

-- AlterTable
ALTER TABLE "public"."areas" ADD COLUMN     "estado" "public"."estado_area" NOT NULL DEFAULT 'EVALUANDO';
