import Dexie, { Table } from 'dexie';
import { CandidateFormData } from '../../types/candidate';
import { ContractFormData } from '../../types/contract';
import { EmployeeItem } from '../../types/employee';
import { MemorandumItem } from '../../types/memorandum';
import { AlertItem } from '../../types/alert';
import { IdCardFormData } from '../../types/id-card';
import { HealthFormData } from '../../types/health';

export interface SyncQueueItem {
  id?: number;
  action: 'create' | 'update' | 'delete';
  tableName: string;
  recordId: string;
  payload: Record<string, unknown>;
  timestamp: string;
  synced: boolean;
}

export class TalentDatabase extends Dexie {
  candidates!: Table<CandidateFormData, string>;
  employees!: Table<EmployeeItem, string>;
  contracts!: Table<ContractFormData, string>;
  memoranda!: Table<MemorandumItem, string>;
  alerts!: Table<AlertItem, string>;
  idCards!: Table<IdCardFormData, string>;
  healthAffiliations!: Table<HealthFormData, string>;
  syncQueue!: Table<SyncQueueItem, number>;

  constructor() {
    super('RosimarTalentDB');

    this.version(2).stores({
      candidates: 'id, documentNumber, status, firstNames, lastNames, email, phone, createdAt',
      employees: 'id, employeeCode, status, candidateId, hireDate, memoCount',
      contracts: 'id, employeeId, workerDocumentNumber, status, startDate, endDate',
      memoranda: 'id, employeeId, memoType, memoDate, status',
      alerts: 'id, employeeId, alertType, severity, status, dueDate',
      idCards: 'id, documentNumber',
      healthAffiliations: 'id, documentNumber, epsName',
      syncQueue: '++id, action, tableName, recordId, timestamp, synced',
    });
  }
}

export const db = new TalentDatabase();
