import "server-only";
import crypto from "crypto";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { authSecret } from "./request";

authenticator.options = { window: 1 };

function key() {
  return crypto.createHash("sha256").update(`totp:${authSecret()}`).digest();
}

// TOTP secrets are encrypted at rest with AES-256-GCM.
export function sealSecret(secret: string) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(secret, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

export function openSecret(sealed: string) {
  const [iv, tag, enc] = sealed.split(".").map((s) => Buffer.from(s, "base64url"));
  const d = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

export function newSecret() {
  return authenticator.generateSecret();
}

export function verifyTotp(code: string, secret: string) {
  return authenticator.check(code.replace(/\s/g, ""), secret);
}

export async function totpQrDataUrl(email: string, secret: string) {
  const uri = authenticator.keyuri(email, "Lord Erroll Feedback", secret);
  return QRCode.toDataURL(uri, { margin: 1, width: 220, color: { dark: "#1F2421", light: "#FAF5EA" } });
}
