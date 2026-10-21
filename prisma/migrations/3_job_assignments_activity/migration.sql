-- CreateEnum
CREATE TYPE "JobActivityType" AS ENUM ('CREATED', 'UPDATED', 'STATUS_CHANGED', 'ASSIGNED', 'UNASSIGNED', 'PAYMENT_ADDED', 'PAYMENT_UPDATED', 'PAYMENT_DELETED', 'PAYMENT_RESTORED', 'INVOICE_GENERATED', 'ATTACHMENT_ADDED', 'PROOF_DELIVERED', 'FINISHING_UPDATED', 'DELETED', 'RESTORED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'JOB_ASSIGNED';

-- CreateTable
CREATE TABLE "JobAssignment" (
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedById" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobAssignment_pkey" PRIMARY KEY ("jobId","userId")
);

-- CreateTable
CREATE TABLE "JobActivity" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "actorId" TEXT,
    "type" "JobActivityType" NOT NULL,
    "summary" TEXT NOT NULL,
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobAssignment_userId_assignedAt_idx" ON "JobAssignment"("userId", "assignedAt");

-- CreateIndex
CREATE INDEX "JobActivity_jobId_createdAt_idx" ON "JobActivity"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "JobActivity_actorId_createdAt_idx" ON "JobActivity"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobActivity" ADD CONSTRAINT "JobActivity_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobActivity" ADD CONSTRAINT "JobActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Hand-written: carry existing assignments over before dropping the old JSON column.
-- Old values were user ids, either as strings or objects with an "id".
INSERT INTO "JobAssignment" ("jobId", "userId")
SELECT DISTINCT j."id", u."id"
FROM "Job" j
CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(j."photographers") = 'array' THEN j."photographers" ELSE '[]'::jsonb END) AS e(v)
JOIN "User" u ON u."id" = CASE jsonb_typeof(e.v) WHEN 'string' THEN e.v #>> '{}' WHEN 'object' THEN e.v ->> 'id' END
ON CONFLICT DO NOTHING;

-- The default job form's "Assigned Operator/Designer" user-picker stored one or more comma-separated ids.
INSERT INTO "JobAssignment" ("jobId", "userId")
SELECT DISTINCT j."id", u."id"
FROM "Job" j
CROSS JOIN LATERAL regexp_split_to_table(COALESCE(j."customData" ->> 'fld_b_assigned_operator', ''), '\s*,\s*') AS t(uid)
JOIN "User" u ON u."id" = t.uid
WHERE jsonb_typeof(j."customData") = 'object'
ON CONFLICT DO NOTHING;

ALTER TABLE "Job" DROP COLUMN "photographers";
