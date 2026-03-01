import { normalizeIncomingPhone } from "@/lib/n8n-phone";
import { prisma } from "@/lib/prisma";

export type HandoffMessageDirection = "INBOUND" | "OUTBOUND";

interface HandoffMessageRow {
  id: bigint | number;
  phone: string;
  direction: string;
  content: string;
  content_type: string;
  sender_user_id: string | null;
  sender_name: string | null;
  read_at: Date | string | null;
  created_at: Date | string;
}

export interface HandoffChatMessage {
  id: string;
  phone: string;
  direction: HandoffMessageDirection;
  content: string;
  contentType: string;
  senderUserId: string | null;
  senderName: string | null;
  readAt: string | null;
  createdAt: string;
}

interface AddHandoffMessageInput {
  rawPhone: unknown;
  direction: HandoffMessageDirection;
  content: string;
  senderUserId?: string | null;
  senderName?: string | null;
}

function toIso(value: Date | string | null) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function normalizeMessageContent(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error("Mensagem vazia.");
  }
  return normalized.slice(0, 4000);
}

function mapRow(row: HandoffMessageRow): HandoffChatMessage {
  return {
    id: typeof row.id === "bigint" ? row.id.toString() : String(row.id),
    phone: row.phone,
    direction: row.direction === "OUTBOUND" ? "OUTBOUND" : "INBOUND",
    content: row.content,
    contentType: row.content_type || "text",
    senderUserId: row.sender_user_id,
    senderName: row.sender_name,
    readAt: toIso(row.read_at),
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
  };
}

async function addHandoffMessage(input: AddHandoffMessageInput) {
  const normalizedPhone = normalizeIncomingPhone(input.rawPhone);
  if (!normalizedPhone) {
    throw new Error("Telefone invalido para mensagem de handoff.");
  }

  const content = normalizeMessageContent(input.content);
  const readAt = input.direction === "OUTBOUND" ? new Date() : null;

  const rows = await prisma.$queryRaw<HandoffMessageRow[]>`
    INSERT INTO bot_handoff_messages (
      phone,
      direction,
      content,
      content_type,
      sender_user_id,
      sender_name,
      read_at
    )
    VALUES (
      ${normalizedPhone},
      ${input.direction},
      ${content},
      'text',
      ${input.senderUserId || null},
      ${input.senderName || null},
      ${readAt}
    )
    RETURNING
      id,
      phone,
      direction,
      content,
      content_type,
      sender_user_id,
      sender_name,
      read_at,
      created_at
  `;

  const row = rows[0];
  if (!row) {
    throw new Error("Falha ao registrar mensagem de handoff.");
  }

  return mapRow(row);
}

export async function addInboundHandoffMessage(rawPhone: unknown, content: string) {
  return addHandoffMessage({
    rawPhone,
    direction: "INBOUND",
    content,
  });
}

export async function addOutboundHandoffMessage(input: {
  rawPhone: unknown;
  content: string;
  senderUserId?: string | null;
  senderName?: string | null;
}) {
  return addHandoffMessage({
    rawPhone: input.rawPhone,
    direction: "OUTBOUND",
    content: input.content,
    senderUserId: input.senderUserId,
    senderName: input.senderName,
  });
}

export async function listHandoffMessages(rawPhone: unknown, limit = 200) {
  const normalizedPhone = normalizeIncomingPhone(rawPhone);
  if (!normalizedPhone) {
    throw new Error("Telefone invalido para listar mensagens.");
  }

  const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
  const rows = await prisma.$queryRaw<HandoffMessageRow[]>`
    SELECT
      id,
      phone,
      direction,
      content,
      content_type,
      sender_user_id,
      sender_name,
      read_at,
      created_at
    FROM bot_handoff_messages
    WHERE phone = ${normalizedPhone}
    ORDER BY created_at ASC
    LIMIT ${safeLimit}
  `;

  return rows.map((row) => mapRow(row));
}

export async function markInboundHandoffMessagesAsRead(rawPhone: unknown) {
  const normalizedPhone = normalizeIncomingPhone(rawPhone);
  if (!normalizedPhone) {
    throw new Error("Telefone invalido para marcar mensagens como lidas.");
  }

  const rows = await prisma.$queryRaw<Array<{ total: bigint | number }>>`
    WITH updated AS (
      UPDATE bot_handoff_messages
      SET read_at = NOW()
      WHERE phone = ${normalizedPhone}
        AND direction = 'INBOUND'
        AND read_at IS NULL
      RETURNING 1
    )
    SELECT COUNT(*)::bigint AS total FROM updated
  `;

  const total = rows[0]?.total;
  if (typeof total === "bigint") return Number(total);
  if (typeof total === "number") return total;
  return 0;
}
