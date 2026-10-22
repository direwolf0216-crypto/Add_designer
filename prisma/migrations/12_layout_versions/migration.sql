-- Layout drafts and publish history: the builder saves drafts without touching the live form, and every
-- publish is kept as a version with its author so it can be compared and restored.
ALTER TABLE "FormLayout"
  ADD COLUMN "draftSchema" JSONB,
  ADD COLUMN "draftUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "publishedVersion" INTEGER;

CREATE TABLE "FormLayoutVersion" (
  "id" TEXT NOT NULL,
  "formKey" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "schema" JSONB NOT NULL,
  "authorId" TEXT,
  "authorName" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FormLayoutVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FormLayoutVersion_formKey_version_key" ON "FormLayoutVersion"("formKey", "version");
CREATE INDEX "FormLayoutVersion_formKey_createdAt_idx" ON "FormLayoutVersion"("formKey", "createdAt");

-- Existing layouts become version 1 so history starts from what is live today.
INSERT INTO "FormLayoutVersion" ("id", "formKey", "version", "name", "description", "schema", "note", "createdAt")
SELECT md5(random()::text || clock_timestamp()::text || "formKey"), "formKey", 1, "name", "description", "schema", 'Layout as it was when version history was introduced', "updatedAt"
FROM "FormLayout";
UPDATE "FormLayout" SET "publishedVersion" = 1;
