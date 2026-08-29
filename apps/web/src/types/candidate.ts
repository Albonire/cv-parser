export type DocumentType = 'CC' | 'CE' | 'TI' | 'PAS' | 'PEP' | 'PPT' | 'OTRO';

export type CandidateStatus =
  | 'nuevo'
  | 'en_revision'
  | 'preseleccionado'
  | 'en_entrevista'
  | 'descartado'
  | 'contratado'
  | 'archivado';

export interface EducationItem {
  id?: string;
  level: string; // Primaria, Bachiller, Tecnico, Tecnologo, Universitario, Posgrado, Diplomado
  institution: string;
  degree: string;
  fieldOfStudy?: string;
  startYear?: string;
  endYear?: string;
  isCurrent?: boolean;
  honors?: string;
}

export interface ExperienceItem {
  id?: string;
  company: string;
  position: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  responsibilities?: string;
  technologies?: string[];
}

export interface SkillItem {
  id?: string;
  category: string;
  skillName: string;
  level?: string;
}

export interface LanguageItem {
  id?: string;
  language: string;
  level: string; // Basico, Intermedio, Avanzado, Nativo, A1, A2, B1, B2, C1, C2
}

export interface CertificationItem {
  id?: string;
  name: string;
  institution?: string;
  year?: string;
  credentialId?: string;
}

export interface ReferenceItem {
  id?: string;
  referenceType: 'familiar' | 'personal' | 'laboral';
  name: string;
  relationship?: string;
  phone: string;
  company?: string;
  position?: string;
}

export interface CandidateFormData {
  id?: string;
  firstNames: string;
  lastNames: string;
  documentType: DocumentType;
  documentNumber: string;
  birthDate?: string;
  nationality: string;
  birthPlace?: string;
  cityResidence?: string;
  address?: string;
  phone: string;
  email: string;
  maritalStatus?: string;
  gender?: string;
  driverLicense?: string;
  militaryCard?: string;
  professionalCard?: string;
  socialLinks?: string[];
  photoUrl?: string;
  headline?: string;
  summary?: string;
  salaryExpectation?: number;
  availability?: string;
  status: CandidateStatus;
  education: EducationItem[];
  experience: ExperienceItem[];
  skills: SkillItem[];
  languages?: LanguageItem[];
  certifications?: CertificationItem[];
  references: ReferenceItem[];
  originalDocumentUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}
