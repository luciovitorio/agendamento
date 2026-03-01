ALTER TABLE "bot_handoff_messages"
ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMPTZ;

UPDATE "bot_handoff_messages"
SET "read_at" = COALESCE("read_at", "created_at")
WHERE "direction" = 'OUTBOUND';

CREATE INDEX IF NOT EXISTS "bot_handoff_messages_unread_idx"
ON "bot_handoff_messages" ("phone", "created_at")
WHERE "direction" = 'INBOUND' AND "read_at" IS NULL;
