-- Printing-press terminology. Column and enum names in the database are unchanged (the Prisma schema
-- maps the new names onto them); this migration only renames stored *values* and keys.

ALTER TABLE "Job" ALTER COLUMN "category" SET DEFAULT 'General Printing';

-- Permission keys: legacy manage_bookings -> manage_jobs; galleries -> designs; notification types.
-- Skip a rename when the target row already exists for that role (unique on role+permission).
UPDATE "RolePermission" rp SET "permission" = m.new_key
FROM (VALUES
  ('manage_bookings', 'manage_jobs'),
  ('view_galleries', 'view_designs'),
  ('manage_galleries', 'manage_designs'),
  ('notify_GALLERY_DELIVERED', 'notify_PROOF_DELIVERED'),
  ('notify_GALLERY_NOT_DELIVERED', 'notify_PROOF_NOT_DELIVERED'),
  ('notify_ALBUM_PENDING_REMINDER', 'notify_FINISHING_PENDING_REMINDER')
) AS m(old_key, new_key)
WHERE rp."permission" = m.old_key
  AND NOT EXISTS (SELECT 1 FROM "RolePermission" x WHERE x."role" = rp."role" AND x."permission" = m.new_key);
DELETE FROM "RolePermission"
WHERE "permission" IN ('manage_bookings', 'view_galleries', 'manage_galleries',
  'notify_GALLERY_DELIVERED', 'notify_GALLERY_NOT_DELIVERED', 'notify_ALBUM_PENDING_REMINDER');

-- Business settings keys.
UPDATE "SystemSetting" s SET "key" = 'business_' || substring(s."key" from 8)
WHERE s."key" LIKE 'studio\_%'
  AND NOT EXISTS (SELECT 1 FROM "SystemSetting" x WHERE x."key" = 'business_' || substring(s."key" from 8));
UPDATE "SystemSetting" SET "key" = 'reminder_threshold_proof' WHERE "key" = 'reminder_threshold_gallery'
  AND NOT EXISTS (SELECT 1 FROM "SystemSetting" WHERE "key" = 'reminder_threshold_proof');
UPDATE "SystemSetting" SET "key" = 'reminder_threshold_finishing' WHERE "key" = 'reminder_threshold_album'
  AND NOT EXISTS (SELECT 1 FROM "SystemSetting" WHERE "key" = 'reminder_threshold_finishing');

-- Job status and custom-data keys.
UPDATE "Job" SET "status" = 'Printing Completed' WHERE lower("status") = 'shoot completed';
UPDATE "Job" SET "status" = 'Finishing In Progress' WHERE lower("status") = 'album work in progress';
UPDATE "Job"
SET "customData" = ("customData" - 'fld_b_album_status' - 'album_status')
  || jsonb_build_object('fld_b_finishing_status', COALESCE("customData"->'fld_b_album_status', "customData"->'album_status'))
WHERE jsonb_typeof("customData") = 'object'
  AND ("customData" ? 'fld_b_album_status' OR "customData" ? 'album_status');

UPDATE "Job"
SET "customData" = ("customData" - 'fld_gallery_delivered') || jsonb_build_object('fld_proof_delivered', "customData"->'fld_gallery_delivered')
WHERE jsonb_typeof("customData") = 'object' AND "customData" ? 'fld_gallery_delivered';

-- Transaction categories.
UPDATE "Transaction" SET "category" = CASE "category"
    WHEN 'Photography Session' THEN 'Printing Job'
    WHEN 'Photography' THEN 'Printing Job'
    WHEN 'Editing Charges' THEN 'Design Charges'
    WHEN 'Album Payment' THEN 'Binding & Finishing'
    ELSE "category" END
WHERE "category" IN ('Photography Session', 'Photography', 'Editing Charges', 'Album Payment');

-- Stored form layouts (field ids, labels and options inside the JSON schema).
UPDATE "FormLayout" SET "schema" = replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
    "schema"::text,
    'fld_gallery_delivered', 'fld_proof_delivered'),
    'Album Work In Progress', 'Finishing In Progress'),
    'fld_b_album_status', 'fld_b_finishing_status'),
    'Shoot Completed', 'Printing Completed'),
    'Album Status', 'Finishing Status'),
    'Gallery Delivered', 'Proof Delivered'),
    'Photography Session', 'Printing Job'),
    'Editing Charges', 'Design Charges'),
    'Album Payment', 'Binding & Finishing'),
    'Shoot Date', 'Job Date')::jsonb;
