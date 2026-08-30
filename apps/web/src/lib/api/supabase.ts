import { createClient } from '@supabase/supabase-js';

/**
 * Cliente unico de Supabase. Mientras no haya credenciales configuradas la
 * aplicacion trabaja solo contra IndexedDB: la cola de sincronizacion consulta
 * `isSupabaseConfigured` antes de intentar subir nada, en vez de apuntar a un
 * host de relleno y acumular errores de red.
 */
export const isSupabaseConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY
);

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key'
);
