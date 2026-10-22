-- Every module gets view / create / edit / delete permissions.
-- manage_transactions -> create/edit/delete_transactions, the new view_jobs is granted wherever jobs were
-- visible before (always, until now), and the unused design permissions are dropped.
INSERT INTO "RolePermission" ("id", "role", "permission", "enabled")
SELECT md5(random()::text || clock_timestamp()::text || m.np), rp."role", m.np, rp."enabled"
FROM "RolePermission" rp
JOIN (VALUES
  ('manage_transactions', 'create_transactions'), ('manage_transactions', 'edit_transactions'), ('manage_transactions', 'delete_transactions')
) AS m(op, np) ON m.op = rp."permission"
WHERE NOT EXISTS (SELECT 1 FROM "RolePermission" x WHERE x."role" = rp."role" AND x."permission" = m.np);
DELETE FROM "RolePermission" WHERE "permission" IN ('manage_transactions', 'manage_designs', 'view_designs');

UPDATE "CustomRole"
SET "permissions" = array_remove("permissions", 'manage_transactions') || ARRAY['create_transactions', 'edit_transactions', 'delete_transactions']
WHERE 'manage_transactions' = ANY("permissions");
UPDATE "CustomRole"
SET "permissions" = array_remove(array_remove("permissions", 'manage_designs'), 'view_designs')
WHERE 'manage_designs' = ANY("permissions") OR 'view_designs' = ANY("permissions");
UPDATE "CustomRole"
SET "permissions" = "permissions" || ARRAY['view_jobs']
WHERE NOT ('view_jobs' = ANY("permissions"));
