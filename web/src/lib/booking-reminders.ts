import { BookingStatus, Prisma } from "@prisma/client";
import {
  BOT_SETTINGS_SINGLETON_KEY,
  DEFAULT_BOT_SETTINGS_VALUES,
} from "@/lib/bot-settings";
import {
  REMINDER_CONFIRMATION_NUMERIC_INSTRUCTION,
  isBookingReminderCancelOrRescheduleMessage,
  isBookingReminderConfirmationMessage,
  parseBookingReminderRules,
  renderBookingReminderMessage,
} from "@/lib/booking-reminder-rules";
import type { EvolutionListMessage } from "@/lib/evolution-api";
import { buildPhoneComparableDigits, normalizeIncomingPhone } from "@/lib/n8n-phone";
import { prisma } from "@/lib/prisma";
import {
  resolveMissingProviderConfigMessage,
  sendConfiguredWhatsAppMessage,
} from "@/lib/whatsapp-provider";

const ACTIVE_BOOKING_STATUSES = new Set<BookingStatus>([
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
]);
const DEFAULT_CLINIC_TIMEZONE_OFFSET = "-03:00";
const TIMEZONE_OFFSET_PATTERN = /^[+-](?:0\d|1[0-4]):[0-5]\d$/;

type BookingReminderStatus =
  | "PENDING"
  | "SENDING"
  | "SENT"
  | "FAILED"
  | "SKIPPED"
  | "CONFIRMED";

interface ReminderSettingsSnapshot {
  whatsappProvider: "EVOLUTION" | "META_CLOUD";
  reminderRules: Array<{
    id: string;
    offsetHours: number;
    messageTemplate: string;
    requireConfirmation: boolean;
  }>;
  confirmMessage: string;
  messageTypingDelayMs: number;
  messageTypingPresence: "composing" | "recording" | "paused";
  useInteractiveMessages: boolean;
  interactiveMenuTitle: string;
  interactiveMenuButtonText: string;
  interactiveMenuSectionTitle: string;
  evolutionApiUrl: string | null;
  evolutionInstanceName: string | null;
  evolutionApiToken: string | null;
  metaPhoneNumberId: string | null;
  metaAccessToken: string | null;
  metaApiVersion: string | null;
}

interface BookingReminderRow {
  id: bigint;
  bookingId: string;
  patientPhone: string;
  offsetHours: number;
  messageTemplate: string;
  requireConfirmation: boolean;
  sendAt: Date;
  status: BookingReminderStatus;
  attempts: number;
  sentAt: Date | null;
}

interface BookingReminderModel {
  findMany(args: Record<string, unknown>): Promise<BookingReminderRow[]>;
  createMany(args: Record<string, unknown>): Promise<{ count: number }>;
  deleteMany(args: Record<string, unknown>): Promise<{ count: number }>;
  update(args: Record<string, unknown>): Promise<unknown>;
  updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
}

export interface SyncBookingRemindersResult {
  synced: boolean;
  created: number;
  reason?: string;
}

export interface ProcessDueRemindersResult {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  error?: string;
}

export interface ReminderConfirmationResult {
  handled: boolean;
  confirmed: boolean;
  action?: "CONFIRM" | "CANCEL_OR_RESCHEDULE";
  bookingId?: string;
  responseMessage?: string;
}

function getBookingReminderModelFromClient(client: unknown): BookingReminderModel {
  const model = (client as { bookingReminder?: BookingReminderModel }).bookingReminder;
  if (!model) {
    throw new Error(
      "Prisma client sem o model BookingReminder. Rode `npx prisma generate`.",
    );
  }
  return model;
}

function getBookingReminderModel() {
  return getBookingReminderModelFromClient(prisma);
}

function isActiveBookingStatus(status: BookingStatus) {
  return ACTIVE_BOOKING_STATUSES.has(status);
}

function normalizeTypingPresence(
  value: unknown,
): "composing" | "recording" | "paused" {
  if (value === "recording" || value === "paused" || value === "composing") {
    return value;
  }
  return "composing";
}

