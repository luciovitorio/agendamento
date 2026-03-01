export interface BookingReminderRule {
  id: string;
  offsetHours: number;
  messageTemplate: string;
  requireConfirmation: boolean;
}

export interface ReminderTemplateContext {
  patientName: string;
  professionalName: string;
  serviceName: string;
  bookingDateLabel: string;
  bookingTime: string;
}

const REMINDER_MIN_HOURS = 1;
const REMINDER_MAX_HOURS = 24 * 30;
const REMINDER_MAX_RULES = 8;
const TEMPLATE_MAX_LENGTH = 1000;

export const REMINDER_CONFIRMATION_INSTRUCTION =
  "Responda CONFIRMAR para confirmar este agendamento.";
export const REMINDER_CONFIRMATION_NUMERIC_INSTRUCTION =
  "Responda com:\n1 - Confirmar\n2 - Cancelar/Remarcar";

export const DEFAULT_BOOKING_REMINDER_RULES: BookingReminderRule[] = [
  {
    id: "reminder-72h",
    offsetHours: 72,
    messageTemplate:
      "Ola, [nome]!\n\nEste e um lembrete da sua consulta.\n\nMedico(a): [profissional]\nEspecialidade: [servico]\nData: [data] as [hora].",
    requireConfirmation: false,
  },
  {
    id: "reminder-24h",
    offsetHours: 24,
    messageTemplate:
      "Ola, [nome]!\n\nSua consulta esta marcada para [data] as [hora].\n\nMedico(a): [profissional]\nEspecialidade: [servico]",
    requireConfirmation: false,
  },
  {
    id: "reminder-4h",
    offsetHours: 4,
    messageTemplate:
      "Ola, [nome]!\n\nSua consulta sera hoje, [data], as [hora].\n\nMedico(a): [profissional]\nEspecialidade: [servico]\n\nPosso confirmar sua presenca?\n[confirmacao]",
    requireConfirmation: true,
  },
];

function normalizeRuleId(value: unknown, fallbackIndex: number) {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized) return normalized.slice(0, 64);
  }
  return `reminder-${fallbackIndex + 1}`;
}

function normalizeTemplate(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("Cada mensagem de lembrete precisa ser um texto.");
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new Error("Cada mensagem de lembrete precisa ser preenchida.");
  }

  if (normalized.length > TEMPLATE_MAX_LENGTH) {
    throw new Error(
      `Cada mensagem de lembrete suporta no maximo ${TEMPLATE_MAX_LENGTH} caracteres.`,
    );
  }

  return normalized;
}

function normalizeOffsetHours(value: unknown) {
  const raw =
    typeof value === "string"
      ? Number.parseInt(value, 10)
      : typeof value === "number"
        ? value
        : Number.NaN;
  const normalized = Math.trunc(raw);

  if (!Number.isFinite(normalized)) {
    throw new Error("Cada lembrete deve ter uma quantidade de horas valida.");
  }

  if (normalized < REMINDER_MIN_HOURS || normalized > REMINDER_MAX_HOURS) {
    throw new Error(
      `Cada lembrete deve estar entre ${REMINDER_MIN_HOURS} e ${REMINDER_MAX_HOURS} horas.`,
    );
  }

  return normalized;
}

function normalizeRequireConfirmation(value: unknown) {
  return !!value;
}

export function normalizeBookingReminderRules(
  rawRules: unknown,
): BookingReminderRule[] {
  const source = Array.isArray(rawRules) ? rawRules : [];
  if (source.length === 0) {
    return [];
  }
  const normalizedRules: BookingReminderRule[] = [];
  const usedOffsets = new Set<number>();

  for (let index = 0; index < source.length; index += 1) {
    const entry = source[index];
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const record = entry as Record<string, unknown>;
    const offsetHours = normalizeOffsetHours(record.offsetHours);
    if (usedOffsets.has(offsetHours)) {
      throw new Error(
        `Os lembretes nao podem repetir o mesmo horario (${offsetHours}h).`,
      );
    }
    usedOffsets.add(offsetHours);

    normalizedRules.push({
      id: normalizeRuleId(record.id, index),
      offsetHours,
      messageTemplate: normalizeTemplate(record.messageTemplate),
      requireConfirmation: normalizeRequireConfirmation(
        record.requireConfirmation,
      ),
    });
  }

  if (normalizedRules.length > REMINDER_MAX_RULES) {
    throw new Error(
      `Voce pode configurar no maximo ${REMINDER_MAX_RULES} lembretes.`,
    );
  }

  return normalizedRules.sort((a, b) => b.offsetHours - a.offsetHours);
}

export function parseBookingReminderRules(rawJson: string | null | undefined) {
  if (!rawJson?.trim()) {
    return DEFAULT_BOOKING_REMINDER_RULES.map((rule) => ({ ...rule }));
  }

  try {
    const parsed = JSON.parse(rawJson);
    return normalizeBookingReminderRules(parsed);
  } catch {
    return DEFAULT_BOOKING_REMINDER_RULES.map((rule) => ({ ...rule }));
  }
}

export function serializeBookingReminderRules(rules: BookingReminderRule[]) {
  return JSON.stringify(normalizeBookingReminderRules(rules));
}

function applyToken(
  value: string,
  tokenPattern: RegExp,
  replacement: string,
): string {
  return value.replace(tokenPattern, replacement);
}

function replaceTemplateToken(
  value: string,
  token: string,
  replacement: string,
): string {
  // Keep compatibility with both [token] and {token}.
  const pattern = new RegExp(`\\[${token}\\]|\\{${token}\\}`, "gi");
  return applyToken(value, pattern, replacement);
}

export function renderBookingReminderMessage(
  template: string,
  context: ReminderTemplateContext,
  requireConfirmation: boolean,
  confirmationInstruction?: string,
) {
  let output = template;

  output = replaceTemplateToken(output, "nome_paciente", context.patientName);
  output = replaceTemplateToken(output, "nome", context.patientName);
  output = replaceTemplateToken(output, "paciente", context.patientName);
  output = replaceTemplateToken(output, "profissional", context.professionalName);
  output = replaceTemplateToken(output, "servico", context.serviceName);
  output = replaceTemplateToken(output, "data", context.bookingDateLabel);
  output = replaceTemplateToken(output, "hora", context.bookingTime);

  const confirmationText = requireConfirmation
    ? confirmationInstruction || REMINDER_CONFIRMATION_INSTRUCTION
    : "";
  output = replaceTemplateToken(output, "confirmacao", confirmationText);

  if (requireConfirmation && !/(\[confirmacao\]|\{confirmacao\})/i.test(template)) {
    output = `${output}\n\n${confirmationText}`;
  }

  return output.trim();
}

function normalizeIncomingMessageForMatching(message: string) {
  return message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CONFIRMATION_KEYWORDS = new Set([
  "confirmar",
  "confirmo",
  "confirmado",
  "sim",
  "ok",
  "1",
]);

export function isBookingReminderConfirmationMessage(message: string) {
  const normalized = normalizeIncomingMessageForMatching(message);
  if (!normalized) return false;
  return CONFIRMATION_KEYWORDS.has(normalized);
}

const CANCEL_OR_RESCHEDULE_KEYWORDS = new Set([
  "2",
  "cancelar",
  "cancelar remarcar",
  "cancelar_remarcar",
  "remarcar",
  "reagendar",
]);

export function isBookingReminderCancelOrRescheduleMessage(message: string) {
  const normalized = normalizeIncomingMessageForMatching(message);
  if (!normalized) return false;
  return CANCEL_OR_RESCHEDULE_KEYWORDS.has(normalized);
}
