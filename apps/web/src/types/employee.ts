import { CandidateFormData } from './candidate';
import { HealthFormData } from './health';
import { ContractFormData } from './contract';
import { MemorandumItem } from './memorandum';

export type EmployeeStatus = 'activo' | 'inactivo';

export type TerminationReason =
  | 'renuncia'
  | 'terminacion_unilateral_empleador'
  | 'mutuo_acuerdo'
  | 'finalizacion_obra'
  | 'jubilacion'
  | 'despido_justificado'
  | 'despido_no_justificado'
  | 'fallecimiento'
  | 'otra';

export interface EmployeeItem {
  id: string;
  candidateId?: string;
  employeeCode: string;
  status: EmployeeStatus;
  hireDate: string;
  terminationDate?: string;
  terminationReason?: TerminationReason;
  photoUrl?: string;
  candidateData: CandidateFormData;
  healthData?: HealthFormData;
  activeContract?: ContractFormData;
  contracts?: ContractFormData[];
  memoranda?: MemorandumItem[];
  memoCount: number;
  createdAt: string;
  updatedAt: string;
}
