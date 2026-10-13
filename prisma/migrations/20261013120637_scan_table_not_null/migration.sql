/*
  Warnings:

  - Made the column `table` on table `ScanEvent` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "ScanEvent" ALTER COLUMN "table" SET NOT NULL,
ALTER COLUMN "table" SET DEFAULT '';
