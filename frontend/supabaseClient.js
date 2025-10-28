import { createClient } from '@supabase/supabase-js';

// Resolve environment variables for different environments (Vite or plain pages)
const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL)
  ? import.meta.env.VITE_SUPABASE_URL
  : (window.SUPABASE_URL || null);

const supabaseKey = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_KEY)
  ? import.meta.env.VITE_SUPABASE_KEY
  : (window.SUPABASE_KEY || null);

if (!supabaseUrl || !supabaseKey) {
  console.warn('SUPABASE_URL or SUPABASE_KEY not found in env. Make sure to set VITE_SUPABASE_URL / VITE_SUPABASE_KEY or window.SUPABASE_URL / window.SUPABASE_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Also expose globally for non-module pages (so inline scripts can use `window.supabase`)
if (typeof window !== 'undefined') window.supabase = supabase;

export async function getSession() {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return { session: null, error };
    return { session: data.session, error: null };
  } catch (e) {
    return { session: null, error: e };
  }
}
