function stripRemoteJidSuffix(value: string) {
  return value.replace(/@s\.whatsapp\.net$/i, "").replace(/@c\.us$/i, "");
}

export function normalizeIncomingPhone(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = stripRemoteJidSuffix(value.trim());
  if (!normalized) return null;
  let digits = normalized.replace(/\D/g, "");
  if (!digits) return null;

  // BR: WhatsApp envia com DDI 55 (ex: 5521993940772), mas o sistema
  // armazena apenas DDD+número (ex: 21993940772).
  if (digits.startsWith("55") && digits.length >= 12 && digits.length <= 13) {
    digits = digits.slice(2);
  }

  return digits;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function buildPhoneComparableDigits(rawDigits: string) {
  const digits = rawDigits.replace(/\D/g, "");
  if (!digits) return [];

  const comparables = [digits];

  // BR: também compara versões com e sem DDI 55 para evitar desencontro de formato.
  if (digits.startsWith("55") && digits.length > 11) {
    comparables.push(digits.slice(2));
  }

  if (digits.length >= 10 && digits.length <= 11) {
    comparables.push(`55${digits}`);
  }

  return unique(comparables);
}

export function arePhonesEquivalent(a: string, b: string) {
  const aComparables = buildPhoneComparableDigits(a);
  const bComparables = new Set(buildPhoneComparableDigits(b));
  return aComparables.some((candidate) => bComparables.has(candidate));
}
