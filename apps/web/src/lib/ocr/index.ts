import { ExtractedDocumentData, FieldConfidence } from '../../types/reader';
import { CandidateFormData } from '../../types/candidate';
import { readDocxFile } from './docx-reader';
import { readPdfFile } from './pdf-reader';
import { performOcr } from './tesseract-worker';
import { classifyDocumentType } from './document-classifier';
import { parseCvText } from './parser-cv';
import { parseContractText } from './parser-contract';
import { parseIdCardText } from './parser-id';
import { parseHealthText } from './parser-health';
import { parseLiquidacionText } from './parser-liquidacion';
import { parseMemorandoText } from './parser-memorando';
import { parseFuncionesText } from './parser-funciones';
import { detectarCargos } from './cargos';
import { clasificarHistorial } from './document-classifier';
import { DocumentLayout, layoutFromPlainText } from './layout';

const EXTENSIONES_IMAGEN = ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tif', 'tiff'];

/**
 * Orquestador de lectura y extraccion de documentos. Todo corre en el navegador
 * (costo $0) y de forma determinista: sin modelos de lenguaje.
 */
export async function processDocument(
  file: File,
  onProgress?: (progress: number, message: string) => void
): Promise<ExtractedDocumentData> {
  const startTime = performance.now();
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  let extractedText = '';
  let layout: DocumentLayout | undefined;
  let method: ExtractedDocumentData['method'] = 'pdf_text';
  let rawConfidence = 0.95;

  onProgress?.(5, `Iniciando analisis de ${file.name}...`);

  if (extension === 'docx') {
    method = 'docx';
    onProgress?.(30, 'Extrayendo texto del documento Word...');
    const result = await readDocxFile(file);
    extractedText = result.text;
    layout = layoutFromPlainText(result.text);
    rawConfidence = 0.98;
  } else if (extension === 'pdf') {
    onProgress?.(20, 'Analizando capas del PDF...');
    const pdfResult = await readPdfFile(file, onProgress);

    if (pdfResult.isDigitalText) {
      method = 'pdf_text';
      extractedText = pdfResult.text;
      layout = pdfResult.layout;
      rawConfidence = 0.96;
    } else if (pdfResult.renderedPages && pdfResult.renderedPages.length > 0) {
      method = 'pdf_ocr';
      onProgress?.(50, 'Ejecutando OCR sobre paginas escaneadas...');
      const ocrRes = await performOcr(pdfResult.renderedPages, onProgress);
      extractedText = ocrRes.text;
      layout = ocrRes.layout;
      rawConfidence = ocrRes.confidence;
    }
  } else if (EXTENSIONES_IMAGEN.includes(extension)) {
    method = 'image_ocr';
    onProgress?.(25, 'Preprocesando imagen y ejecutando OCR...');
    const ocrRes = await performOcr(file, onProgress);
    extractedText = ocrRes.text;
    layout = ocrRes.layout;
    rawConfidence = ocrRes.confidence;
  } else {
    throw new Error(
      `Formato no soportado: .${extension}. Use PDF, DOCX, JPG, PNG, WEBP, BMP, GIF o TIFF.`
    );
  }

  onProgress?.(90, 'Clasificando y estructurando campos del formulario...');

  const detectedType = classifyDocumentType(extractedText);
  const categoria = clasificarHistorial(extractedText);

  const candidateData = detectedType === 'cv' ? parseCvText(extractedText, layout) : undefined;
  const contractData = detectedType === 'contract' ? parseContractText(extractedText, layout) : undefined;
  const idCardData = detectedType === 'id_card' ? parseIdCardText(extractedText) : undefined;
  const healthData = detectedType === 'health' ? parseHealthText(extractedText) : undefined;
  const liquidacionData =
    detectedType === 'liquidacion' ? parseLiquidacionText(extractedText) : undefined;
  // Memorando / llamado de atencion y funciones de cargo no tienen formulario
  // propio (detectedType 'unknown') pero se estructuran para registrarlos en sus
  // tablas y en la ficha del empleado.
  const memorandoData =
    categoria === 'memorando' || categoria === 'llamado_atencion'
      ? parseMemorandoText(extractedText)
      : undefined;
  const funcionesData =
    categoria === 'funciones' ? parseFuncionesText(extractedText) : undefined;

  const { confidence, warnings, fieldConfidence } = evaluarCalidad(
    detectedType,
    candidateData,
    extractedText,
    rawConfidence
  );

  onProgress?.(100, 'Extraccion completada con exito.');

  return {
    detectedType,
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type || extension,
    extractedText,
    confidenceScore: confidence,
    processingTimeMs: Math.round(performance.now() - startTime),
    method,
    candidateData,
    contractData,
    idCardData,
    healthData,
    liquidacionData,
    memorandoData,
    funcionesData,
    warnings: warnings.length > 0 ? warnings : undefined,
    fieldConfidence,
    detectedRoles: candidateData ? detectarCargos(candidateData.experience) : undefined,
  };
}

