import { CandidateFormData } from './candidate';
import { ContractFormData } from './contract';
import { IdCardFormData } from './id-card';
import { HealthFormData } from './health';
import { LiquidacionFormData } from './liquidacion';

export type DetectedDocumentType = 'cv' | 'contract' | 'id_card' | 'health' | 'liquidacion' | 'unknown';

/** Confianza de un campo concreto, para resaltarlo en el formulario de revision. */
export interface FieldConfidence {
  field: string;
  label: string;
  level: 'alta' | 'media' | 'baja' | 'vacio';
}

/** Datos estructurados de un memorando / llamado de atencion leido por OCR. */
export interface MemorandoOCR {
  workerName?: string;
  workerDocumentNumber?: string;
  subject?: string;
  description?: string;
  memoType?: 'llamado_atencion' | 'amonestacion_preventiva' | 'amonestacion_disciplinaria' | 'otro';
  memoDate?: string;
  responsiblePerson?: string;
}

/** Funciones de cargo detectadas en un documento de "funciones del puesto". */
export interface FuncionesOCR {
  workerName?: string;
  workerDocumentNumber?: string;
  position?: string;
  funciones: string[];
}

export interface ExtractedDocumentData {
  detectedType: DetectedDocumentType;
  fileName: string;
  fileSize: number;
  fileType: string;
  extractedText: string;
  confidenceScore: number;
  processingTimeMs: number;
  method: 'pdf_text' | 'pdf_ocr' | 'image_ocr' | 'docx' | 'txt';
  candidateData?: CandidateFormData;
  contractData?: ContractFormData;
  idCardData?: IdCardFormData;
  healthData?: HealthFormData;
  liquidacionData?: LiquidacionFormData;
  memorandoData?: MemorandoOCR;
  funcionesData?: FuncionesOCR;
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
