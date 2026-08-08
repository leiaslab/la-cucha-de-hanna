export const APP_SESSION_COOKIE = "pepshop_session";
const FALLBACK_USERNAME = "admin";
// Contraseña de acceso inicial — debe cambiarse en el primer uso
const FALLBACK_PASSWORD = "12345678";
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

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 4) return "La clave debe tener al menos 4 caracteres.";
  return null;
}

export function getFallbackAdminUser() {
  const credentials = getFallbackAdminCredentials();

  return {
    id: null,
    username: credentials.username,
    fullName: FALLBACK_FULL_NAME,
    role: "admin" as const,
    localId: null,
    localName: "General",
    source: "fallback" as const,
  };
}