/** Campos clave de una hoja de vida y su peso en el puntaje de confianza. */
const CAMPOS_CLAVE: { field: keyof CandidateFormData; label: string; peso: number }[] = [
  { field: 'firstNames', label: 'Nombres', peso: 0.14 },
  { field: 'lastNames', label: 'Apellidos', peso: 0.14 },
  { field: 'documentNumber', label: 'Numero de documento', peso: 0.1 },
  { field: 'email', label: 'Correo electronico', peso: 0.08 },
  { field: 'phone', label: 'Telefono', peso: 0.08 },
  { field: 'cityResidence', label: 'Ciudad de residencia', peso: 0.06 },
  { field: 'headline', label: 'Cargo o titular', peso: 0.05 },
  { field: 'experience', label: 'Experiencia laboral', peso: 0.1 },
  { field: 'education', label: 'Formacion academica', peso: 0.1 },
  { field: 'skills', label: 'Habilidades', peso: 0.05 },
];

/**
 * Calcula la confianza compuesta y marca que campos quedaron vacios o dudosos,
 * que es lo que la persona de RRHH debe revisar antes de guardar (RN-7).
 */
function evaluarCalidad(
  detectedType: ExtractedDocumentData['detectedType'],
  candidato: CandidateFormData | undefined,
  texto: string,
  confianzaOcr: number
): { confidence: number; warnings: string[]; fieldConfidence: FieldConfidence[] } {
  const warnings: string[] = [];
  const fieldConfidence: FieldConfidence[] = [];

  if (texto.trim().length < 40) {
    warnings.push('Se reconocio muy poco texto. Verifique la calidad del escaneo o la foto.');
  }

  if (detectedType !== 'cv' || !candidato) {
    return {
      confidence: texto.trim().length < 40 ? Math.min(confianzaOcr, 0.4) : confianzaOcr,
      warnings,
      fieldConfidence,
    };
  }

  // 30% del puntaje viene de la claridad del OCR y 70% de cuantos campos se llenaron.
  let puntaje = confianzaOcr * 0.3;

  for (const campo of CAMPOS_CLAVE) {
    const valor = candidato[campo.field];
    const lleno = Array.isArray(valor) ? valor.length > 0 : Boolean(valor && String(valor).trim());

    if (lleno) {
      puntaje += campo.peso * 0.7;
      fieldConfidence.push({
        field: campo.field,
        label: campo.label,
        level: confianzaOcr >= 0.85 ? 'alta' : 'media',
      });
    } else {
      fieldConfidence.push({ field: campo.field, label: campo.label, level: 'vacio' });
    }
  }

  if (!candidato.firstNames && !candidato.lastNames) {
    warnings.push('No se detecto el nombre del candidato. Escribalo manualmente.');
  }
  if (!candidato.email && !candidato.phone) {
    warnings.push('No se detecto informacion de contacto (ni correo ni telefono).');
  }
  if (candidato.experience.length === 0) {
    warnings.push('No se detecto experiencia laboral. Revise el documento original.');
  }
  if (confianzaOcr < 0.7) {
    warnings.push(
      'La calidad del reconocimiento es baja. Revise campo por campo antes de guardar.'
    );
  }

  const confianza = Math.min(1, Math.max(0.2, puntaje));

  return {
    confidence: texto.trim().length < 40 ? Math.min(confianza, 0.4) : confianza,
    warnings,
    fieldConfidence,
  };
}

export * from './skills-taxonomy';
export * from './layout';
export * from './pdf-reader';
export * from './docx-reader';
export * from './tesseract-worker';
export * from './document-classifier';
export * from './sections';
export * from './cargos';
export * from './parser-cv';
export * from './parser-contract';
export * from './parser-id';
export * from './parser-health';
export * from './parser-liquidacion';
export * from './parser-memorando';
export * from './parser-funciones';
export * from './extraer-zip';
