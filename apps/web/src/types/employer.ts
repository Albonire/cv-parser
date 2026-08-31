export interface EmployerConfig {
  id: string;
  businessName: string;
  nit: string;
  legalRepresentative?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  website?: string;
  noticeDaysDefault: number;
  trialPeriodMonthsDefault: number;
  memoWarningThreshold: number;
  alertRecipients: string[];
  updatedAt?: string;
}

export const EMPLOYER_ID_DEFAULT = 'rosimar-sas';

export const DEFAULT_EMPLOYER: EmployerConfig = {
  id: EMPLOYER_ID_DEFAULT,
  businessName: 'Rosimar S.A.S.',
  nit: '',
  legalRepresentative: '',
  address: 'Pamplona, Norte de Santander',
  phone: '',
  email: '',
  logoUrl: '',
  website: '',
  noticeDaysDefault: 30,
  trialPeriodMonthsDefault: 2,
  memoWarningThreshold: 3,
  alertRecipients: [],
};