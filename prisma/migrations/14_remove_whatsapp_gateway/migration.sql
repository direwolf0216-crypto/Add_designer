-- The self-hosted OpenWA gateway was removed in favour of click-to-chat (wa.me) links, which send
-- nothing from the server. Drop its message log and the per-user "WhatsApp notifications" flag.
-- IF EXISTS keeps this safe on databases that never had them.
DROP TABLE IF EXISTS "WhatsAppMessage";
ALTER TABLE "User" DROP COLUMN IF EXISTS "whatsappNotifs";