function normalizeDelayMs(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_BOT_SETTINGS_VALUES.messageTypingDelayMs;
  }
  return Math.max(0, Math.min(30_000, Math.trunc(value)));
}

function normalizeShortText(
  value: unknown,
  fallback: string,
  maxLength: number,
) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  if (!normalized) return fallback;
  return normalized.slice(0, maxLength);
}

async function loadReminderSettingsSnapshot(): Promise<ReminderSettingsSnapshot> {
  const settings = await prisma.clinicBotSettings.findUnique({
    where: { singletonKey: BOT_SETTINGS_SINGLETON_KEY },
  });
  const settingsRecord = settings as (typeof settings & {
    bookingReminderRulesJson?: string | null;
  }) | null;

  return {
    whatsappProvider: settings?.whatsappProvider === "META_CLOUD"
      ? "META_CLOUD"
      : "EVOLUTION",
    reminderRules: parseBookingReminderRules(
      settingsRecord?.bookingReminderRulesJson,
    ),
    confirmMessage:
      settings?.confirmMessage ?? DEFAULT_BOT_SETTINGS_VALUES.confirmMessage,
    messageTypingDelayMs: normalizeDelayMs(settings?.messageTypingDelayMs),
    messageTypingPresence: normalizeTypingPresence(settings?.messageTypingPresence),
    useInteractiveMessages: !!settings?.useInteractiveMessages,
    interactiveMenuTitle: normalizeShortText(
      settings?.interactiveMenuTitle,
      DEFAULT_BOT_SETTINGS_VALUES.interactiveMenuTitle,
      24,
    ),
    interactiveMenuButtonText: normalizeShortText(
      settings?.interactiveMenuButtonText,
      DEFAULT_BOT_SETTINGS_VALUES.interactiveMenuButtonText,
      20,
    ),
    interactiveMenuSectionTitle: normalizeShortText(
      settings?.interactiveMenuSectionTitle,
      DEFAULT_BOT_SETTINGS_VALUES.interactiveMenuSectionTitle,
      40,
    ),
    evolutionApiUrl: settings?.evolutionApiUrl ?? null,
    evolutionInstanceName: settings?.evolutionInstanceName ?? null,
    evolutionApiToken: settings?.evolutionApiToken ?? null,
    metaPhoneNumberId: settings?.metaPhoneNumberId ?? null,
    metaAccessToken: settings?.metaAccessToken ?? null,
    metaApiVersion: settings?.metaApiVersion ?? null,
  };
}

function truncateErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 500);
}

function extractProviderMessageId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;

  const directId = record.id;
  if (typeof directId === "string" && directId.trim()) {
    return directId.trim();
  }

  const key =
    typeof record.key === "object" && record.key
      ? (record.key as Record<string, unknown>)
      : null;
  if (key && typeof key.id === "string" && key.id.trim()) {
    return key.id.trim();
  }

  const messages = Array.isArray(record.messages)
    ? (record.messages as Array<Record<string, unknown>>)
    : [];
  const firstMessage = messages[0];
  if (firstMessage && typeof firstMessage.id === "string") {
    const messageId = firstMessage.id.trim();
    if (messageId) return messageId;
  }

  return null;
}

function resolveComparablePhones(rawPhone: string) {
  const normalizedPhone = normalizeIncomingPhone(rawPhone) ?? rawPhone;
  const comparables = buildPhoneComparableDigits(normalizedPhone);
  if (comparables.length > 0) return comparables;

  const fallbackDigits = rawPhone.replace(/\D/g, "");
  return fallbackDigits ? [fallbackDigits] : [];
}

function getAppointmentDateTime(date: Date, time: string) {
  return new Date(`${toClinicDateStr(date)}T${time}:00${getClinicTimezoneOffset()}`);
}

