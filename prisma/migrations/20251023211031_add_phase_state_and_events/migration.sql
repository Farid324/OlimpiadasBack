-- CreateEnum
CREATE TYPE "public"."phase_type" AS ENUM ('CLASIFICACION', 'FINAL');

-- CreateEnum
CREATE TYPE "public"."phase_status" AS ENUM ('EN_PROCESO', 'CERRADA', 'VALIDADA');

-- CreateEnum
CREATE TYPE "public"."phase_event_type" AS ENUM ('CLOSE', 'VALIDATE');

-- CreateTable
CREATE TABLE "public"."phases_state" (
    "id_state" BIGSERIAL NOT NULL,
    "id_area" BIGINT NOT NULL,
    "id_nivel" BIGINT NOT NULL,
    "type" "public"."phase_type" NOT NULL,
    "status" "public"."phase_status" NOT NULL DEFAULT 'EN_PROCESO',
    "locked_at" TIMESTAMP(3),
    "closed_by" BIGINT,
    "validated_at" TIMESTAMP(3),
    "validated_by" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "phases_state_pkey" PRIMARY KEY ("id_state")
);

-- CreateTable
CREATE TABLE "public"."phases_events" (
    "id_event" BIGSERIAL NOT NULL,
    "id_state" BIGINT NOT NULL,
    "event" "public"."phase_event_type" NOT NULL,
    "actor_id" BIGINT NOT NULL,
    "message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "phases_events_pkey" PRIMARY KEY ("id_event")
);

-- CreateIndex
CREATE INDEX "ix_phase_status" ON "public"."phases_state"("id_area", "id_nivel", "type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "phases_state_id_area_id_nivel_type_key" ON "public"."phases_state"("id_area", "id_nivel", "type");
