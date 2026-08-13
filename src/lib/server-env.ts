import "server-only";

function readEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? (fallback ? process.env[fallback] : undefined);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readOptionalEnv(name: string, fallback?: string) {
  return process.env[name] ?? (fallback ? process.env[fallback] : undefined);
}

export function getServerEnv() {
  return {
    supabaseUrl: readEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
    supabaseServiceRoleKey: readEnv("SUPABASE_SERVICE_ROLE_KEY"),
    googleDriveClientEmail: readEnv("GOOGLE_DRIVE_CLIENT_EMAIL"),
    googleDrivePrivateKey: readEnv("GOOGLE_DRIVE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    googleDriveParentFolderId: process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID,
  };
}

export function getTicketEmailEnv() {
  return {
    resendApiKey: readOptionalEnv("RESEND_API_KEY"),
    mailFrom: readOptionalEnv("MAIL_FROM", "RESEND_FROM_EMAIL"),
  };
}
