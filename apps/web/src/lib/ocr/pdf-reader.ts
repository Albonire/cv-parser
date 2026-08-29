import * as pdfjsLib from 'pdfjs-dist';
import { sortTextItemsByColumns, TextItemWithCoords } from './column-layout';

// Configurar worker de pdfjs
// En entornos modernos con Vite, podemos usar el worker empaquetado o CDN de respaldo
if (typeof window !== 'undefined' && 'Worker' in window) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    // Respaldo CDN seguro si falla resolucion relativa
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
  }
}

export interface PdfExtractionResult {
  isDigitalText: boolean;
  pageCount: number;
  text: string;
  renderedPages?: Blob[];
}

/**
 * Lee un archivo PDF. Si tiene capa de texto digital, la extrae ordenando columnas.
 * Si es un escaneo, renderiza cada pagina a Canvas (180 DPI) y retorna los Blobs.
 */
export async function readPdfFile(
  file: File | ArrayBuffer,
  onProgress?: (progress: number, message: string) => void
): Promise<PdfExtractionResult> {
  const arrayBuffer = file instanceof File ? await file.arrayBuffer() : file;
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const pageCount = pdf.numPages;

  let totalChars = 0;
  const pageTexts: string[] = [];
  const scannedPages: Blob[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    if (onProgress) {
      onProgress(
        Math.round((pageNum / pageCount) * 50),
        `Analizando pagina ${pageNum} de ${pageCount}...`
      );
    }

    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();

    const items: TextItemWithCoords[] = [];

    for (const rawItem of textContent.items) {
      if ('str' in rawItem && rawItem.str.trim().length > 0) {
        // En PDF.js transform = [scaleX, skewY, skewX, scaleY, translateX, translateY]
        const tx = rawItem.transform;
        const x = tx[4];
        // En PDF Y crece hacia arriba; convertimos a coordenadas de pantalla (arriba hacia abajo)
        const y = viewport.height - tx[5];
        const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
        const isBold =
          ('fontName' in rawItem &&
            typeof rawItem.fontName === 'string' &&
            /bold|black|heavy/i.test(rawItem.fontName)) ||
          false;

        items.push({
          text: rawItem.str,
          x,
          y,
          width: rawItem.width || 0,
          height: rawItem.height || fontSize,
          fontSize,
          isBold,
        });

        totalChars += rawItem.str.length;
      }
    }

    if (items.length > 0) {
      const sortedPageText = sortTextItemsByColumns(items, viewport.width);
      pageTexts.push(sortedPageText);
    }
  }

  // Umbral: si hay al menos 60 caracteres por pagina en promedio, se considera digital
  const avgChars = totalChars / Math.max(1, pageCount);
  const isDigital = avgChars >= 60;

  if (isDigital) {
    return {
      isDigitalText: true,
      pageCount,
      text: pageTexts.join('\n\n--- PAGINA ---\n\n').trim(),
    };
  }

  // Si no es digital, renderizamos las paginas a Canvas para OCR
  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    if (onProgress) {
      onProgress(
        50 + Math.round((pageNum / pageCount) * 40),
        `Renderizando pagina ${pageNum} para OCR...`
      );
    }

    const page = await pdf.getPage(pageNum);
    // Escala 2.5 para ~180-200 DPI (resolucion optima de Tesseract)
    const viewport = page.getViewport({ scale: 2.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      const renderContext = {
        canvasContext: ctx,
        viewport,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (page.render(renderContext as any) as any).promise;

      const pageBlob = await new Promise<Blob | null>((res) =>
        canvas.toBlob((b) => res(b), 'image/png', 0.95)
      );

      if (pageBlob) {
        scannedPages.push(pageBlob);
      }
    }
  }

  return {
    isDigitalText: false,
    pageCount,
    text: '',
    renderedPages: scannedPages,
  };
}
