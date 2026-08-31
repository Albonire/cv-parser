export type UserRole = 'admin' | 'rrhh' | 'reclutador' | 'consulta';

export interface SessionUser {
  role: UserRole;
  name: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrador',
  rrhh: 'Recursos Humanos',
  reclutador: 'Reclutador',
  consulta: 'Consulta',
};

export const ROLE_OPTIONS: SessionUser[] = [
  { role: 'admin', name: 'Administrador' },
  { role: 'rrhh', name: 'Recursos Humanos' },
  { role: 'reclutador', name: 'Reclutador' },
  { role: 'consulta', name: 'Consulta' },
];