export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'review'
  | 'login'
  | 'logout'
  | 'export'
  | 'settings'
  | 'other';

export interface AuditLogItem {
  id?: number;
  user: string;
  action: AuditAction;
  tableName: string;
  recordId?: string;
  details?: string;
  createdAt: string;
}