-- Roles become Owner / Admin / Staff plus admin-defined custom roles.

CREATE TABLE "CustomRole" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomRole_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CustomRole_name_key" ON "CustomRole"("name");

ALTER TABLE "User" ADD COLUMN "customRoleId" TEXT;
CREATE INDEX "User_customRoleId_idx" ON "User"("customRoleId");
ALTER TABLE "User" ADD CONSTRAINT "User_customRoleId_fkey"
    FOREIGN KEY ("customRoleId") REFERENCES "CustomRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The old Designer role (stored as PHOTOGRAPHER) becomes a custom role with the same effective
-- permissions: its defaults (view/manage designs) unless switched off, plus anything switched on.
INSERT INTO "CustomRole" ("id", "name", "description", "permissions", "updatedAt")
SELECT 'role_designer', 'Designer', 'Works on design deliverables', ARRAY(
    SELECT d.p FROM unnest(ARRAY['view_designs', 'manage_designs']) AS d(p)
    WHERE NOT EXISTS (
        SELECT 1 FROM "RolePermission" rp
        WHERE rp."role" = 'PHOTOGRAPHER' AND rp."permission" = d.p AND rp."enabled" = false
    )
    UNION
    SELECT rp."permission" FROM "RolePermission" rp WHERE rp."role" = 'PHOTOGRAPHER' AND rp."enabled" = true
), CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "User" WHERE "role" = 'PHOTOGRAPHER');

ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'STAFF', 'CUSTOM');

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role"
    USING (CASE "role"::text WHEN 'PHOTOGRAPHER' THEN 'CUSTOM' ELSE "role"::text END)::"Role";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'STAFF';
UPDATE "User" SET "customRoleId" = 'role_designer' WHERE "role" = 'CUSTOM';

-- Designer overrides now live on the custom role.
DELETE FROM "RolePermission" WHERE "role" = 'PHOTOGRAPHER';
ALTER TABLE "RolePermission" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");

DROP TYPE "Role_old";

-- The owner is the protected "master admin" account the app already treated specially, else the
-- longest-standing active admin. Transferable from Settings.
UPDATE "User" SET "role" = 'OWNER'
WHERE "id" = (
    SELECT "id" FROM "User" WHERE "role" = 'ADMIN' AND "status" = 'ACTIVE'
    ORDER BY ("email" = 'nithyavishalr@gmail.com') DESC NULLS LAST, "idNumber" ASC
    LIMIT 1
);

-- A custom role id exactly when the role is CUSTOM; at most one owner.
ALTER TABLE "User" ADD CONSTRAINT "User_custom_role_check" CHECK (("role" = 'CUSTOM') = ("customRoleId" IS NOT NULL));
CREATE UNIQUE INDEX "User_single_owner_key" ON "User" ((true)) WHERE "role" = 'OWNER';
