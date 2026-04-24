import { createHmac, timingSafeEqual } from "crypto";

// HMAC-signed password reset token. We bind the signature to
// passwordSetAt so any previously-issued token is auto-invalidated the
// moment the user successfully resets their password. That gives us
// single-use semantics without a DB table.
//
// Payload: userId . passwordSetAtEpochMs . expEpochMs . sig
// All segments base64url so dots are safe.

const SECRET = process.env.NEXTAUTH_SECRET ?? "";
const TTL_MS = 60 * 60 * 1000; // 60 minutes

function b64(s: string): string {
  return Buffer.from(s).toString("base64url");
}
function b64d(s: string): string {
  return Buffer.from(s, "base64url").toString("utf8");
}

export function signPasswordResetToken(
  userId: string,
  passwordSetAt: Date | null,
  now: number = Date.now()
): string {
  if (!SECRET) throw new Error("NEXTAUTH_SECRET not set");
  const exp = now + TTL_MS;
  const stamp = passwordSetAt ? passwordSetAt.getTime() : 0;
  const payload = `${userId}:${stamp}:${exp}`;
  const sig = createHmac("sha256", SECRET).update(payload).digest("hex");
  return `${b64(userId)}.${stamp}.${exp}.${sig}`;
}

type VerifyResult =
  | { ok: true; userId: string; stamp: number }
  | { ok: false; reason: "malformed" | "expired" | "bad_signature" };

export function verifyPasswordResetToken(token: string): VerifyResult {
  if (!SECRET || !token) return { ok: false, reason: "malformed" };
  const parts = token.split(".");
  if (parts.length !== 4) return { ok: false, reason: "malformed" };
  const [encUserId, stampStr, expStr, sig] = parts;
  let userId: string;
  try {
    userId = b64d(encUserId);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const stamp = Number(stampStr);
  const exp = Number(expStr);
  if (!Number.isFinite(stamp) || !Number.isFinite(exp)) {
    return { ok: false, reason: "malformed" };
  }
  if (Date.now() > exp) return { ok: false, reason: "expired" };
  const expected = createHmac("sha256", SECRET)
    .update(`${userId}:${stamp}:${exp}`)
    .digest("hex");
  const sigBuf = Buffer.from(sig, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expectedBuf.length) {
    return { ok: false, reason: "bad_signature" };
  }
  if (!timingSafeEqual(sigBuf, expectedBuf)) {
    return { ok: false, reason: "bad_signature" };
  }
  return { ok: true, userId, stamp };
}
