export interface HealthFormData {
  id?: string;
  employeeId?: string;
  workerName?: string;
  documentNumber?: string;
  epsName: string;
  epsRegime?: string; // Contributivo, Subsidiado, Especial
  arlName?: string;
  pensionFund?: string;
  severanceFund?: string;
  compensationBox?: string;
  affiliationDate?: string;
  certificateUrl?: string;
  rawText?: string;
}
