-- CreateTable
CREATE TABLE "public"."grupos" (
    "id_grupo" SERIAL NOT NULL,
    "nombre_equipo" TEXT NOT NULL,
    "escuela" TEXT NOT NULL,
    "departamento" TEXT NOT NULL,
    "id_area" INTEGER NOT NULL,
    "id_nivel" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,

    CONSTRAINT "grupos_pkey" PRIMARY KEY ("id_grupo")
);

-- CreateTable
CREATE TABLE "public"."grupo_miembros" (
    "id_grupo_miembro" SERIAL NOT NULL,
    "id_grupo" INTEGER NOT NULL,
    "id_competidor" INTEGER NOT NULL,
    "rol" TEXT,

    CONSTRAINT "grupo_miembros_pkey" PRIMARY KEY ("id_grupo_miembro")
);

-- CreateIndex
CREATE INDEX "grupos_id_area_idx" ON "public"."grupos"("id_area");

-- CreateIndex
CREATE INDEX "grupos_id_nivel_idx" ON "public"."grupos"("id_nivel");

-- CreateIndex
CREATE UNIQUE INDEX "grupos_nombre_equipo_id_area_id_nivel_escuela_key" ON "public"."grupos"("nombre_equipo", "id_area", "id_nivel", "escuela");

-- CreateIndex
CREATE INDEX "grupo_miembros_id_grupo_idx" ON "public"."grupo_miembros"("id_grupo");

-- CreateIndex
CREATE INDEX "grupo_miembros_id_competidor_idx" ON "public"."grupo_miembros"("id_competidor");

-- CreateIndex
CREATE UNIQUE INDEX "grupo_miembros_id_grupo_id_competidor_key" ON "public"."grupo_miembros"("id_grupo", "id_competidor");

-- AddForeignKey
ALTER TABLE "public"."grupos" ADD CONSTRAINT "grupos_id_area_fkey" FOREIGN KEY ("id_area") REFERENCES "public"."areas"("id_area") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."grupos" ADD CONSTRAINT "grupos_id_nivel_fkey" FOREIGN KEY ("id_nivel") REFERENCES "public"."niveles"("id_nivel") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."grupo_miembros" ADD CONSTRAINT "grupo_miembros_id_grupo_fkey" FOREIGN KEY ("id_grupo") REFERENCES "public"."grupos"("id_grupo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."grupo_miembros" ADD CONSTRAINT "grupo_miembros_id_competidor_fkey" FOREIGN KEY ("id_competidor") REFERENCES "public"."competidores"("id_competidor") ON DELETE CASCADE ON UPDATE CASCADE;
