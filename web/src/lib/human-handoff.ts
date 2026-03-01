import {
  arePhonesEquivalent,
  buildPhoneComparableDigits,
  normalizeIncomingPhone,
} from "@/lib/n8n-phone";
import { prisma } from "@/lib/prisma";

export type HandoffMode = "BOT" | "HUMAN";

interface HandoffRow {
  phone: string;
  mode: string;
  reason: string | null;
  assigned_agent: string | null;
  opened_at: Date | string | null;
  closed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface ActiveHandoffRow extends HandoffRow {
  unread_count: bigint | number;
}

export interface HandoffStatus {
  phone: string;
  mode: HandoffMode;
  reason: string | null;
  assignedAgent: string | null;
  openedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveHumanHandoffItem {
  phone: string;
  mode: HandoffMode;
  reason: string | null;
  assignedAgent: string | null;
  openedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  patient: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
  } | null;
  unreadCount: number;
}

interface SetHandoffModeInput {
  rawPhone: unknown;
  mode: HandoffMode;
  reason?: string | null;
  actor?: string | null;
  assignedAgent?: string | null;
}

function toIso(value: Date | string | null) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function normalizeMode(mode: string | null | undefined): HandoffMode | null {
  if (mode === "BOT" || mode === "HUMAN") return mode;
  return null;
}

function normalizeOptionalText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

function scorePatientMatch(inputDigits: string, patientPhone: string) {
  const normalizedInput = normalizeDigits(inputDigits);
  const inputComparables = buildPhoneComparableDigits(normalizedInput);
  const patientComparables = new Set(buildPhoneComparableDigits(patientPhone));

  if (patientComparables.has(normalizedInput)) return 3;
  if (inputComparables.some((value) => patientComparables.has(value))) return 2;
  if (arePhonesEquivalent(normalizedInput, patientPhone)) return 1;
  return 0;
}

async function findBestPatientForPhone(phone: string) {
  const comparableDigits = buildPhoneComparableDigits(phone);
  const whereCandidates = comparableDigits.map((digits) => ({
    phone: { contains: digits },
  }));

  const candidates = await prisma.patient.findMany({
    where: {
      OR:
        whereCandidates.length > 0
          ? whereCandidates
          : [{ phone: { contains: phone } }],
    },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
    },
    take: 20,
  });

