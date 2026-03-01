export type EvolutionPresence = "composing" | "recording" | "paused";

export interface EvolutionSendMessageOptions {
  delay: number;
  presence: EvolutionPresence;
}

const DEFAULT_DELAY_MS = 1800;
const MAX_DELAY_MS = 30_000;
const ALLOWED_PRESENCE = new Set<EvolutionPresence>([
  "composing",
  "recording",
  "paused",
]);

function parseRecord(input: unknown) {
  if (!input || typeof input !== "object") return null;
  return input as Record<string, unknown>;
}

function normalizeDelay(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.min(MAX_DELAY_MS, Math.round(value)));
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.min(MAX_DELAY_MS, Math.round(parsed)));
    }
  }

  return null;
}

function normalizePresence(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase() as EvolutionPresence;
  if (!ALLOWED_PRESENCE.has(normalized)) return null;
  return normalized;
}

export function resolveEvolutionSendOptions(
  body: unknown,
): EvolutionSendMessageOptions | undefined {
  const payload = parseRecord(body);
  if (!payload) {
    return { delay: DEFAULT_DELAY_MS, presence: "composing" };
  }

  const options = parseRecord(payload.options);

  const disableTyping =
    payload.disableTyping === true || payload.typingEnabled === false;
  if (disableTyping) return undefined;

  const resolvedDelay =
    normalizeDelay(payload.typingDelayMs) ??
    normalizeDelay(payload.delayMs) ??
    normalizeDelay(options?.delay) ??
    DEFAULT_DELAY_MS;

  const resolvedPresence =
    normalizePresence(payload.typingPresence) ??
    normalizePresence(payload.presence) ??
    normalizePresence(options?.presence) ??
    "composing";

  return {
    delay: resolvedDelay,
    presence: resolvedPresence,
  };
}