function parseTimezoneOffsetToMinutes(offset: string) {
  const sign = offset[0] === "-" ? -1 : 1;
  const hours = Number(offset.slice(1, 3));
  const minutes = Number(offset.slice(4, 6));
  return sign * (hours * 60 + minutes);
}

function getClinicTimezoneOffset() {
  const configured = process.env.CLINIC_TIMEZONE_OFFSET?.trim();
  if (configured && TIMEZONE_OFFSET_PATTERN.test(configured)) {
    return configured;
  }
  return DEFAULT_CLINIC_TIMEZONE_OFFSET;
}

function toClinicDateStr(date: Date) {
  const offsetMinutes = parseTimezoneOffsetToMinutes(getClinicTimezoneOffset());
  const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatBookingDateLabel(date: Date) {
  const [year, month, day] = toClinicDateStr(date).split("-");
  if (!year || !month || !day) return toClinicDateStr(date);
  return `${day}/${month}/${year}`;
}

function buildReminderContent(params: {
  reminder: BookingReminderRow;
  baseText: string;
  settings: ReminderSettingsSnapshot;
}): string | EvolutionListMessage {
  const { reminder, baseText, settings } = params;

  if (!reminder.requireConfirmation) {
    return baseText;
  }

  if (settings.useInteractiveMessages) {
    return {
      title: settings.interactiveMenuTitle,
      description: baseText,
      buttonText: settings.interactiveMenuButtonText,
      sections: [
        {
          title: settings.interactiveMenuSectionTitle,
          rows: [
            {
              title: "Confirmar",
              description: "Confirmar presenca na consulta",
              rowId: "confirmar",
            },
            {
              title: "Cancelar/Remarcar",
              description: "Solicitar ajuste do agendamento",
              rowId: "cancelar_remarcar",
            },
          ],
        },
      ],
    };
  }

  return baseText;
}

async function markReminderSkipped(
  reminderModel: BookingReminderModel,
  reminderId: bigint,
  reason: string,
) {
  await reminderModel.update({
    where: { id: reminderId },
    data: {
      status: "SKIPPED",
      lastError: reason.slice(0, 500),
    },
  });
}

export async function syncBookingRemindersForBooking(
  bookingId: string,
): Promise<SyncBookingRemindersResult> {
  const reminderModel = getBookingReminderModel();
  const [settings, booking] = await Promise.all([
    loadReminderSettingsSnapshot(),
    prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        patient: true,
        professional: true,
        service: true,
      },
    }),
  ]);

  if (!booking) {
    return { synced: false, created: 0, reason: "BOOKING_NOT_FOUND" };
  }

  if (!isActiveBookingStatus(booking.status)) {
    await reminderModel.deleteMany({
      where: {
        bookingId: booking.id,
        status: {
          in: ["PENDING", "FAILED", "SENDING", "SENT"],
        },
      },
    });
    return { synced: true, created: 0, reason: "BOOKING_INACTIVE" };
  }

  await reminderModel.deleteMany({
    where: {
      bookingId: booking.id,
      status: {
        in: ["PENDING", "FAILED", "SENDING"],
      },
    },
  });

  if (settings.reminderRules.length === 0) {
    return { synced: true, created: 0, reason: "NO_RULES" };
  }

  const now = new Date();
  const appointmentAt = getAppointmentDateTime(booking.date, booking.startTime);
  if (!(appointmentAt > now)) {
    return { synced: true, created: 0, reason: "BOOKING_ALREADY_PASSED" };
  }

  const reminderRows = settings.reminderRules.map((rule) => {
    const baseSendAt = new Date(
      appointmentAt.getTime() - rule.offsetHours * 60 * 60 * 1000,
    );
    const sendAt = baseSendAt > now ? baseSendAt : now;

    return {
      bookingId: booking.id,
      patientPhone: booking.patient.phone,
      offsetHours: rule.offsetHours,
      messageTemplate: rule.messageTemplate,
      requireConfirmation: rule.requireConfirmation,
      sendAt,
      status: "PENDING" as BookingReminderStatus,
    };
  });

  const result = await reminderModel.createMany({
    data: reminderRows,
    skipDuplicates: true,
  });

  return { synced: true, created: result.count };
}

