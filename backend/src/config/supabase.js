import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function assertSupabaseEnv() {
  const missing = [];
  if (!supabaseUrl) missing.push('SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('SUPABASE_ANON_KEY (or SUPABASE_KEY)');
  if (!supabaseServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');

  if (missing.length > 0) {
    throw new Error(`Missing Supabase environment variables: ${missing.join(', ')}`);
  }
}

const baseAuthOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
};

export function createSupabaseAuthClient() {
  assertSupabaseEnv();
  return createClient(supabaseUrl, supabaseAnonKey, baseAuthOptions);
}

export function createSupabaseUserClient(accessToken) {
  assertSupabaseEnv();
  return createClient(supabaseUrl, supabaseAnonKey, {
    ...baseAuthOptions,
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
}

assertSupabaseEnv();
export const supabaseAdminClient = createClient(supabaseUrl, supabaseServiceRoleKey, baseAuthOptions);
