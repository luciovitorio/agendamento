CREATE TABLE IF NOT EXISTS "bot_handoff_sessions" (
    "phone" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "reason" TEXT,
    "assigned_agent" TEXT,
    "opened_at" TIMESTAMPTZ,
    "closed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "bot_handoff_sessions_pkey" PRIMARY KEY ("phone")
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'bot_handoff_sessions_mode_check'
    ) THEN
        ALTER TABLE "bot_handoff_sessions"
        ADD CONSTRAINT "bot_handoff_sessions_mode_check"
        CHECK ("mode" IN ('BOT', 'HUMAN'));
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "bot_handoff_events" (
    "id" BIGSERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "previous_mode" TEXT,
    "next_mode" TEXT NOT NULL,
    "reason" TEXT,
    "actor" TEXT,
    "assigned_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT "bot_handoff_events_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'bot_handoff_events_next_mode_check'
    ) THEN
        ALTER TABLE "bot_handoff_events"
        ADD CONSTRAINT "bot_handoff_events_next_mode_check"
        CHECK ("next_mode" IN ('BOT', 'HUMAN'));
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'bot_handoff_events_phone_fkey'
    ) THEN
        ALTER TABLE "bot_handoff_events"
        ADD CONSTRAINT "bot_handoff_events_phone_fkey"
        FOREIGN KEY ("phone")
        REFERENCES "bot_handoff_sessions"("phone")
        ON DELETE CASCADE
        ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "bot_handoff_events_phone_created_at_idx"
ON "bot_handoff_events"("phone", "created_at");
