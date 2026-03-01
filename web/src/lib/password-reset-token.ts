import crypto from "crypto";

export type PasswordResetPurpose = "setup" | "recovery";

export interface PasswordResetTokenPayload {
  sub: string;
  purpose: PasswordResetPurpose;
  iat: number;
  exp: number;
  uv: number;
}

const TOKEN_VERSION = "v1";
const SETUP_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 2; // 48h
const RECOVERY_TOKEN_TTL_SECONDS = 60 * 60; // 1h

function getPasswordResetSecret(): string | null {
  return (
    process.env.PASSWORD_RESET_TOKEN_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET ||
    null
  );
}

function signPayload(payloadPart: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payloadPart).digest("base64url");
}

function safeCompare(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

function isValidPayload(value: unknown): value is PasswordResetTokenPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Partial<PasswordResetTokenPayload>;
  const validPurpose =
    payload.purpose === "setup" || payload.purpose === "recovery";

  return (
    typeof payload.sub === "string" &&
    validPurpose &&
    typeof payload.iat === "number" &&
    typeof payload.exp === "number" &&
    typeof payload.uv === "number"
  );
}

export function createPasswordResetToken({
  email,
  purpose,
  userVersionMs,
}: {
  email: string;
  purpose: PasswordResetPurpose;
  userVersionMs: number;
}): string {
  const secret = getPasswordResetSecret();
  if (!secret) {
    throw new Error(
      "Missing secret for password reset token. Configure PASSWORD_RESET_TOKEN_SECRET or NEXTAUTH_SECRET.",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const ttl =
    purpose === "setup" ? SETUP_TOKEN_TTL_SECONDS : RECOVERY_TOKEN_TTL_SECONDS;

  const payload: PasswordResetTokenPayload = {
    sub: email,
    purpose,
    iat: now,
    exp: now + ttl,
    uv: userVersionMs,
  };

  const payloadPart = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signaturePart = signPayload(payloadPart, secret);

  return `${TOKEN_VERSION}.${payloadPart}.${signaturePart}`;
}

export function verifyPasswordResetToken(token: string): {
  valid: boolean;
  payload?: PasswordResetTokenPayload;
} {
  const secret = getPasswordResetSecret();
  if (!secret) {
    return { valid: false };
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false };
  }

  const [versionPart, payloadPart, signaturePart] = parts;
  if (versionPart !== TOKEN_VERSION || !payloadPart || !signaturePart) {
    return { valid: false };
  }

  const expectedSignature = signPayload(payloadPart, secret);
  if (!safeCompare(expectedSignature, signaturePart)) {
    return { valid: false };
  }

  try {
    const decoded = Buffer.from(payloadPart, "base64url").toString("utf-8");
    const payload = JSON.parse(decoded) as unknown;

    if (!isValidPayload(payload)) {
      return { valid: false };
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return { valid: false };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}
