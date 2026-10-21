-- Roles become Admin / Manager / Staff plus custom roles. The single Owner role goes away: the owner
-- becomes an Admin (Admins hold full access, including the team, roles and settings). Manager is a new
-- built-in role whose permissions can be edited like Staff's.

-- Owner-only notification switches are dropped; Admin keeps its own.
DELETE FROM "RolePermission" WHERE "role" = 'OWNER';

-- The single-owner index and the custom-role check depend on the column type: rebuild around the change.
DROP INDEX IF EXISTS "User_single_owner_key";
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_custom_role_check";

ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'STAFF', 'CUSTOM');

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role"
    USING (CASE "role"::text WHEN 'OWNER' THEN 'ADMIN' ELSE "role"::text END)::"Role";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'STAFF';
ALTER TABLE "RolePermission" ALTER COLUMN "role" TYPE "Role" USING ("role"::text::"Role");

DROP TYPE "Role_old";

-- A custom role id exactly when the role is CUSTOM.
ALTER TABLE "User" ADD CONSTRAINT "User_custom_role_check" CHECK (("role" = 'CUSTOM') = ("customRoleId" IS NOT NULL));
