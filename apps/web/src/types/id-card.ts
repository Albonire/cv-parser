export interface IdCardFormData {
  id?: string;
  documentType: 'CC' | 'CE' | 'TI' | 'PAS' | 'PEP' | 'PPT' | 'OTRO';
  documentNumber: string;
  firstNames: string;
  lastNames: string;
  birthDate?: string;
  expeditionPlace?: string;
  address?: string;
  gender?: string;
  rawText?: string;
}
