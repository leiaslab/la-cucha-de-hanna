export const APP_SESSION_COOKIE = "pepshop_session";

export function getAppLoginCredentials() {
  const username = process.env.APP_LOGIN_USERNAME;
  const password = process.env.APP_LOGIN_PASSWORD;

  if (!username || !password) {
    throw new Error(
      "Faltan APP_LOGIN_USERNAME y APP_LOGIN_PASSWORD para habilitar el acceso con clave.",
    );
  }

  return {
    username: username.trim(),
    password: password.trim(),
  };
}
