CREATE TABLE IF NOT EXISTS "bot_handoff_messages" (
    "id" BIGSERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "content_type" TEXT NOT NULL DEFAULT 'text',
    "sender_user_id" TEXT,
    "sender_name" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "bot_handoff_messages_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'bot_handoff_messages_direction_check'
    ) THEN
        ALTER TABLE "bot_handoff_messages"
        ADD CONSTRAINT "bot_handoff_messages_direction_check"
        CHECK ("direction" IN ('INBOUND', 'OUTBOUND'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'bot_handoff_messages_phone_fkey'
    ) THEN
        ALTER TABLE "bot_handoff_messages"
        ADD CONSTRAINT "bot_handoff_messages_phone_fkey"
        FOREIGN KEY ("phone")
        REFERENCES "bot_handoff_sessions"("phone")
        ON DELETE CASCADE
        ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "bot_handoff_messages_phone_created_at_idx"
ON "bot_handoff_messages"("phone", "created_at");
