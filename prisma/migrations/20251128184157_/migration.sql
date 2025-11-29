-- CreateTable
CREATE TABLE "public"."asignacion_evaluador_fase" (
    "id_asignacion" SERIAL NOT NULL,
    "id_evaluador_area" INTEGER NOT NULL,
    "id_fase" INTEGER NOT NULL,
    "cupo" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "asignacion_evaluador_fase_pkey" PRIMARY KEY ("id_asignacion")
);

-- CreateIndex
CREATE UNIQUE INDEX "asignacion_evaluador_fase_id_evaluador_area_id_fase_key" ON "public"."asignacion_evaluador_fase"("id_evaluador_area", "id_fase");

-- AddForeignKey
ALTER TABLE "public"."asignacion_evaluador_fase" ADD CONSTRAINT "asignacion_evaluador_fase_id_evaluador_area_fkey" FOREIGN KEY ("id_evaluador_area") REFERENCES "public"."evaluadores_area"("id_evaluador_area") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."asignacion_evaluador_fase" ADD CONSTRAINT "asignacion_evaluador_fase_id_fase_fkey" FOREIGN KEY ("id_fase") REFERENCES "public"."fases"("id_fase") ON DELETE RESTRICT ON UPDATE CASCADE;
