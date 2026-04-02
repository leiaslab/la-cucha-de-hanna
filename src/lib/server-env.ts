import "server-only";

function readEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? (fallback ? process.env[fallback] : undefined);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getServerEnv() {
  return {
    supabaseUrl: readEnv("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
    supabaseAnonKey: readEnv("SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    supabaseServiceRoleKey: readEnv("SUPABASE_SERVICE_ROLE_KEY"),
    googleDriveClientEmail: readEnv("GOOGLE_DRIVE_CLIENT_EMAIL"),
    googleDrivePrivateKey: readEnv("GOOGLE_DRIVE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    googleDriveParentFolderId: process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID,
  };
}
