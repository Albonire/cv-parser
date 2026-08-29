export type MemorandumType =
  | 'llamado_atencion'
  | 'amonestacion_preventiva'
  | 'amonestacion_disciplinaria'
  | 'otro';

export type MemorandumStatus =
  | 'registrado'
  | 'en_revision_contrato'
  | 'archivado';

export interface MemorandumItem {
  id: string;
  employeeId: string;
  employeeName?: string;
  memoType: MemorandumType;
  subject: string;
  description: string;
  memoDate: string;
  responsiblePerson: string;
  attachmentUrl?: string;
  status: MemorandumStatus;
  createdAt: string;
}
