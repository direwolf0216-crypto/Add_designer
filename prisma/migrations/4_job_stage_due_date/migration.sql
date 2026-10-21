-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "stage" TEXT;

-- CreateIndex
CREATE INDEX "Job_deletedAt_stage_idx" ON "Job"("deletedAt", "stage");

-- CreateIndex
CREATE INDEX "Job_deletedAt_dueDate_idx" ON "Job"("deletedAt", "dueDate");


-- Hand-written backfill for the common case (board stage stored at the top level of customData).
-- Layout-specific due dates and line-item stages are filled by scripts/jobs/backfill-tracking.ts.
UPDATE "Job" SET "stage" = "customData" ->> 'fld_b_status'
WHERE jsonb_typeof("customData") = 'object' AND "customData" ? 'fld_b_status' AND "stage" IS NULL;
