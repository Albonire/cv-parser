import { DocumentLayout, layoutFromPlainText } from './layout';

export interface TxtExtractionResult {
  text: string;
  layout: DocumentLayout;
}

/**
 * Extrae el contenido de un archivo de texto plano (.txt) como UTF-8.
 * Es un documento de texto nativo: no pasa por OCR y conserva el orden de
 * lectura original. La maquetacion se reconstruye con `layoutFromPlainText`,
 * el mismo camino que usa el .docx.
 */
export async function readTxtFile(file: File | ArrayBuffer): Promise<TxtExtractionResult> {
  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
  const text = new TextDecoder('utf-8').decode(arrayBuffer);

  // Descarta el BOM si lo trae el archivo.
  const sinBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  return {
    text: sinBom.trim(),
    layout: layoutFromPlainText(sinBom),
  };
}
