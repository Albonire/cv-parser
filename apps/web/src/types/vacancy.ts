export type VacancyStatus = 'borrador' | 'abierta' | 'en_proceso' | 'cerrada' | 'cancelada';

export type RequirementType = 'habilidad' | 'experiencia' | 'educacion' | 'otro';

export interface VacancyRequirement {
  id?: string;
  skillOrReq: string;
  weight: number;
  reqType: RequirementType;
}

export interface CandidateRanking {
  id?: string;
  vacancyId: string;
  candidateId: string;
  score: number;
  matchedSkills?: string[];
  matchedEducation?: string[];
  matchedExperience?: string[];
  manualRating?: number;
  notes?: string;
  createdAt?: string;
}

export interface VacancyFormData {
  id?: string;
  title: string;
  department?: string;
  location?: string;
  contractType?: string;
  description?: string;
  salaryRange?: string;
  status: VacancyStatus;
  requirements: VacancyRequirement[];
  rankings?: CandidateRanking[];
  createdAt?: string;
  updatedAt?: string;
}