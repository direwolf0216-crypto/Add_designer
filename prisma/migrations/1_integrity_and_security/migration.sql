-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_jobId_fkey";

-- DropForeignKey
ALTER TABLE "CategoryBudget" DROP CONSTRAINT "CategoryBudget_userId_fkey";

-- DropForeignKey
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_jobId_fkey";

-- DropIndex
DROP INDEX "Job_date_idx";

-- DropIndex
DROP INDEX "Job_deletedAt_idx";

-- DropIndex
DROP INDEX "Transaction_transactionId_idx";

-- DropIndex
DROP INDEX "Notification_userId_idx";

-- DropIndex
DROP INDEX "Notification_isRead_idx";

-- DropIndex
DROP INDEX "Invoice_jobId_idx";

-- AlterTable (hand-edited: convert in place instead of DROP/ADD so existing rows keep their values)
ALTER TABLE "Transaction" ALTER COLUMN "type" TYPE "TransactionType" USING (upper(trim("type")))::"TransactionType";

-- AlterTable (hand-edited: convert in place; unknown values fall back to NORMAL)
ALTER TABLE "Notification" ALTER COLUMN "priority" DROP DEFAULT;
ALTER TABLE "Notification" ALTER COLUMN "priority" TYPE "NotificationPriority"
  USING (CASE WHEN upper("priority") IN ('HIGH', 'NORMAL', 'LOW') THEN upper("priority") ELSE 'NORMAL' END)::"NotificationPriority";
ALTER TABLE "Notification" ALTER COLUMN "priority" SET DEFAULT 'NORMAL';

-- CreateTable
CREATE TABLE "RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "Counter" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ReminderLog" (
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReminderLog_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "RateLimit_windowStart_idx" ON "RateLimit"("windowStart");

-- CreateIndex
CREATE INDEX "ReminderLog_createdAt_idx" ON "ReminderLog"("createdAt");

-- CreateIndex
CREATE INDEX "Transaction_deletedAt_date_idx" ON "Transaction"("deletedAt", "date");

-- CreateIndex
CREATE INDEX "Transaction_jobId_idx" ON "Transaction"("jobId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_email_idx" ON "PasswordResetToken"("email");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_type_entityId_createdAt_idx" ON "Notification"("type", "entityId", "createdAt");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CategoryBudget" ADD CONSTRAINT "CategoryBudget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Seed the invoice counter from any existing INV-#### numbers (numeric max, not string sort).
INSERT INTO "Counter" ("key", "value")
SELECT 'invoice', COALESCE(MAX(NULLIF(regexp_replace("invoiceNumber", '\D', '', 'g'), '')::int), 0)
FROM "Invoice"
ON CONFLICT ("key") DO NOTHING;

-- Normalise legacy recycle-bin item types from the Booking era.
UPDATE "RecycleBin" SET "itemType" = 'job' WHERE "itemType" = 'booking';
