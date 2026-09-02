import { db } from './offline/db';
import { queueMutation } from './offline/sync';
import {
  DEFAULT_EMPLOYER,
  EMPLOYER_ID_DEFAULT,
  EmployerConfig,
} from '../types/employer';
import { SessionUser, UserRole } from '../types/session';

const SESSION_KEY = 'rosimar-session';
const CLAVE_HASH_KEY = 'rosimar-clave-admin-hash';

/**
 * Aviso importante sobre esta "autenticación".
 *
 * El sistema corre 100% en el navegador, sin servidor, así que esto NO es un
 * control de seguridad: es un seguro contra ediciones accidentales. Quien abra
 * las herramientas del navegador puede reescribir el hash de `localStorage` y
 * entrar igual. No protege los datos frente a alguien que quiera saltárselo.
 *
 * La autorización de verdad llega cuando se conecte Supabase Auth: las
 * políticas RLS por rol ya están escritas en
 * `supabase/migrations/002_sync_schema.sql` y se aplican en la base de datos,
 * que es donde no se pueden burlar.
 *
 * Antes había aquí una contraseña por defecto, que además se imprimía en la
 * pantalla de acceso. Ahora la define el administrador en el primer arranque.
 */
export const HAY_CLAVE_DEFINIDA_KEY = CLAVE_HASH_KEY;

function hashPlano(texto: string): string {
  let h = 5381;
  for (let i = 0; i < texto.length; i++) {
    h = ((h << 5) + h + texto.charCodeAt(i)) | 0;
  }
  return 'djb2-' + (h >>> 0).toString(16);
}

/** Hash determinista de una clave: SHA-256 cuando hay contexto seguro, con
 *  respaldo determinista local para navegadores sin crypto.subtle. */
export async function hashDeClave(clave: string): Promise<string> {
  try {
    const subtle = globalThis.crypto?.subtle;
    if (subtle?.digest) {
      const bytes = new TextEncoder().encode(clave);
      const digesto = await subtle.digest('SHA-256', bytes);
      return 'sha256-' + Array.from(new Uint8Array(digesto)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // contexto no seguro en algunos despliegues de red local; se usa el respaldo
  }
  return hashPlano(clave);
}

export function hashClaveGuardada(): string | null {
  try {
    return localStorage.getItem(CLAVE_HASH_KEY);
  } catch {
    return null;
  }
}

/** Si aun no se ha definido ninguna clave, el primer acceso la establece. */
export function requiereDefinirClave(): boolean {
  return hashClaveGuardada() === null;
}

export async function verificarClaveAdmin(clave: string): Promise<boolean> {
  if (!clave) return false;
  const guardada = hashClaveGuardada();
  // Sin clave definida no se puede verificar nada: la interfaz debe pedir que
  // se establezca en vez de aceptar una por defecto conocida.
  if (guardada === null) return false;
  return (await hashDeClave(clave)) === guardada;
}

export async function cambiarClaveAdmin(nueva: string): Promise<void> {
  const clave = nueva.trim();
  if (clave.length < 6) {
    throw new Error('La contraseña debe tener al menos 6 caracteres.');
  }
  localStorage.setItem(CLAVE_HASH_KEY, await hashDeClave(clave));
}

export async function getEmployerConfig(): Promise<EmployerConfig> {
  const stored = await db.employers.get(EMPLOYER_ID_DEFAULT);
  return stored ?? DEFAULT_EMPLOYER;
}

export async function saveEmployerConfig(config: EmployerConfig) {
  const toSave: EmployerConfig = { ...config, updatedAt: new Date().toISOString() };
  await db.employers.put(toSave);
  await queueMutation('update', 'employers', toSave.id, toSave as unknown as Record<string, unknown>);
  return toSave;
}

export function getSessionUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SessionUser;
      if (parsed && parsed.role) return parsed;
    }
  } catch {
    // sesion corrupta: se ignora y se exige iniciar sesion de nuevo
  }
  return null;
}

export function setSessionUser(user: SessionUser) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearSessionUser() {
  localStorage.removeItem(SESSION_KEY);
}

export function canManage(role: UserRole): boolean {
  return role === 'admin' || role === 'rrhh';
}

export function canRecruit(role: UserRole): boolean {
  return role === 'admin' || role === 'rrhh' || role === 'reclutador';
}

export function canViewReports(role: UserRole): boolean {
  return role === 'admin' || role === 'rrhh' || role === 'consulta';
}