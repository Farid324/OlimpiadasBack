-- AlterTable
ALTER TABLE "public"."competidores" ADD COLUMN     "id_tutor" INTEGER;

-- CreateTable
CREATE TABLE "public"."tutores" (
    "id_tutor" SERIAL NOT NULL,
    "nombre_completo" TEXT NOT NULL,
    "ci" TEXT,
    "correo" TEXT,
    "telefono" TEXT NOT NULL,
    "unidad_educativa" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutores_pkey" PRIMARY KEY ("id_tutor")
);

-- CreateIndex
CREATE UNIQUE INDEX "tutores_ci_key" ON "public"."tutores"("ci");

-- CreateIndex
CREATE UNIQUE INDEX "tutores_telefono_key" ON "public"."tutores"("telefono");

-- CreateIndex
CREATE INDEX "tutores_telefono_idx" ON "public"."tutores"("telefono");

-- CreateIndex
CREATE INDEX "tutores_nombre_completo_idx" ON "public"."tutores"("nombre_completo");

-- AddForeignKey
ALTER TABLE "public"."competidores" ADD CONSTRAINT "competidores_id_tutor_fkey" FOREIGN KEY ("id_tutor") REFERENCES "public"."tutores"("id_tutor") ON DELETE SET NULL ON UPDATE CASCADE;
