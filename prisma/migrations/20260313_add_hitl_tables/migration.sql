-- Migration: add_hitl_tables
-- Adds AnomalyStatus enum, DecisionAction enum, anomalies table, decisions table
-- Also adds password_hash column to users (missing from _init)

-- CreateEnum
CREATE TYPE "AnomalyStatus" AS ENUM ('PENDING', 'RESOLVED');

-- CreateEnum
CREATE TYPE "DecisionAction" AS ENUM ('APPROVED', 'CORRECTED', 'DISCARDED');

-- AlterTable: add password_hash to users (if not already present)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" TEXT NOT NULL DEFAULT '';

-- CreateTable: anomalies
CREATE TABLE "anomalies" (
    "id" TEXT NOT NULL,
    "dataset_id" TEXT NOT NULL,
    "column" TEXT NOT NULL,
    "row" INTEGER,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "original_value" TEXT,
    "suggested_value" TEXT,
    "status" "AnomalyStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "anomalies_pkey" PRIMARY KEY ("id")
);

-- CreateTable: decisions
CREATE TABLE "decisions" (
    "id" TEXT NOT NULL,
    "anomaly_id" TEXT NOT NULL,
    "action" "DecisionAction" NOT NULL,
    "correction" TEXT,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "anomalies_dataset_id_idx" ON "anomalies"("dataset_id");
CREATE INDEX "anomalies_status_idx" ON "anomalies"("status");
CREATE UNIQUE INDEX "decisions_anomaly_id_key" ON "decisions"("anomaly_id");

-- AddForeignKey
ALTER TABLE "anomalies" ADD CONSTRAINT "anomalies_dataset_id_fkey"
    FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "decisions" ADD CONSTRAINT "decisions_anomaly_id_fkey"
    FOREIGN KEY ("anomaly_id") REFERENCES "anomalies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
