import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables. Check backend/.env.');
}

const baseAuthOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
};

export function createSupabaseAuthClient() {
  return createClient(supabaseUrl, supabaseAnonKey, baseAuthOptions);
}

export function createSupabaseUserClient(accessToken) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    ...baseAuthOptions,
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  });
}

export const supabaseAdminClient = createClient(supabaseUrl, supabaseServiceRoleKey, baseAuthOptions);
