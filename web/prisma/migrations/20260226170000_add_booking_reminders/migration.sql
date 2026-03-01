ALTER TABLE "ClinicBotSettings"
ADD COLUMN IF NOT EXISTS "bookingReminderRulesJson" TEXT NOT NULL DEFAULT '[]';

CREATE TABLE IF NOT EXISTS "booking_reminders" (
  "id" BIGSERIAL PRIMARY KEY,
  "booking_id" TEXT NOT NULL,
  "patient_phone" TEXT NOT NULL,
  "offset_hours" INTEGER NOT NULL,
  "message_template" TEXT NOT NULL,
  "require_confirmation" BOOLEAN NOT NULL DEFAULT false,
  "send_at" TIMESTAMPTZ NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "sent_at" TIMESTAMPTZ,
  "confirmed_at" TIMESTAMPTZ,
  "evolution_message_id" TEXT,
  "last_error" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "booking_reminders_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "Booking"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "booking_reminders_booking_offset_key"
ON "booking_reminders" ("booking_id", "offset_hours");

CREATE INDEX IF NOT EXISTS "booking_reminders_status_send_at_idx"
ON "booking_reminders" ("status", "send_at");

CREATE INDEX IF NOT EXISTS "booking_reminders_phone_status_idx"
ON "booking_reminders" ("patient_phone", "status");
