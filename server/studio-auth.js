/* global process, Buffer */
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const studioOrigin = "https://chinesesatellite.art";
export const callbackUrl = `${studioOrigin}/api/studio-auth`;
export const studioUrl = `${studioOrigin}/#/studio`;
export const sessionCookie = "__Host-csa-studio";
export const oauthCookie = "__Host-csa-oauth";
const cookieOptions = "Path=/; HttpOnly; Secure; SameSite=Lax";

export function authConfig() {
  const clientId = process.env.STUDIO_GITHUB_CLIENT_ID;
  const clientSecret = process.env.STUDIO_GITHUB_CLIENT_SECRET;
  const keyHex = process.env.STUDIO_SESSION_KEY || "";
  if (!clientId || !clientSecret || !/^[a-f0-9]{64}$/i.test(keyHex)) return null;
  return { clientId, clientSecret, key: Buffer.from(keyHex, "hex") };
}

export function secret() {
  return randomBytes(32).toString("base64url");
}

export function challenge(verifier) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function secureEquals(a, b) {
  const left = Buffer.from(a || "");
  const right = Buffer.from(b || "");
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}

export function seal(key, purpose, data) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(purpose));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  return Buffer.concat([nonce, cipher.getAuthTag(), ciphertext]).toString("base64url");
}

export function unseal(key, purpose, sealed) {
  if (typeof sealed !== "string" || !sealed || sealed.length > 4000) return null;
  try {
    const bytes = Buffer.from(sealed, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from(purpose));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const plaintext = Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]);
    const data = JSON.parse(plaintext.toString("utf8"));
    return Number.isFinite(data.expires) && data.expires > Date.now() ? data : null;
  } catch {
    return null;
  }
}

export function cookieValue(request, name) {
  const cookie = request.headers.get("cookie")?.split(";").find((item) => item.trimStart().startsWith(`${name}=`));
  return cookie?.trimStart().slice(name.length + 1);
}

export function sessionFor(request, config) {
  if (!config) return null;
  return unseal(config.key, sessionCookie, cookieValue(request, sessionCookie));
}

export function setCookie(name, value = "", maxAge = 0) {
  return `${name}=${value}; Max-Age=${maxAge}; ${cookieOptions}`;
}

export function studioHeaders() {
  return new Headers({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" });
}

export function studioJson(data, status = 200) {
  return Response.json(data, { status, headers: studioHeaders() });
}
