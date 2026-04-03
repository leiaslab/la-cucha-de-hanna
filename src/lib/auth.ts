export const APP_SESSION_COOKIE = "pepshop_session";
const FALLBACK_USERNAME = "admin";
const FALLBACK_PASSWORD = "0345";
const FALLBACK_FULL_NAME = "Administrador";

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function getFallbackAdminCredentials() {
  const username = process.env.APP_LOGIN_USERNAME ?? FALLBACK_USERNAME;
  const password = process.env.APP_LOGIN_PASSWORD ?? FALLBACK_PASSWORD;

  return {
    username: normalizeUsername(username),
    password: password.trim(),
  };
}

export function getFallbackAdminUser() {
  const credentials = getFallbackAdminCredentials();

  return {
    id: null,
    username: credentials.username,
    fullName: FALLBACK_FULL_NAME,
    role: "admin" as const,
    source: "fallback" as const,
  };
}
