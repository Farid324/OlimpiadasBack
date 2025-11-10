-- CreateEnum
CREATE TYPE "public"."tipo_premio" AS ENUM ('ORO', 'PLATA', 'BRONCE', 'MENCION');

-- CreateTable
CREATE TABLE "public"."premios_otorgados" (
    "id_premio" SERIAL NOT NULL,
    "id_inscripcion" INTEGER NOT NULL,
    "id_area" INTEGER NOT NULL,
    "id_nivel" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "tipo" "public"."tipo_premio" NOT NULL,
    "fuente" "public"."fuente_lista",
    "generado_desde" INTEGER,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "premios_otorgados_pkey" PRIMARY KEY ("id_premio")
);

-- CreateIndex
CREATE INDEX "premios_otorgados_id_area_id_nivel_anio_idx" ON "public"."premios_otorgados"("id_area", "id_nivel", "anio");

-- CreateIndex
CREATE UNIQUE INDEX "premios_otorgados_id_inscripcion_id_area_id_nivel_anio_key" ON "public"."premios_otorgados"("id_inscripcion", "id_area", "id_nivel", "anio");

-- AddForeignKey
ALTER TABLE "public"."premios_otorgados" ADD CONSTRAINT "premios_otorgados_id_inscripcion_fkey" FOREIGN KEY ("id_inscripcion") REFERENCES "public"."inscripciones"("id_inscripcion") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."premios_otorgados" ADD CONSTRAINT "premios_otorgados_id_area_fkey" FOREIGN KEY ("id_area") REFERENCES "public"."areas"("id_area") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."premios_otorgados" ADD CONSTRAINT "premios_otorgados_id_nivel_fkey" FOREIGN KEY ("id_nivel") REFERENCES "public"."niveles"("id_nivel") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."premios_otorgados" ADD CONSTRAINT "premios_otorgados_generado_desde_fkey" FOREIGN KEY ("generado_desde") REFERENCES "public"."listas_generadas"("id_lista") ON DELETE SET NULL ON UPDATE CASCADE;
