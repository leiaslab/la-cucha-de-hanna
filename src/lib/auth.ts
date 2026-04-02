export const APP_SESSION_COOKIE = "pepshop_session";
const FALLBACK_USERNAME = "admin";
const FALLBACK_PASSWORD = "0345";

export function getAppLoginCredentials() {
  const username = process.env.APP_LOGIN_USERNAME ?? FALLBACK_USERNAME;
  const password = process.env.APP_LOGIN_PASSWORD ?? FALLBACK_PASSWORD;

  return {
    username: username.trim(),
    password: password.trim(),
  };
}
