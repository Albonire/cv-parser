import { db } from './offline/db';
import { AuditAction, AuditLogItem } from '../types/audit';
import { getSessionUser } from './employer';

/**
 * Registra una entrada de auditoria en IndexedDB (y en la cola de sync).
 * Es una traza de solo escritura: nadie la modifica desde la UI.
 */
export async function writeAudit(
  action: AuditAction,
  tableName: string,
  recordId?: string,
  details?: string,
): Promise<void> {
  try {
    const user = getSessionUser();
    const entry: AuditLogItem = {
      user: user?.name ?? 'Administrador',
      action,
      tableName,
      recordId,
      details,
      createdAt: new Date().toISOString(),
    };
    await db.auditLog.add(entry);
    // La cola local no tiene tabla de auditoria en SQL (se sincroniza solo el
    // registro nominal); no se encola para evitar multiplicar fallos de sync.
  } catch (err) {
    console.error('Error escribiendo auditoria:', err);
  }
}