export async function cancelBookingRemindersForBooking(
  bookingId: string,
  reason = "Agendamento inativo para lembretes.",
) {
  const reminderModel = getBookingReminderModel();
  const result = await reminderModel.updateMany({
    where: {
      bookingId,
      status: {
        in: ["PENDING", "FAILED", "SENDING", "SENT"],
      },
    },
    data: {
      status: "SKIPPED",
      lastError: reason.slice(0, 500),
    },
  });

  return result.count;
}

function parseProcessLimit(rawLimit: unknown) {
  const parsed =
    typeof rawLimit === "number"
      ? Math.trunc(rawLimit)
      : typeof rawLimit === "string"
        ? Number.parseInt(rawLimit, 10)
        : Number.NaN;

  if (!Number.isFinite(parsed)) return 30;
  return Math.max(1, Math.min(200, parsed));
}

export async function processDueBookingReminders(input?: {
  limit?: number;
}): Promise<ProcessDueRemindersResult> {
  const reminderModel = getBookingReminderModel();
  const settings = await loadReminderSettingsSnapshot();
  const limit = parseProcessLimit(input?.limit);

  const providerConfigError = resolveMissingProviderConfigMessage(settings);
  if (providerConfigError) {
    return {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      error: providerConfigError,
    };
  }

  const dueReminders = await reminderModel.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      sendAt: { lte: new Date() },
      attempts: { lt: 5 },
    },
    orderBy: [{ sendAt: "asc" }, { id: "asc" }],
    take: limit,
  });

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const reminder of dueReminders) {
    const lock = await reminderModel.updateMany({
      where: {
        id: reminder.id,
        status: { in: ["PENDING", "FAILED"] },
      },
      data: {
        status: "SENDING",
        lastError: null,
      },
    });
    if (lock.count === 0) {
      continue;
    }

    try {
      const booking = await prisma.booking.findUnique({
        where: { id: reminder.bookingId },
        include: {
          patient: true,
          professional: true,
          service: true,
        },
      });

      if (!booking) {
        skipped += 1;
        await markReminderSkipped(
          reminderModel,
          reminder.id,
          "Agendamento nao encontrado.",
        );
        continue;
      }

      if (!isActiveBookingStatus(booking.status)) {
        skipped += 1;
        await markReminderSkipped(
          reminderModel,
          reminder.id,
          "Agendamento sem status ativo para lembrete.",
        );
        continue;
      }

      const appointmentAt = getAppointmentDateTime(booking.date, booking.startTime);
      if (!(appointmentAt > new Date())) {
        skipped += 1;
        await markReminderSkipped(
          reminderModel,
          reminder.id,
          "Horario do agendamento ja passou.",
        );
        continue;
      }

      const message = renderBookingReminderMessage(
        reminder.messageTemplate,
        {
          patientName: booking.patient.name,
          professionalName: booking.professional.name,
          serviceName: booking.service.name,
          bookingDateLabel: formatBookingDateLabel(booking.date),
          bookingTime: booking.startTime,
        },
        reminder.requireConfirmation,
        settings.useInteractiveMessages
          ? "Selecione uma opcao no menu abaixo."
          : REMINDER_CONFIRMATION_NUMERIC_INSTRUCTION,
      );
      const reminderContent = buildReminderContent({
        reminder,
        baseText: message,
        settings,
      });

      const providerPayload = await sendConfiguredWhatsAppMessage({
        settings,
        phone: reminder.patientPhone,
        content: reminderContent,
        delay: settings.messageTypingDelayMs,
        presence: settings.messageTypingPresence,
      });

      await reminderModel.update({
        where: { id: reminder.id },
        data: {
          status: "SENT",
          attempts: { increment: 1 },
          sentAt: new Date(),
          evolutionMessageId: extractProviderMessageId(providerPayload),
          lastError: null,
        },
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      await reminderModel.update({
        where: { id: reminder.id },
        data: {
          status: "FAILED",
          attempts: { increment: 1 },
          lastError: truncateErrorMessage(error),
        },
      });
    }
  }

  return {
    processed: dueReminders.length,
    sent,
    failed,
    skipped,
  };
}

export async function tryConfirmBookingFromReminderReply(
  rawPhone: string,
  messageText: string,
): Promise<ReminderConfirmationResult> {
  const confirmIntent = isBookingReminderConfirmationMessage(messageText);
  const cancelOrRescheduleIntent =
    isBookingReminderCancelOrRescheduleMessage(messageText);

  if (!confirmIntent && !cancelOrRescheduleIntent) {
    return { handled: false, confirmed: false };
  }

  const phoneCandidates = resolveComparablePhones(rawPhone);
  if (phoneCandidates.length === 0) {
    return { handled: false, confirmed: false };
  }

  const reminderModel = getBookingReminderModel();
  const candidateReminders = await reminderModel.findMany({
    where: {
      requireConfirmation: true,
      status: "SENT",
      patientPhone: { in: phoneCandidates },
    },
    orderBy: [{ sendAt: "desc" }, { id: "desc" }],
    take: 20,
  });

  if (candidateReminders.length === 0) {
    return { handled: false, confirmed: false };
  }

  const now = new Date();
  let targetReminder: BookingReminderRow | null = null;
  let targetBooking: Prisma.BookingGetPayload<{
    include: { patient: true; professional: true; service: true };
  }> | null = null;

  for (const reminder of candidateReminders) {
    const booking = await prisma.booking.findUnique({
      where: { id: reminder.bookingId },
      include: {
        patient: true,
        professional: true,
        service: true,
      },
    });
    if (!booking) {
      continue;
    }

    if (!isActiveBookingStatus(booking.status)) {
      continue;
    }

    const appointmentAt = getAppointmentDateTime(booking.date, booking.startTime);
    if (appointmentAt.getTime() < now.getTime() - 6 * 60 * 60 * 1000) {
      continue;
    }

    targetReminder = reminder;
    targetBooking = booking;
    break;
  }

  if (!targetReminder || !targetBooking) {
    return { handled: false, confirmed: false };
  }

  const settings = await loadReminderSettingsSnapshot();

  if (cancelOrRescheduleIntent) {
    await getBookingReminderModel().updateMany({
      where: {
        bookingId: targetBooking.id,
        requireConfirmation: true,
        status: { in: ["PENDING", "FAILED", "SENDING", "SENT"] },
      },
      data: {
        status: "SKIPPED",
        lastError: "Paciente solicitou cancelar/remarcar via lembrete.",
      },
    });

    return {
      handled: true,
      confirmed: false,
      action: "CANCEL_OR_RESCHEDULE",
      bookingId: targetBooking.id,
    };
  }

  const transactionResult = await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: targetBooking.id },
      select: { id: true, status: true },
    });
    if (!booking) {
      return { updatedBooking: false };
    }

    if (booking.status === BookingStatus.PENDING) {
      await tx.booking.update({
        where: { id: booking.id },
        data: { status: BookingStatus.CONFIRMED },
      });
    }

    const txReminderModel = getBookingReminderModelFromClient(tx);
    await txReminderModel.updateMany({
      where: {
        bookingId: booking.id,
        requireConfirmation: true,
        status: { in: ["PENDING", "FAILED", "SENDING", "SENT"] },
      },
      data: {
        status: "CONFIRMED",
        confirmedAt: new Date(),
        lastError: null,
      },
    });

    return {
      updatedBooking: booking.status === BookingStatus.PENDING,
    };
  });

  return {
    handled: true,
    confirmed: true,
    action: "CONFIRM",
    bookingId: targetBooking.id,
    responseMessage: transactionResult.updatedBooking
      ? settings.confirmMessage
      : "Seu agendamento ja estava confirmado.",
  };
}
