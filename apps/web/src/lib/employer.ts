import { db } from './offline/db';
import { queueMutation } from './offline/sync';
import {
  DEFAULT_EMPLOYER,
  EMPLOYER_ID_DEFAULT,
  EmployerConfig,
} from '../types/employer';
import { SessionUser, UserRole } from '../types/session';

const SESSION_KEY = 'rosimar-session';

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

export function getSessionUser(): SessionUser {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw) as SessionUser;
  } catch {
    // sesion corrupta: se ignora y se usa el rol por defecto
  }
  return { role: 'admin', name: 'Administrador' };
}

export function setSessionUser(user: SessionUser) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
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