  const bestMatch = candidates
    .map((candidate) => ({
      candidate,
      score: scorePatientMatch(phone, candidate.phone),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0];

  return bestMatch?.candidate ?? null;
}

function mapRow(row: HandoffRow): HandoffStatus {
  const mode = normalizeMode(row.mode) || "BOT";
  return {
    phone: row.phone,
    mode,
    reason: row.reason,
    assignedAgent: row.assigned_agent,
    openedAt: toIso(row.opened_at),
    closedAt: toIso(row.closed_at),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
  };
}

async function getHandoffStatusByNormalizedPhone(
  normalizedPhone: string,
): Promise<HandoffStatus | null> {
  const rows = await prisma.$queryRaw<HandoffRow[]>`
    SELECT
      phone,
      mode,
      reason,
      assigned_agent,
      opened_at,
      closed_at,
      created_at,
      updated_at
    FROM bot_handoff_sessions
    WHERE phone = ${normalizedPhone}
    LIMIT 1
  `;

  const row = rows[0];
  if (!row) return null;
  return mapRow(row);
}

export async function getHandoffStatus(rawPhone: unknown) {
  const normalizedPhone = normalizeIncomingPhone(rawPhone);
  if (!normalizedPhone) return null;
  return getHandoffStatusByNormalizedPhone(normalizedPhone);
}

export async function isHumanHandoffActive(rawPhone: unknown) {
  const status = await getHandoffStatus(rawPhone);
  return status?.mode === "HUMAN";
}

export async function setHandoffMode(input: SetHandoffModeInput) {
  const normalizedPhone = normalizeIncomingPhone(input.rawPhone);
  if (!normalizedPhone) {
    throw new Error(
      "Telefone invalido. Envie em number/phone/remoteJid/to (somente WhatsApp).",
    );
  }

  const reason = normalizeOptionalText(input.reason, 1000);
  const actor = normalizeOptionalText(input.actor, 120);
  const assignedAgent = normalizeOptionalText(input.assignedAgent, 120);
  const keepAssignedOnHumanUpdate = assignedAgent === null;

  return prisma.$transaction(async (tx) => {
    const previousRows = await tx.$queryRaw<HandoffRow[]>`
      SELECT
        phone,
        mode,
        reason,
        assigned_agent,
        opened_at,
        closed_at,
        created_at,
        updated_at
      FROM bot_handoff_sessions
      WHERE phone = ${normalizedPhone}
      LIMIT 1
    `;

    const previousMode = normalizeMode(previousRows[0]?.mode);

    if (input.mode === "HUMAN") {
      await tx.$executeRaw`
        INSERT INTO bot_handoff_sessions (
          phone,
          mode,
          reason,
          assigned_agent,
          opened_at,
          closed_at,
          created_at,
          updated_at
        )
        VALUES (
          ${normalizedPhone},
          'HUMAN',
          ${reason},
          ${assignedAgent},
          NOW(),
          NULL,
          NOW(),
          NOW()
        )
        ON CONFLICT (phone) DO UPDATE
        SET
          mode = 'HUMAN',
          reason = ${reason},
          assigned_agent = CASE
            WHEN bot_handoff_sessions.mode = 'HUMAN' AND ${keepAssignedOnHumanUpdate} THEN bot_handoff_sessions.assigned_agent
            ELSE ${assignedAgent}
          END,
          opened_at = CASE
            WHEN bot_handoff_sessions.mode = 'HUMAN' THEN bot_handoff_sessions.opened_at
            ELSE NOW()
          END,
          closed_at = NULL,
          updated_at = NOW()
      `;
    } else {
      await tx.$executeRaw`
        INSERT INTO bot_handoff_sessions (
          phone,
          mode,
          reason,
          assigned_agent,
          opened_at,
          closed_at,
          created_at,
          updated_at
        )
        VALUES (
          ${normalizedPhone},
          'BOT',
          ${reason},
          ${assignedAgent},
          NULL,
          NOW(),
          NOW(),
          NOW()
        )
        ON CONFLICT (phone) DO UPDATE
        SET
          mode = 'BOT',
          reason = ${reason},
          assigned_agent = ${assignedAgent},
          closed_at = NOW(),
          updated_at = NOW()
      `;
    }

    await tx.$executeRaw`
      INSERT INTO bot_handoff_events (
        phone,
        previous_mode,
        next_mode,
        reason,
        actor,
        assigned_agent
      )
      VALUES (
        ${normalizedPhone},
        ${previousMode},
        ${input.mode},
        ${reason},
        ${actor},
        ${assignedAgent}
      )
    `;

    const currentRows = await tx.$queryRaw<HandoffRow[]>`
      SELECT
        phone,
        mode,
        reason,
        assigned_agent,
        opened_at,
        closed_at,
        created_at,
        updated_at
      FROM bot_handoff_sessions
      WHERE phone = ${normalizedPhone}
      LIMIT 1
    `;

    const currentRow = currentRows[0];
    if (!currentRow) {
      throw new Error("Falha ao persistir handoff humano.");
    }

    return mapRow(currentRow);
  });
}

export async function countActiveHumanHandoffs() {
  const rows = await prisma.$queryRaw<Array<{ total: bigint | number }>>`
    SELECT COUNT(*)::bigint AS total
    FROM bot_handoff_sessions
    WHERE mode = 'HUMAN'
  `;

  const rawValue = rows[0]?.total;
  if (typeof rawValue === "bigint") return Number(rawValue);
  if (typeof rawValue === "number") return rawValue;
  return 0;
}

export async function listActiveHumanHandoffs(
  limit = 200,
): Promise<ActiveHumanHandoffItem[]> {
  const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
  const rows = await prisma.$queryRaw<ActiveHandoffRow[]>`
    SELECT
      s.phone,
      s.mode,
      s.reason,
      s.assigned_agent,
      s.opened_at,
      s.closed_at,
      s.created_at,
      s.updated_at,
      COALESCE((
        SELECT COUNT(*)::bigint
        FROM bot_handoff_messages m
        WHERE m.phone = s.phone
          AND m.direction = 'INBOUND'
          AND m.read_at IS NULL
      ), 0) AS unread_count
    FROM bot_handoff_sessions s
    WHERE s.mode = 'HUMAN'
    ORDER BY COALESCE(opened_at, updated_at) DESC
    LIMIT ${safeLimit}
  `;

  const baseItems = rows
    .map((row) => mapRow(row))
    .filter((item) => item.mode === "HUMAN");

  const unreadByPhone = new Map<string, number>(
    rows.map((row) => [
      row.phone,
      typeof row.unread_count === "bigint"
        ? Number(row.unread_count)
        : typeof row.unread_count === "number"
          ? row.unread_count
          : 0,
    ]),
  );

  const patients = await Promise.all(
    baseItems.map((item) => findBestPatientForPhone(item.phone)),
  );

  return baseItems.map((item, index) => ({
    ...item,
    unreadCount: unreadByPhone.get(item.phone) ?? 0,
    patient: patients[index]
      ? {
          id: patients[index].id,
          name: patients[index].name,
          phone: patients[index].phone,
          email: patients[index].email,
        }
      : null,
  }));
}
