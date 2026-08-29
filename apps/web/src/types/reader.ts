import { CandidateFormData } from './candidate';
import { ContractFormData } from './contract';
import { IdCardFormData } from './id-card';
import { HealthFormData } from './health';

export type DetectedDocumentType = 'cv' | 'contract' | 'id_card' | 'health' | 'unknown';

/** Confianza de un campo concreto, para resaltarlo en el formulario de revision. */
export interface FieldConfidence {
  field: string;
  label: string;
  level: 'alta' | 'media' | 'baja' | 'vacio';
}

export interface ExtractedDocumentData {
  detectedType: DetectedDocumentType;
  fileName: string;
  fileSize: number;
  fileType: string;
  extractedText: string;
  confidenceScore: number;
  processingTimeMs: number;
  method: 'pdf_text' | 'pdf_ocr' | 'image_ocr' | 'docx';
  candidateData?: CandidateFormData;
  contractData?: ContractFormData;
  idCardData?: IdCardFormData;
  healthData?: HealthFormData;
  warnings?: string[];
  /** Confianza por campo (RN-7: resaltar lo dudoso antes de guardar). */
  fieldConfidence?: FieldConfidence[];
  /** Cargo principal y familias detectadas contra el diccionario configurable. */
  detectedRoles?: {
    cargoPrincipal: string;
    familiaPrincipal: string;
    cargos: { cargo: string; familia: string | null }[];
  };
}

export interface BatchItem {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'done' | 'error';
  progress: number;
  error?: string;
  result?: ExtractedDocumentData;
}
