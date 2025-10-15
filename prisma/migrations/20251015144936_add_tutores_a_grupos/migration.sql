-- AlterTable
ALTER TABLE "public"."grupos" ADD COLUMN     "id_tutor" INTEGER;

-- CreateIndex
CREATE INDEX "grupos_id_tutor_idx" ON "public"."grupos"("id_tutor");

-- AddForeignKey
ALTER TABLE "public"."grupos" ADD CONSTRAINT "grupos_id_tutor_fkey" FOREIGN KEY ("id_tutor") REFERENCES "public"."tutores"("id_tutor") ON DELETE SET NULL ON UPDATE CASCADE;
