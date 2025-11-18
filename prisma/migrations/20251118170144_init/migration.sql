/*
  Warnings:

  - The `tipo` column on the `areas` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `_areas_niveles_config` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."tipo_area_config" AS ENUM ('INDIVIDUAL', 'GRUPAL');

-- DropForeignKey
ALTER TABLE "public"."_areas_niveles_config" DROP CONSTRAINT "_areas_niveles_config_A_fkey";

-- DropForeignKey
ALTER TABLE "public"."_areas_niveles_config" DROP CONSTRAINT "_areas_niveles_config_B_fkey";

-- AlterTable
ALTER TABLE "public"."areas" ADD COLUMN     "niveles_target" TEXT,
ALTER COLUMN "nota_aprobacion" DROP NOT NULL,
DROP COLUMN "tipo",
ADD COLUMN     "tipo" "public"."tipo_area_config" DEFAULT 'INDIVIDUAL';

-- DropTable
DROP TABLE "public"."_areas_niveles_config";

-- DropEnum
DROP TYPE "public"."tipo_area";
