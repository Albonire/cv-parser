import { createWorker } from 'tesseract.js';
import { preprocessImage } from './image-prep';

let globalWorker: any = null;

export async function getTesseractWorker(onProgress?: (progress: number, message: string) => void) {
  if (!globalWorker) {
    if (onProgress) onProgress(10, 'Cargando motor de OCR (WebAssembly spa+eng)...');
    globalWorker = await createWorker('spa+eng');
  }
  return globalWorker;
}

export interface OcrExecutionResult {
  text: string;
  confidence: number;
}

/**
 * Ejecuta OCR sobre uno o varios archivos, blobs o canvas
 */
export async function performOcr(
  input: File | Blob | HTMLCanvasElement | (File | Blob | HTMLCanvasElement)[],
  onProgress?: (progress: number, message: string) => void
): Promise<OcrExecutionResult> {
  const worker = await getTesseractWorker(onProgress);
  const items = Array.isArray(input) ? input : [input];

  let fullText = '';
  let totalConfidence = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const progressBase = Math.round((i / items.length) * 60) + 20;

    if (onProgress) {
      onProgress(progressBase, `Reconociendo texto en pagina ${i + 1} de ${items.length}...`);
    }

    let imageToProcess: any = item;

    // Si es un archivo o Blob en el navegador, preprocesar con Canvas
    if (typeof window !== 'undefined' && (item instanceof File || item instanceof Blob)) {
      try {
        const prepBlob = await preprocessImage(item);
        imageToProcess = prepBlob;
      } catch (e) {
        console.warn('Preprocesamiento de canvas omitido:', e);
        imageToProcess = item;
      }
    }

    const { data } = await worker.recognize(imageToProcess);
    fullText += (i > 0 ? '\n\n--- PAGINA ' + (i + 1) + ' ---\n\n' : '') + data.text;
    totalConfidence += data.confidence;
  }

  const avgConfidence = items.length > 0 ? totalConfidence / items.length : 0;

  return {
    text: fullText,
    confidence: avgConfidence / 100,
  };
}
