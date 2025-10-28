// This module supports two environments:
// - Bundled (Vite / build): set VITE_SUPABASE_URL / VITE_SUPABASE_KEY and bundler will include @supabase/supabase-js
// - Unbundled static pages: the code will load the UMD bundle from CDN and create a client

// Resolve environment variables for different environments (Vite or plain pages)
const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_URL)
  ? import.meta.env.VITE_SUPABASE_URL
  : (typeof window !== 'undefined' ? window.SUPABASE_URL : null);

const supabaseKey = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_SUPABASE_KEY)
  ? import.meta.env.VITE_SUPABASE_KEY
  : (typeof window !== 'undefined' ? window.SUPABASE_KEY : null);

if (!supabaseUrl || !supabaseKey) {
  console.warn('SUPABASE_URL or SUPABASE_KEY not found in env. Set VITE_SUPABASE_URL / VITE_SUPABASE_KEY for builds or window.SUPABASE_URL / window.SUPABASE_KEY for static pages.');
}

let supabase = null;

// If a global UMD supabase exists (script tag or previous load), use it.
if (typeof window !== 'undefined' && window.supabase) {
  supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
} else {
  // For static pages without a bundler we load the UMD bundle from CDN.
  // Use top-level await so the module consumers can import `supabase` synchronously after load.
  // Note: top-level await is supported in modern browsers for type="module" scripts.
  try {
    // Try dynamic import first (works in bundled environments)
    // This will fail in an unbundled browser because bare specifiers aren't resolved.
    const mod = await import('@supabase/supabase-js').catch(() => null);
    if (mod && mod.createClient) {
      supabase = mod.createClient(supabaseUrl, supabaseKey);
    } else {
      // Fallback: inject UMD script from CDN and wait for it to load
      if (typeof document !== 'undefined') {
        await new Promise((resolve, reject) => {
          const existing = document.querySelector('script[data-supabase-umd]');
          if (existing) {
            existing.addEventListener('load', () => resolve());
            existing.addEventListener('error', () => reject(new Error('Failed to load supabase UMD')));
            return;
          }
          const s = document.createElement('script');
          s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/dist/umd/supabase.js';
          s.setAttribute('data-supabase-umd', '1');
          s.onload = () => resolve();
          s.onerror = () => reject(new Error('Failed to load supabase UMD'));
          document.head.appendChild(s);
        });

        if (typeof window !== 'undefined' && window.supabase) {
          supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
        } else {
          throw new Error('Supabase UMD did not expose `window.supabase`');
        }
      } else {
        throw new Error('No DOM available to load Supabase UMD and dynamic import failed');
      }
    }
  } catch (e) {
    console.error('Failed to initialize Supabase client:', e);
    // Keep supabase null — consumers should handle the absence
  }
}

// Expose globally for non-module pages
if (typeof window !== 'undefined' && supabase) {
  window.supabase = supabase;
}

export { supabase };

export async function getSession() {
  if (!supabase) return { session: null, error: new Error('Supabase client not initialized') };
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return { session: null, error };
    return { session: data.session, error: null };
  } catch (e) {
    return { session: null, error: e };
  }
}
