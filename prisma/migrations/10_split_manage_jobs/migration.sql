-- "Create & edit jobs" (manage_jobs) becomes three permissions: create_jobs, edit_jobs, delete_jobs.
-- Staff/Manager overrides: copy the manage_jobs setting to each new permission, then drop the old row.
INSERT INTO "RolePermission" ("id", "role", "permission", "enabled")
SELECT md5(random()::text || clock_timestamp()::text || p), rp."role", p, rp."enabled"
FROM "RolePermission" rp
CROSS JOIN unnest(ARRAY['create_jobs', 'edit_jobs', 'delete_jobs']) AS p
WHERE rp."permission" = 'manage_jobs'
  AND NOT EXISTS (SELECT 1 FROM "RolePermission" x WHERE x."role" = rp."role" AND x."permission" = p);
DELETE FROM "RolePermission" WHERE "permission" = 'manage_jobs';

-- Custom roles: expand the legacy entry in the permissions array.
UPDATE "CustomRole"
SET "permissions" = array_remove("permissions", 'manage_jobs') || ARRAY['create_jobs', 'edit_jobs', 'delete_jobs']
WHERE 'manage_jobs' = ANY("permissions");
