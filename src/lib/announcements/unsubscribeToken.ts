import { createHmac, timingSafeEqual } from "crypto";

// Lightweight signed token for one-click unsubscribe. We HMAC the userId
// with NEXTAUTH_SECRET so the token cannot be forged. The token has no
// expiry because unsubscribe is idempotent and should work forever once
// a user clicks it from an old email.

const SECRET = process.env.NEXTAUTH_SECRET ?? "";

export function signUnsubscribeToken(userId: string): string {
  if (!SECRET) throw new Error("NEXTAUTH_SECRET not set");
  const sig = createHmac("sha256", SECRET).update(userId).digest("hex");
  return `${Buffer.from(userId).toString("base64url")}.${sig}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  if (!SECRET || !token) return null;
  const [encUserId, sig] = token.split(".");
  if (!encUserId || !sig) return null;
  let userId: string;
  try {
    userId = Buffer.from(encUserId, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = createHmac("sha256", SECRET).update(userId).digest("hex");
  const sigBuf = Buffer.from(sig, "hex");
  const expectedBuf = Buffer.from(expected, "hex");
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null;
  return userId;
}
