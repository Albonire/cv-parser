import { ExtractedDocumentData } from '../../types/reader';
import { readDocxFile } from './docx-reader';
import { readPdfFile } from './pdf-reader';
import { performOcr } from './tesseract-worker';
import { classifyDocumentType } from './document-classifier';
import { parseCvText } from './parser-cv';
import { parseContractText } from './parser-contract';
import { parseIdCardText } from './parser-id';
import { parseHealthText } from './parser-health';

/**
 * Orquestador principal de lectura y extraccion de documentos en el navegador.
 * 100% Client-side, costo $0, soporte offline.
 */
export async function processDocument(
  file: File,
  onProgress?: (progress: number, message: string) => void
): Promise<ExtractedDocumentData> {
  const startTime = performance.now();
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  let extractedText = '';
  let method: 'pdf_text' | 'pdf_ocr' | 'image_ocr' | 'docx' = 'pdf_text';
  let rawConfidence = 0.95;

  if (onProgress) {
    onProgress(5, `Iniciando analisis de ${file.name}...`);
  }

  // 1. Archivos Word (.docx)
  if (extension === 'docx') {
    method = 'docx';
    if (onProgress) onProgress(30, 'Extrayendo texto del documento Word...');
    const result = await readDocxFile(file);
    extractedText = result.text;
    rawConfidence = 0.98;
  }
  // 2. Archivos PDF
  else if (extension === 'pdf') {
    if (onProgress) onProgress(20, 'Analizando capas del PDF...');
    const pdfResult = await readPdfFile(file, onProgress);

    if (pdfResult.isDigitalText) {
      method = 'pdf_text';
      extractedText = pdfResult.text;
      rawConfidence = 0.96;
    } else if (pdfResult.renderedPages && pdfResult.renderedPages.length > 0) {
      method = 'pdf_ocr';
      if (onProgress) onProgress(50, 'Ejecutando OCR sobre paginas escaneadas...');
      const ocrRes = await performOcr(pdfResult.renderedPages, onProgress);
      extractedText = ocrRes.text;
      rawConfidence = ocrRes.confidence;
    }
  }
  // 3. Imagenes y fotos (JPG, PNG, WEBP, BMP, GIF)
  else if (['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif'].includes(extension)) {
    method = 'image_ocr';
    if (onProgress) onProgress(25, 'Preprocesando imagen y ejecutando OCR...');
    const ocrRes = await performOcr(file, onProgress);
    extractedText = ocrRes.text;
    rawConfidence = ocrRes.confidence;
  } else {
    throw new Error(`Formato no soportado: .${extension}. Use PDF, DOCX, JPG, PNG, WEBP o GIF.`);
  }

  if (onProgress) {
    onProgress(90, 'Clasificando y estructurando campos del formulario...');
  }

  // 4. Clasificar tipo de documento
  const detectedType = classifyDocumentType(extractedText);

  // 5. Extraer segun tipo detectado
  const candidateData = detectedType === 'cv' ? parseCvText(extractedText) : undefined;
  const contractData = detectedType === 'contract' ? parseContractText(extractedText) : undefined;
  const idCardData = detectedType === 'id_card' ? parseIdCardText(extractedText) : undefined;
  const healthData = detectedType === 'health' ? parseHealthText(extractedText) : undefined;

  // 6. Calculo de Score de Confianza Real y Compuesto
  const warnings: string[] = [];
  let compositeConfidence = rawConfidence;

  if (detectedType === 'cv' && candidateData) {
    let score = (rawConfidence * 0.3); // 30% base de claridad OCR

    if (candidateData.firstNames || candidateData.lastNames) {
      score += 0.25;
    } else {
      warnings.push('No se detectó el nombre del candidato en el encabezado. Ingréselo manualmente.');
    }

    if (candidateData.email || candidateData.phone) {
      score += 0.20;
    } else {
      warnings.push('No se detectó información de contacto (email ni teléfono).');
    }

    if (candidateData.experience.length > 0 || candidateData.education.length > 0) {
      score += 0.15;
    }

    if (candidateData.skills.length > 0 || candidateData.summary) {
      score += 0.10;
    }

    compositeConfidence = Math.min(1.0, Math.max(0.2, score));
  }

  if (extractedText.length < 40) {
    warnings.push('Poco texto detectado en el documento. Verifique la calidad del escaneo.');
    compositeConfidence = Math.min(compositeConfidence, 0.4);
  }

  const durationMs = Math.round(performance.now() - startTime);

  if (onProgress) {
    onProgress(100, 'Extraccion completada con exito.');
  }

  return {
    detectedType,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type || extension,
    extractedText,
    confidenceScore: compositeConfidence,
    processingTimeMs: durationMs,
    method,
    candidateData,
    contractData,
    idCardData,
    healthData,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

export * from './skills-taxonomy';
export * from './pdf-reader';
export * from './docx-reader';
export * from './tesseract-worker';
export * from './document-classifier';
export * from './parser-cv';
export * from './parser-contract';
export * from './parser-id';
export * from './parser-health';
