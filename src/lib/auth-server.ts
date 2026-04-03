import "server-only";

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { APP_SESSION_COOKIE, getFallbackAdminCredentials, getFallbackAdminUser } from "./auth";
import type { SessionUser } from "./pos-types";

type SessionEnvelope = {
  exp: number;
  user: SessionUser;
  v: 1;
};

function toBase64Url(value: Buffer | string) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(`${normalized}${"=".repeat(padding)}`, "base64");
}

function getSessionSecret() {
  return (
    process.env.APP_SESSION_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.APP_LOGIN_PASSWORD ||
    "pepshop-dev-session-secret"
  );
}

function signValue(value: string) {
  return toBase64Url(createHmac("sha256", getSessionSecret()).update(value).digest());
}

export function createSessionToken(user: SessionUser) {
  const payload: SessionEnvelope = {
    v: 1,
    exp: Date.now() + 1000 * 60 * 60 * 12,
    user,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signValue(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function readSessionToken(token?: string | null) {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signValue(encodedPayload);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload).toString("utf8")) as SessionEnvelope;
    if (payload.v !== 1 || payload.exp <= Date.now()) {
      return null;
    }

    return payload.user;
  } catch {
    return null;
  }
}

export async function getCurrentSessionUser() {
  const cookieStore = await cookies();
  return readSessionToken(cookieStore.get(APP_SESSION_COOKIE)?.value);
}

export async function setCurrentSessionUser(user: SessionUser) {
  const cookieStore = await cookies();
  cookieStore.set(APP_SESSION_COOKIE, createSessionToken(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearCurrentSessionUser() {
  const cookieStore = await cookies();
  cookieStore.delete(APP_SESSION_COOKIE);
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, hash] = storedHash.split(":");

  if (algorithm !== "scrypt" || !salt || !hash) {
    return false;
  }

  const expectedBuffer = Buffer.from(hash, "hex");
  const providedBuffer = scryptSync(password, salt, expectedBuffer.length);

  return timingSafeEqual(providedBuffer, expectedBuffer);
}

export function authenticateFallbackAdmin(username: string, password: string) {
  const credentials = getFallbackAdminCredentials();

  if (username !== credentials.username || password.trim() !== credentials.password) {
    return null;
  }

  return getFallbackAdminUser();
}
