import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "../server-env";

export function createServiceRoleSupabaseClient() {
  const serverEnv = getServerEnv();
  return createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createAnonSupabaseClient() {
  const serverEnv = getServerEnv();
  return createClient(serverEnv.supabaseUrl, serverEnv.supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
