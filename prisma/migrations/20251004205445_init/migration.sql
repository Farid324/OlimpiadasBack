-- AlterTable
ALTER TABLE "public"."responsables_area" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "public"."usuarios" ADD COLUMN     "ci" TEXT,
ADD COLUMN     "institucion" TEXT;
