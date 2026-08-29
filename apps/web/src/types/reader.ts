import { CandidateFormData } from './candidate';
import { ContractFormData } from './contract';
import { IdCardFormData } from './id-card';
import { HealthFormData } from './health';

export type DetectedDocumentType = 'cv' | 'contract' | 'id_card' | 'health' | 'unknown';

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
}

export interface BatchItem {
  id: string;
  file: File;
  status: 'pending' | 'processing' | 'done' | 'error';
  progress: number;
  error?: string;
  result?: ExtractedDocumentData;
}
