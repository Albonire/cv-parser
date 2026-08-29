import mammoth from 'mammoth';

export interface DocxExtractionResult {
  text: string;
  rawHtml?: string;
  messages: string[];
}

/**
 * Extrae texto plano formateado desde archivos Word (.docx) usando mammoth.js
 */
export async function readDocxFile(file: File | ArrayBuffer): Promise<DocxExtractionResult> {
  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;

  const result = await mammoth.extractRawText({ arrayBuffer });
  const htmlResult = await mammoth.convertToHtml({ arrayBuffer });

  const messages = result.messages.map((m) => m.message);

  return {
    text: result.value.trim(),
    rawHtml: htmlResult.value,
    messages,
  };
}
