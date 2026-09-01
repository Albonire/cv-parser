export type ContractType =
  | 'termino_fijo'
  | 'indefinido'
  | 'obra_labor'
  | 'aprendizaje'
  | 'tiempo_parcial'
  | 'otro';

export type PaymentFrequency = 'quincenal' | 'mensual' | 'otro';

export type ContractStatus =
  | 'vigente'
  | 'por_vencer'
  | 'vencido'
  | 'terminado'
  | 'cancelado'
  | 'prorroga';

export interface ContractRenewal {
  id?: string;
  contractId: string;
  renewalNumber: number;
  newEndDate: string;
  extendedMonths: number;
  effectiveDate: string;
  documentUrl?: string;
  notes?: string;
  createdAt?: string;
}

export interface ContractFormData {
  id?: string;
  employeeId?: string;
  employeeName?: string;
  employerName: string;
  employerNit: string;
  employerAddress?: string;
  employerEmail?: string;
  workerName: string;
  workerDateOfBirth?: string;
  workerDocumentNumber: string;
  workerAddress?: string;
  workerEmail?: string;
  position: string;
  salary: number;
  currency: string;
  paymentFrequency: PaymentFrequency;
  contractType: ContractType;
  durationMonths?: number;
  startDate: string;
  endDate?: string;
  trialPeriodDays: number;
  noticeDays: number;
  executionPlace: string;
  signedDocumentUrl?: string;
  status: ContractStatus;
  renewals?: ContractRenewal[];
  createdAt?: string;
  updatedAt?: string;
}
